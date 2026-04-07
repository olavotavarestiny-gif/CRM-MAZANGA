#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'olavo@kukugest.ao';
  const password = 'mamaester';
  const name = 'Olavo Admin';

  console.log('Creating/updating admin user...');

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    // Use upsert: se existe, actualiza; se não, cria
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

    console.log('✓ Admin user created/updated:', {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      active: admin.active,
    });
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
