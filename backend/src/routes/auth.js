const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/auth');
const { isBootstrapSuperAdminEmail, verifySupabaseJwt } = require('../middleware/auth');
const { intersectPermissions, parsePermissions } = require('../lib/permissions');
const { normalizePlan, DEFAULT_PLAN, isSupportedPlan } = require('../lib/plans');
const { getSerializedPlanCatalog } = require('../lib/plan-limits');
const { getSubscriptionState } = require('../lib/subscription-access');
const { DEV_AUTH_PUBLIC_USER } = require('../lib/dev-auth');
const { getAccessRole } = require('../lib/roles');
const { logRouteError } = require('../lib/request-log');
const { getOrganizationModules, resolveFoodAccess, serializeFoodAccess } = require('../lib/food-access');

const DIAGNOSTIC_TIMEOUT_MS = 3500;

function makeRequestId() {
  return `diag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getHost(value) {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function normalizeOrigin(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed.replace(/\/+$/, '')
    : `https://${trimmed.replace(/\/+$/, '')}`;
}

function parseAllowedOrigins(...values) {
  return [...new Set(
    values
      .flatMap((value) => String(value || '').split(/[,\s]+/))
      .map(normalizeOrigin)
      .filter(Boolean)
  )];
}

function isManagedFrontendOrigin(origin) {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    return (
      hostname === 'app.kukugest.ao' ||
      hostname.endsWith('.app.kukugest.ao') ||
      hostname === 'beta.kukugest.ao'
    );
  } catch {
    return false;
  }
}

function getCorsDiagnostic(origin) {
  if (!origin) {
    return { origin: null, allowed: true, reason: 'no_origin_header' };
  }

  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    return { origin, allowed: true, reason: 'localhost' };
  }

  if (isManagedFrontendOrigin(origin)) {
    return { origin, allowed: true, reason: 'managed_frontend_origin' };
  }

  const explicitlyAllowedOrigins = new Set(
    parseAllowedOrigins(
      process.env.FRONTEND_URL,
      process.env.GROWTH_FRONTEND_URL,
      process.env.ALLOWED_VERCEL_URL
    )
  );

  if (explicitlyAllowedOrigins.has(origin)) {
    return { origin, allowed: true, reason: 'explicit_env_origin' };
  }

  return { origin, allowed: false, reason: 'not_allowed_by_cors' };
}

function withTimeout(promise, timeoutMs, timeoutValue) {
  let timeout;
  return Promise.race([
    promise.finally(() => clearTimeout(timeout)),
    new Promise((resolve) => {
      timeout = setTimeout(() => resolve(timeoutValue), timeoutMs);
    }),
  ]);
}

async function checkDatabase() {
  try {
    const result = await withTimeout(
      prisma.$queryRaw`SELECT 1`,
      DIAGNOSTIC_TIMEOUT_MS,
      { timeout: true }
    );

    if (result?.timeout) {
      return { ok: false, code: 'DB_TIMEOUT' };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, code: 'DB_UNAVAILABLE', detail: error?.code || error?.name || 'DB_ERROR' };
  }
}

