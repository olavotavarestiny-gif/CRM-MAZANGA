const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const prisma = require('../lib/prisma');
const { requireAccountOwner } = require('../middleware/auth');

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

// PATCH /api/account/team/:memberId/pages - Definir páginas permitidas de um membro
router.patch('/team/:memberId/pages', requireAccountOwner, async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    const accountOwnerId = req.user.effectiveUserId;
    const { pages } = req.body; // string[] | null

    const member = await prisma.user.findFirst({
      where: { id: memberId, accountOwnerId },
    });
    if (!member) return res.status(404).json({ error: 'Membro não encontrado nesta conta' });

    // Fetch org's own allowedPages to enforce intersection
    const owner = await prisma.user.findUnique({
      where: { id: accountOwnerId },
      select: { allowedPages: true },
    });
    const orgAllowed = owner?.allowedPages ? JSON.parse(owner.allowedPages) : null;

    let finalPages = pages || null;
    if (orgAllowed && finalPages) {
      finalPages = finalPages.filter(p => orgAllowed.includes(p));
    }

    await prisma.user.update({
      where: { id: memberId },
      data: { allowedPages: finalPages ? JSON.stringify(finalPages) : null },
    });

    res.json({ allowedPages: finalPages });
  } catch (error) {
    console.error('Error setting member pages:', error);
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
