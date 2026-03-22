const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { requireAccountOwner } = require('../middleware/auth');

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

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Criar membro da conta
    const member = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        accountOwnerId, // Assign to the account owner
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
