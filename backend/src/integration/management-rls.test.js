const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('RLS isola os clientes entre organizações Gestão e KPI', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const rollback = new Error('ROLLBACK_MANAGEMENT_RLS_TEST');
  const suffix = crypto.randomUUID();

  try {
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        const ownerA = await tx.user.create({ data: { name: 'RLS A', email: `rls-a-${suffix}@example.test`, workspaceMode: 'gestao_kpi' } });
        const ownerB = await tx.user.create({ data: { name: 'RLS B', email: `rls-b-${suffix}@example.test`, workspaceMode: 'gestao_kpi' } });
        const authA = crypto.randomUUID();
        const authB = crypto.randomUUID();

        await tx.$queryRawUnsafe('SELECT set_config($1, $2, true)', 'app.management_user_id', String(ownerA.id));
        const provisionA = await tx.$queryRawUnsafe('SELECT * FROM provision_management_workspace($1::integer, $2, $3::uuid, $4)', ownerA.id, 'Organização RLS A', authA, ownerA.name);
        await tx.$queryRawUnsafe('SELECT set_config($1, $2, true)', 'app.management_user_id', String(ownerB.id));
        const provisionB = await tx.$queryRawUnsafe('SELECT * FROM provision_management_workspace($1::integer, $2, $3::uuid, $4)', ownerB.id, 'Organização RLS B', authB, ownerB.name);

        const setContext = async (orgId, profileId, userId) => {
          await tx.$queryRawUnsafe('SELECT set_config($1, $2, true)', 'app.management_organization_id', orgId);
          await tx.$queryRawUnsafe('SELECT set_config($1, $2, true)', 'app.management_profile_id', profileId);
          await tx.$queryRawUnsafe('SELECT set_config($1, $2, true)', 'app.management_user_id', String(userId));
          await tx.$queryRawUnsafe('SELECT set_config($1, $2, true)', 'app.management_role', 'admin');
          await tx.$queryRawUnsafe('SELECT set_config($1, $2, true)', 'app.management_system', '');
        };

        await setContext(provisionA[0].organization_id, provisionA[0].profile_id, ownerA.id);
        await tx.managementClient.create({ data: { organizationId: provisionA[0].organization_id, companyName: 'Cliente isolado A', contactName: 'Contacto A', createdBy: provisionA[0].profile_id } });
        const countA = await tx.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM clients');
        assert.equal(countA[0].count, 1);

        await setContext(provisionB[0].organization_id, provisionB[0].profile_id, ownerB.id);
        const countB = await tx.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM clients');
        assert.equal(countB[0].count, 0);

        throw rollback;
      }),
      (error) => error === rollback
    );
  } finally {
    await prisma.$disconnect();
  }
});
