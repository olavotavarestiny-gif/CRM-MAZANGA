const { createLocalJWKSet, createRemoteJWKSet, jwtVerify } = require('jose');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

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
  const remoteJwks = getRemoteJwks();
  const jwks = remoteJwks ?? LOCAL_JWKS;
  const issuer = process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/auth/v1` : undefined;
  const { payload } = await jwtVerify(token, jwks, { issuer, audience: 'authenticated' });
  return payload;
}

const USER_SELECT = {
  id: true, name: true, email: true, role: true,
  active: true, accountOwnerId: true, mustChangePassword: true,
  isSuperAdmin: true, permissions: true, supabaseUid: true,
};

// Bootstrap: email that always gets superadmin regardless of DB field value
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'olavo@mazanga.digital';

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  // ── Impersonation token (HS256, signed with JWT_SECRET) ───────────────────
  // We attempt HS256 verification first. If it succeeds and type='impersonation',
  // we use the impersonated user. Otherwise fall through to Supabase JWT.
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    if (decoded.type === 'impersonation') {
      const targetUser = await prisma.user.findUnique({
        where: { id: decoded.impersonatedUserId },
        select: USER_SELECT,
      });
      if (!targetUser || !targetUser.active) {
        return res.status(403).json({ error: 'Utilizador impersonado não encontrado ou inactivo' });
      }
      req.user = {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        isSuperAdmin: targetUser.isSuperAdmin || targetUser.email === SUPER_ADMIN_EMAIL,
        permissionsJson: targetUser.permissions,
        accountOwnerId: targetUser.accountOwnerId || null,
        supabaseUid: targetUser.supabaseUid || null,
        effectiveUserId: targetUser.accountOwnerId || targetUser.id,
        isAccountOwner: !targetUser.accountOwnerId,
        mustChangePassword: targetUser.mustChangePassword,
        impersonatedBy: decoded.impersonatorId,
      };
      return next();
    }
  } catch {
    // Not a valid HS256 token — fall through to Supabase verification
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

  try {
    let user = await prisma.user.findUnique({ where: { supabaseUid }, select: USER_SELECT });

    // Auto-link: first login after migration — supabaseUid not yet linked in DB
    if (!user && jwtEmail) {
      const byEmail = await prisma.user.findUnique({ where: { email: jwtEmail } });
      if (byEmail && !byEmail.supabaseUid) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: { supabaseUid },
          select: USER_SELECT,
        });
        console.log(`[auth] auto-linked supabaseUid for ${jwtEmail}`);
      }
    }

    if (!user || !user.active) {
      return res.status(403).json({ error: 'Conta desactivada. Contacte o administrador.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin || user.email === SUPER_ADMIN_EMAIL,
      permissionsJson: user.permissions,
      accountOwnerId: user.accountOwnerId || null,
      supabaseUid,
      effectiveUserId: user.accountOwnerId || user.id,
      isAccountOwner: !user.accountOwnerId,
      mustChangePassword: user.mustChangePassword,
      impersonatedBy: null,
    };
    next();
  } catch (error) {
    console.error('[auth] DB error:', error.message);
    res.status(500).json({ error: 'Erro ao verificar autenticação' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
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
  if (req.user?.role === 'admin' || req.user?.isAccountOwner) {
    return next();
  }
  return res.status(403).json({ error: 'Acesso não autorizado' });
}

function requireSuperAdmin(req, res, next) {
  if (!req.user?.isSuperAdmin) {
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
