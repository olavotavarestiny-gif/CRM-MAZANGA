const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const prisma = require('../lib/prisma');
const { DEFAULT_PLAN, isSupportedPlan, normalizePlan } = require('../lib/plans');

// Lazy Supabase admin client — created on first use, not at startup
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

// GET /api/admin/users - Lista todos os utilizadores
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        plan: true,
        permissions: true,
        accountOwnerId: true,
        createdAt: true,
        loginLogs: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        },
        accountOwner: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const usersWithInfo = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      plan: normalizePlan(u.plan),
      permissions: u.permissions ? JSON.parse(u.permissions) : null,
      accountOwnerId: u.accountOwnerId,
      accountOwnerName: u.accountOwner?.name || null,
      createdAt: u.createdAt,
      lastLogin: u.loginLogs[0]?.createdAt || null,
    }));

    res.json(usersWithInfo);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/accounts - Lista todas as contas clientes (account owners independentes)
router.get('/accounts', async (req, res) => {
  try {
    const accounts = await prisma.user.findMany({
      where: { accountOwnerId: null, isSuperAdmin: false },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        plan: true,
        permissions: true,
        createdAt: true,
        accountMembers: {
          select: {
            id: true,
            name: true,
            email: true,
            active: true,
            permissions: true,
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { accountMembers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(accounts.map(a => ({
      ...a,
      plan: normalizePlan(a.plan),
      permissions: a.permissions ? JSON.parse(a.permissions) : null,
      accountMembers: a.accountMembers.map(m => ({
        ...m,
        permissions: m.permissions ? JSON.parse(m.permissions) : null,
      })),
    })));
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/admin/accounts/:id - Actualizar plano e/ou permissões de uma conta
router.patch('/accounts/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { plan, permissions } = req.body;

    const data = {};
    if (plan !== undefined) {
      if (!isSupportedPlan(plan)) {
        return res.status(400).json({ error: 'Plano inválido. Use essencial ou profissional.' });
      }
      data.plan = plan;
    }
    if (permissions !== undefined) {
      data.permissions = permissions ? JSON.stringify(permissions) : null;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, plan: true, permissions: true },
    });

    res.json({
      ...updated,
      plan: normalizePlan(updated.plan),
      permissions: updated.permissions ? JSON.parse(updated.permissions) : null,
    });
  } catch (error) {
    console.error('Error updating account:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/users - Criar novo utilizador (admin pode criar contas independentes; só super-admin cria outros admins)
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role, accountOwnerId, plan, permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email e password são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres' });
    }

    if (plan !== undefined && !isSupportedPlan(plan)) {
      return res.status(400).json({ error: 'Plano inválido. Use essencial ou profissional.' });
    }

    // Verificar se email já existe no PostgreSQL
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email já está registado' });
    }

    // Validar accountOwnerId se fornecido
    if (accountOwnerId) {
      const accountOwner = await prisma.user.findUnique({ where: { id: parseInt(accountOwnerId) } });
      if (!accountOwner) {
        return res.status(400).json({ error: 'Account owner não encontrado' });
      }
    }

    // Só super-admin pode criar outros admins
    const isSuperAdmin = !!req.user?.isSuperAdmin;
    if (!isSuperAdmin && role === 'admin') {
      return res.status(403).json({
        error: 'Só o super-administrador pode atribuir papel admin',
      });
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
    const user = await prisma.user.create({
      data: {
        name,
        email,
        supabaseUid: authData.user.id,
        role: role === 'admin' ? 'admin' : 'user',
        active: true,
        mustChangePassword: true,
        plan: plan || DEFAULT_PLAN,
        permissions: permissions ? JSON.stringify(permissions) : null,
        accountOwnerId: accountOwnerId ? parseInt(accountOwnerId) : null,
      },
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      plan: normalizePlan(user.plan),
      permissions: user.permissions ? JSON.parse(user.permissions) : null,
      accountOwnerId: user.accountOwnerId,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/admin/users/:id - Actualizar utilizador
router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, active, role, plan, permissions } = req.body;
    const userId = parseInt(id);

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (active !== undefined) updateData.active = active;
    if (role !== undefined && ['admin', 'user'].includes(role)) {
      updateData.role = role;
    }
    if (plan !== undefined) {
      if (!isSupportedPlan(plan)) {
        return res.status(400).json({ error: 'Plano inválido. Use essencial ou profissional.' });
      }
      updateData.plan = plan;
    }
    if (permissions !== undefined) {
      updateData.permissions = permissions ? JSON.stringify(permissions) : null;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true, name: true, email: true, role: true, active: true,
        plan: true, permissions: true, createdAt: true,
      },
    });

    res.json({
      ...user,
      plan: normalizePlan(user.plan),
      permissions: user.permissions ? JSON.parse(user.permissions) : null,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/admin/users/:id - Eliminar utilizador
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Não pode eliminar sua própria conta' });
    }

    // Buscar supabaseUid antes de eliminar
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { supabaseUid: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    // Eliminar do Supabase Auth (se tiver uid)
    if (user.supabaseUid) {
      await getSupabaseAdmin().auth.admin.deleteUser(user.supabaseUid);
    }

    // Eliminar do PostgreSQL
    await prisma.user.delete({ where: { id: userId } });

    res.json({ message: 'Utilizador eliminado' });
  } catch (error) {
    console.error('Error deleting user:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/logins - Histórico de logins
router.get('/logins', async (req, res) => {
  try {
    const logins = await prisma.loginLog.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(logins);
  } catch (error) {
    console.error('Error fetching login logs:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
