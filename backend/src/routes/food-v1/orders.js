const express = require('express');
const { Prisma } = require('@prisma/client');
const prisma = require('../../lib/prisma');
const {
  requireAnyFoodPermission,
  requireFoodPermission,
} = require('../../lib/food-access');
const { ORDER_COMMANDS, deriveDisplayStatus, domainError } = require('../../lib/food-domain');
const {
  acknowledgeKitchenTicket,
  createFoodOrder,
  executeOrderCommand,
  findOrderAggregate,
  idempotencyKeyFromRequest,
  listFoodOrders,
  resolveKitchenIssue,
  serializeOrderAggregate,
  updateKitchenItem,
} = require('../../services/food-order.service');
const { deriveKitchenAlert, isCashierEscalation } = require('../../lib/food-kitchen-alerts');
const { handleFoodV1Error } = require('./errors');
const { recordFoodAudit } = require('../../lib/food-audit');

const router = express.Router();
const VALID_COMMANDS = new Set(Object.values(ORDER_COMMANDS));

function scopedBranchWhere(access, requestedBranchId) {
  if (requestedBranchId) {
    if (!access.canAccessBranch(requestedBranchId)) throw domainError('Não tem acesso a esta unidade.', 403);
    return requestedBranchId;
  }
  return access.branchIds === null ? undefined : { in: access.branchIds };
}

function requireCommandPermission(req, command) {
  if (command === 'send_to_kitchen' && req.foodContext.can('orders.create')) return;
  if (command.startsWith('kitchen_') && req.foodContext.can('kitchen.manage')) return;
  if (command === 'cancel' && req.foodContext.can('orders.cancel')) return;
  if (command === 'complete' && (req.foodContext.can('orders.view') || req.foodContext.can('delivery.update_own'))) return;
  throw domainError('Não tem permissão para executar este comando.', 403, 'FOOD_PERMISSION_DENIED');
}

router.get('/orders', requireAnyFoodPermission('orders.view', 'orders.create', 'kitchen.view'), async (req, res) => {
  try {
    res.json(await listFoodOrders(prisma, req.foodContext, req.query));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar os pedidos Food.');
  }
});

router.post('/orders', requireFoodPermission('orders.create'), async (req, res) => {
  try {
    const result = await createFoodOrder(prisma, req.foodContext, req.body || {}, {
      idempotencyKey: idempotencyKeyFromRequest(req),
      origin: req.get('X-Food-Origin') || 'web',
    });
    await recordFoodAudit(prisma, req, { branchId: result.order.branchId, action: 'order.created', entityType: 'food_order', entityId: result.order.id, payload: { orderNumber: result.order.orderNumber, orderType: result.order.orderType, total: result.order.total, created: result.created } });
    res.status(result.created ? 201 : 200).json(result.order);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao criar pedido Food.');
  }
});

router.get('/orders/:id', requireAnyFoodPermission('orders.view', 'orders.create', 'kitchen.view'), async (req, res) => {
  try {
    const order = await findOrderAggregate(prisma, req.foodContext.organizationId, req.params.id);
    if (!order) throw domainError('Pedido Food não encontrado.', 404);
    if (!req.foodContext.canAccessBranch(order.branchId)) throw domainError('Não tem acesso a esta unidade.', 403);
    res.json(serializeOrderAggregate(order));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar o pedido Food.');
  }
});

router.post('/orders/:id/commands/:command', async (req, res) => {
  try {
    const command = String(req.params.command || '');
    if (!VALID_COMMANDS.has(command)) throw domainError('Comando de pedido inválido.');
    requireCommandPermission(req, command);
    const result = await executeOrderCommand(
      prisma,
      req.foodContext,
      req.params.id,
      command,
      req.body || {},
      {
        expectedVersion: req.body?.expectedVersion,
        idempotencyKey: idempotencyKeyFromRequest(req),
        origin: req.get('X-Food-Origin') || 'web',
      }
    );
    await recordFoodAudit(prisma, req, { branchId: result.order.branchId, action: `order.command.${command}`, entityType: 'food_order', entityId: result.order.id, reason: req.body?.reason || req.body?.note, payload: { version: result.order.version } });
    res.json(result);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atualizar o pedido Food.');
  }
});

