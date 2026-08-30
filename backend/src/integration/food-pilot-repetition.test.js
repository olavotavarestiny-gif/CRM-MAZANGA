'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('piloto repete dez pedidos e cinco entregas sem duplicar efeitos operacionais', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const { resolveFoodAccess } = require('../lib/food-access');
  const {
    acknowledgeKitchenTicket,
    createFoodOrder,
    executeDeliveryTransition,
    executeOrderCommand,
    recordPayment,
  } = require('../services/food-order.service');
  const { getFoodOperationalReport } = require('../services/food-operational-report.service');

  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  const people = [];
  let owner;

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
      data: { name: 'Pilot Manager', email: `pilot-manager-${suffix}@example.test`, workspaceMode: 'food', role: 'admin' },
    });
    for (const [role, name] of [
      ['cashier', 'Caixa'],
      ['kitchen', 'Cozinha'],
      ['delivery_manager', 'Gestor Delivery'],
      ['courier', 'Entregador A'],
      ['courier', 'Entregador B'],
    ]) {
      const person = await prisma.user.create({
        data: {
          name: `Pilot ${name}`,
          email: `pilot-${role}-${people.length}-${suffix}@example.test`,
          workspaceMode: 'food',
          accountOwnerId: owner.id,
        },
      });
      people.push({ role, person });
    }

    await prisma.organizationModule.create({ data: { organizationId: owner.id, module: 'food', enabled: true } });
    await prisma.foodSettings.create({ data: { userId: owner.id, isEnabled: true } });
    const branch = await prisma.foodBranch.create({
      data: { userId: owner.id, name: `Pilot Principal ${suffix}`, isMain: true },
    });
    await prisma.foodStaffRoleAssignment.createMany({
      data: people.map(({ role, person }, index) => ({
        organizationId: owner.id,
        personId: person.id,
        branchId: branch.id,
        role,
        isPrimary: index < 4,
        createdByUserId: owner.id,
      })),
    });

    const cashier = people.find(({ role }) => role === 'cashier').person;
    const kitchen = people.find(({ role }) => role === 'kitchen').person;
    const deliveryManager = people.find(({ role }) => role === 'delivery_manager').person;
    const couriers = people.filter(({ role }) => role === 'courier').map(({ person }) => person);
    const cashierAccess = await resolveFoodAccess(prisma, requestUser(cashier));
    const kitchenAccess = await resolveFoodAccess(prisma, requestUser(kitchen));
    const deliveryManagerAccess = await resolveFoodAccess(prisma, requestUser(deliveryManager));
    const courierAccess = await Promise.all(couriers.map((courier) => resolveFoodAccess(prisma, requestUser(courier))));
    const managerAccess = await resolveFoodAccess(prisma, {
      id: owner.id,
      effectiveUserId: owner.id,
      accountOwnerId: null,
      role: 'admin',
      planContext: { workspaceMode: 'food' },
    });

    const shift = await prisma.foodShift.create({
      data: { organizationId: owner.id, branchId: branch.id, personId: cashier.id, status: 'open', createdByUserId: cashier.id },
    });
    const cashSession = await prisma.foodCashSession.create({
      data: {
        organizationId: owner.id,
        branchId: branch.id,
        shiftId: shift.id,
        openedByUserId: cashier.id,
        openingBalance: 500,
        expectedClosingAmount: 500,
      },
    });
    const product = await prisma.foodProduct.create({
      data: {
        userId: owner.id,
        branchId: branch.id,
        internalCode: `PILOT-${suffix}`,
        name: 'Produto piloto',
        price: 1000,
        preparationMinutes: 5,
      },
    });
    const ingredient = await prisma.foodIngredient.create({
      data: {
        organizationId: owner.id,
        branchId: branch.id,
        internalCode: `PILOT-ING-${suffix}`,
        name: 'Ingrediente piloto',
        unit: 'un',
        currentStock: 100,
        averageCost: 100,
      },
    });
    await prisma.foodRecipeItem.create({
      data: { organizationId: owner.id, productId: product.id, ingredientId: ingredient.id, quantity: 1, unit: 'un' },
    });

    async function createDraftOrder(index, orderType) {
      const input = {
        branchId: branch.id,
        orderType,
        source: 'counter',
        sendToKitchen: false,
        paymentMethod: 'CASH',
        deliveryFee: orderType === 'delivery' ? 100 : 0,
        customerName: `Cliente piloto ${index}`,
        deliveryAddress: orderType === 'delivery' ? `Destino piloto ${index}` : undefined,
        items: [{ productId: product.id, quantity: 1 }],
      };
      const key = `pilot-create-${index}-${suffix}`;
      const created = await createFoodOrder(prisma, cashierAccess, input, { idempotencyKey: key, origin: 'pilot-cashier' });
      const repeated = await createFoodOrder(prisma, cashierAccess, input, { idempotencyKey: key, origin: 'pilot-cashier' });
      assert.equal(created.created, true);
      assert.equal(repeated.created, false);
      assert.equal(repeated.order.id, created.order.id);
      return created.order;
    }

    async function prepareOrder(order, index) {
      const sendKey = `pilot-send-${index}-${suffix}`;
      const sent = await executeOrderCommand(prisma, cashierAccess, order.id, 'send_to_kitchen', {}, {
        expectedVersion: order.version,
        idempotencyKey: sendKey,
        origin: 'pilot-cashier',
      });
      const repeated = await executeOrderCommand(prisma, cashierAccess, order.id, 'send_to_kitchen', {}, {
        expectedVersion: order.version,
        idempotencyKey: sendKey,
        origin: 'pilot-cashier',
      });
      assert.equal(repeated.order.version, sent.order.version);
      order = sent.order;

      const ticket = await prisma.foodKitchenTicket.findUnique({ where: { orderId: order.id } });
      await acknowledgeKitchenTicket(prisma, kitchenAccess, ticket.id, {
        expectedVersion: ticket.version,
        idempotencyKey: `pilot-ack-${index}-${suffix}`,
        origin: 'pilot-kitchen',
      });
      order = await prisma.foodOrder.findUnique({ where: { id: order.id } });
      for (const command of ['kitchen_accept', 'kitchen_start', 'kitchen_ready']) {
        order = (await executeOrderCommand(prisma, kitchenAccess, order.id, command, {}, {
          expectedVersion: order.version,
          idempotencyKey: `pilot-${command}-${index}-${suffix}`,
          origin: 'pilot-kitchen',
        })).order;
      }
      return order;
    }

    const counterOrders = [];
    for (let index = 1; index <= 10; index += 1) {
      let order = await createDraftOrder(index, 'pickup');
      order = await prepareOrder(order, index);
      order = (await executeOrderCommand(prisma, cashierAccess, order.id, 'complete', {}, {
        expectedVersion: order.version,
        idempotencyKey: `pilot-complete-counter-${index}-${suffix}`,
        origin: 'pilot-cashier',
      })).order;
      counterOrders.push(order);
    }

    assert.deepEqual(counterOrders.map((order) => order.orderNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.ok(counterOrders.every((order) => order.orderState === 'completed' && order.kitchenState === 'ready'));
    assert.equal(await prisma.foodOrder.count({ where: { userId: owner.id } }), 10);
    assert.equal(await prisma.foodKitchenTicket.count({ where: { userId: owner.id, state: 'collected' } }), 10);
    assert.equal(await prisma.foodStockMovement.count({ where: { organizationId: owner.id, type: 'consumption' } }), 10);
    assert.equal((await prisma.foodIngredient.findUnique({ where: { id: ingredient.id } })).currentStock, 90);

    const deliveryOrders = [];
    for (let index = 11; index <= 15; index += 1) {
      let order = await createDraftOrder(index, 'delivery');
      order = await prepareOrder(order, index);
      const paymentKey = `pilot-payment-${index}-${suffix}`;
      const payment = await recordPayment(prisma, cashierAccess, order.id, {
        amount: order.total,
        method: 'CASH',
        cashSessionId: cashSession.id,
      }, { idempotencyKey: paymentKey });
      const repeatedPayment = await recordPayment(prisma, cashierAccess, order.id, {
        amount: order.total,
        method: 'CASH',
        cashSessionId: cashSession.id,
      }, { idempotencyKey: paymentKey });
      assert.equal(repeatedPayment.id, payment.id);

      const delivery = await prisma.foodDelivery.findUnique({ where: { orderId: order.id } });
      const firstCourierIndex = index === 12 ? 0 : index % 2;
      order = await executeDeliveryTransition(
        prisma,
        deliveryManagerAccess,
        delivery.id,
        'assigned',
        { courierUserId: couriers[firstCourierIndex].id },
        { idempotencyKey: `pilot-assign-${index}-${suffix}` }
      );

      let activeCourierIndex = firstCourierIndex;
      if (index === 12) {
        order = await executeDeliveryTransition(
          prisma,
          courierAccess[0],
          delivery.id,
          'failed',
          { reason: 'Avaria temporária da viatura' },
          { idempotencyKey: `pilot-failed-${index}-${suffix}` }
        );
        order = await executeDeliveryTransition(
          prisma,
          deliveryManagerAccess,
          delivery.id,
          'assigned',
          { courierUserId: couriers[1].id },
          { idempotencyKey: `pilot-reassign-${index}-${suffix}` }
        );
        activeCourierIndex = 1;
      }

      order = await executeDeliveryTransition(
        prisma,
        courierAccess[activeCourierIndex],
        delivery.id,
        'picked_up',
        {},
        { idempotencyKey: `pilot-picked-up-${index}-${suffix}` }
      );
      order = await executeDeliveryTransition(
        prisma,
        courierAccess[activeCourierIndex],
        delivery.id,
        'out_for_delivery',
        {},
        { idempotencyKey: `pilot-out-${index}-${suffix}` }
      );

      if (index === 13) {
        order = await executeDeliveryTransition(
          prisma,
          courierAccess[activeCourierIndex],
          delivery.id,
          'returned',
          { reason: 'Cliente recusou a receção do pedido' },
          { idempotencyKey: `pilot-returned-${index}-${suffix}` }
        );
      } else {
        order = await executeDeliveryTransition(
          prisma,
          courierAccess[activeCourierIndex],
          delivery.id,
          'arrived',
          {},
          { idempotencyKey: `pilot-arrived-${index}-${suffix}` }
        );
        const proof = await prisma.foodPrivateMedia.create({
          data: {
            organizationId: owner.id,
            uploadedByUserId: couriers[activeCourierIndex].id,
            kind: 'delivery_proof',
            storageUrl: `private://pilot/${index}-${suffix}.jpg`,
            mimeType: 'image/jpeg',
          },
        });
        order = await executeDeliveryTransition(
          prisma,
          courierAccess[activeCourierIndex],
          delivery.id,
          'delivered',
          { proofMediaId: proof.id },
          { idempotencyKey: `pilot-delivered-${index}-${suffix}` }
        );
        order = (await executeOrderCommand(prisma, managerAccess, order.id, 'complete', {}, {
          expectedVersion: order.version,
          idempotencyKey: `pilot-complete-delivery-${index}-${suffix}`,
          origin: 'pilot-management',
        })).order;
      }
      deliveryOrders.push(order);
    }

    assert.deepEqual(deliveryOrders.map((order) => order.orderNumber), [11, 12, 13, 14, 15]);
    assert.equal(deliveryOrders.filter((order) => order.deliveryState === 'delivered' && order.orderState === 'completed').length, 4);
    assert.equal(deliveryOrders.filter((order) => order.deliveryState === 'returned').length, 1);
    assert.equal(await prisma.foodDelivery.count({ where: { userId: owner.id, state: 'delivered' } }), 4);
    assert.equal(await prisma.foodDelivery.count({ where: { userId: owner.id, state: 'returned' } }), 1);
    assert.equal(await prisma.foodDeliveryCollection.count({ where: { organizationId: owner.id } }), 0);
    assert.equal(await prisma.foodPayment.count({ where: { userId: owner.id } }), 5);
    assert.equal(await prisma.foodPrivateMedia.count({ where: { organizationId: owner.id } }), 4);
    assert.equal(await prisma.foodStockMovement.count({ where: { organizationId: owner.id, type: 'consumption' } }), 15);
    assert.equal((await prisma.foodIngredient.findUnique({ where: { id: ingredient.id } })).currentStock, 85);

    const reassignedOrder = deliveryOrders.find((order) => order.orderNumber === 12);
    const reassignmentEvents = await prisma.foodOrderEvent.findMany({
      where: { orderId: reassignedOrder.id, eventType: { in: ['delivery.assigned', 'delivery.failed'] } },
      orderBy: { version: 'asc' },
    });
    assert.deepEqual(reassignmentEvents.map((event) => event.eventType), ['delivery.assigned', 'delivery.failed', 'delivery.assigned']);
    assert.deepEqual(reassignmentEvents.map((event) => event.actorRole), ['delivery_manager', 'courier', 'delivery_manager']);
    const returnedOrder = deliveryOrders.find((order) => order.orderNumber === 13);
    assert.equal(await prisma.foodOrderEvent.count({ where: { orderId: returnedOrder.id, eventType: 'delivery.returned' } }), 1);

    const allEvents = await prisma.foodOrderEvent.findMany({
      where: { userId: owner.id },
      select: { orderId: true, version: true, idempotencyKey: true },
      orderBy: [{ orderId: 'asc' }, { version: 'asc' }],
    });
    for (const orderId of new Set(allEvents.map((event) => event.orderId))) {
      const versions = allEvents.filter((event) => event.orderId === orderId).map((event) => event.version);
      assert.deepEqual(versions, versions.map((_, index) => index + 1));
    }
    const keys = allEvents.map((event) => event.idempotencyKey).filter(Boolean);
    assert.equal(new Set(keys).size, keys.length);

    const finalSession = await prisma.foodCashSession.findUnique({ where: { id: cashSession.id } });
    assert.equal(finalSession.totalSalesAmount, 5500);
    assert.equal(finalSession.expectedClosingAmount, 6000);
    assert.equal(finalSession.salesCount, 5);
    assert.equal(finalSession.totalsByMethod.CASH, 5500);

    const today = new Date().toISOString().slice(0, 10);
    const report = await getFoodOperationalReport(prisma, managerAccess, { from: today, to: today, branchId: branch.id });
    assert.equal(report.summary.orders, 15);
    assert.equal(report.summary.orderValue, 15500);
    assert.equal(report.summary.received, 5500);
    assert.equal(report.summary.reconciled, 5500);
    assert.equal(report.summary.outstanding, 10000);
    assert.equal(report.summary.delivered, 4);
    assert.equal(report.summary.failedDeliveries, 1);
    assert.equal(report.summary.deliverySuccessRate, 80);
    assert.equal(report.stock.movementCount, 15);
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
    await prisma.user.deleteMany({ where: { id: { in: people.map(({ person }) => person.id) } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: owner?.id } }).catch(() => {});
    await prisma.$disconnect();
  }
});
