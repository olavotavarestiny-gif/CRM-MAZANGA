'use strict';

const crypto = require('node:crypto');

const ORDER_COUNT = 5000;
const EVENT_COUNT_PER_ORDER = 3;
const TICKET_COUNT = 1500;
const DELIVERY_COUNT = 1000;
const MEASURED_RUNS = 9;

function assertSafeDatabase() {
  if (process.env.FOOD_PROFILE_ALLOW_WRITE !== '1') {
    throw new Error('Defina FOOD_PROFILE_ALLOW_WRITE=1 para executar o profiler.');
  }
  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  if (databaseUrl.pathname !== '/kukugest_test') {
    throw new Error(`O profiler só pode escrever em kukugest_test; recebido ${databaseUrl.pathname || 'sem base'}.`);
  }
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return sorted[index];
}

function milliseconds(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function round(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

async function inChunks(rows, size, operation) {
  for (let index = 0; index < rows.length; index += size) {
    await operation(rows.slice(index, index + size));
  }
}

async function measure(operation, runs = MEASURED_RUNS) {
  await operation();
  await operation();
  const samples = [];
  for (let index = 0; index < runs; index += 1) {
    const startedAt = process.hrtime.bigint();
    await operation();
    samples.push(milliseconds(startedAt));
  }
  return {
    runs,
    minMs: round(Math.min(...samples)),
    p50Ms: round(percentile(samples, 50)),
    p95Ms: round(percentile(samples, 95)),
    maxMs: round(Math.max(...samples)),
  };
}

function collectPlanNodes(node, nodes = []) {
  nodes.push({
    nodeType: node['Node Type'],
    relation: node['Relation Name'] || null,
    index: node['Index Name'] || null,
    actualRows: node['Actual Rows'],
    rowsRemovedByFilter: node['Rows Removed by Filter'] || 0,
    sortMethod: node['Sort Method'] || null,
    sharedHitBlocks: node['Shared Hit Blocks'] || 0,
    sharedReadBlocks: node['Shared Read Blocks'] || 0,
  });
  for (const child of node.Plans || []) collectPlanNodes(child, nodes);
  return nodes;
}

async function explain(prisma, name, sql, ...params) {
  const rows = await prisma.$queryRawUnsafe(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
    ...params
  );
  const document = rows[0]['QUERY PLAN'][0];
  const nodes = collectPlanNodes(document.Plan);
  return {
    name,
    planningMs: round(document['Planning Time']),
    executionMs: round(document['Execution Time']),
    root: document.Plan['Node Type'],
    indexes: [...new Set(nodes.map((node) => node.index).filter(Boolean))],
    sequentialScans: nodes.filter((node) => node.nodeType === 'Seq Scan').map((node) => ({
      relation: node.relation,
      actualRows: node.actualRows,
      rowsRemovedByFilter: node.rowsRemovedByFilter,
    })),
    sorts: nodes.filter((node) => node.nodeType.includes('Sort')).map((node) => ({
      nodeType: node.nodeType,
      sortMethod: node.sortMethod,
      actualRows: node.actualRows,
    })),
    nodes,
  };
}

async function main() {
  assertSafeDatabase();
  const { PrismaClient } = require('@prisma/client');
  const { listFoodOrders } = require('../src/services/food-order.service');
  const { getFoodOperationalReport } = require('../src/services/food-operational-report.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  let owner;

  try {
    const seedStartedAt = process.hrtime.bigint();
    owner = await prisma.user.create({
      data: { name: 'Food Profiler', email: `food-profiler-${suffix}@example.test`, workspaceMode: 'food' },
    });
    await prisma.organizationModule.create({ data: { organizationId: owner.id, module: 'food', enabled: true } });
    await prisma.foodSettings.create({ data: { userId: owner.id, isEnabled: true } });
    const branchA = await prisma.foodBranch.create({ data: { userId: owner.id, name: `Profiler A ${suffix}`, isMain: true } });
    const branchB = await prisma.foodBranch.create({ data: { userId: owner.id, name: `Profiler B ${suffix}` } });
    const states = ['draft', 'sent_to_kitchen', 'preparing', 'ready', 'completed'];
    const kitchenStates = ['not_required', 'queued', 'preparing', 'ready', 'ready'];
    const baseTime = Date.now() - (ORDER_COUNT * 1000);
    const orderRows = Array.from({ length: ORDER_COUNT }, (_, index) => ({
      userId: owner.id,
      branchId: index % 5 === 0 ? branchB.id : branchA.id,
      orderNumber: index + 1,
      status: states[index % states.length],
      orderState: index % states.length === 0 ? 'draft' : index % states.length === 4 ? 'completed' : 'active',
      kitchenState: kitchenStates[index % kitchenStates.length],
      deliveryState: 'not_required',
      paymentState: 'unpaid',
      orderType: 'pickup',
      source: 'performance-profile',
      customerName: `Cliente profiler ${index % 250}`,
      subtotal: 1000 + index,
      total: 1000 + index,
      createdAt: new Date(baseTime + (index * 1000)),
    }));
    await inChunks(orderRows, 1000, (data) => prisma.foodOrder.createMany({ data }));
    const orders = await prisma.foodOrder.findMany({
      where: { userId: owner.id },
      select: { id: true, branchId: true, orderNumber: true, createdAt: true },
      orderBy: { orderNumber: 'asc' },
    });

    const eventRows = orders.flatMap((order) => [1, 2, 3].map((version) => ({
      userId: owner.id,
      branchId: order.branchId,
      orderId: order.id,
      version,
      eventType: version === 1 ? 'order.created' : version === 2 ? 'order.send_to_kitchen' : 'kitchen.ticket_acknowledged',
      actorUserId: owner.id,
      actorRole: 'manager',
      origin: 'performance-profile',
      payload: {},
      idempotencyKey: `profile-event-${order.orderNumber}-${version}-${suffix}`,
      occurredAt: new Date(order.createdAt.getTime() + version),
    })));
    await inChunks(eventRows, 1000, (data) => prisma.foodOrderEvent.createMany({ data }));

    const ticketStates = ['queued', 'accepted', 'preparing', 'ready'];
    await inChunks(orders.slice(0, TICKET_COUNT).map((order, index) => ({
      userId: owner.id,
      branchId: order.branchId,
      orderId: order.id,
      state: ticketStates[index % ticketStates.length],
      createdAt: order.createdAt,
    })), 500, (data) => prisma.foodKitchenTicket.createMany({ data }));

    const deliveryStates = ['awaiting_dispatch', 'assigned', 'picked_up', 'out_for_delivery', 'arrived'];
    await inChunks(orders.slice(TICKET_COUNT, TICKET_COUNT + DELIVERY_COUNT).map((order, index) => ({
      userId: owner.id,
      branchId: order.branchId,
      orderId: order.id,
      state: deliveryStates[index % deliveryStates.length],
      createdAt: order.createdAt,
    })), 500, (data) => prisma.foodDelivery.createMany({ data }));

    await prisma.$executeRawUnsafe('ANALYZE "food_orders"');
    await prisma.$executeRawUnsafe('ANALYZE "food_order_events"');
    await prisma.$executeRawUnsafe('ANALYZE "food_kitchen_tickets"');
    await prisma.$executeRawUnsafe('ANALYZE "food_deliveries"');

    const cursorEvent = eventRows[Math.floor(eventRows.length * 0.75)];
    const orderSql = `SELECT "id" FROM "food_orders"
      WHERE "userId" = $1 AND "branchId" = $2
        AND "status" IN ('draft', 'sent_to_kitchen', 'preparing', 'ready')
      ORDER BY "createdAt" DESC LIMIT 100`;
    const kitchenSql = `SELECT "id" FROM "food_kitchen_tickets"
      WHERE "userId" = $1 AND "branchId" = $2
        AND "state" IN ('queued', 'accepted', 'preparing', 'ready')
      ORDER BY "createdAt" ASC LIMIT 200`;
    const deliverySql = `SELECT "id" FROM "food_deliveries"
      WHERE "userId" = $1 AND "branchId" = $2
        AND "state" IN ('awaiting_dispatch', 'assigned', 'picked_up', 'out_for_delivery', 'arrived')
      ORDER BY "createdAt" ASC LIMIT 200`;
    const eventsSql = `SELECT "id" FROM "food_order_events"
      WHERE "userId" = $1
        AND "branchId" = $2
        AND ("occurredAt", "id") > ($3, $4)
      ORDER BY "occurredAt" ASC, "id" ASC LIMIT 200`;

    const access = {
      organizationId: owner.id,
      personId: owner.id,
      roles: ['manager'],
      primaryRole: 'manager',
      branchIds: [branchA.id],
      can: () => true,
      canAccessBranch: (branchId) => branchId === branchA.id,
    };
    const from = new Date(baseTime).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    const result = {
      generatedAt: new Date().toISOString(),
      safety: { database: 'kukugest_test', fixtureRemovedOnExit: true },
      dataset: {
        orders: ORDER_COUNT,
        events: ORDER_COUNT * EVENT_COUNT_PER_ORDER,
        kitchenTickets: TICKET_COUNT,
        deliveries: DELIVERY_COUNT,
        primaryBranchOrders: orderRows.filter((order) => order.branchId === branchA.id).length,
      },
      seedMs: round(milliseconds(seedStartedAt)),
      latency: {
        latestOrdersRaw: await measure(() => prisma.$queryRawUnsafe(orderSql, owner.id, branchA.id)),
        kitchenQueueRaw: await measure(() => prisma.$queryRawUnsafe(kitchenSql, owner.id, branchA.id)),
        deliveryQueueRaw: await measure(() => prisma.$queryRawUnsafe(deliverySql, owner.id, branchA.id)),
        eventRecoveryRaw: await measure(() => prisma.$queryRawUnsafe(eventsSql, owner.id, branchA.id, cursorEvent.occurredAt, '')),
        orderAggregateService: await measure(() => listFoodOrders(prisma, access, { branchId: branchA.id, limit: 100 }), 5),
        operationalReportService: await measure(() => getFoodOperationalReport(prisma, access, { branchId: branchA.id, from, to }), 5),
      },
      plans: [
        await explain(prisma, 'latest_orders', orderSql, owner.id, branchA.id),
        await explain(prisma, 'kitchen_queue', kitchenSql, owner.id, branchA.id),
        await explain(prisma, 'delivery_queue', deliverySql, owner.id, branchA.id),
        await explain(prisma, 'event_recovery', eventsSql, owner.id, branchA.id, cursorEvent.occurredAt, ''),
      ],
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    if (owner) {
      await prisma.foodOrder.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.foodBranch.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.foodSettings.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.organizationModule.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: owner.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[food-profile]', error);
  process.exitCode = 1;
});
