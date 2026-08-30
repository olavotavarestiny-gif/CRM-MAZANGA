'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('HTTP Food aplica funções, unidade, idempotência e recuperação SSE', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.JWT_SECRET = `food-http-${crypto.randomUUID()}`;
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const prisma = require('../lib/prisma');
  const requireAuth = require('../middleware/auth');
  const { checkSubscriptionAccess } = require('../middleware/subscription-access');
  const foodV1Router = require('../routes/food-v1');

  const suffix = crypto.randomUUID();
  const app = express();
  app.use(express.json());
  app.use('/api/food/v1', requireAuth, checkSubscriptionAccess, foodV1Router);
  let server;
  let baseUrl;
  let owner;
  const people = [];

  function tokenFor(person) {
    return jwt.sign({
      type: 'impersonation',
      impersonatedUserId: person.id,
      impersonatorId: owner.id,
    }, process.env.JWT_SECRET, { expiresIn: '10m' });
  }

  async function request(method, path, token, body, extraHeaders = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        Connection: 'close',
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    return { status: response.status, headers: response.headers, data };
  }

  try {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    owner = await prisma.user.create({
      data: {
        name: 'HTTP Food Manager',
        email: `http-food-manager-${suffix}@example.test`,
        workspaceMode: 'food',
        role: 'admin',
        billingType: 'subscription',
        accountStatus: 'active',
      },
    });
    for (const [role, name] of [
      ['cashier', 'Caixa'],
      ['kitchen', 'Cozinha'],
      ['delivery_manager', 'Gestor Delivery'],
      ['courier', 'Entregador'],
      ['crm_marketing', 'CRM Marketing'],
    ]) {
      const person = await prisma.user.create({
        data: {
          name: `HTTP Food ${name}`,
          email: `http-food-${role}-${suffix}@example.test`,
          workspaceMode: 'food',
          accountOwnerId: owner.id,
          role: 'user',
        },
      });
      people.push({ role, person });
    }

    await prisma.organizationModule.create({ data: { organizationId: owner.id, module: 'food', enabled: true } });
    await prisma.foodSettings.create({ data: { userId: owner.id, isEnabled: true } });
    const branch = await prisma.foodBranch.create({
      data: { userId: owner.id, name: `HTTP Principal ${suffix}`, isMain: true },
    });
    const otherBranch = await prisma.foodBranch.create({
      data: { userId: owner.id, name: `HTTP Outra ${suffix}` },
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

    const cashier = people.find(({ role }) => role === 'cashier').person;
    const kitchen = people.find(({ role }) => role === 'kitchen').person;
    const deliveryManager = people.find(({ role }) => role === 'delivery_manager').person;
    const courier = people.find(({ role }) => role === 'courier').person;
    const crm = people.find(({ role }) => role === 'crm_marketing').person;
    const tokens = {
      manager: tokenFor(owner),
      cashier: tokenFor(cashier),
      kitchen: tokenFor(kitchen),
      deliveryManager: tokenFor(deliveryManager),
      courier: tokenFor(courier),
      crm: tokenFor(crm),
    };

    const shift = await prisma.foodShift.create({
      data: { organizationId: owner.id, branchId: branch.id, personId: cashier.id, status: 'open', createdByUserId: cashier.id },
    });
    await prisma.foodCashSession.create({
      data: { organizationId: owner.id, branchId: branch.id, shiftId: shift.id, openedByUserId: cashier.id },
    });
    const product = await prisma.foodProduct.create({
      data: { userId: owner.id, branchId: branch.id, internalCode: `HTTP-${suffix}`, name: 'Produto HTTP', price: 1200 },
    });

    const unauthenticated = await request('GET', '/api/food/v1/context', null);
    assert.equal(unauthenticated.status, 401);
    const cashierCurrentSession = await request('GET', `/api/food/v1/cash-sessions/current?branchId=${branch.id}`, tokens.cashier);
    const managerCurrentSession = await request('GET', `/api/food/v1/cash-sessions/current?branchId=${branch.id}`, tokens.manager);
    assert.equal(cashierCurrentSession.status, 200);
    assert.ok(cashierCurrentSession.data?.id);
    assert.equal(managerCurrentSession.status, 200);
    assert.equal(managerCurrentSession.data, null);

    const matrix = [
      ['GET', '/api/food/v1/settings', tokens.cashier, 200],
      ['GET', '/api/food/v1/products', tokens.cashier, 200],
      ['POST', '/api/food/v1/categories', tokens.cashier, 403, { name: 'Negada ao Caixa' }],
      ['GET', '/api/food/v1/kitchen/tickets', tokens.kitchen, 200],
      ['POST', '/api/food/v1/orders', tokens.kitchen, 403, { branchId: branch.id, items: [{ productId: product.id, quantity: 1 }] }],
      ['GET', '/api/food/v1/delivery/couriers', tokens.deliveryManager, 200],
      ['POST', '/api/food/v1/orders', tokens.deliveryManager, 403, { branchId: branch.id, items: [{ productId: product.id, quantity: 1 }] }],
      ['GET', '/api/food/v1/delivery', tokens.courier, 200],
      ['GET', '/api/food/v1/orders', tokens.courier, 403],
      ['GET', '/api/food/v1/marketing/overview', tokens.crm, 200],
      ['GET', '/api/food/v1/orders', tokens.crm, 403],
      ['GET', '/api/food/v1/management/reports/operational', tokens.manager, 200],
    ];
    for (const [method, path, token, expectedStatus, body] of matrix) {
      const response = await request(method, path, token, body);
      assert.equal(response.status, expectedStatus, `${method} ${path}`);
      if (expectedStatus === 403) assert.equal(response.data.code, 'FOOD_PERMISSION_DENIED');
    }

    const forbiddenBranch = await request(
      'GET',
      `/api/food/v1/products?branchId=${encodeURIComponent(otherBranch.id)}`,
      tokens.cashier
    );
    assert.equal(forbiddenBranch.status, 403);
    assert.equal(forbiddenBranch.data.code, 'FOOD_BRANCH_ACCESS_DENIED');

    const managerCategory = await request('POST', '/api/food/v1/categories', tokens.manager, {
      name: `HTTP Categoria ${suffix}`,
    });
    assert.equal(managerCategory.status, 201);

    const createKey = `http-create-${suffix}`;
    const orderInput = {
      branchId: branch.id,
      orderType: 'pickup',
      source: 'counter',
      sendToKitchen: false,
      items: [{ productId: product.id, quantity: 1 }],
    };
    const created = await request('POST', '/api/food/v1/orders', tokens.cashier, orderInput, {
      'Idempotency-Key': createKey,
      'X-Food-Origin': 'http-integration',
    });
    const repeatedCreate = await request('POST', '/api/food/v1/orders', tokens.cashier, orderInput, {
      'Idempotency-Key': createKey,
      'X-Food-Origin': 'http-integration',
    });
    assert.equal(created.status, 201);
    assert.equal(repeatedCreate.status, 200);
    assert.equal(repeatedCreate.data.id, created.data.id);
    assert.equal(await prisma.foodOrder.count({ where: { userId: owner.id, idempotencyKey: createKey } }), 1);

    const sendKey = `http-send-${suffix}`;
    const sendBody = { expectedVersion: created.data.version };
    const sent = await request(
      'POST',
      `/api/food/v1/orders/${created.data.id}/commands/send_to_kitchen`,
      tokens.cashier,
      sendBody,
      { 'Idempotency-Key': sendKey, 'X-Food-Origin': 'http-integration' }
    );
    const repeatedSend = await request(
      'POST',
      `/api/food/v1/orders/${created.data.id}/commands/send_to_kitchen`,
      tokens.cashier,
      sendBody,
      { 'Idempotency-Key': sendKey, 'X-Food-Origin': 'http-integration' }
    );
    assert.equal(sent.status, 200);
    assert.equal(repeatedSend.status, 200);
    assert.equal(repeatedSend.data.order.version, sent.data.order.version);
    assert.equal(await prisma.foodKitchenTicket.count({ where: { orderId: created.data.id } }), 1);

    const hiddenOrder = await prisma.foodOrder.create({
      data: {
        userId: owner.id,
        branchId: otherBranch.id,
        orderNumber: 999,
        status: 'draft',
        orderState: 'draft',
        kitchenState: 'not_required',
        deliveryState: 'not_required',
        paymentState: 'unpaid',
        version: 1,
        orderType: 'pickup',
        subtotal: 1,
        total: 1,
      },
    });
    await prisma.foodOrderEvent.create({
      data: {
        userId: owner.id,
        branchId: otherBranch.id,
        orderId: hiddenOrder.id,
        version: 1,
        eventType: 'order.created',
        actorUserId: owner.id,
        actorRole: 'manager',
        origin: 'http-integration',
        payload: {},
        idempotencyKey: `http-hidden-${suffix}`,
      },
    });

    const initialEvents = await request('GET', '/api/food/v1/events', tokens.kitchen, undefined, { Accept: 'application/json' });
    assert.equal(initialEvents.status, 200);
    assert.ok(initialEvents.data.events.some((event) => event.eventType === 'order.send_to_kitchen'));
    assert.ok(initialEvents.data.events.every((event) => event.branchId === branch.id));
    const managerEvents = await request('GET', '/api/food/v1/events', tokens.manager, undefined, { Accept: 'application/json' });
    assert.equal(managerEvents.status, 200);
    assert.ok(managerEvents.data.events.some((event) => event.branchId === otherBranch.id));
    const cursorBeforeAcknowledge = initialEvents.data.cursor;

    const ticket = await prisma.foodKitchenTicket.findUnique({ where: { orderId: created.data.id } });
    const acknowledged = await request(
      'POST',
      `/api/food/v1/kitchen/tickets/${ticket.id}/acknowledge`,
      tokens.kitchen,
      { expectedVersion: ticket.version },
      { 'Idempotency-Key': `http-ack-${suffix}`, 'X-Food-Origin': 'http-integration' }
    );
    assert.equal(acknowledged.status, 200);

    const recoveredEvents = await request(
      'GET',
      `/api/food/v1/events?cursor=${encodeURIComponent(cursorBeforeAcknowledge)}`,
      tokens.kitchen,
      undefined,
      { Accept: 'application/json' }
    );
    assert.equal(recoveredEvents.status, 200);
    assert.deepEqual(recoveredEvents.data.events.map((event) => event.eventType), ['kitchen.ticket_acknowledged']);

    const controller = new AbortController();
    const streamResponse = await fetch(`${baseUrl}/api/food/v1/events`, {
      headers: {
        Authorization: `Bearer ${tokens.kitchen}`,
        Accept: 'text/event-stream',
        Connection: 'close',
        'Last-Event-ID': recoveredEvents.data.cursor,
      },
      signal: controller.signal,
    });
    assert.equal(streamResponse.status, 200);
    assert.match(streamResponse.headers.get('content-type'), /^text\/event-stream/);
    const reader = streamResponse.body.getReader();
    const firstChunk = await reader.read();
    const streamText = new TextDecoder().decode(firstChunk.value);
    assert.match(streamText, /retry: 3000/);
    await reader.cancel().catch(() => {});
    controller.abort();

    const configuredPin = await request('POST', '/api/food/v1/team/credentials/self', tokens.cashier, { pin: '2468' });
    assert.equal(configuredPin.status, 200);
    const currentCash = await prisma.foodCashSession.findFirst({
      where: { organizationId: owner.id, openedByUserId: cashier.id, status: 'open' },
    });
    assert.ok(currentCash);
    const closedWorkday = await request(
      'POST',
      `/api/food/v1/cash-sessions/${currentCash.id}/close`,
      tokens.cashier,
      { closingCountedAmount: Number(currentCash.expectedClosingAmount), pin: '2468', deviceId: 'http-test', endShift: true }
    );
    assert.equal(closedWorkday.status, 200);
    assert.equal(closedWorkday.data.shiftEnded, true);
    assert.equal((await prisma.foodShift.findUnique({ where: { id: shift.id } })).status, 'closed');

    const reopenedWorkday = await request(
      'POST',
      '/api/food/v1/cash-sessions',
      tokens.cashier,
      { branchId: branch.id, openingBalance: 500, pin: '2468', deviceId: 'http-test', startShift: true }
    );
    assert.equal(reopenedWorkday.status, 201);
    const reopenedShift = await prisma.foodShift.findUnique({ where: { id: reopenedWorkday.data.shiftId } });
    assert.equal(reopenedShift.status, 'open');
    const reclosedWorkday = await request(
      'POST',
      `/api/food/v1/cash-sessions/${reopenedWorkday.data.id}/close`,
      tokens.cashier,
      { closingCountedAmount: 500, pin: '2468', deviceId: 'http-test', endShift: true }
    );
    assert.equal(reclosedWorkday.status, 200);
    assert.equal(reclosedWorkday.data.shiftEnded, true);
    assert.equal((await prisma.foodShift.findUnique({ where: { id: reopenedWorkday.data.shiftId } })).status, 'closed');

    await prisma.foodSettings.update({ where: { userId: owner.id }, data: { isEnabled: false } });
    const disabledContext = await request('GET', '/api/food/v1/context', tokens.cashier);
    const disabledOrders = await request('GET', '/api/food/v1/orders', tokens.cashier);
    assert.equal(disabledContext.status, 200);
    assert.equal(disabledOrders.status, 403);
    assert.equal(disabledOrders.data.code, 'FOOD_NOT_ENABLED');
  } finally {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeIdleConnections?.();
        server.closeAllConnections?.();
      });
    }
    if (owner) {
      await prisma.foodOrder.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.foodAuditEvent.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodCashSession.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodShift.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodProduct.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.foodCategory.deleteMany({ where: { userId: owner.id } }).catch(() => {});
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