router.get('/kitchen/tickets', requireFoodPermission('kitchen.view'), async (req, res) => {
  try {
    const branchId = req.query.branchId ? String(req.query.branchId) : null;
    const branchWhere = scopedBranchWhere(req.foodContext, branchId);
    const states = String(req.query.states || 'queued,accepted,preparing,ready').split(',').filter(Boolean);
    const [tickets, settings] = await Promise.all([prisma.foodKitchenTicket.findMany({
      where: {
        userId: req.foodContext.organizationId,
        state: { in: states },
        ...(branchWhere !== undefined && { branchId: branchWhere }),
      },
      include: {
        branch: { select: { id: true, name: true } },
        items: { orderBy: { createdAt: 'asc' }, include: { orderItem: { include: { modifiers: true } } } },
        order: { include: { contact: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    }), prisma.foodSettings.findUnique({ where: { userId: req.foodContext.organizationId } })]);
    res.json(tickets.map((ticket) => {
      const display = deriveDisplayStatus(ticket.order);
      return {
        ...ticket,
        alert: deriveKitchenAlert(ticket, settings || {}),
        order: {
          ...ticket.order,
          displayNumber: `#${String(ticket.order.orderNumber).padStart(4, '0')}`,
          status: display.status,
          statusLabel: display.label,
        },
      };
    }));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar a cozinha.');
  }
});

router.post('/kitchen/tickets/:ticketId/acknowledge', requireFoodPermission('kitchen.manage'), async (req, res) => {
  try {
    const ticket = await acknowledgeKitchenTicket(prisma, req.foodContext, req.params.ticketId, {
      expectedVersion: req.body?.expectedVersion,
      idempotencyKey: idempotencyKeyFromRequest(req),
      origin: req.get('X-Food-Origin') || 'web',
    });
    await recordFoodAudit(prisma, req, { branchId: ticket.branchId, action: 'kitchen.ticket.acknowledged', entityType: 'food_kitchen_ticket', entityId: ticket.id });
    res.json(ticket);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao reconhecer o ticket da cozinha.');
  }
});

router.get('/kitchen/escalations', requireAnyFoodPermission('orders.create', 'orders.view'), async (req, res) => {
  try {
    const branchId = req.query.branchId ? String(req.query.branchId) : null;
    const branchWhere = scopedBranchWhere(req.foodContext, branchId);
    const settings = await prisma.foodSettings.findUnique({ where: { userId: req.foodContext.organizationId } });
    const candidates = await prisma.foodKitchenTicket.findMany({
      where: {
        userId: req.foodContext.organizationId,
        state: 'queued',
        acknowledgedAt: null,
        ...(branchWhere !== undefined && { branchId: branchWhere }),
      },
      include: {
        branch: { select: { id: true, name: true } },
        order: { select: { id: true, orderNumber: true, orderType: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(candidates.filter((ticket) => isCashierEscalation(ticket, settings || {})).map((ticket) => ({
      ...ticket,
      alert: deriveKitchenAlert(ticket, settings || {}),
      order: { ...ticket.order, displayNumber: `#${String(ticket.order.orderNumber).padStart(4, '0')}` },
    })));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar alertas da cozinha.');
  }
});

router.patch('/kitchen/tickets/:ticketId/items/:itemId', requireFoodPermission('kitchen.manage'), async (req, res) => {
  try {
    const item = await updateKitchenItem(
      prisma,
      req.foodContext,
      req.params.ticketId,
      req.params.itemId,
      req.body || {},
      { idempotencyKey: idempotencyKeyFromRequest(req), origin: req.get('X-Food-Origin') || 'web' }
    );
    res.json(item);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atualizar o item da cozinha.');
  }
});

router.post('/kitchen/tickets/:ticketId/items/:itemId/resolve', requireAnyFoodPermission('orders.create', 'orders.view'), async (req, res) => {
  try {
    const item = await resolveKitchenIssue(
      prisma,
      req.foodContext,
      req.params.ticketId,
      req.params.itemId,
      req.body || {},
      { idempotencyKey: idempotencyKeyFromRequest(req), origin: req.get('X-Food-Origin') || 'web' }
    );
    res.json(item);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao confirmar a alteração da cozinha.');
  }
});

function eventCursor(req) {
  const value = req.query.cursor || req.get('Last-Event-ID');
  if (!value) return { occurredAt: new Date(Date.now() - 60_000), id: null };
  const [rawDate, id] = String(value).split('|', 2);
  const parsed = new Date(rawDate);
  return {
    occurredAt: Number.isNaN(parsed.getTime()) ? new Date(Date.now() - 60_000) : parsed,
    id: id || null,
  };
}

async function loadOrderEvents(access, cursor) {
  const branchFilter = access.branchIds === null
    ? Prisma.empty
    : access.branchIds.length
      ? Prisma.sql`AND "branchId" IN (${Prisma.join(access.branchIds)})`
      : Prisma.sql`AND FALSE`;
  return prisma.$queryRaw(Prisma.sql`
    SELECT "id", "userId", "branchId", "orderId", "version", "eventType",
      "actorUserId", "actorRole", "origin", "payload", "idempotencyKey", "occurredAt"
    FROM "food_order_events"
    WHERE "userId" = ${access.organizationId}
      ${branchFilter}
      AND ("occurredAt", "id") > (${cursor.occurredAt}, ${cursor.id || ''})
    ORDER BY "occurredAt" ASC, "id" ASC
    LIMIT 200
  `);
}

function serializeCursor(cursor) {
  return `${cursor.occurredAt.toISOString()}|${cursor.id || ''}`;
}

router.get('/events', requireAnyFoodPermission('orders.view', 'kitchen.view', 'delivery.view', 'delivery.view_own'), async (req, res) => {
  let cursor = eventCursor(req);
  const wantsStream = req.accepts(['text/event-stream', 'json']) === 'text/event-stream';

  async function loadEvents() {
    const events = await loadOrderEvents(req.foodContext, cursor);
    if (events.length) cursor = { occurredAt: events[events.length - 1].occurredAt, id: events[events.length - 1].id };
    return events;
  }

  if (!wantsStream) {
    try {
      const events = await loadEvents();
      return res.json({ events, cursor: serializeCursor(cursor) });
    } catch (error) {
      return handleFoodV1Error(res, error, 'Erro ao carregar eventos Food.');
    }
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write(`retry: 3000\n\n`);

  let closed = false;
  let polling = false;
  const pump = async () => {
    if (closed || polling) return;
    polling = true;
    try {
      const events = await loadEvents();
      for (const event of events) {
        res.write(`id: ${event.occurredAt.toISOString()}|${event.id}\n`);
        res.write(`event: food-order\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      if (!events.length) res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch (error) {
      res.write(`event: error\ndata: ${JSON.stringify({ code: 'FOOD_EVENT_STREAM_ERROR' })}\n\n`);
    } finally {
      polling = false;
    }
  };
  await pump();
  const timer = setInterval(pump, 2500);
  req.on('close', () => {
    closed = true;
    clearInterval(timer);
  });
});

module.exports = router;