async function checkSupabaseJwks() {
  if (!process.env.SUPABASE_URL) {
    return { ok: false, code: 'SUPABASE_URL_MISSING' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DIAGNOSTIC_TIMEOUT_MS);

  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`, {
      method: 'GET',
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      code: response.ok ? 'OK' : 'SUPABASE_JWKS_UNAVAILABLE',
    };
  } catch (error) {
    return {
      ok: false,
      code: error?.name === 'AbortError' ? 'SUPABASE_JWKS_TIMEOUT' : 'SUPABASE_JWKS_NETWORK_ERROR',
    };
  } finally {
    clearTimeout(timer);
  }
}

// Lazy Supabase admin client
let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabaseAdmin;
}

const CURRENT_USER_BASE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  plan: true,
  billingType: true,
  trialEndsAt: true,
  expiresAt: true,
  graceEndsAt: true,
  accountStatus: true,
  permissions: true,
  mustChangePassword: true,
  accountOwnerId: true,
  assignedEstabelecimentoId: true,
  workspaceMode: true,
  createdAt: true,
  isSuperAdmin: true,
  assignedEstabelecimento: { select: { id: true, nome: true } },
};

function isMissingJobTitleColumn(error) {
  const message = error?.message || '';
  return message.includes('User.jobTitle') && message.includes('does not exist');
}

function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }

  return req.ip || null;
}

function getPasswordValidationError(password) {
  if (!password || password.length < 6) {
    return 'A password deve ter pelo menos 6 caracteres.';
  }

  if (!/[A-Z]/.test(password)) {
    return 'A password deve conter pelo menos uma letra maiúscula.';
  }

  if (!/[a-z]/.test(password)) {
    return 'A password deve conter pelo menos uma letra minúscula.';
  }

  if (!/\d/.test(password)) {
    return 'A password deve conter pelo menos um número.';
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'A password deve conter pelo menos um símbolo especial (ex: @, #, !).';
  }

  return null;
}

function mapPasswordProviderError(rawMessage) {
  const raw = (rawMessage || '').toLowerCase();

  if (raw.includes('at least') || raw.includes('characters') || raw.includes('length')) {
    return 'A password deve ter pelo menos 6 caracteres.';
  }

  if (raw.includes('weak') || raw.includes('strong') || raw.includes('strength')) {
    return 'A password é demasiado fraca. Use letras maiúsculas, minúsculas, números e símbolos.';
  }

  if (raw.includes('number') || raw.includes('digit')) {
    return 'A password deve conter pelo menos um número.';
  }

  if (raw.includes('uppercase')) {
    return 'A password deve conter pelo menos uma letra maiúscula.';
  }

  if (raw.includes('lower')) {
    return 'A password deve conter pelo menos uma letra minúscula.';
  }

  if (raw.includes('special') || raw.includes('symbol')) {
    return 'A password deve conter pelo menos um símbolo especial (ex: @, #, !).';
  }

  if (raw.includes('same') || raw.includes('different') || raw.includes('previous')) {
    return 'A nova password não pode ser igual à anterior.';
  }

  return 'Não foi possível alterar a password. Tente novamente.';
}

function blockImpersonatedWrites(req, res) {
  if (!req.user?.impersonatedBy) return false;
  res.status(403).json({
    error: 'Operação bloqueada durante impersonation.',
    code: 'IMPERSONATION_WRITE_BLOCKED',
  });
  return true;
}

router.get('/diagnostics', async (req, res) => {
  const requestId = makeRequestId();
  const origin = req.headers.origin || null;

  const [database, supabaseJwks] = await Promise.all([
    checkDatabase(),
    checkSupabaseJwks(),
  ]);

  const envPresence = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    FRONTEND_URL: Boolean(process.env.FRONTEND_URL),
    ALLOWED_VERCEL_URL: Boolean(process.env.ALLOWED_VERCEL_URL),
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    JWT_SECRET: Boolean(process.env.JWT_SECRET),
  };

  const cors = getCorsDiagnostic(origin);
  const ok = Boolean(
    envPresence.DATABASE_URL &&
    envPresence.FRONTEND_URL &&
    envPresence.SUPABASE_URL &&
    database.ok &&
    supabaseJwks.ok &&
    cors.allowed
  );

  res.status(200).json({
    ok,
    code: ok ? 'AUTH_DIAGNOSTICS_OK' : 'AUTH_DIAGNOSTICS_DEGRADED',
    message: ok ? 'Diagnóstico de autenticação OK' : 'Diagnóstico de autenticação com falhas',
    requestId,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    envPresence,
    hosts: {
      frontend: getHost(process.env.FRONTEND_URL),
      supabase: getHost(process.env.SUPABASE_URL),
    },
    cors,
    checks: {
      database,
      supabaseJwks,
    },
  });
});

async function getCurrentUserPayload(userId, { impersonatedBy = null, activeAccount = null } = {}) {
  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...CURRENT_USER_BASE_SELECT,
        jobTitle: true,
      },
    });
  } catch (error) {
    if (!isMissingJobTitleColumn(error)) {
      throw error;
    }

    user = await prisma.user.findUnique({
      where: { id: userId },
      select: CURRENT_USER_BASE_SELECT,
    });

    if (user) {
      user = { ...user, jobTitle: null };
    }
  }

  if (!user) {
    return null;
  }

  // Conta activa: por omissão a conta "casa" (accountOwnerId da própria linha).
  // Com multi-conta, activeAccount vem do req.user (a conta seleccionada) e o
  // plano/permissões/subscrição são resolvidos contra ESSA conta.
  const activeOwnerId = activeAccount ? activeAccount.ownerId : user.accountOwnerId || user.id;
  const isOwnerActive = activeAccount ? activeAccount.isOwner : !user.accountOwnerId;
  const activeMemberPerms = activeAccount ? activeAccount.permissionsJson : user.permissions;
  const effectiveRole = activeAccount ? activeAccount.role || user.role : user.role;

  let effectivePermissions = parsePermissions(activeMemberPerms);
  let effectivePlan = normalizePlan(user.plan);
  let effectiveWorkspaceMode = user.workspaceMode ?? 'servicos';
  let accountOwnerName = null;
  let subscriptionAccount = user;

  if (!isOwnerActive) {
    const owner = await prisma.user.findUnique({
      where: { id: activeOwnerId },
      select: {
        id: true,
        plan: true,
        permissions: true,
        name: true,
        workspaceMode: true,
        billingType: true,
        trialEndsAt: true,
        expiresAt: true,
        graceEndsAt: true,
        accountStatus: true,
      },
    });
    if (owner) {
      effectivePlan = normalizePlan(owner.plan);
      effectiveWorkspaceMode = owner.workspaceMode ?? 'servicos';
      accountOwnerName = owner.name;
      subscriptionAccount = owner;
      const orgPerms = parsePermissions(owner.permissions);
      effectivePermissions = intersectPermissions(orgPerms, effectivePermissions);
    }
  }

  const isSuperAdmin = Boolean(user.isSuperAdmin || isBootstrapSuperAdminEmail(user.email));
  const userWithEffectiveRole = {
    ...user,
    isSuperAdmin,
    role: effectiveRole,
    accountOwnerId: isOwnerActive ? null : activeOwnerId,
  };
  const currentPlanCatalog = getSerializedPlanCatalog(effectivePlan, effectiveWorkspaceMode);
  const subscription = await getSubscriptionState(activeOwnerId, subscriptionAccount);
  const requestUserForFood = {
    ...userWithEffectiveRole,
    effectiveUserId: activeOwnerId,
    isAccountOwner: isOwnerActive,
    permissionsJson: effectivePermissions,
    planContext: { workspaceMode: effectiveWorkspaceMode, plan: effectivePlan },
  };
  const [availableWorkspaces, foodAccess] = await Promise.all([
    getOrganizationModules(prisma, activeOwnerId, effectiveWorkspaceMode),
    resolveFoodAccess(prisma, requestUserForFood),
  ]);

  return {
    ...userWithEffectiveRole,
    accessRole: getAccessRole(userWithEffectiveRole),
    plan: effectivePlan,
    workspaceMode: effectiveWorkspaceMode,
    defaultWorkspace: effectiveWorkspaceMode,
    availableWorkspaces,
    foodAccess: serializeFoodAccess(foodAccess),
    planDetails: {
      label: currentPlanCatalog.label,
      description: currentPlanCatalog.description,
    },
    planLimits: currentPlanCatalog.limits,
    planFeatures: currentPlanCatalog.features,
    availablePlans: getSerializedPlanCatalog(undefined, effectiveWorkspaceMode),
    permissions: effectivePermissions,
    accountOwnerName,
    activeAccountId: activeOwnerId,
    impersonatedBy,
    subscription,
    billingType: subscription?.billingType || user.billingType,
    trialEndsAt: subscription?.trialEndsAt || user.trialEndsAt,
    expiresAt: subscription?.expiresAt || user.expiresAt,
    graceEndsAt: subscription?.graceEndsAt || user.graceEndsAt,
    accountStatus: subscription?.accountStatus || user.accountStatus,
  };
}

// Simple in-memory rate limiter: max 5 registrations per IP per hour
const _registerAttempts = new Map();
function checkRegisterRateLimit(ip) {
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const entry = _registerAttempts.get(ip) || { count: 0, resetAt: now + window };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + window;
  }
  entry.count += 1;
  _registerAttempts.set(ip, entry);
  return entry.count <= 5;
}

// POST /api/auth/register — public self-registration with 14-day trial
router.post('/register', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    if (!checkRegisterRateLimit(ip)) {
      return res.status(429).json({ error: 'Demasiadas tentativas. Tente novamente mais tarde.' });
    }

    const { name, email, password, workspaceMode, plan } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Nome deve ter pelo menos 2 caracteres.' });
    }
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Email inválido.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres.' });
    }
    if (workspaceMode && !['servicos', 'comercio', 'food'].includes(workspaceMode)) {
      return res.status(400).json({ error: 'Workspace inválido.' });
    }
    const resolvedPlan = plan && isSupportedPlan(plan) ? normalizePlan(plan) : DEFAULT_PLAN;

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const dbData = {
      name: name.trim(),
      email: normalizedEmail,
      role: 'user',
      active: true,
      mustChangePassword: false,
      plan: resolvedPlan,
      workspaceMode: workspaceMode || 'servicos',
      billingType: 'trial',
      trialEndsAt,
      accountStatus: 'active',
    };

    // Check if DB user already exists
    const existingDb = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingDb) {
      return res.status(400).json({ error: 'Este email já está registado.' });
    }

    // Try to create the Supabase user
    const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name: name.trim() },
    });

    let supabaseUid;

    if (authError) {
      // Recovery: Supabase user exists but DB record is missing (previous failed attempt)
      const isAlreadyExists = authError.message?.toLowerCase().includes('already been registered') ||
        authError.message?.toLowerCase().includes('already registered') ||
        authError.message?.toLowerCase().includes('already exists');

      if (!isAlreadyExists) {
        return res.status(400).json({ error: authError.message });
      }

      // Find the orphaned Supabase user to get their UID
      const { data: listData } = await getSupabaseAdmin().auth.admin.listUsers();
      const orphanedUser = listData?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
      if (!orphanedUser) {
        return res.status(400).json({ error: 'Este email já está registado.' });
      }

      // Update password to the one the user just provided
      await getSupabaseAdmin().auth.admin.updateUserById(orphanedUser.id, { password });
      supabaseUid = orphanedUser.id;
    } else {
      supabaseUid = authData.user.id;
    }

    // Create DB record — rollback Supabase user if this fails
    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { ...dbData, supabaseUid },
        });
        await tx.organizationModule.create({
          data: {
            organizationId: created.id,
            module: created.workspaceMode,
            enabled: true,
            planTier: created.plan,
            createdByUserId: created.id,
          },
        });
        if (created.workspaceMode === 'food') {
          await tx.foodSettings.create({
            data: { userId: created.id, isEnabled: true, createdByUserId: created.id },
          });
          await tx.foodStaffRoleAssignment.create({
            data: {
              organizationId: created.id,
              personId: created.id,
              role: 'manager',
              isPrimary: true,
              createdByUserId: created.id,
            },
          });
        }
      });
    } catch (dbError) {
      console.error('[auth.register] DB create failed, rolling back Supabase user:', dbError.message);
      // Only delete if we just created the user (not the recovery path)
      if (!authError) {
        await getSupabaseAdmin().auth.admin.deleteUser(supabaseUid).catch(() => {});
      }
      throw dbError;
    }

    res.status(201).json({ success: true, email: normalizedEmail });
  } catch (error) {
    console.error('[auth.register] error:', error);
    res.status(500).json({ error: `Erro ao criar conta: ${error.message}` });
  }
});

// POST /api/auth/sync
// Called by the frontend after Supabase login to link supabaseUid → User record.
// Verifies the Supabase JWT from the Authorization header (no service role key needed).
router.post('/sync', async (req, res) => {
  try {
    const { supabaseUid, email } = req.body;
    if (!supabaseUid || !email) {
      return res.status(400).json({ error: 'supabaseUid e email são obrigatórios' });
    }

    // Verify the JWT token to confirm the supabaseUid is genuine
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token de autenticação em falta' });
    }
    try {
      const payload = await verifySupabaseJwt(token);
      if (payload.sub !== supabaseUid) {
        return res.status(401).json({ error: 'Token não corresponde ao utilizador' });
      }
    } catch {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, supabaseUid: true, mustChangePassword: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    if (user.supabaseUid && user.supabaseUid !== supabaseUid) {
      return res.status(409).json({ error: 'Email já associado a outra conta Supabase' });
    }

    if (!user.supabaseUid) {
      await prisma.user.update({
        where: { id: user.id },
        data: { supabaseUid },
      });
    }

    res.json({ ok: true, userId: user.id, mustChangePassword: user.mustChangePassword });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me - Dados do utilizador autenticado
router.get('/me', requireAuth, async (req, res) => {
  try {
    if (req.user?.isDevAuthBypass) {
      return res.json(DEV_AUTH_PUBLIC_USER);
    }

    const payload = await getCurrentUserPayload(req.user.id, {
      impersonatedBy: req.user.impersonatedBy || null,
      activeAccount: {
        ownerId: req.user.effectiveUserId,
        isOwner: req.user.isAccountOwner,
        permissionsJson: req.user.permissionsJson,
        role: req.user.role,
      },
    });
    if (!payload) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }
    res.json(payload);
  } catch (error) {
    logRouteError('[auth.me] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/log-login', requireAuth, async (req, res) => {
  try {
    if (req.user?.isDevAuthBypass) {
      return res.status(204).send();
    }

    const ip = getRequestIp(req);
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;
    const dedupeWindowStart = new Date(Date.now() - (2 * 60 * 1000));

    const existingLog = await prisma.loginLog.findFirst({
      where: {
        userId: req.user.id,
        ip,
        userAgent,
        createdAt: { gte: dedupeWindowStart },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!existingLog) {
      await prisma.loginLog.create({
        data: {
          userId: req.user.id,
          ip,
          userAgent,
        },
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error logging login event:', error);
    res.status(204).send();
  }
});

router.patch('/me', requireAuth, async (req, res) => {
  try {
    if (blockImpersonatedWrites(req, res)) return;

    const { name, jobTitle } = req.body || {};
    const data = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Nome inválido' });
      }
      data.name = name.trim();
    }

    if (jobTitle !== undefined) {
      if (jobTitle !== null && typeof jobTitle !== 'string') {
        return res.status(400).json({ error: 'Função inválida' });
      }
      data.jobTitle = jobTitle && typeof jobTitle === 'string' ? jobTitle.trim() || null : null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    try {
      await prisma.user.update({
        where: { id: req.user.id },
        data,
      });
    } catch (error) {
      if (isMissingJobTitleColumn(error) && Object.prototype.hasOwnProperty.call(data, 'jobTitle')) {
        return res.status(409).json({
          error: 'A função do utilizador ainda não está disponível nesta base de dados. Execute a atualização da base antes de editar este campo.',
        });
      }
      throw error;
    }

    const payload = await getCurrentUserPayload(req.user.id, {
      impersonatedBy: req.user.impersonatedBy || null,
      activeAccount: {
        ownerId: req.user.effectiveUserId,
        isOwner: req.user.isAccountOwner,
        permissionsJson: req.user.permissionsJson,
        role: req.user.role,
      },
    });
    res.json(payload);
  } catch (error) {
    console.error('Error updating current user:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/change-password
// For first-time password change (mustChangePassword=true) or regular password change
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    if (blockImpersonatedWrites(req, res)) return;

    const { newPassword } = req.body;

    const passwordValidationError = getPasswordValidationError(newPassword);
    if (passwordValidationError) {
      return res.status(400).json({ error: passwordValidationError });
    }

    // Resolve supabaseUid — may be null for impersonated users whose UID wasn't in req.user
    let supabaseUid = req.user.supabaseUid;
    if (!supabaseUid) {
      const dbUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { supabaseUid: true } });
      supabaseUid = dbUser?.supabaseUid;
    }
    if (!supabaseUid) {
      return res.status(400).json({ error: 'Utilizador não tem conta Supabase associada. Contacte o suporte.' });
    }

    // Update password in Supabase Auth
    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(supabaseUid, {
      password: newPassword,
    });

    if (error) {
      return res.status(400).json({ error: mapPasswordProviderError(error.message) });
    }

    // Clear mustChangePassword flag
    await prisma.user.update({
      where: { id: req.user.id },
      data: { mustChangePassword: false },
    });

    res.json({ message: 'Password alterada com sucesso' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/acknowledge-password-change
// Called after a successful Supabase password reset (forgot-password flow)
// to clear the mustChangePassword flag without re-setting the password.
router.post('/acknowledge-password-change', requireAuth, async (req, res) => {
  try {
    if (blockImpersonatedWrites(req, res)) return;

    await prisma.user.update({
      where: { id: req.user.id },
      data: { mustChangePassword: false },
    });
    res.json({ message: 'OK' });
  } catch (error) {
    console.error('Error acknowledging password change:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
