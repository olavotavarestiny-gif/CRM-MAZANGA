const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

// POST /api/setup/create-admin - Create admin user (one-time use)
// This route is TEMPORARY for initial setup and should be deleted after
router.post('/create-admin', async (req, res) => {
  try {
    const { token } = req.body;

    // Verify token matches a setup token (for security)
    if (token !== process.env.SETUP_TOKEN) {
      return res.status(401).json({ error: 'Invalid setup token' });
    }

    const email = 'olavo@mazanga.digital';
    const password = 'mamaester';
    const name = 'Olavo Admin';

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Upsert admin user
    const admin = await prisma.user.upsert({
      where: { email },
      update: {
        role: 'admin',
        active: true,
        passwordHash,
      },
      create: {
        email,
        name,
        passwordHash,
        role: 'admin',
        active: true,
      },
    });

    console.log('Admin user created/updated:', admin.email);

    res.json({
      message: 'Admin user created successfully',
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
