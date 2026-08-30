const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('horários, painel e aprovação de Caixa respeitam tenant e derivam produtividade', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const {
    saveFoodWorkSchedule,
    listFoodWorkSchedules,
    archiveFoodWorkSchedule,
    getFoodWorkforceDashboard,
    reviewFoodCashDifference,
  } = require('../services/food-workforce-management.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  const userIds = [];
  const branchIds = [];
  const assignmentIds = [];
  const orderIds = [];
  const shiftIds = [];
  const sessionIds = [];
  const scheduleIds = [];

  try {
    const ownerA = await prisma.user.create({ data: { name: 'Workforce Manager A', email: `workforce-manager-a-${suffix}@example.test`, workspaceMode: 'food' } });
    const memberA = await prisma.user.create({ data: { name: 'Operador A', email: `workforce-operator-a-${suffix}@example.test`, workspaceMode: 'food', accountOwnerId: ownerA.id } });
    const ownerB = await prisma.user.create({ data: { name: 'Workforce Manager B', email: `workforce-manager-b-${suffix}@example.test`, workspaceMode: 'food' } });
    userIds.push(ownerA.id, memberA.id, ownerB.id);
    const branchA = await prisma.foodBranch.create({ data: { userId: ownerA.id, name: 'Painel A', isMain: true, createdByUserId: ownerA.id } });
    const branchB = await prisma.foodBranch.create({ data: { userId: ownerB.id, name: 'Painel B', isMain: true, createdByUserId: ownerB.id } });
    branchIds.push(branchA.id, branchB.id);
    const assignment = await prisma.foodStaffRoleAssignment.create({ data: { organizationId: ownerA.id, personId: memberA.id, branchId: branchA.id, role: 'cashier', isPrimary: true, createdByUserId: ownerA.id } });
    assignmentIds.push(assignment.id);
    const contextA = { organizationId: ownerA.id, personId: ownerA.id, branchIds: null, canAccessBranch: (id) => id === branchA.id };
    const contextB = { organizationId: ownerB.id, personId: ownerB.id, branchIds: null, canAccessBranch: (id) => id === branchB.id };
    const workDate = new Date().toISOString().slice(0, 10);

    const schedule = await saveFoodWorkSchedule(prisma, contextA, { personId: memberA.id, branchId: branchA.id, workDate, startTime: '08:00', endTime: '17:00', notes: 'Turno principal' });
    scheduleIds.push(schedule.id);
    const updatedSchedule = await saveFoodWorkSchedule(prisma, contextA, { personId: memberA.id, branchId: branchA.id, workDate, startTime: '09:00', endTime: '18:00' });
    assert.equal(updatedSchedule.id, schedule.id);
    assert.equal(updatedSchedule.startTime, '09:00');
    assert.equal((await listFoodWorkSchedules(prisma, contextA, { from: workDate, to: workDate })).length, 1);
    assert.equal((await listFoodWorkSchedules(prisma, contextB, { from: workDate, to: workDate })).length, 0);

    const startedAt = new Date(Date.now() - 2 * 3600000);
    const endedAt = new Date();
    const shift = await prisma.foodShift.create({ data: { organizationId: ownerA.id, branchId: branchA.id, personId: memberA.id, status: 'closed', startedAt, endedAt, createdByUserId: memberA.id } });
    shiftIds.push(shift.id);
    const session = await prisma.foodCashSession.create({ data: { organizationId: ownerA.id, branchId: branchA.id, shiftId: shift.id, openedByUserId: memberA.id, closedByUserId: memberA.id, status: 'closed', openingBalance: 1000, expectedClosingAmount: 6000, closingCountedAmount: 5900, differenceAmount: -100, totalSalesAmount: 5000, salesCount: 1, totalsByMethod: { CASH: 5000 }, notes: 'Faltam 100 Kz', approvalStatus: 'pending', openedAt: startedAt, closedAt: endedAt } });
    sessionIds.push(session.id);
    const order = await prisma.foodOrder.create({ data: { userId: ownerA.id, branchId: branchA.id, orderNumber: 1, orderState: 'completed', status: 'completed', total: 5000, createdByUserId: memberA.id, completedAt: endedAt } });
    orderIds.push(order.id);

    const dashboard = await getFoodWorkforceDashboard(prisma, contextA, { branchId: branchA.id, days: 7 });
    const operator = dashboard.performance.find((item) => item.person.id === memberA.id);
    assert.ok(operator.hours >= 1.9 && operator.hours <= 2.1);
    assert.equal(operator.orders, 1);
    assert.equal(operator.orderValue, 5000);
    assert.equal(operator.cashSales, 5000);
    assert.equal(operator.cashDifference, 100);
    assert.equal(operator.pendingApprovals, 1);
    assert.equal(dashboard.summary.pendingApprovals, 1);

    await assert.rejects(reviewFoodCashDifference(prisma, contextB, session.id, { decision: 'approved' }), (error) => error.code === 'FOOD_CASH_SESSION_NOT_FOUND');
    await assert.rejects(reviewFoodCashDifference(prisma, contextA, session.id, { decision: 'rejected' }), (error) => error.code === 'FOOD_CASH_APPROVAL_NOTE_REQUIRED');
    const reviewed = await reviewFoodCashDifference(prisma, contextA, session.id, { decision: 'approved', note: 'Contagem conferida' });
    assert.equal(reviewed.approvalStatus, 'approved');
    assert.equal(reviewed.approvedByUserId, ownerA.id);
    await assert.rejects(reviewFoodCashDifference(prisma, contextA, session.id, { decision: 'approved' }), (error) => error.code === 'FOOD_CASH_APPROVAL_ALREADY_REVIEWED');
    await archiveFoodWorkSchedule(prisma, contextA, schedule.id);
    assert.equal((await listFoodWorkSchedules(prisma, contextA, { from: workDate, to: workDate })).length, 0);
  } finally {
    if (orderIds.length) await prisma.foodOrder.deleteMany({ where: { id: { in: orderIds } } });
    if (sessionIds.length) await prisma.foodCashSession.deleteMany({ where: { id: { in: sessionIds } } });
    if (shiftIds.length) await prisma.foodShift.deleteMany({ where: { id: { in: shiftIds } } });
    if (scheduleIds.length) await prisma.foodWorkSchedule.deleteMany({ where: { id: { in: scheduleIds } } });
    if (assignmentIds.length) await prisma.foodStaffRoleAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
    if (branchIds.length) await prisma.foodBranch.deleteMany({ where: { id: { in: branchIds } } });
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
