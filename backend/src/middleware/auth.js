const { createLocalJWKSet, createRemoteJWKSet, jwtVerify } = require('jose');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { ACCESS_ROLES, getAccessRole, hasSuperAdminAccess } = require('../lib/roles');
const {
  buildDevAuthRequestUser,
  hasValidDevAuthHeader,
  isDevAuthBypassEnabled,
  isDevAuthWrite,
  runWithDevAuthBypass,
} = require('../lib/dev-auth');

// Dynamic JWKS — fetched from Supabase when SUPABASE_URL is set.
// jose caches and auto-refreshes on key rotation.
let _remoteJwks = null;
function getRemoteJwks() {
  if (!_remoteJwks && process.env.SUPABASE_URL) {
    _remoteJwks = createRemoteJWKSet(
      new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
    );
  }
  return _remoteJwks;
}

// Local fallback JWKS with BOTH known Supabase keys.
// createLocalJWKSet resolves by kid — works regardless of which key Supabase is using.
const LOCAL_JWKS = createLocalJWKSet({
  keys: [
    { // Chave standby (activa agora)
      alg: 'ES256', crv: 'P-256', kty: 'EC',
      kid: 'ad8dfdb2-0ce9-49d3-b9f8-6e889a76b6a0',
      x: 'fMN9KiM8utsDfKKFeOD1rhiXSmkXcx-546QJBgIL4Cg',
      y: 'PdmdVOzbsZYEtGGpw9hs02bkH0qBsTSOVAQHEHYEthc',
    },
    { // Chave primária (anterior)
      alg: 'ES256', crv: 'P-256', kty: 'EC',
      kid: 'bb424079-cb99-41be-97ee-ebd44cbd72d3',
      x: 'zHF8awnfE8CwkcTnZrTpetP8TOzQ-Nvnp6tTtHwcnyQ',
      y: 'sG2mdRZeicP-BLn1G8jXln1t1xNU50wRD6qNftFMRhc',
    },
  ],
});

