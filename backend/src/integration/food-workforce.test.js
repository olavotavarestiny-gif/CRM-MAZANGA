const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('credencial, bloqueio e turno Food respeitam tenant, unidade e Caixa aberto', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const {
    setFoodStaffPin,
    verifyFoodStaffPin,
    startFoodShift,
    endFoodShift,
    getCurrentFoodWorkforce,
  } = require('../services/food-workforce.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  const userIds = [];
  const branchIds = [];
  const cashSessionIds = [];

  try {
    const ownerA = await prisma.user.create({ data: { name: 'Workforce A', email: `workforce-a-${suffix}@example.test`, workspaceMode: 'food' } });
    const ownerB = await prisma.user.create({ data: { name: 'Workforce B', email: `workforce-b-${suffix}@example.test`, workspaceMode: 'food' } });
    userIds.push(ownerA.id, ownerB.id);
    const branchA1 = await prisma.foodBranch.create({ data: { userId: ownerA.id, name: 'Turno A1', isMain: true, createdByUserId: ownerA.id } });
    const branchA2 = await prisma.foodBranch.create({ data: { userId: ownerA.id, name: 'Turno A2', createdByUserId: ownerA.id } });
    const branchB = await prisma.foodBranch.create({ data: { userId: ownerB.id, name: 'Turno B', isMain: true, createdByUserId: ownerB.id } });
    branchIds.push(branchA1.id, branchA2.id, branchB.id);
    const contextA = { organizationId: ownerA.id, personId: ownerA.id, branchIds: null, roles: ['manager'], canAccessBranch: (id) => [branchA1.id, branchA2.id].includes(id) };
    const contextB = { organizationId: ownerB.id, personId: ownerB.id, branchIds: null, roles: ['manager'], canAccessBranch: (id) => id === branchB.id };

    const credential = await setFoodStaffPin(prisma, contextA, ownerA.id, '2468');
    const stored = await prisma.foodStaffCredential.findUnique({ where: { id: credential.id } });
    assert.notEqual(stored.pinHash, '2468');
    assert.match(stored.pinHash, /^\$2[aby]\$/);
    await assert.rejects(
      setFoodStaffPin(prisma, contextA, ownerB.id, '1234'),
      (error) => error.code === 'FOOD_STAFF_PERSON_INVALID'
    );

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await assert.rejects(verifyFoodStaffPin(prisma, contextA, '1111'), (error) => error.code === 'FOOD_STAFF_PIN_INCORRECT');
    }
    await assert.rejects(verifyFoodStaffPin(prisma, contextA, '1111'), (error) => error.code === 'FOOD_STAFF_PIN_LOCKED');
    const locked = await prisma.foodStaffCredential.findUnique({ where: { id: credential.id } });
    assert.ok(locked.lockedUntil > new Date());
    await assert.rejects(verifyFoodStaffPin(prisma, contextA, '2468'), (error) => error.code === 'FOOD_STAFF_PIN_LOCKED');
    await setFoodStaffPin(prisma, contextA, ownerA.id, '2468');

    await assert.rejects(
      startFoodShift(prisma, contextA, { branchId: branchB.id, pin: '2468' }),
      (error) => error.code === 'FOOD_BRANCH_FORBIDDEN'
    );
    const started = await startFoodShift(prisma, contextA, { branchId: branchA1.id, pin: '2468', deviceId: 'test-device' });
    assert.equal(started.created, true);
    assert.equal(started.shift.branchId, branchA1.id);
    const repeated = await startFoodShift(prisma, contextA, { branchId: branchA1.id, pin: '2468', deviceId: 'test-device' });
    assert.equal(repeated.created, false);
    assert.equal(repeated.shift.id, started.shift.id);
    await assert.rejects(
      startFoodShift(prisma, contextA, { branchId: branchA2.id, pin: '2468' }),
      (error) => error.code === 'FOOD_SHIFT_ALREADY_OPEN'
    );
    const workforce = await getCurrentFoodWorkforce(prisma, contextA, branchA2.id);
    assert.equal(workforce.credentialConfigured, true);
    assert.equal(workforce.shift.id, started.shift.id);
    assert.equal(workforce.shift.branchId, branchA1.id);

    const cashSession = await prisma.foodCashSession.create({ data: { organizationId: ownerA.id, branchId: branchA1.id, shiftId: started.shift.id, openedByUserId: ownerA.id, openingBalance: 1000, expectedClosingAmount: 1000 } });
    cashSessionIds.push(cashSession.id);
    await assert.rejects(
      endFoodShift(prisma, contextA, started.shift.id, { pin: '2468' }),
      (error) => error.code === 'FOOD_SHIFT_HAS_OPEN_CASH_SESSION'
    );
    await prisma.foodCashSession.update({ where: { id: cashSession.id }, data: { status: 'closed', closedAt: new Date(), closedByUserId: ownerA.id, closingCountedAmount: 1000, differenceAmount: 0 } });
    const ended = await endFoodShift(prisma, contextA, started.shift.id, { pin: '2468', deviceId: 'test-device' });
    assert.equal(ended.status, 'closed');
    assert.ok(ended.endedAt);

    await setFoodStaffPin(prisma, contextB, ownerB.id, '1357');
    assert.equal((await getCurrentFoodWorkforce(prisma, contextB, branchB.id)).shift, null);
  } finally {
    if (cashSessionIds.length) await prisma.foodCashSession.deleteMany({ where: { id: { in: cashSessionIds } } });
    if (userIds.length) await prisma.foodShift.deleteMany({ where: { organizationId: { in: userIds } } });
    if (userIds.length) await prisma.foodStaffCredential.deleteMany({ where: { organizationId: { in: userIds } } });
    if (branchIds.length) await prisma.foodBranch.deleteMany({ where: { id: { in: branchIds } } });
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
