const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { sendEmail } = require('../lib/email');
const requireAuth = require('../middleware/auth');

// POST /api/auth/register - Criar nova conta
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

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
      },
    });

    // Gerar JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/login - Fazer login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password são obrigatórios' });
    }

    // Buscar user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Email ou password incorretos' });
    }

    // Verificar password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Email ou password incorretos' });
    }

    // Gerar JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me - Obter dados do user logado
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User não encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/forgot-password - Enviar email de reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Não revelar se o email existe ou não (segurança)
      return res.json({ message: 'Se o email existe, um link de reset foi enviado' });
    }

    // Gerar token de reset (válido por 1 hora)
    const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const resetExpiry = new Date(Date.now() + 3600000); // 1 hora

    // Guardar token no DB
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetExpiry },
    });

    // Enviar email
    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Reset de Password - Mazanga CRM',
      body: `
        <h2>Reset de Password</h2>
        <p>Clique no link abaixo para resetar sua password:</p>
        <a href="${resetLink}">Resetar Password</a>
        <p>Este link é válido por 1 hora.</p>
        <p>Se não solicitou um reset, ignore este email.</p>
      `,
    });

    res.json({ message: 'Email de reset enviado' });
  } catch (error) {
    console.error('Error sending reset email:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/reset-password - Resetar password com token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token e password são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres' });
    }

    // Verificar token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    // Buscar user e verificar reset token
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.resetToken !== token || !user.resetExpiry || user.resetExpiry < new Date()) {
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    // Hash nova password
    const passwordHash = await bcrypt.hash(password, 10);

    // Atualizar user (limpar reset token)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetExpiry: null },
    });

    res.json({ message: 'Password resetada com sucesso' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
