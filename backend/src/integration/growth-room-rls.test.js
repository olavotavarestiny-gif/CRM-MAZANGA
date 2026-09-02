const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('RLS da Growth Room isola organizações e clientes', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const rollback = new Error('ROLLBACK_GROWTH_RLS_TEST');
  const suffix = crypto.randomUUID();
  try {
    await assert.rejects(prisma.$transaction(async (tx) => {
      const adminA = await tx.user.create({ data: { name: 'Growth Admin A', email: `growth-admin-a-${suffix}@example.test` } });
      const adminB = await tx.user.create({ data: { name: 'Growth Admin B', email: `growth-admin-b-${suffix}@example.test` } });
      const clientUser = await tx.user.create({ data: { name: 'Growth Client', email: `growth-client-${suffix}@example.test` } });
      const set = (key, value) => tx.$queryRawUnsafe('SELECT set_config($1, $2, true)', key, String(value ?? ''));
      await set('app.growth_user_id', adminA.id); await set('app.growth_system', 'provision');
      const orgA = await tx.growthOrganization.create({ data: { accountOwnerId: adminA.id, name: 'Growth A' } });
      await tx.growthMembership.create({ data: { organizationId: orgA.id, userId: adminA.id } });
      const orgB = await tx.growthOrganization.create({ data: { accountOwnerId: adminB.id, name: 'Growth B' } });
      await tx.growthMembership.create({ data: { organizationId: orgB.id, userId: adminB.id } });
      const clientA = await tx.growthClient.create({ data: { organizationId: orgA.id, companyName: 'Cliente A' } });
      await tx.growthClient.create({ data: { organizationId: orgA.id, companyName: 'Cliente A2' } });
      const clientB = await tx.growthClient.create({ data: { organizationId: orgB.id, companyName: 'Cliente B' } });
      await tx.growthClientAccess.create({ data: { clientId: clientA.id, userId: clientUser.id } });
      await tx.growthClientGoal.create({ data: { clientId: clientA.id, targetContacts: 100 } });
      await tx.growthClientGoal.create({ data: { clientId: clientB.id, targetContacts: 200 } });

      const adminContext = async (orgId, userId) => {
        await set('app.growth_system', ''); await set('app.growth_user_id', userId); await set('app.growth_organization_id', orgId);
        await set('app.growth_client_id', ''); await set('app.growth_role', 'mazanga_admin');
      };
      await adminContext(orgA.id, adminA.id);
      assert.equal(await tx.growthClient.count(), 2);
      assert.equal(await tx.growthClientGoal.count(), 1);
      await adminContext(orgB.id, adminB.id);
      assert.equal(await tx.growthClient.count(), 1);
      assert.equal(await tx.growthClientGoal.count(), 1);

      await set('app.growth_user_id', clientUser.id); await set('app.growth_organization_id', orgA.id);
      await set('app.growth_client_id', clientA.id); await set('app.growth_role', 'client');
      assert.deepEqual((await tx.growthClient.findMany()).map((row) => row.companyName), ['Cliente A']);
      assert.deepEqual((await tx.growthClientGoal.findMany()).map((row) => row.targetContacts), [100]);
      await assert.rejects(tx.growthClient.update({ where: { id: clientA.id }, data: { companyName: 'Tentativa' } }));
      await assert.rejects(tx.growthClientGoal.update({ where: { clientId: clientA.id }, data: { targetContacts: 999 } }));
      throw rollback;
    }), (error) => error === rollback);
  } finally {
    await prisma.$disconnect();
  }
});
