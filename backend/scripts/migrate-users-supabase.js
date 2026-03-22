/**
 * migrate-users-supabase.js
 *
 * One-time migration: creates a Supabase Auth identity for every User in PostgreSQL
 * that doesn't yet have a supabaseUid.
 *
 * Run ONCE after deploying the Supabase auth migration:
 *   cd backend && node scripts/migrate-users-supabase.js
 *
 * Each migrated user will receive a password reset email from Supabase,
 * prompting them to set a new password on first login.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateUsers() {
  console.log('Starting Supabase user migration...\n');

  const users = await prisma.user.findMany({
    where: { supabaseUid: null },
    select: { id: true, name: true, email: true },
  });

  if (users.length === 0) {
    console.log('No users to migrate. All users already have supabaseUid.');
    return;
  }

  console.log(`Found ${users.length} user(s) to migrate:\n`);

  let succeeded = 0;
  let failed = 0;

  for (const user of users) {
    try {
      // Create in Supabase Auth with a random password
      // User will receive a reset email to set their own password
      const randomPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!1';

      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: randomPassword,
        email_confirm: true,
        user_metadata: { name: user.name },
      });

      if (createError) {
        // User may already exist in Supabase Auth
        if (createError.message.includes('already been registered')) {
          // Find existing Supabase user by email
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const existingAuthUser = listData?.users?.find(u => u.email === user.email);

          if (existingAuthUser) {
            await prisma.user.update({
              where: { id: user.id },
              data: { supabaseUid: existingAuthUser.id },
            });
            console.log(`✓ Linked existing Supabase user: ${user.email}`);
            succeeded++;
            continue;
          }
        }
        console.error(`✗ Failed to create ${user.email}: ${createError.message}`);
        failed++;
        continue;
      }

      // Update PostgreSQL with Supabase UID
      await prisma.user.update({
        where: { id: user.id },
        data: { supabaseUid: authData.user.id },
      });

      // Send password reset email so user sets their own password
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: user.email,
        options: {
          redirectTo: `${frontendUrl}/reset-password`,
        },
      });

      console.log(`✓ Migrated: ${user.email} (supabaseUid: ${authData.user.id})`);
      succeeded++;
    } catch (err) {
      console.error(`✗ Error migrating ${user.email}:`, err.message);
      failed++;
    }
  }

  console.log(`\nMigration complete: ${succeeded} succeeded, ${failed} failed`);
  if (failed > 0) {
    console.log('\nRe-run this script to retry failed users.');
  } else {
    console.log('\nAll users have been migrated to Supabase Auth.');
    console.log('Each user will receive a password reset email to set their new password.');
  }
}

migrateUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
