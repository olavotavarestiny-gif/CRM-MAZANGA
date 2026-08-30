'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('cobrança do entregador só entra no caixa após entrega e reconciliação', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const { executeDeliveryTransition } = require('../services/food-order.service');
  const {
    confirmDeliveryCollection,
    handoffDeliveryCollection,
    reconcileDeliveryCollection,
  } = require('../services/food-delivery-collection.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  let owner;
  let courier;
  let stranger;
  try {
    owner = await prisma.user.create({ data: { name: 'Delivery Manager', email: `delivery-manager-${suffix}@example.test`, workspaceMode: 'food' } });
    courier = await prisma.user.create({ data: { name: 'Delivery Courier', email: `delivery-courier-${suffix}@example.test`, workspaceMode: 'food' } });
    stranger = await prisma.user.create({ data: { name: 'Other Tenant', email: `delivery-other-${suffix}@example.test`, workspaceMode: 'food' } });
    const branch = await prisma.foodBranch.create({ data: { userId: owner.id, name: `Delivery Collection ${suffix}`, isMain: true } });
    await prisma.foodSettings.create({ data: { userId: owner.id, isEnabled: true } });
    const order = await prisma.foodOrder.create({
      data: {
        userId: owner.id, branchId: branch.id, orderNumber: 1, status: 'awaiting_handoff', orderState: 'active',
        kitchenState: 'ready', deliveryState: 'awaiting_dispatch', paymentState: 'unpaid', paymentStatus: 'pending',
        paymentMethod: 'CASH', orderType: 'delivery', subtotal: 1000, total: 1000,
        delivery: { create: { userId: owner.id, branchId: branch.id, state: 'awaiting_dispatch' } },
      },
    });
    const delivery = await prisma.foodDelivery.findUnique({ where: { orderId: order.id } });
    const managerAccess = {
      organizationId: owner.id, personId: owner.id, roles: ['manager'], primaryRole: 'manager', branchIds: null,
      can: () => true, canAccessBranch: () => true,
    };
    const courierAccess = {
      organizationId: owner.id, personId: courier.id, roles: ['courier'], primaryRole: 'courier', branchIds: [branch.id],
      can: () => true, canAccessBranch: (id) => id === branch.id,
    };
    await executeDeliveryTransition(prisma, managerAccess, delivery.id, 'assigned', { courierUserId: courier.id }, { idempotencyKey: `assign-${suffix}` });
    const pending = await prisma.foodDeliveryCollection.findUnique({ where: { deliveryId: delivery.id } });
    assert.equal(pending.state, 'pending_collection');
    assert.equal(pending.expectedAmount, 1000);
    assert.equal(pending.courierUserId, courier.id);

    await prisma.foodDelivery.update({ where: { id: delivery.id }, data: { state: 'arrived', arrivedAt: new Date() } });
    await prisma.foodOrder.update({ where: { id: order.id }, data: { deliveryState: 'arrived', status: 'out_for_delivery' } });
    const confirmKey = `confirm-${suffix}`;
    const confirmed = await confirmDeliveryCollection(prisma, courierAccess, delivery.id, { received: true, method: 'CASH', amount: 1 }, { idempotencyKey: confirmKey });
    assert.equal(confirmed.state, 'with_courier');
    assert.equal(confirmed.actualAmount, 1000);
    assert.equal(confirmed.payment.amount, 1000);
    assert.equal(confirmed.payment.cashSessionId, null);
    assert.equal(confirmed.payment.source, 'delivery_collection');
    const repeatedConfirm = await confirmDeliveryCollection(prisma, courierAccess, delivery.id, { received: true, method: 'CASH' }, { idempotencyKey: confirmKey });
    assert.equal(repeatedConfirm.id, confirmed.id);
    assert.equal(await prisma.foodPayment.count({ where: { orderId: order.id } }), 1);
    assert.equal((await prisma.foodOrder.findUnique({ where: { id: order.id } })).paymentState, 'paid');

    await prisma.foodDelivery.update({ where: { id: delivery.id }, data: { state: 'failed', failureReason: 'Teste de reatribuição' } });
    await assert.rejects(
      executeDeliveryTransition(prisma, managerAccess, delivery.id, 'assigned', { courierUserId: owner.id }, { idempotencyKey: `unsafe-reassign-${suffix}` }),
      (error) => error.statusCode === 409 && error.code === 'FOOD_DELIVERY_COLLECTION_CUSTODY_ACTIVE'
    );
    assert.equal((await prisma.foodDeliveryCollection.findUnique({ where: { id: pending.id } })).state, 'with_courier');
    await prisma.foodDelivery.update({ where: { id: delivery.id }, data: { state: 'arrived', failureReason: null } });

    await assert.rejects(
      confirmDeliveryCollection(prisma, { ...courierAccess, organizationId: stranger.id }, delivery.id, { received: true, method: 'CASH' }, { idempotencyKey: `tenant-${suffix}` }),
      (error) => error.statusCode === 409 || error.statusCode === 404
    );
    const handed = await handoffDeliveryCollection(prisma, courierAccess, delivery.id, { idempotencyKey: `handoff-${suffix}` });
    assert.equal(handed.state, 'handed_to_cashier');
    const cashSession = await prisma.foodCashSession.create({
      data: { organizationId: owner.id, branchId: branch.id, openedByUserId: owner.id, openingBalance: 500, expectedClosingAmount: 500 },
    });
    const discrepancy = await reconcileDeliveryCollection(prisma, managerAccess, pending.id, { countedAmount: 900, reason: 'Faltam 100 AOA' }, { idempotencyKey: `difference-${suffix}` });
    assert.equal(discrepancy.state, 'discrepancy');
    assert.equal(discrepancy.discrepancyAmount, -100);
    assert.equal((await prisma.foodCashSession.findUnique({ where: { id: cashSession.id } })).totalSalesAmount, 0);

    const reconcileKey = `reconcile-${suffix}`;
    const reconciled = await reconcileDeliveryCollection(prisma, managerAccess, pending.id, { countedAmount: 1000 }, { idempotencyKey: reconcileKey });
    assert.equal(reconciled.state, 'reconciled');
    await reconcileDeliveryCollection(prisma, managerAccess, pending.id, { countedAmount: 1000 }, { idempotencyKey: reconcileKey });
    const finalSession = await prisma.foodCashSession.findUnique({ where: { id: cashSession.id } });
    const finalPayment = await prisma.foodPayment.findUnique({ where: { deliveryCollectionId: pending.id } });
    assert.equal(finalSession.totalSalesAmount, 1000);
    assert.equal(finalSession.expectedClosingAmount, 1500);
    assert.equal(finalSession.salesCount, 1);
    assert.equal(finalSession.totalsByMethod.CASH, 1000);
    assert.equal(finalPayment.cashSessionId, cashSession.id);
  } finally {
    if (owner) {
      await prisma.foodOrder.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.foodCashSession.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodSettings.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.foodBranch.deleteMany({ where: { userId: owner.id } }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { id: { in: [owner?.id, courier?.id, stranger?.id].filter(Boolean) } } }).catch(() => {});
    await prisma.$disconnect();
  }
});
