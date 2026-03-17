const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

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
        createdAt: true,
        loginLogs: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mapear último login
    const usersWithLastLogin = users.map(u => ({
      ...u,
      lastLogin: u.loginLogs[0]?.createdAt || null,
      loginLogs: undefined,
    }));

    res.json(usersWithLastLogin);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/users - Criar novo utilizador (só admin)
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email e password são obrigatórios' });
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

    // Criar user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role === 'admin' ? 'admin' : 'user',
        active: true,
      },
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
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
    const { name, active, role } = req.body;
    const userId = parseInt(id);

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (active !== undefined) updateData.active = active;
    if (role !== undefined && ['admin', 'user'].includes(role)) {
      updateData.role = role;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    res.json(user);
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

    // Não permitir eliminar o próprio admin
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Não pode eliminar sua própria conta' });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

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
      take: 100, // Últimos 100 logins
    });

    res.json(logins);
  } catch (error) {
    console.error('Error fetching login logs:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
