const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

// POST /api/setup/bootstrap-admin - Bootstrap admin user (protected by SETUP_SECRET)
// This route is TEMPORARY and should be removed after admin role is set correctly
router.post('/bootstrap-admin', async (req, res) => {
  try {
    const { secret } = req.body;

    // Security: Verify SETUP_SECRET from environment
    if (!secret || secret !== process.env.SETUP_SECRET) {
      return res.status(401).json({ error: 'Invalid or missing SETUP_SECRET' });
    }

    const email = process.env.SUPER_ADMIN_EMAIL || 'olavo@kukugest.ao';
    const name = 'Olavo Admin';

    // Find existing user
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!existingUser) {
      return res.status(400).json({ error: 'User not found. Please create user first.' });
    }

    // Update user to admin role
    const admin = await prisma.user.update({
      where: { email },
      data: {
        role: 'admin',
        active: true,
      },
    });

    console.log('Admin role updated:', admin.email);

    res.json({
      message: 'Admin role set successfully',
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        active: admin.active,
      },
    });
  } catch (error) {
    console.error('Error setting admin role:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
