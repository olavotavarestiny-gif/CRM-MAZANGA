const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/auth');
const { verifySupabaseJwt } = require('../middleware/auth');
const { intersectPermissions, parsePermissions } = require('../lib/permissions');
const { normalizePlan } = require('../lib/plans');
const { getSerializedPlanCatalog } = require('../lib/plan-limits');

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

async function getCurrentUserPayload(userId, impersonatedBy = null) {
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

  let effectivePermissions = parsePermissions(user.permissions);
  let effectivePlan = normalizePlan(user.plan);
  let effectiveWorkspaceMode = user.workspaceMode ?? 'servicos';
  let accountOwnerName = null;

  if (user.accountOwnerId) {
    const owner = await prisma.user.findUnique({
      where: { id: user.accountOwnerId },
      select: { plan: true, permissions: true, name: true, workspaceMode: true },
    });
    if (owner) {
      effectivePlan = normalizePlan(owner.plan);
      effectiveWorkspaceMode = owner.workspaceMode ?? 'servicos';
      accountOwnerName = owner.name;
      const orgPerms = parsePermissions(owner.permissions);
      effectivePermissions = intersectPermissions(orgPerms, effectivePermissions);
    }
  }

  const currentPlanCatalog = getSerializedPlanCatalog(effectivePlan, effectiveWorkspaceMode);

  return {
    ...user,
    plan: effectivePlan,
    workspaceMode: effectiveWorkspaceMode,
    planDetails: {
      label: currentPlanCatalog.label,
      description: currentPlanCatalog.description,
    },
    planLimits: currentPlanCatalog.limits,
    planFeatures: currentPlanCatalog.features,
    availablePlans: getSerializedPlanCatalog(undefined, effectiveWorkspaceMode),
    permissions: effectivePermissions,
    accountOwnerName,
    impersonatedBy,
  };
}

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
    const payload = await getCurrentUserPayload(req.user.id, req.user.impersonatedBy || null);
    if (!payload) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }
    res.json(payload);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/log-login', requireAuth, async (req, res) => {
  try {
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

    const payload = await getCurrentUserPayload(req.user.id, req.user.impersonatedBy || null);
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
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Nova password deve ter pelo menos 6 caracteres' });
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
      const raw = (error.message || '').toLowerCase();
      let msg = 'Não foi possível alterar a password. Tente novamente.';
      if (raw.includes('at least') || raw.includes('characters') || raw.includes('length')) {
        msg = 'A password deve ter pelo menos 6 caracteres.';
      } else if (raw.includes('weak') || raw.includes('strong') || raw.includes('strength')) {
        msg = 'A password é demasiado fraca. Use letras maiúsculas, minúsculas, números e símbolos.';
      } else if (raw.includes('number') || raw.includes('digit')) {
        msg = 'A password deve conter pelo menos um número.';
      } else if (raw.includes('uppercase') || raw.includes('lower')) {
        msg = 'A password deve conter letras maiúsculas e minúsculas.';
      } else if (raw.includes('special') || raw.includes('symbol')) {
        msg = 'A password deve conter pelo menos um símbolo especial (ex: @, #, !).';
      } else if (raw.includes('same') || raw.includes('different') || raw.includes('previous')) {
        msg = 'A nova password não pode ser igual à anterior.';
      }
      return res.status(400).json({ error: msg });
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
