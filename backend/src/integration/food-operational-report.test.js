'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('relatório operacional isola tenant, unidade e custódia do entregador', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const { getFoodOperationalReport } = require('../services/food-operational-report.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  let owner;
  let other;
  try {
    owner = await prisma.user.create({ data: { name: 'Report Owner', email: `report-owner-${suffix}@example.test`, workspaceMode: 'food' } });
    other = await prisma.user.create({ data: { name: 'Report Other', email: `report-other-${suffix}@example.test`, workspaceMode: 'food' } });
    const branchA = await prisma.foodBranch.create({ data: { userId: owner.id, name: `Report A ${suffix}`, isMain: true } });
    const branchB = await prisma.foodBranch.create({ data: { userId: owner.id, name: `Report B ${suffix}` } });
    const order = await prisma.foodOrder.create({ data: { userId: owner.id, branchId: branchA.id, orderNumber: 1, orderState: 'active', paymentState: 'paid', orderType: 'delivery', total: 1000, subtotal: 1000 } });
    const delivery = await prisma.foodDelivery.create({ data: { userId: owner.id, branchId: branchA.id, orderId: order.id, courierUserId: owner.id, state: 'delivered', deliveredAt: new Date() } });
    const collection = await prisma.foodDeliveryCollection.create({ data: { organizationId: owner.id, branchId: branchA.id, orderId: order.id, deliveryId: delivery.id, courierUserId: owner.id, state: 'with_courier', expectedAmount: 600, actualAmount: 600, actualMethod: 'CASH' } });
    const session = await prisma.foodCashSession.create({ data: { organizationId: owner.id, branchId: branchA.id, openedByUserId: owner.id, totalSalesAmount: 400 } });
    await prisma.foodPayment.createMany({ data: [
      { userId: owner.id, branchId: branchA.id, orderId: order.id, cashSessionId: session.id, amount: 400, method: 'CASH', source: 'cashier', paidAt: new Date() },
      { userId: owner.id, branchId: branchA.id, orderId: order.id, deliveryCollectionId: collection.id, courierUserId: owner.id, amount: 600, method: 'CASH', source: 'delivery_collection', paidAt: new Date() },
    ] });
    await prisma.foodOrder.create({ data: { userId: owner.id, branchId: branchA.id, orderNumber: 2, orderState: 'cancelled', status: 'cancelled', orderType: 'pickup', total: 200, subtotal: 200 } });
    await prisma.foodOrder.create({ data: { userId: owner.id, branchId: branchB.id, orderNumber: 3, orderState: 'active', orderType: 'pickup', total: 5000, subtotal: 5000 } });
    await prisma.foodOrder.create({ data: { userId: other.id, orderNumber: 1, orderState: 'active', orderType: 'pickup', total: 9000, subtotal: 9000 } });
    const access = { organizationId: owner.id, personId: owner.id, roles: ['manager'], primaryRole: 'manager', branchIds: [branchA.id], canAccessBranch: (id) => id === branchA.id };
    const today = new Date().toISOString().slice(0, 10);
    const report = await getFoodOperationalReport(prisma, access, { from: today, to: today });
    assert.equal(report.summary.orders, 1);
    assert.equal(report.summary.cancelledOrders, 1);
    assert.equal(report.summary.orderValue, 1000);
    assert.equal(report.summary.received, 1000);
    assert.equal(report.summary.reconciled, 400);
    assert.equal(report.summary.heldByCouriers, 600);
    assert.equal(report.pending.collections.length, 1);
    assert.equal(report.byBranch.length, 1);
    assert.equal(report.byBranch[0].branchId, branchA.id);
    const otherReport = await getFoodOperationalReport(prisma, { ...access, organizationId: other.id, personId: other.id, branchIds: null }, { from: today, to: today });
    assert.equal(otherReport.summary.orderValue, 9000);
    assert.equal(otherReport.summary.received, 0);
    await assert.rejects(
      getFoodOperationalReport(prisma, access, { from: today, to: today, branchId: branchB.id }),
      (error) => error.statusCode === 403 && error.code === 'FOOD_BRANCH_ACCESS_DENIED'
    );
  } finally {
    if (owner) {
      await prisma.foodOrder.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.foodCashSession.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodBranch.deleteMany({ where: { userId: owner.id } }).catch(() => {});
    }
    if (other) await prisma.foodOrder.deleteMany({ where: { userId: other.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [owner?.id, other?.id].filter(Boolean) } } }).catch(() => {});
    await prisma.$disconnect();
  }
});
