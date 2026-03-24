const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const prisma = require('../lib/prisma');
const { requireAccountOwner } = require('../middleware/auth');
const { parsePermissions, intersectPermissions } = require('../lib/permissions');

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

// GET /api/account/team - Listar membros da conta (donos apenas)
router.get('/team', requireAccountOwner, async (req, res) => {
  try {
    const accountOwnerId = req.user.effectiveUserId;

    const members = await prisma.user.findMany({
      where: { accountOwnerId },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        allowedPages: true,
        createdAt: true,
        loginLogs: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const membersWithLastLogin = members.map((m) => ({
      ...m,
      allowedPages: m.allowedPages ? JSON.parse(m.allowedPages) : null,
      lastLogin: m.loginLogs[0]?.createdAt || null,
      loginLogs: undefined,
    }));

    res.json(membersWithLastLogin);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/account/team - Criar utilizador + adicionar à conta
router.post('/team', requireAccountOwner, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const accountOwnerId = req.user.effectiveUserId;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e password são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres' });
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email já está registado' });
    }

    // 1. Criar no Supabase Auth
    const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // 2. Criar no PostgreSQL com o UID do Supabase
    const member = await prisma.user.create({
      data: {
        name,
        email,
        supabaseUid: authData.user.id,
        accountOwnerId,
        role: 'user',
        active: true,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        accountOwnerId: true,
        active: true,
        createdAt: true,
      },
    });

    res.status(201).json(member);
  } catch (error) {
    console.error('Error creating team member:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/account/team/:memberId/permissions - Set granular permissions for a team member
router.patch('/team/:memberId/permissions', requireAccountOwner, async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    const accountOwnerId = req.user.effectiveUserId;
    const { permissions } = req.body; // UserPermissions object | null

    const member = await prisma.user.findFirst({
      where: { id: memberId, accountOwnerId },
    });
    if (!member) return res.status(404).json({ error: 'Membro não encontrado nesta conta' });

    // Enforce org-level restrictions (intersection)
    const owner = await prisma.user.findUnique({
      where: { id: accountOwnerId },
      select: { permissions: true },
    });
    const orgPerms = parsePermissions(owner?.permissions);
    const memberPerms = parsePermissions(permissions ? JSON.stringify(permissions) : null);
    const finalPerms = intersectPermissions(orgPerms, memberPerms);

    await prisma.user.update({
      where: { id: memberId },
      data: { permissions: finalPerms ? JSON.stringify(finalPerms) : null },
    });

    res.json({ permissions: finalPerms });
  } catch (error) {
    console.error('Error setting member permissions:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/account/team/:memberId - Remover membro da conta
router.delete('/team/:memberId', requireAccountOwner, async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    const accountOwnerId = req.user.effectiveUserId;

    // Verificar que o membro pertence a esta conta
    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: { accountOwnerId: true },
    });

    if (!member || member.accountOwnerId !== accountOwnerId) {
      return res.status(404).json({ error: 'Membro não encontrado nesta conta' });
    }

    // Remover membro (set accountOwnerId = null)
    await prisma.user.update({
      where: { id: memberId },
      data: { accountOwnerId: null },
    });

    res.json({ message: 'Membro removido da conta' });
  } catch (error) {
    console.error('Error removing team member:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Membro não encontrado' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
