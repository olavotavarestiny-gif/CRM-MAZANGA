const { domainError, paymentStateFor } = require('../lib/food-domain');
const { parseJsonList } = require('../lib/food-foundation');
const { collectionDifference, money } = require('../lib/food-delivery-collection');

function ensureCollectionAccess(access, collection) {
  if (collection.organizationId !== access.organizationId) throw domainError('Cobrança não encontrada.', 404);
  if (access.branchIds !== null && collection.branchId && !access.branchIds.includes(collection.branchId)) {
    throw domainError('Sem acesso à unidade desta cobrança.', 403, 'FOOD_BRANCH_ACCESS_DENIED');
  }
}

async function confirmedAmount(tx, organizationId, orderId) {
  const result = await tx.foodPayment.aggregate({
    where: { userId: organizationId, orderId, status: 'confirmed' },
    _sum: { amount: true },
  });
  return money(result._sum.amount);
}

async function createCollectionEvent(tx, collection, access, eventType, payload, idempotencyKey) {
  return tx.foodDeliveryCollectionEvent.create({
    data: {
      organizationId: access.organizationId,
      collectionId: collection.id,
      version: collection.version,
      eventType,
      actorUserId: access.personId,
      actorRole: access.primaryRole,
      payload: payload || {},
      idempotencyKey: idempotencyKey || null,
    },
  });
}

async function ensureCollectionForAssignment(tx, access, delivery, courierUserId) {
  const paid = await confirmedAmount(tx, access.organizationId, delivery.orderId);
  const outstanding = money(Number(delivery.order.total) - paid);
  const existing = await tx.foodDeliveryCollection.findUnique({ where: { deliveryId: delivery.id } });
  if (existing) {
    if (existing.courierUserId !== courierUserId && ['with_courier', 'handed_to_cashier', 'discrepancy'].includes(existing.state)) {
      throw domainError('Não é possível reatribuir a entrega enquanto o valor recebido não estiver reconciliado.', 409, 'FOOD_DELIVERY_COLLECTION_CUSTODY_ACTIVE');
    }
    if (outstanding <= 0) return existing;
    return tx.foodDeliveryCollection.update({
      where: { id: existing.id },
      data: {
        courierUserId,
        expectedAmount: outstanding,
        expectedMethod: delivery.order.paymentMethod || existing.expectedMethod,
        ...(existing.state === 'not_received' || existing.state === 'returned'
          ? { state: 'pending_collection', exceptionReason: null, version: { increment: 1 } }
          : {}),
      },
    });
  }
  if (outstanding <= 0) return null;
  return tx.foodDeliveryCollection.create({
    data: {
      organizationId: access.organizationId,
      branchId: delivery.branchId,
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      courierUserId,
      expectedAmount: outstanding,
      expectedMethod: delivery.order.paymentMethod || null,
    },
  });
}

async function findIdempotentCollection(tx, access, idempotencyKey) {
  if (!idempotencyKey) return null;
  const event = await tx.foodDeliveryCollectionEvent.findFirst({
    where: { organizationId: access.organizationId, idempotencyKey },
    include: { collection: { include: { payment: true, events: { orderBy: { createdAt: 'asc' } } } } },
  });
  return event?.collection || null;
}

