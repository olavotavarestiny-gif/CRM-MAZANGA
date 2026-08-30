const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('Food V1 isola organização e unidade e torna comandos idempotentes', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const { acknowledgeKitchenTicket, createFoodOrder, executeOrderCommand, listFoodOrders } = require('../services/food-order.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  let ownerA;
  let ownerB;

  try {
    ownerA = await prisma.user.create({ data: { name: 'Food V1 A', email: `food-v1-a-${suffix}@example.test`, workspaceMode: 'servicos' } });
    ownerB = await prisma.user.create({ data: { name: 'Food V1 B', email: `food-v1-b-${suffix}@example.test`, workspaceMode: 'servicos' } });
    await prisma.organizationModule.createMany({ data: [
      { id: `module-a-${suffix}`, organizationId: ownerA.id, module: 'food', enabled: true },
      { id: `module-b-${suffix}`, organizationId: ownerB.id, module: 'food', enabled: true },
    ] });
    await prisma.foodSettings.createMany({ data: [
      { id: `settings-a-${suffix}`, userId: ownerA.id, isEnabled: true },
      { id: `settings-b-${suffix}`, userId: ownerB.id, isEnabled: true },
    ] });
    const branchA = await prisma.foodBranch.create({ data: { userId: ownerA.id, name: 'A Principal', isMain: true } });
    const branchB = await prisma.foodBranch.create({ data: { userId: ownerB.id, name: 'B Principal', isMain: true } });
    const product = await prisma.foodProduct.create({ data: { userId: ownerA.id, branchId: branchA.id, internalCode: `P-${suffix}`, name: 'Produto A', price: 2500 } });
    const ingredient = await prisma.foodIngredient.create({
      data: {
        organizationId: ownerA.id,
        branchId: branchA.id,
        internalCode: `I-${suffix}`,
        name: 'Ingrediente A',
        unit: 'un',
        currentStock: 10,
      },
    });
    await prisma.foodRecipeItem.create({
      data: { organizationId: ownerA.id, productId: product.id, ingredientId: ingredient.id, quantity: 2, unit: 'un' },
    });
    const ownerAccess = {
      organizationId: ownerA.id,
      personId: ownerA.id,
      primaryRole: 'manager',
      roles: ['manager'],
      can: () => true,
      canAccessBranch: () => true,
    };
    const createKey = `create-${suffix}`;
    const created = await createFoodOrder(prisma, ownerAccess, {
      branchId: branchA.id,
      orderType: 'pickup',
      source: 'integration-test',
      sendToKitchen: false,
      items: [{ productId: product.id, quantity: 1 }],
    }, { idempotencyKey: createKey, origin: 'integration-test' });
    const repeatedCreate = await createFoodOrder(prisma, ownerAccess, {
      branchId: branchA.id,
      orderType: 'pickup',
      source: 'integration-test',
      sendToKitchen: false,
      items: [{ productId: product.id, quantity: 1 }],
    }, { idempotencyKey: createKey, origin: 'integration-test' });
    assert.equal(created.created, true);
    assert.equal(repeatedCreate.created, false);
    assert.equal(repeatedCreate.order.id, created.order.id);
    assert.equal(created.order.orderNumber, 1);
    assert.equal(created.order.orderTypeLabel, 'Levantamento');
    assert.equal(created.order.paymentStatusLabel, 'Pendente');
    assert.deepEqual(created.order.statusHistory[0].metadata, { action: 'create', origin: 'integration-test' });
    assert.equal(await prisma.foodOrderEvent.count({ where: { orderId: created.order.id, idempotencyKey: createKey } }), 1);
    const listed = await listFoodOrders(prisma, ownerAccess, { branchId: branchA.id, search: '#1', status: 'draft' });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, created.order.id);
    assert.equal(listed[0].createdByName, ownerA.name);
    assert.equal((await listFoodOrders(prisma, { ...ownerAccess, organizationId: ownerB.id, personId: ownerB.id }, {})).length, 0);
    await assert.rejects(
      listFoodOrders(prisma, ownerAccess, { branchId: branchB.id }),
      (error) => error.statusCode === 400 && error.code === 'FOOD_BRANCH_INVALID'
    );
    await assert.rejects(
      listFoodOrders(prisma, ownerAccess, { status: 'estado-invalido' }),
      (error) => error.statusCode === 400 && error.code === 'FOOD_ORDER_STATUS_INVALID'
    );
    await assert.rejects(
      createFoodOrder(prisma, ownerAccess, {
        branchId: branchB.id,
        orderType: 'pickup',
        source: 'integration-test',
        sendToKitchen: false,
        items: [{ productId: product.id, quantity: 1 }],
      }, { idempotencyKey: `wrong-branch-${suffix}` }),
      (error) => error.statusCode === 400 && error.code === 'FOOD_BRANCH_INVALID'
    );

    const order = await prisma.foodOrder.create({
      data: {
        userId: ownerA.id,
        branchId: branchA.id,
        orderNumber: 2,
        status: 'draft',
        orderState: 'draft',
        kitchenState: 'not_required',
        deliveryState: 'not_required',
        paymentState: 'unpaid',
        version: 1,
        orderType: 'pickup',
        subtotal: 2500,
        total: 2500,
        items: { create: [{ userId: ownerA.id, productId: product.id, productName: product.name, unitPrice: 2500, quantity: 1, subtotal: 2500 }] },
      },
    });
    const idempotencyKey = `send-${suffix}`;
    const first = await executeOrderCommand(prisma, ownerAccess, order.id, 'send_to_kitchen', {}, { expectedVersion: 1, idempotencyKey, origin: 'integration-test' });
    const repeated = await executeOrderCommand(prisma, ownerAccess, order.id, 'send_to_kitchen', {}, { expectedVersion: 1, idempotencyKey, origin: 'integration-test' });

    assert.equal(first.order.version, 2);
    assert.equal(repeated.order.version, 2);
    assert.equal(repeated.order.kitchenState, 'queued');
    assert.equal(await prisma.foodKitchenTicket.count({ where: { orderId: order.id } }), 1);
    assert.equal(await prisma.foodOrderEvent.count({ where: { orderId: order.id, idempotencyKey } }), 1);
    assert.equal((await prisma.foodIngredient.findUnique({ where: { id: ingredient.id } })).currentStock, 8);
    assert.equal(await prisma.foodStockMovement.count({ where: { referenceType: 'food_order', referenceId: order.id } }), 1);

    const ticket = await prisma.foodKitchenTicket.findUnique({ where: { orderId: order.id } });
    const acknowledgeKey = `ack-${suffix}`;
    const acknowledged = await acknowledgeKitchenTicket(prisma, ownerAccess, ticket.id, { expectedVersion: ticket.version, idempotencyKey: acknowledgeKey, origin: 'integration-test' });
    const repeatedAcknowledgement = await acknowledgeKitchenTicket(prisma, ownerAccess, ticket.id, { expectedVersion: ticket.version, idempotencyKey: acknowledgeKey, origin: 'integration-test' });
    assert.ok(acknowledged.acknowledgedAt);
    assert.equal(repeatedAcknowledgement.id, acknowledged.id);
    assert.equal(await prisma.foodOrderEvent.count({ where: { orderId: order.id, idempotencyKey: acknowledgeKey } }), 1);
    await assert.rejects(
      acknowledgeKitchenTicket(prisma, { ...ownerAccess, organizationId: ownerB.id, personId: ownerB.id }, ticket.id, { idempotencyKey: `ack-other-${suffix}` }),
      (error) => error.statusCode === 404
    );

    await assert.rejects(
      executeOrderCommand(prisma, { ...ownerAccess, organizationId: ownerB.id, personId: ownerB.id }, order.id, 'cancel', { reason: 'Outro tenant' }),
      (error) => error.statusCode === 404
    );
    await assert.rejects(
      executeOrderCommand(prisma, { ...ownerAccess, canAccessBranch: (id) => id === branchB.id }, order.id, 'cancel', { reason: 'Unidade errada' }),
      (error) => error.statusCode === 403
    );

    const concurrentOrders = [];
    for (const orderNumber of [3, 4]) {
      concurrentOrders.push(await prisma.foodOrder.create({
        data: {
          userId: ownerA.id,
          branchId: branchA.id,
          orderNumber,
          status: 'draft',
          orderState: 'draft',
          kitchenState: 'not_required',
          deliveryState: 'not_required',
          paymentState: 'unpaid',
          version: 1,
          orderType: 'pickup',
          subtotal: 2500,
          total: 2500,
          items: { create: [{ userId: ownerA.id, productId: product.id, productName: product.name, unitPrice: 2500, quantity: 1, subtotal: 2500 }] },
        },
      }));
    }
    await Promise.all(concurrentOrders.map((candidate) => executeOrderCommand(
      prisma,
      ownerAccess,
      candidate.id,
      'send_to_kitchen',
      {},
      { expectedVersion: 1, idempotencyKey: `send-${candidate.id}`, origin: 'integration-test' }
    )));
    assert.equal((await prisma.foodIngredient.findUnique({ where: { id: ingredient.id } })).currentStock, 4);
    assert.equal(await prisma.foodStockMovement.count({ where: { organizationId: ownerA.id, type: 'consumption' } }), 3);
    const cancelled = await executeOrderCommand(
      prisma,
      ownerAccess,
      order.id,
      'cancel',
      { reason: 'Cliente desistiu' },
      { expectedVersion: 3, idempotencyKey: `cancel-${order.id}`, origin: 'integration-test' }
    );
    assert.equal(cancelled.order.orderState, 'cancelled');
    assert.equal(cancelled.order.kitchenState, 'not_required');
    assert.equal((await prisma.foodIngredient.findUnique({ where: { id: ingredient.id } })).currentStock, 6);
    assert.equal((await prisma.foodKitchenTicket.findUnique({ where: { orderId: order.id } })).state, 'cancelled');
  } finally {
    if (ownerA) {
      await prisma.foodStockMovement.deleteMany({ where: { organizationId: ownerA.id } }).catch(() => {});
      await prisma.foodOrder.deleteMany({ where: { userId: ownerA.id } }).catch(() => {});
      await prisma.foodProduct.deleteMany({ where: { userId: ownerA.id } }).catch(() => {});
      await prisma.foodIngredient.deleteMany({ where: { organizationId: ownerA.id } }).catch(() => {});
      await prisma.foodBranch.deleteMany({ where: { userId: ownerA.id } }).catch(() => {});
      await prisma.foodSettings.deleteMany({ where: { userId: ownerA.id } }).catch(() => {});
      await prisma.organizationModule.deleteMany({ where: { organizationId: ownerA.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: ownerA.id } }).catch(() => {});
    }
    if (ownerB) {
      await prisma.foodBranch.deleteMany({ where: { userId: ownerB.id } }).catch(() => {});
      await prisma.foodSettings.deleteMany({ where: { userId: ownerB.id } }).catch(() => {});
      await prisma.organizationModule.deleteMany({ where: { organizationId: ownerB.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: ownerB.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
});