async function verifySupabaseJwt(token) {
  const issuer = process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/auth/v1` : undefined;
  const options = { issuer, audience: 'authenticated' };

  // Prefer local known keys for stability and speed.
  // If Supabase rotates to a new key, fall back to remote JWKS.
  try {
    const { payload } = await jwtVerify(token, LOCAL_JWKS, options);
    return payload;
  } catch (localError) {
    const remoteJwks = getRemoteJwks();
    if (!remoteJwks) throw localError;

    try {
      const { payload } = await jwtVerify(token, remoteJwks, options);
      return payload;
    } catch (remoteError) {
      // Preserve the original local verification error when both strategies fail.
      throw localError.code === 'ERR_JWKS_NO_MATCHING_KEY' ? remoteError : localError;
    }
  }
}

const USER_SELECT = {
  id: true, name: true, email: true, role: true,
  active: true, accountOwnerId: true, mustChangePassword: true,
  isSuperAdmin: true, permissions: true, supabaseUid: true,
  plan: true, workspaceMode: true, billingType: true,
  trialEndsAt: true, expiresAt: true, graceEndsAt: true, accountStatus: true,
  accountOwner: {
    select: {
      id: true,
      plan: true,
      workspaceMode: true,
      billingType: true,
      trialEndsAt: true,
      expiresAt: true,
      graceEndsAt: true,
      accountStatus: true,
    },
  },
};

const AUTH_USER_CACHE_TTL_MS = Math.max(0, Number(process.env.AUTH_USER_CACHE_TTL_MS || 15_000));
const AUTH_USER_CACHE_MAX_ENTRIES = Math.max(10, Number(process.env.AUTH_USER_CACHE_MAX_ENTRIES || 500));
const authUserCache = new Map();
const authUserLoaders = new Map();

function pruneAuthUserCache() {
  while (authUserCache.size > AUTH_USER_CACHE_MAX_ENTRIES) {
    const oldestKey = authUserCache.keys().next().value;
    if (!oldestKey) break;
    authUserCache.delete(oldestKey);
  }
}

function cloneCachedRequestUser(user) {
  return {
    ...user,
    planContext: user.planContext ? { ...user.planContext } : null,
    subscriptionAccount: user.subscriptionAccount ? { ...user.subscriptionAccount } : null,
  };
}

function getCachedAuthUser(cacheKey) {
  if (!AUTH_USER_CACHE_TTL_MS) return null;
  const entry = authUserCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    authUserCache.delete(cacheKey);
    return null;
  }
  return cloneCachedRequestUser(entry.user);
}

function setCachedAuthUser(cacheKey, requestUser) {
  if (!AUTH_USER_CACHE_TTL_MS || !cacheKey || !requestUser) return;
  authUserCache.set(cacheKey, {
    user: cloneCachedRequestUser(requestUser),
    expiresAt: Date.now() + AUTH_USER_CACHE_TTL_MS,
  });
  pruneAuthUserCache();
}

async function getOrLoadAuthUser(cacheKey, loader) {
  const cachedUser = getCachedAuthUser(cacheKey);
  if (cachedUser) return cachedUser;

  const existingLoader = authUserLoaders.get(cacheKey);
  if (existingLoader) {
    const requestUser = await existingLoader;
    return requestUser ? cloneCachedRequestUser(requestUser) : null;
  }

  const loaderPromise = Promise.resolve()
    .then(loader)
    .then((requestUser) => {
      if (requestUser) {
        setCachedAuthUser(cacheKey, requestUser);
      }
      return requestUser;
    })
    .finally(() => {
      authUserLoaders.delete(cacheKey);
    });

  authUserLoaders.set(cacheKey, loaderPromise);
  const requestUser = await loaderPromise;
  return requestUser ? cloneCachedRequestUser(requestUser) : null;
}

// Bootstrap: emails that always get superadmin regardless of DB field value
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'olavo@kukugest.ao';
const SUPER_ADMIN_EMAILS = [...new Set([SUPER_ADMIN_EMAIL, 'olavo@kukugest.ao'])]
  .map((email) => String(email).trim().toLowerCase())
  .filter(Boolean);
function isBootstrapSuperAdminEmail(email) {
  return SUPER_ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}

function buildSubscriptionAccountSnapshot(account) {
  if (!account) return null;
  return {
    id: account.id,
    plan: account.plan,
    workspaceMode: account.workspaceMode,
    billingType: account.billingType,
    trialEndsAt: account.trialEndsAt,
    expiresAt: account.expiresAt,
    graceEndsAt: account.graceEndsAt,
    accountStatus: account.accountStatus,
  };
}

function buildRequestUser(user, { supabaseUid = null, impersonatedBy = null } = {}) {
  const effectiveAccount = user.accountOwner || user;
  const requestUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin || isBootstrapSuperAdminEmail(user.email),
    permissionsJson: user.permissions,
    accountOwnerId: user.accountOwnerId || null,
    supabaseUid: user.supabaseUid || supabaseUid || null,
    effectiveUserId: user.accountOwnerId || user.id,
    isAccountOwner: !user.accountOwnerId,
    mustChangePassword: user.mustChangePassword,
    impersonatedBy,
    planContext: {
      plan: effectiveAccount.plan || user.plan,
      workspaceMode: effectiveAccount.workspaceMode || user.workspaceMode || 'servicos',
    },
    subscriptionAccount: buildSubscriptionAccountSnapshot(effectiveAccount),
  };
  requestUser.accessRole = getAccessRole(requestUser);
  return requestUser;
}

async function requireAuth(req, res, next) {
  if (isDevAuthBypassEnabled() && hasValidDevAuthHeader(req)) {
    req.user = buildDevAuthRequestUser();

    if (isDevAuthWrite(req) && !String(req.originalUrl || '').startsWith('/api/auth/log-login')) {
      return res.status(403).json({
        error: 'Modo DEV com auth desactivado não permite operações de escrita.',
        code: 'DEV_AUTH_WRITE_BLOCKED',
      });
    }

    return runWithDevAuthBypass(() => next());
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  // ── Impersonation token (HS256, signed with JWT_SECRET) ───────────────────
  // We attempt HS256 verification first. If it succeeds and type='impersonation',
  // we use the impersonated user. Otherwise fall through to Supabase JWT.
  if (process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type === 'impersonation') {
        const cacheKey = `impersonation:${decoded.impersonatedUserId}:${decoded.impersonatorId || ''}`;
        const requestUser = await getOrLoadAuthUser(cacheKey, async () => {
          const targetUser = await prisma.user.findUnique({
            where: { id: decoded.impersonatedUserId },
            select: USER_SELECT,
          });
          if (!targetUser || !targetUser.active) return null;
          return buildRequestUser(targetUser, { impersonatedBy: decoded.impersonatorId });
        });

        if (!requestUser) {
          return res.status(403).json({ error: 'Utilizador impersonado não encontrado ou inactivo' });
        }

        req.user = requestUser;
        return next();
      }
    } catch {
      // Not a valid HS256 token — fall through to Supabase verification
    }
  }

  // ── Supabase JWT (ES256, dynamic JWKS) ───────────────────────────────────
  let decoded;
  try {
    decoded = await verifySupabaseJwt(token);
  } catch (error) {
    console.error('[auth] JWT verify error:', error.code || error.message);
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  const supabaseUid = decoded.sub;
  const jwtEmail = decoded.email;
  const cacheKey = `supabase:${supabaseUid}`;

  try {
    const requestUser = await getOrLoadAuthUser(cacheKey, async () => {
      let user = await prisma.user.findUnique({ where: { supabaseUid }, select: USER_SELECT });

      // Auto-link: first login after migration — supabaseUid not yet linked in DB
      if (!user && jwtEmail) {
        const byEmail = await prisma.user.findUnique({
          where: { email: jwtEmail },
          select: USER_SELECT,
        });
        if (byEmail && !byEmail.supabaseUid) {
          user = await prisma.user.update({
            where: { id: byEmail.id },
            data: { supabaseUid },
            select: USER_SELECT,
          });
          console.log(`[auth] auto-linked supabaseUid for ${jwtEmail}`);
        }
      }

      if (!user) return null;
      if (!user.active) {
        const error = new Error('Conta desactivada. Contacte o administrador.');
        error.statusCode = 403;
        throw error;
      }
      return buildRequestUser(user, { supabaseUid });
    });

    if (!requestUser) {
      return res.status(403).json({ error: 'Utilizador autenticado no Supabase, mas sem registo interno no CRM.' });
    }

    req.user = requestUser;
    next();
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({ error: error.message });
    }
    console.error('[auth] DB error:', error.message);
    res.status(500).json({ error: 'Erro ao verificar autenticação' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.isSuperAdmin && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
}

function requireAccountOwner(req, res, next) {
  if (!req.user?.isAccountOwner) {
    return res.status(403).json({ error: 'Apenas o dono da conta pode realizar esta ação' });
  }
  next();
}

function requireAccountOwnerOrAdmin(req, res, next) {
  if (req.user?.isSuperAdmin || req.user?.role === 'admin' || req.user?.isAccountOwner) {
    return next();
  }
  return res.status(403).json({ error: 'Acesso não autorizado' });
}

function requireSuperAdmin(req, res, next) {
  if (!hasSuperAdminAccess(req.user)) {
    return res.status(403).json({ error: 'Acção reservada ao super-administrador' });
  }
  next();
}

module.exports = requireAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.requireAccountOwner = requireAccountOwner;
module.exports.requireAccountOwnerOrAdmin = requireAccountOwnerOrAdmin;
module.exports.requireSuperAdmin = requireSuperAdmin;
module.exports.SUPER_ADMIN_EMAIL = SUPER_ADMIN_EMAIL;
module.exports.SUPER_ADMIN_EMAILS = SUPER_ADMIN_EMAILS;
module.exports.isBootstrapSuperAdminEmail = isBootstrapSuperAdminEmail;
module.exports.ACCESS_ROLES = ACCESS_ROLES;
module.exports.verifySupabaseJwt = verifySupabaseJwt;
