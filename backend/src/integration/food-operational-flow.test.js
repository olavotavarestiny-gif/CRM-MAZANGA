'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('fluxo operacional integra Caixa, Cozinha, Delivery e relatório com funções e unidade reais', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const { resolveFoodAccess } = require('../lib/food-access');
  const {
    acknowledgeKitchenTicket,
    createFoodOrder,
    executeDeliveryTransition,
    executeOrderCommand,
  } = require('../services/food-order.service');
  const {
    confirmDeliveryCollection,
    handoffDeliveryCollection,
    reconcileDeliveryCollection,
  } = require('../services/food-delivery-collection.service');
  const { getFoodOperationalReport } = require('../services/food-operational-report.service');

  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  let owner;
  let otherOwner;
  const people = [];

  function requestUser(person) {
    return {
      id: person.id,
      effectiveUserId: owner.id,
      accountOwnerId: owner.id,
      role: 'user',
      permissionsJson: null,
      planContext: { workspaceMode: 'food' },
    };
  }

  try {
    owner = await prisma.user.create({
      data: { name: 'Phase 8 Manager', email: `phase8-manager-${suffix}@example.test`, workspaceMode: 'food', role: 'admin' },
    });
    otherOwner = await prisma.user.create({
      data: { name: 'Phase 8 Other', email: `phase8-other-${suffix}@example.test`, workspaceMode: 'food', role: 'admin' },
    });
    for (const [role, name] of [
      ['cashier', 'Caixa'],
      ['kitchen', 'Cozinha'],
      ['delivery_manager', 'Gestor Delivery'],
      ['courier', 'Entregador'],
    ]) {
      const person = await prisma.user.create({
        data: {
          name: `Phase 8 ${name}`,
          email: `phase8-${role}-${suffix}@example.test`,
          workspaceMode: 'food',
          accountOwnerId: owner.id,
          role: 'user',
        },
      });
      people.push({ role, person });
    }

    await prisma.organizationModule.createMany({ data: [
      { organizationId: owner.id, module: 'food', enabled: true },
      { organizationId: otherOwner.id, module: 'food', enabled: true },
    ] });
    await prisma.foodSettings.createMany({ data: [
      { userId: owner.id, isEnabled: true },
      { userId: otherOwner.id, isEnabled: true },
    ] });
    const branch = await prisma.foodBranch.create({
      data: { userId: owner.id, name: `Phase 8 Principal ${suffix}`, isMain: true },
    });
    const restrictedBranch = await prisma.foodBranch.create({
      data: { userId: owner.id, name: `Phase 8 Restrita ${suffix}` },
    });
    await prisma.foodStaffRoleAssignment.createMany({
      data: people.map(({ role, person }) => ({
        organizationId: owner.id,
        personId: person.id,
        branchId: branch.id,
        role,
        isPrimary: true,
        createdByUserId: owner.id,
      })),
    });

    const accessByRole = {};
    for (const { role, person } of people) {
      accessByRole[role] = await resolveFoodAccess(prisma, requestUser(person));
    }
    const managerAccess = await resolveFoodAccess(prisma, {
      id: owner.id,
      effectiveUserId: owner.id,
      accountOwnerId: null,
      role: 'admin',
      planContext: { workspaceMode: 'food' },
    });
    assert.equal(accessByRole.cashier.can('orders.create'), true);
    assert.equal(accessByRole.cashier.can('kitchen.manage'), false);
    assert.equal(accessByRole.kitchen.can('kitchen.manage'), true);
    assert.equal(accessByRole.kitchen.can('delivery.dispatch'), false);
    assert.equal(accessByRole.delivery_manager.can('delivery.dispatch'), true);
    assert.equal(accessByRole.courier.can('delivery.update_own'), true);
    assert.equal(accessByRole.courier.can('orders.create'), false);
    assert.deepEqual(accessByRole.cashier.branchIds, [branch.id]);

    const cashier = people.find(({ role }) => role === 'cashier').person;
    const courier = people.find(({ role }) => role === 'courier').person;
    const shift = await prisma.foodShift.create({
      data: {
        organizationId: owner.id,
        branchId: branch.id,
        personId: cashier.id,
        status: 'open',
        createdByUserId: cashier.id,
      },
    });
    const cashSession = await prisma.foodCashSession.create({
      data: {
        organizationId: owner.id,
        branchId: branch.id,
        shiftId: shift.id,
        openedByUserId: cashier.id,
        openingBalance: 1000,
        expectedClosingAmount: 1000,
      },
    });
    const product = await prisma.foodProduct.create({
      data: {
        userId: owner.id,
        branchId: branch.id,
        internalCode: `PHASE8-${suffix}`,
        name: 'Menu integrado',
        price: 3000,
        preparationMinutes: 10,
      },
    });
    const ingredient = await prisma.foodIngredient.create({
      data: {
        organizationId: owner.id,
        branchId: branch.id,
        internalCode: `PHASE8-ING-${suffix}`,
        name: 'Ingrediente integrado',
        unit: 'un',
        currentStock: 20,
        averageCost: 100,
      },
    });
    await prisma.foodRecipeItem.create({
      data: {
        organizationId: owner.id,
        productId: product.id,
        ingredientId: ingredient.id,
        quantity: 1.5,
        unit: 'un',
      },
    });

    const createKey = `phase8-create-${suffix}`;
    const createInput = {
      branchId: branch.id,
      orderType: 'delivery',
      source: 'counter',
      sendToKitchen: false,
      paymentMethod: 'CASH',
      deliveryFee: 500,
      customerName: 'Cliente Fase 8',
      deliveryAddress: 'Rua de teste, Luanda',
      items: [{ productId: product.id, quantity: 2 }],
    };
    const created = await createFoodOrder(prisma, accessByRole.cashier, createInput, {
      idempotencyKey: createKey,
      origin: 'phase8-integration',
    });
    const repeatedCreate = await createFoodOrder(prisma, accessByRole.cashier, createInput, {
      idempotencyKey: createKey,
      origin: 'phase8-integration',
    });
    assert.equal(created.created, true);
    assert.equal(repeatedCreate.created, false);
    assert.equal(repeatedCreate.order.id, created.order.id);
    assert.equal(created.order.total, 6500);

    let order = created.order;
    const sendKey = `phase8-send-${suffix}`;
    const sent = await executeOrderCommand(prisma, accessByRole.cashier, order.id, 'send_to_kitchen', {}, {
      expectedVersion: order.version,
      idempotencyKey: sendKey,
      origin: 'phase8-cashier',
    });
    const repeatedSend = await executeOrderCommand(prisma, accessByRole.cashier, order.id, 'send_to_kitchen', {}, {
      expectedVersion: order.version,
      idempotencyKey: sendKey,
      origin: 'phase8-cashier',
    });
    order = sent.order;
    assert.equal(repeatedSend.order.version, order.version);
    assert.equal(order.kitchenState, 'queued');
    assert.equal((await prisma.foodIngredient.findUnique({ where: { id: ingredient.id } })).currentStock, 17);
    assert.equal(await prisma.foodStockMovement.count({ where: { referenceType: 'food_order', referenceId: order.id } }), 1);

    let ticket = await prisma.foodKitchenTicket.findUnique({ where: { orderId: order.id } });
    const acknowledgeKey = `phase8-ack-${suffix}`;
    await acknowledgeKitchenTicket(prisma, accessByRole.kitchen, ticket.id, {
      expectedVersion: ticket.version,
      idempotencyKey: acknowledgeKey,
      origin: 'phase8-kitchen',
    });
    const repeatedAcknowledgement = await acknowledgeKitchenTicket(prisma, accessByRole.kitchen, ticket.id, {
      expectedVersion: ticket.version,
      idempotencyKey: acknowledgeKey,
      origin: 'phase8-kitchen',
    });
    assert.ok(repeatedAcknowledgement.acknowledgedAt);
    order = await prisma.foodOrder.findUnique({ where: { id: order.id } });

    for (const command of ['kitchen_accept', 'kitchen_start', 'kitchen_ready']) {
      const result = await executeOrderCommand(prisma, accessByRole.kitchen, order.id, command, {}, {
        expectedVersion: order.version,
        idempotencyKey: `phase8-${command}-${suffix}`,
        origin: 'phase8-kitchen',
      });
      order = result.order;
    }
    assert.equal(order.kitchenState, 'ready');
    ticket = await prisma.foodKitchenTicket.findUnique({ where: { orderId: order.id } });
    assert.equal(ticket.state, 'ready');

    const delivery = await prisma.foodDelivery.findUnique({ where: { orderId: order.id } });
    const assignKey = `phase8-assign-${suffix}`;
    order = await executeDeliveryTransition(
      prisma,
      accessByRole.delivery_manager,
      delivery.id,
      'assigned',
      { courierUserId: courier.id },
      { idempotencyKey: assignKey }
    );
    const repeatedAssignment = await executeDeliveryTransition(
      prisma,
      accessByRole.delivery_manager,
      delivery.id,
      'assigned',
      { courierUserId: courier.id },
      { idempotencyKey: assignKey }
    );
    assert.equal(repeatedAssignment.version, order.version);
    assert.equal(await prisma.foodDeliveryCollection.count({ where: { deliveryId: delivery.id } }), 1);

    for (const nextState of ['picked_up', 'out_for_delivery', 'arrived']) {
      order = await executeDeliveryTransition(
        prisma,
        accessByRole.courier,
        delivery.id,
        nextState,
        {},
        { idempotencyKey: `phase8-delivery-${nextState}-${suffix}` }
      );
    }
    assert.equal(order.deliveryState, 'arrived');

    const confirmKey = `phase8-confirm-collection-${suffix}`;
    const collection = await confirmDeliveryCollection(
      prisma,
      accessByRole.courier,
      delivery.id,
      { received: true, method: 'CASH' },
      { idempotencyKey: confirmKey }
    );
    const repeatedCollection = await confirmDeliveryCollection(
      prisma,
      accessByRole.courier,
      delivery.id,
      { received: true, method: 'CASH' },
      { idempotencyKey: confirmKey }
    );
    assert.equal(collection.state, 'with_courier');
    assert.equal(repeatedCollection.id, collection.id);
    assert.equal(collection.actualAmount, 6500);
    assert.equal(await prisma.foodPayment.count({ where: { orderId: order.id } }), 1);

    const proof = await prisma.foodPrivateMedia.create({
      data: {
        organizationId: owner.id,
        uploadedByUserId: courier.id,
        kind: 'delivery_proof',
        storageUrl: `private://phase8/${suffix}.jpg`,
        mimeType: 'image/jpeg',
      },
    });
    order = await executeDeliveryTransition(
      prisma,
      accessByRole.courier,
      delivery.id,
      'delivered',
      { proofMediaId: proof.id },
      { idempotencyKey: `phase8-delivered-${suffix}` }
    );
    assert.equal(order.deliveryState, 'delivered');
    assert.equal(order.paymentState, 'paid');

    const handed = await handoffDeliveryCollection(
      prisma,
      accessByRole.courier,
      delivery.id,
      { idempotencyKey: `phase8-handoff-${suffix}` }
    );
    assert.equal(handed.state, 'handed_to_cashier');
    const reconcileKey = `phase8-reconcile-${suffix}`;
    const reconciled = await reconcileDeliveryCollection(
      prisma,
      managerAccess,
      collection.id,
      { countedAmount: 6500, cashSessionId: cashSession.id },
      { idempotencyKey: reconcileKey }
    );
    await reconcileDeliveryCollection(
      prisma,
      managerAccess,
      collection.id,
      { countedAmount: 6500, cashSessionId: cashSession.id },
      { idempotencyKey: reconcileKey }
    );
    assert.equal(reconciled.state, 'reconciled');

    order = await prisma.foodOrder.findUnique({ where: { id: order.id } });
    order = (await executeOrderCommand(prisma, managerAccess, order.id, 'complete', {}, {
      expectedVersion: order.version,
      idempotencyKey: `phase8-complete-${suffix}`,
      origin: 'phase8-management',
    })).order;
    assert.equal(order.orderState, 'completed');

    const finalSession = await prisma.foodCashSession.findUnique({ where: { id: cashSession.id } });
    assert.equal(finalSession.totalSalesAmount, 6500);
    assert.equal(finalSession.expectedClosingAmount, 7500);
    assert.equal(finalSession.salesCount, 1);
    assert.equal(finalSession.totalsByMethod.CASH, 6500);
    assert.equal((await prisma.foodPayment.findFirst({ where: { orderId: order.id } })).cashSessionId, cashSession.id);

    const events = await prisma.foodOrderEvent.findMany({
      where: { orderId: order.id },
      orderBy: { version: 'asc' },
      select: { version: true, eventType: true, actorRole: true, idempotencyKey: true },
    });
    assert.deepEqual(events.map((event) => event.version), events.map((_, index) => index + 1));
    assert.equal(new Set(events.map((event) => event.idempotencyKey).filter(Boolean)).size, events.filter((event) => event.idempotencyKey).length);
    assert.ok(events.some((event) => event.eventType === 'order.created' && event.actorRole === 'cashier'));
    assert.ok(events.some((event) => event.eventType === 'kitchen.ticket_acknowledged' && event.actorRole === 'kitchen'));
    assert.ok(events.some((event) => event.eventType === 'delivery.assigned' && event.actorRole === 'delivery_manager'));
    assert.ok(events.some((event) => event.eventType === 'payment.collected_by_courier' && event.actorRole === 'courier'));

    const today = new Date().toISOString().slice(0, 10);
    const report = await getFoodOperationalReport(prisma, managerAccess, { from: today, to: today, branchId: branch.id });
    assert.equal(report.summary.orders, 1);
    assert.equal(report.summary.orderValue, 6500);
    assert.equal(report.summary.received, 6500);
    assert.equal(report.summary.reconciled, 6500);
    assert.equal(report.summary.heldByCouriers, 0);
    assert.equal(report.summary.outstanding, 0);
    assert.equal(report.summary.delivered, 1);
    assert.equal(report.pending.collections.length, 0);

    await assert.rejects(
      getFoodOperationalReport(prisma, accessByRole.cashier, { from: today, to: today, branchId: restrictedBranch.id }),
      (error) => error.statusCode === 403 && error.code === 'FOOD_BRANCH_ACCESS_DENIED'
    );
    const otherAccess = await resolveFoodAccess(prisma, {
      id: otherOwner.id,
      effectiveUserId: otherOwner.id,
      accountOwnerId: null,
      role: 'admin',
      planContext: { workspaceMode: 'food' },
    });
    const otherReport = await getFoodOperationalReport(prisma, otherAccess, { from: today, to: today });
    assert.equal(otherReport.summary.orders, 0);
    assert.equal(otherReport.summary.received, 0);
  } finally {
    if (owner) {
      await prisma.foodOrder.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.foodPrivateMedia.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodStockMovement.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodCashSession.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodShift.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodRecipeItem.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodProduct.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.foodIngredient.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodStaffRoleAssignment.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodBranch.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.foodSettings.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.organizationModule.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
    }
    if (otherOwner) {
      await prisma.foodSettings.deleteMany({ where: { userId: otherOwner.id } }).catch(() => {});
      await prisma.organizationModule.deleteMany({ where: { organizationId: otherOwner.id } }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { id: { in: people.map(({ person }) => person.id) } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [owner?.id, otherOwner?.id].filter(Boolean) } } }).catch(() => {});
    await prisma.$disconnect();
  }
});