async function confirmDeliveryCollection(prisma, access, deliveryId, input = {}, options = {}) {
  return prisma.$transaction(async (tx) => {
    const previous = await findIdempotentCollection(tx, access, options.idempotencyKey);
    if (previous) return previous;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${deliveryId}, 0))`;
    const delivery = await tx.foodDelivery.findFirst({
      where: { id: deliveryId, userId: access.organizationId },
      include: { order: true, collection: true },
    });
    if (!delivery?.collection) throw domainError('Este pedido não possui cobrança na entrega.', 409, 'FOOD_DELIVERY_COLLECTION_NOT_REQUIRED');
    ensureCollectionAccess(access, delivery.collection);
    if (delivery.courierUserId !== access.personId) throw domainError('Esta entrega não está atribuída ao utilizador.', 403);
    if (delivery.state !== 'arrived') throw domainError('Confirme a cobrança apenas depois de chegar ao cliente.', 409);
    if (!['pending_collection', 'not_received'].includes(delivery.collection.state)) {
      throw domainError('Esta cobrança já foi confirmada.', 409, 'FOOD_DELIVERY_COLLECTION_ALREADY_CONFIRMED');
    }
    if (input.received === false) {
      const reason = String(input.reason || '').trim();
      if (reason.length < 3) throw domainError('Indique por que o valor não foi recebido.');
      const collection = await tx.foodDeliveryCollection.update({
        where: { id: delivery.collection.id },
        data: { state: 'not_received', exceptionReason: reason.slice(0, 500), version: { increment: 1 } },
      });
      await createCollectionEvent(tx, collection, access, 'collection.not_received', { reason: collection.exceptionReason }, options.idempotencyKey);
      return collection;
    }
    const method = String(input.method || delivery.collection.expectedMethod || '').trim().toUpperCase();
    const settings = await tx.foodSettings.findUnique({ where: { userId: access.organizationId }, select: { paymentMethods: true } });
    const allowedMethods = parseJsonList(settings?.paymentMethods, ['CASH', 'MULTICAIXA', 'TPA', 'TRANSFER']);
    if (!allowedMethods.includes(method)) throw domainError('Selecione um método de pagamento disponível.');
    const paid = await confirmedAmount(tx, access.organizationId, delivery.orderId);
    const outstanding = money(Number(delivery.order.total) - paid);
    if (outstanding <= 0) throw domainError('Este pedido já está pago.', 409);
    const now = new Date();
    const collection = await tx.foodDeliveryCollection.update({
      where: { id: delivery.collection.id },
      data: {
        state: 'with_courier', expectedAmount: outstanding, actualAmount: outstanding, actualMethod: method,
        exceptionReason: null, receivedByCourierUserId: access.personId, receivedAt: now, version: { increment: 1 },
      },
    });
    const payment = await tx.foodPayment.create({
      data: {
        userId: access.organizationId, branchId: delivery.branchId, orderId: delivery.orderId,
        deliveryCollectionId: collection.id, source: 'delivery_collection', courierUserId: access.personId,
        amount: outstanding, method, status: 'confirmed', paidAt: now, createdByUserId: access.personId,
      },
    });
    const paymentState = paymentStateFor(delivery.order.total, money(paid + outstanding));
    const order = await tx.foodOrder.update({
      where: { id: delivery.orderId },
      data: { paymentState, paymentStatus: paymentState, paymentMethod: method, version: { increment: 1 }, updatedByUserId: access.personId },
    });
    await tx.foodOrderEvent.create({
      data: {
        userId: access.organizationId, branchId: delivery.branchId, orderId: order.id, version: order.version,
        eventType: 'payment.collected_by_courier', actorUserId: access.personId, actorRole: access.primaryRole,
        payload: { paymentId: payment.id, collectionId: collection.id, amount: outstanding, method, paymentState },
      },
    });
    await createCollectionEvent(tx, collection, access, 'collection.received', { amount: outstanding, method, paymentId: payment.id }, options.idempotencyKey);
    return tx.foodDeliveryCollection.findUnique({ where: { id: collection.id }, include: { payment: true, events: { orderBy: { createdAt: 'asc' } } } });
  });
}

async function handoffDeliveryCollection(prisma, access, deliveryId, options = {}) {
  return prisma.$transaction(async (tx) => {
    const previous = await findIdempotentCollection(tx, access, options.idempotencyKey);
    if (previous) return previous;
    const collection = await tx.foodDeliveryCollection.findFirst({ where: { deliveryId, organizationId: access.organizationId } });
    if (!collection) throw domainError('Cobrança não encontrada.', 404);
    ensureCollectionAccess(access, collection);
    if (collection.courierUserId !== access.personId) throw domainError('Esta cobrança não pertence ao utilizador.', 403);
    if (collection.state !== 'with_courier') throw domainError('A cobrança não está em posse do entregador.', 409);
    const updated = await tx.foodDeliveryCollection.update({
      where: { id: collection.id },
      data: { state: 'handed_to_cashier', handedOverByUserId: access.personId, handedOverAt: new Date(), version: { increment: 1 } },
    });
    await createCollectionEvent(tx, updated, access, 'collection.handed_to_cashier', { amount: updated.actualAmount, method: updated.actualMethod }, options.idempotencyKey);
    return updated;
  });
}

async function reconcileDeliveryCollection(prisma, access, collectionId, input = {}, options = {}) {
  return prisma.$transaction(async (tx) => {
    const previous = await findIdempotentCollection(tx, access, options.idempotencyKey);
    if (previous) return previous;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${collectionId}, 0))`;
    const collection = await tx.foodDeliveryCollection.findFirst({
      where: { id: collectionId, organizationId: access.organizationId }, include: { payment: true },
    });
    if (!collection) throw domainError('Cobrança não encontrada.', 404);
    ensureCollectionAccess(access, collection);
    if (!['handed_to_cashier', 'discrepancy'].includes(collection.state)) throw domainError('A cobrança ainda não foi entregue ao caixa.', 409);
    if (!collection.payment) throw domainError('Pagamento da cobrança não encontrado.', 409);
    const countedAmount = money(input.countedAmount);
    if (!Number.isFinite(Number(input.countedAmount)) || countedAmount < 0) throw domainError('Indique o valor contado no caixa.');
    const difference = collectionDifference(collection.expectedAmount, countedAmount);
    if (Math.abs(difference) >= 0.01) {
      const reason = String(input.reason || '').trim();
      if (reason.length < 3) throw domainError('Justifique a diferença encontrada.');
      const updated = await tx.foodDeliveryCollection.update({
        where: { id: collection.id },
        data: { state: 'discrepancy', discrepancyAmount: difference, exceptionReason: reason.slice(0, 500), version: { increment: 1 } },
      });
      await createCollectionEvent(tx, updated, access, 'collection.discrepancy', { expectedAmount: collection.expectedAmount, countedAmount, difference, reason: updated.exceptionReason }, options.idempotencyKey);
      return updated;
    }
    const cashSession = await tx.foodCashSession.findFirst({
      where: {
        organizationId: access.organizationId, branchId: collection.branchId, status: 'open',
        ...(input.cashSessionId ? { id: String(input.cashSessionId) } : {}),
      },
      orderBy: { openedAt: 'desc' },
    });
    if (!cashSession) throw domainError('Abra uma sessão de caixa nesta unidade antes de reconciliar.', 409, 'FOOD_CASH_SESSION_REQUIRED');
    await tx.$queryRaw`SELECT "id" FROM "food_cash_sessions" WHERE "id" = ${cashSession.id} FOR UPDATE`;
    const totalsByMethod = cashSession.totalsByMethod && typeof cashSession.totalsByMethod === 'object' ? { ...cashSession.totalsByMethod } : {};
    totalsByMethod[collection.actualMethod] = money(Number(totalsByMethod[collection.actualMethod] || 0) + countedAmount);
    await tx.foodPayment.update({ where: { id: collection.payment.id }, data: { cashSessionId: cashSession.id } });
    await tx.foodCashSession.update({
      where: { id: cashSession.id },
      data: {
        totalSalesAmount: { increment: countedAmount }, salesCount: { increment: 1 },
        expectedClosingAmount: collection.actualMethod === 'CASH' ? { increment: countedAmount } : undefined,
        totalsByMethod,
      },
    });
    const updated = await tx.foodDeliveryCollection.update({
      where: { id: collection.id },
      data: {
        state: 'reconciled', discrepancyAmount: 0, exceptionReason: null, reconciledByUserId: access.personId,
        reconciledAt: new Date(), version: { increment: 1 },
      },
    });
    await createCollectionEvent(tx, updated, access, 'collection.reconciled', { amount: countedAmount, method: updated.actualMethod, cashSessionId: cashSession.id }, options.idempotencyKey);
    return updated;
  });
}

async function markCollectionReturned(tx, access, deliveryId, reason) {
  const collection = await tx.foodDeliveryCollection.findUnique({ where: { deliveryId } });
  if (!collection || !['pending_collection', 'not_received'].includes(collection.state)) return collection;
  const updated = await tx.foodDeliveryCollection.update({
    where: { id: collection.id },
    data: { state: 'returned', exceptionReason: String(reason || '').slice(0, 500) || null, version: { increment: 1 } },
  });
  await createCollectionEvent(tx, updated, access, 'collection.returned', { reason: updated.exceptionReason }, null);
  return updated;
}

module.exports = {
  ensureCollectionForAssignment,
  confirmDeliveryCollection,
  handoffDeliveryCollection,
  reconcileDeliveryCollection,
  markCollectionReturned,
};
