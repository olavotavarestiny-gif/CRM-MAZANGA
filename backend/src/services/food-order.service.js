const bcrypt = require('bcryptjs');
const {
  domainError,
  deriveDisplayStatus,
  reduceOrderCommand,
  reduceDeliveryState,
  paymentStateFor,
} = require('../lib/food-domain');
const { parseJsonList, serializeFoodSettings } = require('../lib/food-foundation');
const {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  buildOrderItemSnapshots,
  calculateOrderTotals,
  normalizeOrderType,
  normalizePaymentMethod,
  normalizePaymentStatus,
  normalizeStatus,
  nonNegativeMoney,
  statusTimestampsFor,
} = require('../lib/food-orders');
const { normalizePhoneToE164 } = require('../lib/phone-normalization');
const {
  ensureCollectionForAssignment,
  markCollectionReturned,
} = require('./food-delivery-collection.service');

const ORDER_AGGREGATE_INCLUDE = Object.freeze({
  branch: { select: { id: true, name: true, isMain: true } },
  contact: { select: { id: true, name: true, phone: true, email: true } },
  items: {
    orderBy: { sortOrder: 'asc' },
    include: {
      modifiers: { orderBy: { sortOrder: 'asc' } },
      kitchenTicketItem: true,
    },
  },
  events: { orderBy: [{ version: 'asc' }] },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  kitchenTicket: { include: { items: true } },
  delivery: { include: { proofMedia: true, collection: { include: { payment: true, events: { orderBy: { createdAt: 'asc' } } } } } },
  payments: { orderBy: { createdAt: 'asc' } },
  fiscalDocuments: { orderBy: { requestedAt: 'asc' } },
});

const PRODUCT_ORDER_INCLUDE = Object.freeze({
  category: { select: { id: true, name: true } },
  modifierGroups: {
    where: { group: { active: true } },
    orderBy: { sortOrder: 'asc' },
    include: {
      group: {
        include: {
          options: {
            where: { active: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          },
        },
      },
    },
  },
});

function trimOrNull(value) {
  if (value === undefined) return undefined;
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizePhone(value) {
  return normalizePhoneToE164(value) || String(value || '').replace(/\s+/g, '').trim();
}

function isValidQuickPhone(value) {
  return /^[\d+\-()]{7,20}$/.test(value || '');
}

async function resolveOrderContact(tx, organizationId, input = {}, createCustomer = false) {
  const contactId = input.contactId ? Number(input.contactId) : null;
  if (contactId) {
    const contact = await tx.contact.findFirst({
      where: { id: contactId, userId: organizationId },
      select: { id: true, name: true, phone: true, email: true, location: true, company: true },
    });
    if (!contact) throw domainError('Cliente inválido para esta organização.', 400, 'FOOD_CUSTOMER_INVALID');
    return contact;
  }

  const phone = normalizePhone(input.phone);
  if (phone) {
    const existing = await tx.contact.findUnique({
      where: { user_phone_unique: { userId: organizationId, phone } },
      select: { id: true, name: true, phone: true, email: true, location: true, company: true },
    });
    if (existing) return existing;
  }
  if (!createCustomer) return null;
  if (!phone || !isValidQuickPhone(phone)) {
    throw domainError('Telefone do cliente inválido.', 400, 'FOOD_CUSTOMER_PHONE_INVALID');
  }

  const name = trimOrNull(input.name) || `Cliente ${phone}`;
  return tx.contact.create({
    data: {
      userId: organizationId,
      name,
      phone,
      email: trimOrNull(input.email) || '',
      company: trimOrNull(input.company) || name,
      location: trimOrNull(input.location || input.neighborhood || input.address),
      contactType: 'cliente',
      inPipeline: false,
      status: 'ativo',
    },
    select: { id: true, name: true, phone: true, email: true, location: true, company: true },
  });
}

async function createFoodOrder(prisma, access, input = {}, options = {}) {
  const organizationId = access.organizationId;
  const idempotencyKey = options.idempotencyKey || null;
  if (idempotencyKey) {
    const existing = await prisma.foodOrder.findFirst({
      where: { userId: organizationId, idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      return { order: serializeOrderAggregate(await findOrderAggregate(prisma, organizationId, existing.id)), created: false };
    }
  }

  const rawSettings = await prisma.foodSettings.findUnique({ where: { userId: organizationId } });
  const settings = serializeFoodSettings(rawSettings);
  const allowedOrderTypes = parseJsonList(rawSettings?.orderTypes, settings.orderTypes);
  const allowedPaymentMethods = parseJsonList(rawSettings?.paymentMethods, settings.paymentMethods);
  const orderType = normalizeOrderType(input.orderType, allowedOrderTypes);
  const paymentMethod = normalizePaymentMethod(input.paymentMethod, allowedPaymentMethods);
  if (input.paymentMethod && !paymentMethod) {
    throw domainError('Método de pagamento indisponível.', 400, 'FOOD_PAYMENT_METHOD_INVALID');
  }

  const discountAmount = nonNegativeMoney(input.discountAmount, 0);
  if (discountAmount > 0 && !access.can?.('orders.discount')) {
    throw domainError('Sem permissão para aplicar descontos.', 403, 'FOOD_PERMISSION_DENIED');
  }
  const initialStatus = normalizeStatus(input.status, input.sendToKitchen === false ? 'draft' : 'sent_to_kitchen');
  if (!['draft', 'pending_confirmation', 'confirmed', 'sent_to_kitchen'].includes(initialStatus)) {
    throw domainError('Estado inicial do pedido inválido.', 400, 'FOOD_ORDER_STATE_INVALID');
  }

  const branchId = trimOrNull(input.branchId);
  if (!branchId) throw domainError('Seleccione a unidade Food deste pedido.', 400, 'FOOD_BRANCH_REQUIRED');
  ensureBranchAccess(access, branchId);
  const branch = await prisma.foodBranch.findFirst({
    where: { id: branchId, userId: organizationId, active: true },
    select: { id: true },
  });
  if (!branch) throw domainError('Unidade Food inválida para esta organização.', 400, 'FOOD_BRANCH_INVALID');

  const source = trimOrNull(input.source) || 'counter';
  if (source === 'counter') {
    const cashSession = await prisma.foodCashSession.findFirst({
      where: {
        organizationId,
        branchId,
        status: 'open',
        ...(!access.can?.('payments.manage') && { openedByUserId: access.personId }),
      },
      select: { id: true },
    });
    if (!cashSession) {
      throw domainError(
        'Abra uma sessão de caixa nesta unidade antes de criar o pedido.',
        409,
        'FOOD_CASH_SESSION_REQUIRED'
      );
    }
  }

  const requestedItems = Array.isArray(input.items) ? input.items : [];
  const productIds = [...new Set(requestedItems.map((item) => String(item?.productId || '').trim()).filter(Boolean))];
  const products = await prisma.foodProduct.findMany({
    where: {
      userId: organizationId,
      id: { in: productIds },
      active: true,
      OR: [{ branchId: null }, { branchId }],
    },
    include: PRODUCT_ORDER_INCLUDE,
  });
  const itemSnapshots = buildOrderItemSnapshots({
    requestedItems,
    productsById: new Map(products.map((product) => [product.id, product])),
  });
  const totals = calculateOrderTotals({
    itemSnapshots,
    orderType,
    discountAmount,
    deliveryFee: input.deliveryFee,
    taxAmount: input.taxAmount,
  });
  const estimatedPreparationMinutes = Math.max(settings.defaultPreparationMinutes || 1, totals.estimatedPreparationMinutes);
  const normalizedPaymentStatus = normalizePaymentStatus(input.paymentStatus);
  const initialOrderState = initialStatus === 'draft' ? 'draft' : 'active';
  const initialKitchenState = initialStatus === 'sent_to_kitchen' ? 'queued' : 'not_required';
  const initialDeliveryState = orderType === 'delivery' && initialStatus !== 'draft' ? 'pending' : 'not_required';
  const initialPaymentState = paymentStateFor(totals.total, normalizedPaymentStatus === 'paid' ? totals.total : 0);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const lockKey = `food-order-number:${organizationId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    if (idempotencyKey) {
      const existing = await tx.foodOrder.findFirst({
        where: { userId: organizationId, idempotencyKey },
        select: { id: true },
      });
      if (existing) return { id: existing.id, created: false };
    }

    const customer = await resolveOrderContact(tx, organizationId, {
      contactId: input.contactId,
      name: input.customerName,
      phone: input.customerPhone,
      email: input.customerEmail,
      address: input.deliveryAddress,
      neighborhood: input.deliveryNeighborhood,
    }, Boolean(input.createCustomer));
    const aggregate = await tx.foodOrder.aggregate({
      where: { userId: organizationId },
      _max: { orderNumber: true },
    });
    const orderNumber = Number(aggregate._max.orderNumber || 0) + 1;
    const order = await tx.foodOrder.create({
      data: {
        userId: organizationId,
        branchId,
        contactId: customer?.id || null,
        orderNumber,
        status: initialStatus,
        orderState: initialOrderState,
        kitchenState: initialKitchenState,
        deliveryState: initialDeliveryState,
        paymentState: initialPaymentState,
        version: 1,
        idempotencyKey,
        orderType,
        source,
        customerName: trimOrNull(input.customerName) || customer?.name || null,
        customerPhone: normalizePhone(input.customerPhone) || customer?.phone || null,
        customerEmail: trimOrNull(input.customerEmail) || customer?.email || null,
        deliveryAddress: trimOrNull(input.deliveryAddress),
        deliveryNeighborhood: trimOrNull(input.deliveryNeighborhood),
        deliveryReference: trimOrNull(input.deliveryReference),
        tableName: orderType === 'dine_in' ? trimOrNull(input.tableName) : null,
        paymentMethod,
        paymentStatus: normalizedPaymentStatus,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        deliveryFee: totals.deliveryFee,
        taxAmount: totals.taxAmount,
        total: totals.total,
        estimatedPreparationMinutes,
        notes: trimOrNull(input.notes),
        createdByUserId: access.personId,
        updatedByUserId: access.personId,
        ...statusTimestampsFor(initialStatus, now),
        items: {
          create: itemSnapshots.map((item) => ({
            userId: organizationId,
            productId: item.productId,
            productName: item.productName,
            productCode: item.productCode,
            productImageUrl: item.productImageUrl,
            categoryName: item.categoryName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            subtotal: item.subtotal,
            notes: item.notes,
            offered: item.offered,
            preparationMinutes: item.preparationMinutes,
            sortOrder: item.sortOrder,
            modifiers: { create: item.modifiers.map((modifier) => ({ ...modifier, userId: organizationId })) },
          })),
        },
        statusHistory: {
          create: {
            userId: organizationId,
            previousStatus: null,
            newStatus: initialStatus,
            note: initialStatus === 'sent_to_kitchen' ? 'Pedido criado e enviado para a cozinha.' : 'Pedido criado.',
            createdByUserId: access.personId,
            metadata: JSON.stringify({ action: 'create', origin: options.origin || 'api' }),
          },
        },
      },
      include: { items: { include: { modifiers: true } } },
    });
    await tx.foodOrderEvent.create({
      data: {
        userId: organizationId,
        branchId,
        orderId: order.id,
        version: 1,
        eventType: initialStatus === 'sent_to_kitchen' ? 'order.created_and_sent' : 'order.created',
        actorUserId: access.personId,
        actorRole: access.primaryRole,
        origin: options.origin || 'api',
        payload: { orderType, total: totals.total, initialStatus },
        idempotencyKey,
      },
    });
    if (initialStatus === 'sent_to_kitchen') {
      await consumeOrderStock(tx, access, order);
      await tx.foodKitchenTicket.create({
        data: {
          userId: organizationId,
          branchId,
          orderId: order.id,
          state: 'queued',
          items: { create: order.items.map((item) => ({ userId: organizationId, orderItemId: item.id })) },
        },
      });
    }
    if (customer?.id) {
      await tx.foodCustomerProfile.upsert({
        where: { organizationId_contactId: { organizationId, contactId: customer.id } },
        update: { totalOrders: { increment: 1 }, totalSpent: { increment: totals.total }, lastOrderAt: now },
        create: { organizationId, contactId: customer.id, totalOrders: 1, totalSpent: totals.total, lastOrderAt: now },
      });
    }
    return { id: order.id, created: true };
  }, { maxWait: 10_000, timeout: 20_000 });

  const order = await findOrderAggregate(prisma, organizationId, result.id);
  return { order: serializeOrderAggregate(order), created: result.created };
}

function idempotencyKeyFromRequest(req) {
  const value = req.get('Idempotency-Key') || req.body?.idempotencyKey;
  const key = String(value || '').trim();
  if (!key) return null;
  if (key.length > 120) throw domainError('Idempotency-Key demasiado longa.');
  return key;
}

function parseHistoryMetadata(value) {
  if (value && typeof value === 'object') return value;
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
}

function serializeOrderAggregate(order, creatorNames = new Map()) {
  const display = deriveDisplayStatus(order);
  return {
    ...order,
    createdByName: creatorNames.get(order.createdByUserId) || null,
    status: display.status,
    statusLabel: display.label,
    displayNumber: `#${String(order.orderNumber).padStart(4, '0')}`,
    orderTypeLabel: ORDER_TYPE_LABELS[order.orderType] || order.orderType,
    paymentStatusLabel: PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus,
    statusHistory: (order.statusHistory || []).map((entry) => ({
      ...entry,
      metadata: parseHistoryMetadata(entry.metadata),
      previousStatusLabel: entry.previousStatus
        ? ORDER_STATUS_LABELS[entry.previousStatus] || entry.previousStatus
        : null,
      newStatusLabel: ORDER_STATUS_LABELS[entry.newStatus] || entry.newStatus,
    })),
  };
}

function normalizeOrderListParams(params = {}) {
  const rawStatuses = Array.isArray(params.statuses)
    ? params.statuses
    : String(params.statuses || '').split(',');
  const statuses = [...new Set(rawStatuses.map((value) => String(value).trim()).filter(Boolean))];
  if (statuses.some((status) => !ORDER_STATUSES.includes(status))) {
    throw domainError('Um ou mais estados do pedido são inválidos.', 400, 'FOOD_ORDER_STATUS_INVALID');
  }
  const status = String(params.status || '').trim();
  if (status && status !== 'all' && !ORDER_STATUSES.includes(status)) {
    throw domainError('Estado do pedido inválido.', 400, 'FOOD_ORDER_STATUS_INVALID');
  }
  const from = params.from ? new Date(String(params.from)) : null;
  const to = params.to ? new Date(String(params.to)) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    throw domainError('Intervalo de datas inválido.', 400, 'FOOD_ORDER_DATE_INVALID');
  }
  return {
    ...params,
    status,
    statuses,
    search: String(params.search || '').trim(),
    from,
    to,
    limit: Math.min(200, Math.max(1, Number(params.limit || 100))),
  };
}

async function listFoodOrders(prisma, access, params = {}) {
  const filters = normalizeOrderListParams(params);
  const requestedBranchId = filters.branchId ? String(filters.branchId) : null;
  ensureBranchAccess(access, requestedBranchId);
  if (requestedBranchId) {
    const branch = await prisma.foodBranch.findFirst({
      where: { id: requestedBranchId, userId: access.organizationId },
      select: { id: true },
    });
    if (!branch) throw domainError('Unidade Food inválida para esta organização.', 400, 'FOOD_BRANCH_INVALID');
  }
  const branchId = requestedBranchId || (access.branchIds === null ? undefined : { in: access.branchIds });
  const searchNumber = Number(filters.search.replace(/^#/, ''));
  const where = {
    userId: access.organizationId,
    ...(branchId !== undefined && { branchId }),
    ...(filters.statuses.length
      ? { status: { in: filters.statuses } }
      : filters.status && filters.status !== 'all' && { status: filters.status }),
    ...(filters.orderState && { orderState: String(filters.orderState) }),
    ...(filters.kitchenState && { kitchenState: String(filters.kitchenState) }),
    ...(filters.deliveryState && { deliveryState: String(filters.deliveryState) }),
    ...(filters.paymentState && { paymentState: String(filters.paymentState) }),
    ...(filters.orderType && { orderType: String(filters.orderType) }),
    ...((filters.from || filters.to) && {
      createdAt: {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to && { lte: filters.to }),
      },
    }),
    ...(filters.search && {
      OR: [
        { customerName: { contains: filters.search, mode: 'insensitive' } },
        { customerPhone: { contains: normalizePhone(filters.search), mode: 'insensitive' } },
        ...(Number.isInteger(searchNumber) && searchNumber > 0 ? [{ orderNumber: searchNumber }] : []),
      ],
    }),
  };
  const orders = await prisma.foodOrder.findMany({
    where,
    include: ORDER_AGGREGATE_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: filters.limit,
  });
  const creatorIds = [...new Set(orders
    .map((order) => Number(order.createdByUserId))
    .filter((id) => Number.isInteger(id) && id > 0))];
  const creators = creatorIds.length
    ? await prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } })
    : [];
  const creatorNames = new Map(creators.map((creator) => [creator.id, creator.name]));
  return orders.map((order) => serializeOrderAggregate(order, creatorNames));
}

async function findOrderAggregate(prisma, userId, orderId) {
  return prisma.foodOrder.findFirst({
    where: { id: orderId, userId },
    include: ORDER_AGGREGATE_INCLUDE,
  });
}

function ensureBranchAccess(access, branchId) {
  if (branchId && !access.canAccessBranch(branchId)) {
    throw domainError('Não tem acesso à unidade deste pedido.', 403, 'FOOD_BRANCH_ACCESS_DENIED');
  }
}

async function consumeOrderStock(tx, access, order) {
  const alreadyConsumed = await tx.foodStockMovement.findFirst({
    where: {
      organizationId: access.organizationId,
      referenceType: 'food_order',
      referenceId: order.id,
      type: 'consumption',
    },
    select: { id: true },
  });
  if (alreadyConsumed) return;
  const productQuantities = new Map();
  for (const item of order.items) {
    if (!item.productId) continue;
    productQuantities.set(item.productId, Number(productQuantities.get(item.productId) || 0) + Number(item.quantity || 0));
  }
  if (!productQuantities.size) return;
  const recipes = await tx.foodRecipeItem.findMany({
    where: { organizationId: access.organizationId, productId: { in: [...productQuantities.keys()] } },
    include: { ingredient: true },
  });
  const consumption = new Map();
  for (const recipe of recipes) {
    const orderedQuantity = productQuantities.get(recipe.productId) || 0;
    const wasteFactor = 1 + Number(recipe.wastePercent || 0) / 100;
    const quantity = Number(recipe.quantity) * orderedQuantity * wasteFactor;
    consumption.set(recipe.ingredientId, (consumption.get(recipe.ingredientId) || 0) + quantity);
  }
  for (const [ingredientId, quantity] of consumption.entries()) {
    const ingredient = recipes.find((recipe) => recipe.ingredientId === ingredientId)?.ingredient;
    if (!ingredient || !ingredient.active) continue;
    if (ingredient.branchId && ingredient.branchId !== order.branchId) {
      throw domainError(`O ingrediente ${ingredient.name} pertence a outra unidade.`, 409, 'FOOD_STOCK_BRANCH_MISMATCH');
    }
    const consumed = await tx.foodIngredient.updateMany({
      where: {
        id: ingredient.id,
        organizationId: access.organizationId,
        active: true,
        currentStock: { gte: quantity },
      },
      data: { currentStock: { decrement: quantity } },
    });
    if (consumed.count !== 1) {
      throw domainError(`Stock insuficiente de ${ingredient.name}.`, 409, 'FOOD_STOCK_INSUFFICIENT');
    }
    const updatedIngredient = await tx.foodIngredient.findUnique({
      where: { id: ingredient.id },
      select: { currentStock: true },
    });
    const newStock = Number(updatedIngredient.currentStock);
    const previousStock = newStock + quantity;
    await tx.foodStockMovement.create({
      data: {
        organizationId: access.organizationId,
        branchId: order.branchId,
        ingredientId: ingredient.id,
        type: 'consumption',
        quantity: -quantity,
        previousStock,
        newStock,
        unitCost: ingredient.averageCost,
        reason: `Consumo do pedido #${order.orderNumber}`,
        referenceType: 'food_order',
        referenceId: order.id,
        createdByUserId: access.personId,
      },
    });
  }
}

async function restoreQueuedOrderStock(tx, access, order) {
  const alreadyRestored = await tx.foodStockMovement.findFirst({
    where: {
      organizationId: access.organizationId,
      referenceType: 'food_order_cancellation',
      referenceId: order.id,
      type: 'cancellation_reversal',
    },
    select: { id: true },
  });
  if (alreadyRestored) return;
  const consumptions = await tx.foodStockMovement.findMany({
    where: {
      organizationId: access.organizationId,
      referenceType: 'food_order',
      referenceId: order.id,
      type: 'consumption',
    },
    orderBy: { ingredientId: 'asc' },
  });
  for (const movement of consumptions) {
    const quantity = Math.abs(Number(movement.quantity));
    if (quantity <= 0) continue;
    const restored = await tx.foodIngredient.update({
      where: { id: movement.ingredientId },
      data: { currentStock: { increment: quantity } },
      select: { currentStock: true, averageCost: true },
    });
    const newStock = Number(restored.currentStock);
    await tx.foodStockMovement.create({
      data: {
        organizationId: access.organizationId,
        branchId: order.branchId,
        ingredientId: movement.ingredientId,
        type: 'cancellation_reversal',
        quantity,
        previousStock: newStock - quantity,
        newStock,
        unitCost: restored.averageCost,
        reason: `Reposição do pedido cancelado #${order.orderNumber}`,
        referenceType: 'food_order_cancellation',
        referenceId: order.id,
        createdByUserId: access.personId,
      },
    });
  }
}

async function executeOrderCommand(prisma, access, orderId, command, payload = {}, options = {}) {
  const idempotencyKey = options.idempotencyKey || null;
  const updatedId = await prisma.$transaction(async (tx) => {
    if (idempotencyKey) {
      const previousEvent = await tx.foodOrderEvent.findFirst({
        where: { userId: access.organizationId, idempotencyKey },
        select: { orderId: true },
      });
      if (previousEvent) {
        if (previousEvent.orderId !== orderId) {
          throw domainError('Idempotency-Key já utilizada noutro pedido.', 409, 'IDEMPOTENCY_KEY_REUSED');
        }
        return previousEvent.orderId;
      }
    }

    const order = await tx.foodOrder.findFirst({
      where: { id: orderId, userId: access.organizationId },
      include: { items: { select: { id: true, productId: true, quantity: true } }, delivery: true },
    });
    if (!order) throw domainError('Pedido Food não encontrado.', 404, 'FOOD_ORDER_NOT_FOUND');
    ensureBranchAccess(access, order.branchId);
    if (options.expectedVersion !== undefined && Number(options.expectedVersion) !== order.version) {
      throw domainError('O pedido foi alterado noutro dispositivo. Atualize antes de continuar.', 409, 'FOOD_VERSION_CONFLICT');
    }

    const now = new Date();
    const stateUpdate = reduceOrderCommand(order, command, payload, now);
    const nextVersion = order.version + 1;
    const result = await tx.foodOrder.updateMany({
      where: { id: order.id, userId: access.organizationId, version: order.version },
      data: {
        ...stateUpdate,
        version: { increment: 1 },
        updatedByUserId: access.personId,
      },
    });
    if (result.count !== 1) {
      throw domainError('O pedido foi alterado noutro dispositivo. Atualize antes de continuar.', 409, 'FOOD_VERSION_CONFLICT');
    }

    await tx.foodOrderEvent.create({
      data: {
        userId: access.organizationId,
        branchId: order.branchId,
        orderId: order.id,
        version: nextVersion,
        eventType: `order.${command}`,
        actorUserId: access.personId,
        actorRole: access.primaryRole,
        origin: options.origin || 'api',
        payload,
        idempotencyKey,
      },
    });
    await tx.foodOrderStatusHistory.create({
      data: {
        userId: access.organizationId,
        orderId: order.id,
        previousStatus: order.status,
        newStatus: stateUpdate.status,
        note: payload.note || payload.reason || null,
        metadata: JSON.stringify({ command, version: nextVersion }),
        createdByUserId: access.personId,
      },
    });

    if (command === 'send_to_kitchen') {
      await consumeOrderStock(tx, access, order);
      const existingTicket = await tx.foodKitchenTicket.findUnique({ where: { orderId: order.id } });
      if (existingTicket) {
        await tx.foodKitchenTicket.update({
          where: { id: existingTicket.id },
          data: { state: 'queued', version: { increment: 1 } },
        });
      } else {
        await tx.foodKitchenTicket.create({
          data: {
            userId: access.organizationId,
            branchId: order.branchId,
            orderId: order.id,
            state: 'queued',
            items: {
              create: order.items.map((item) => ({
                userId: access.organizationId,
                orderItemId: item.id,
              })),
            },
          },
        });
      }
    }

    if (command === 'cancel') {
      if (order.kitchenState === 'queued') await restoreQueuedOrderStock(tx, access, order);
      await tx.foodKitchenTicket.updateMany({
        where: { orderId: order.id },
        data: { state: 'cancelled', version: { increment: 1 } },
      });
      await tx.foodDelivery.updateMany({
        where: { orderId: order.id, state: 'awaiting_dispatch' },
        data: { state: 'returned', returnReason: String(payload.reason).trim(), returnedAt: now },
      });
    }

    if (command === 'complete') {
      await tx.foodKitchenTicket.updateMany({
        where: { orderId: order.id, state: 'ready' },
        data: { state: 'collected', version: { increment: 1 } },
      });
    }

    if (command.startsWith('kitchen_')) {
      const stateByCommand = {
        kitchen_accept: { state: 'accepted', acceptedAt: now, acknowledgedAt: now, acknowledgedByUserId: access.personId },
        kitchen_start: { state: 'preparing', startedAt: now },
        kitchen_ready: { state: 'ready', readyAt: now },
      };
      await tx.foodKitchenTicket.update({
        where: { orderId: order.id },
        data: { ...stateByCommand[command], version: { increment: 1 } },
      });
      if (command === 'kitchen_start') {
        await tx.foodKitchenTicketItem.updateMany({
          where: { ticket: { orderId: order.id }, state: 'pending' },
          data: { state: 'preparing', startedAt: now },
        });
      }
      if (command === 'kitchen_ready') {
        await tx.foodKitchenTicketItem.updateMany({
          where: { ticket: { orderId: order.id }, state: { in: ['pending', 'preparing'] } },
          data: { state: 'completed', completedAt: now },
        });
        await tx.foodOrderItem.updateMany({
          where: { orderId: order.id, userId: access.organizationId, kitchenState: { not: 'completed' } },
          data: { kitchenState: 'completed', completedAt: now },
        });
        if (order.orderType === 'delivery') {
          await tx.foodDelivery.upsert({
            where: { orderId: order.id },
            update: { state: 'awaiting_dispatch', pinHash: null },
            create: {
              userId: access.organizationId,
              branchId: order.branchId,
              orderId: order.id,
              state: 'awaiting_dispatch',
            },
          });
        }
      }
    }

    return order.id;
  });

  const aggregate = await findOrderAggregate(prisma, access.organizationId, updatedId);
  return { order: serializeOrderAggregate(aggregate) };
}

async function acknowledgeKitchenTicket(prisma, access, ticketId, options = {}) {
  const idempotencyKey = options.idempotencyKey || null;
  const updatedTicketId = await prisma.$transaction(async (tx) => {
    if (idempotencyKey) {
      const previousEvent = await tx.foodOrderEvent.findFirst({
        where: { userId: access.organizationId, idempotencyKey },
        select: { orderId: true },
      });
      if (previousEvent) {
        const previousTicket = await tx.foodKitchenTicket.findFirst({
          where: { id: ticketId, orderId: previousEvent.orderId, userId: access.organizationId },
          select: { id: true },
        });
        if (!previousTicket) throw domainError('Idempotency-Key já utilizada noutro ticket.', 409, 'IDEMPOTENCY_KEY_REUSED');
        return previousTicket.id;
      }
    }

    const ticket = await tx.foodKitchenTicket.findFirst({
      where: { id: ticketId, userId: access.organizationId },
      include: { order: { select: { id: true, version: true } } },
    });
    if (!ticket) throw domainError('Ticket de cozinha não encontrado.', 404, 'FOOD_KITCHEN_TICKET_NOT_FOUND');
    ensureBranchAccess(access, ticket.branchId);
    if (ticket.state !== 'queued') throw domainError('Apenas tickets novos podem ser reconhecidos.', 409, 'FOOD_KITCHEN_ACK_INVALID_STATE');
    if (ticket.acknowledgedAt) return ticket.id;
    if (options.expectedVersion !== undefined && Number(options.expectedVersion) !== ticket.version) {
      throw domainError('O ticket foi alterado noutro dispositivo. Atualize antes de continuar.', 409, 'FOOD_VERSION_CONFLICT');
    }

    const now = new Date();
    const ticketUpdate = await tx.foodKitchenTicket.updateMany({
      where: { id: ticket.id, userId: access.organizationId, version: ticket.version, acknowledgedAt: null },
      data: { acknowledgedAt: now, acknowledgedByUserId: access.personId, version: { increment: 1 } },
    });
    if (ticketUpdate.count !== 1) throw domainError('O ticket foi alterado noutro dispositivo. Atualize antes de continuar.', 409, 'FOOD_VERSION_CONFLICT');
    const orderUpdate = await tx.foodOrder.updateMany({
      where: { id: ticket.order.id, userId: access.organizationId, version: ticket.order.version },
      data: { version: { increment: 1 }, updatedByUserId: access.personId },
    });
    if (orderUpdate.count !== 1) throw domainError('O pedido foi alterado noutro dispositivo. Atualize antes de continuar.', 409, 'FOOD_VERSION_CONFLICT');
    await tx.foodOrderEvent.create({
      data: {
        userId: access.organizationId,
        branchId: ticket.branchId,
        orderId: ticket.order.id,
        version: ticket.order.version + 1,
        eventType: 'kitchen.ticket_acknowledged',
        actorUserId: access.personId,
        actorRole: access.primaryRole,
        origin: options.origin || 'api',
        payload: { ticketId: ticket.id },
        idempotencyKey,
      },
    });
    return ticket.id;
  });

  return prisma.foodKitchenTicket.findFirst({
    where: { id: updatedTicketId, userId: access.organizationId },
  });
}

async function updateKitchenItem(prisma, access, ticketId, itemId, input = {}, options = {}) {
  const allowedStates = ['pending', 'preparing', 'completed', 'unavailable'];
  if (!allowedStates.includes(input.state)) throw domainError('Estado do item de cozinha inválido.');
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.foodKitchenTicketItem.findFirst({
      where: {
        id: itemId,
        ticketId,
        userId: access.organizationId,
      },
      include: { ticket: true },
    });
    if (!item) throw domainError('Item de cozinha não encontrado.', 404);
    ensureBranchAccess(access, item.ticket.branchId);
    const issueNote = String(input.issueNote || '').trim() || null;
    if (input.state === 'unavailable' && !issueNote) {
      throw domainError('Indique o motivo da indisponibilidade.');
    }
    const ticketItem = await tx.foodKitchenTicketItem.update({
      where: { id: item.id },
      data: {
        state: input.state,
        issueType: input.state === 'unavailable' ? input.issueType || 'unavailable' : null,
        issueNote: input.state === 'unavailable' ? issueNote : null,
        startedAt: input.state === 'preparing' ? item.startedAt || now : item.startedAt,
        completedAt: input.state === 'completed' ? now : null,
      },
    });
    await tx.foodOrderItem.update({
      where: { id: item.orderItemId },
      data: {
        kitchenState: input.state,
        kitchenIssue: input.state === 'unavailable' ? issueNote : null,
        completedAt: input.state === 'completed' ? now : null,
      },
    });
    const order = await tx.foodOrder.findUnique({ where: { id: item.ticket.orderId } });
    const nextVersion = order.version + 1;
    await tx.foodOrder.update({
      where: { id: order.id },
      data: { version: { increment: 1 }, updatedByUserId: access.personId },
    });
    await tx.foodOrderEvent.create({
      data: {
        userId: access.organizationId,
        branchId: item.ticket.branchId,
        orderId: order.id,
        version: nextVersion,
        eventType: 'kitchen.item_updated',
        actorUserId: access.personId,
        actorRole: access.primaryRole,
        origin: options.origin || 'api',
        payload: { itemId, state: input.state, issueNote },
        idempotencyKey: options.idempotencyKey || null,
      },
    });
    return ticketItem;
  });
  return updated;
}

async function resolveKitchenIssue(prisma, access, ticketId, itemId, input = {}, options = {}) {
  const resolution = String(input.resolution || '').trim();
  if (resolution.length < 3) throw domainError('Indique como a alteração foi tratada com o cliente.');
  return prisma.$transaction(async (tx) => {
    if (options.idempotencyKey) {
      const previous = await tx.foodOrderEvent.findFirst({
        where: { userId: access.organizationId, idempotencyKey: options.idempotencyKey },
      });
      if (previous) {
        return tx.foodKitchenTicketItem.findFirst({ where: { id: itemId, ticketId, userId: access.organizationId } });
      }
    }
    const item = await tx.foodKitchenTicketItem.findFirst({
      where: { id: itemId, ticketId, userId: access.organizationId },
      include: { ticket: true },
    });
    if (!item) throw domainError('Item de cozinha não encontrado.', 404);
    ensureBranchAccess(access, item.ticket.branchId);
    if (item.state !== 'unavailable') throw domainError('Este item não possui uma indisponibilidade por resolver.', 409);
    if (item.issueResolvedAt) return item;
    const resolvedAt = new Date();
    const resolved = await tx.foodKitchenTicketItem.update({
      where: { id: item.id },
      data: { issueResolution: resolution.slice(0, 500), issueResolvedAt: resolvedAt, issueResolvedByUserId: access.personId },
    });
    const order = await tx.foodOrder.update({
      where: { id: item.ticket.orderId },
      data: { version: { increment: 1 }, updatedByUserId: access.personId },
    });
    await tx.foodOrderEvent.create({
      data: {
        userId: access.organizationId,
        branchId: item.ticket.branchId,
        orderId: order.id,
        version: order.version,
        eventType: 'kitchen.issue_resolved',
        actorUserId: access.personId,
        actorRole: access.primaryRole,
        origin: options.origin || 'api',
        payload: { itemId, resolution: resolved.issueResolution },
        idempotencyKey: options.idempotencyKey || null,
      },
    });
    return resolved;
  });
}

async function executeDeliveryTransition(prisma, access, deliveryId, nextState, payload = {}, options = {}) {
  return prisma.$transaction(async (tx) => {
    if (options.idempotencyKey) {
      const previous = await tx.foodOrderEvent.findFirst({
        where: { userId: access.organizationId, idempotencyKey: options.idempotencyKey },
      });
      if (previous) return findOrderAggregate(tx, access.organizationId, previous.orderId);
    }
    const delivery = await tx.foodDelivery.findFirst({
      where: { id: deliveryId, userId: access.organizationId },
      include: { order: true, collection: true },
    });
    if (!delivery) throw domainError('Entrega não encontrada.', 404, 'FOOD_DELIVERY_NOT_FOUND');
    ensureBranchAccess(access, delivery.branchId);
    if (access.roles.includes('courier') && !access.roles.includes('manager') && delivery.courierUserId !== access.personId) {
      throw domainError('Esta entrega não está atribuída ao utilizador.', 403, 'FOOD_DELIVERY_NOT_ASSIGNED');
    }
    if (nextState === 'delivered') {
      const pin = String(payload.pin || '').trim();
      const hasValidPin = pin && delivery.pinHash && await bcrypt.compare(pin, delivery.pinHash);
      const hasPhoto = Boolean(payload.proofMediaId);
      const isCollectionDelivery = Boolean(delivery.collection);
      if (!isCollectionDelivery && delivery.order.paymentState === 'paid' && !hasValidPin && !hasPhoto) {
        throw domainError('Confirme o PIN do cliente ou anexe uma fotografia autorizada.', 400, 'FOOD_DELIVERY_PROOF_REQUIRED');
      }
      if (isCollectionDelivery && delivery.collection.state !== 'with_courier') {
        throw domainError('Confirme primeiro o recebimento do valor do pedido.', 409, 'FOOD_DELIVERY_COLLECTION_REQUIRED');
      }
      if ((isCollectionDelivery || delivery.order.paymentState !== 'paid') && pin) {
        throw domainError('Pedidos com pagamento no local não utilizam PIN.', 409, 'FOOD_DELIVERY_PIN_PAYMENT_REQUIRED');
      }
      if ((isCollectionDelivery || delivery.order.paymentState !== 'paid') && !hasPhoto) {
        throw domainError('Anexe uma fotografia autorizada para confirmar esta entrega com pagamento local.', 400, 'FOOD_DELIVERY_LOCAL_PAYMENT_PROOF_REQUIRED');
      }
      if (hasPhoto) {
        const media = await tx.foodPrivateMedia.findFirst({
          where: {
            id: payload.proofMediaId,
            organizationId: access.organizationId,
            uploadedByUserId: access.personId,
            kind: 'delivery_proof',
            active: true,
            deliveries: { none: {} },
          },
        });
        if (!media) throw domainError('Comprovativo fotográfico inválido ou já utilizado.', 400);
      }
    }
    const update = reduceDeliveryState(delivery, nextState, payload);
    if (nextState === 'delivered') {
      update.proofType = payload.proofMediaId ? 'photo' : 'pin';
      update.proofMediaId = payload.proofMediaId || null;
    }
    await tx.foodDelivery.update({ where: { id: delivery.id }, data: update });
    if (nextState === 'assigned') {
      await ensureCollectionForAssignment(tx, access, delivery, update.courierUserId);
    }
    if (nextState === 'returned') {
      await markCollectionReturned(tx, access, delivery.id, payload.reason);
    }
    if (nextState === 'picked_up') {
      await tx.foodKitchenTicket.updateMany({
        where: { orderId: delivery.orderId, state: 'ready' },
        data: { state: 'collected', version: { increment: 1 } },
      });
    }

    const orderUpdate = { deliveryState: nextState, version: { increment: 1 }, updatedByUserId: access.personId };
    if (nextState === 'delivered') orderUpdate.status = 'delivered';
    else if (['out_for_delivery', 'arrived'].includes(nextState)) orderUpdate.status = 'out_for_delivery';
    else orderUpdate.status = 'awaiting_handoff';
    const order = await tx.foodOrder.update({ where: { id: delivery.orderId }, data: orderUpdate });
    await tx.foodOrderEvent.create({
      data: {
        userId: access.organizationId,
        branchId: delivery.branchId,
        orderId: delivery.orderId,
        version: order.version,
        eventType: `delivery.${nextState}`,
        actorUserId: access.personId,
        actorRole: access.primaryRole,
        payload: {
          courierUserId: update.courierUserId || delivery.courierUserId,
          reason: payload.reason || null,
          proofType: update.proofType || null,
        },
        idempotencyKey: options.idempotencyKey || null,
      },
    });
    return findOrderAggregate(tx, access.organizationId, delivery.orderId);
  }).then(serializeOrderAggregate);
}

async function recordPayment(prisma, access, orderId, input = {}, options = {}) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw domainError('O valor do pagamento deve ser superior a zero.');
  const method = String(input.method || '').trim().toUpperCase();
  if (!method) throw domainError('Selecione o método de pagamento.');

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${orderId}, 0))`;
    if (options.idempotencyKey) {
      const previous = await tx.foodPayment.findFirst({
        where: { userId: access.organizationId, idempotencyKey: options.idempotencyKey },
      });
      if (previous) {
        if (previous.orderId !== orderId) {
          throw domainError('Idempotency-Key já utilizada noutro pedido.', 409, 'IDEMPOTENCY_KEY_REUSED');
        }
        return previous;
      }
    }
    const settings = await tx.foodSettings.findUnique({ where: { userId: access.organizationId }, select: { paymentMethods: true } });
    const allowedMethods = parseJsonList(settings?.paymentMethods, ['CASH', 'MULTICAIXA', 'TPA', 'TRANSFER']);
    if (!allowedMethods.includes(method)) throw domainError('Método de pagamento indisponível nesta organização.');
    const order = await tx.foodOrder.findFirst({ where: { id: orderId, userId: access.organizationId } });
    if (!order) throw domainError('Pedido Food não encontrado.', 404);
    ensureBranchAccess(access, order.branchId);
    if (order.orderState === 'cancelled') throw domainError('Não é possível pagar um pedido cancelado.', 409);
    let cashSession = await tx.foodCashSession.findFirst({
      where: {
        organizationId: access.organizationId,
        branchId: order.branchId,
        status: 'open',
        ...(input.cashSessionId ? { id: String(input.cashSessionId) } : { openedByUserId: access.personId }),
      },
    });
    if (!cashSession) {
      throw domainError('Abra uma sessão de caixa nesta unidade antes de registar pagamentos.', 409, 'FOOD_CASH_SESSION_REQUIRED');
    }
    await tx.$queryRaw`SELECT "id" FROM "food_cash_sessions" WHERE "id" = ${cashSession.id} FOR UPDATE`;
    cashSession = await tx.foodCashSession.findUnique({ where: { id: cashSession.id } });
    if (!cashSession || cashSession.status !== 'open') {
      throw domainError('A sessão de caixa foi fechada. Abra uma nova sessão antes de continuar.', 409, 'FOOD_CASH_SESSION_REQUIRED');
    }
    const existing = await tx.foodPayment.aggregate({
      where: { orderId, userId: access.organizationId, status: 'confirmed' },
      _sum: { amount: true },
    });
    if (Number(existing._sum.amount || 0) + amount > order.total + 0.005) {
      throw domainError('O pagamento ultrapassa o valor em falta no pedido.');
    }
    const payment = await tx.foodPayment.create({
      data: {
        userId: access.organizationId,
        branchId: order.branchId,
        orderId,
        cashSessionId: cashSession.id,
        amount,
        method,
        status: 'confirmed',
        transactionReference: String(input.transactionReference || '').trim() || null,
        idempotencyKey: options.idempotencyKey || null,
        paidAt: new Date(),
        createdByUserId: access.personId,
      },
    });
    const confirmedAmount = Number(existing._sum.amount || 0) + amount;
    const paymentState = paymentStateFor(order.total, confirmedAmount);
    const totalsByMethod = cashSession.totalsByMethod && typeof cashSession.totalsByMethod === 'object'
      ? cashSession.totalsByMethod
      : {};
    totalsByMethod[method] = Number(totalsByMethod[method] || 0) + amount;
    await tx.foodCashSession.update({
      where: { id: cashSession.id },
      data: {
        totalSalesAmount: { increment: amount },
        salesCount: paymentState === 'paid' ? { increment: 1 } : undefined,
        expectedClosingAmount: method === 'CASH' ? { increment: amount } : undefined,
        totalsByMethod,
      },
    });
    const updatedOrder = await tx.foodOrder.update({
      where: { id: order.id },
      data: {
        paymentState,
        paymentStatus: paymentState === 'unpaid' ? 'pending' : paymentState,
        paymentMethod: method,
        version: { increment: 1 },
        updatedByUserId: access.personId,
      },
    });
    await tx.foodOrderEvent.create({
      data: {
        userId: access.organizationId,
        branchId: order.branchId,
        orderId: order.id,
        version: updatedOrder.version,
        eventType: 'payment.recorded',
        actorUserId: access.personId,
        actorRole: access.primaryRole,
        payload: { paymentId: payment.id, amount, method, paymentState },
      },
    });
    return payment;
  });
}

module.exports = {
  ORDER_AGGREGATE_INCLUDE,
  idempotencyKeyFromRequest,
  serializeOrderAggregate,
  listFoodOrders,
  findOrderAggregate,
  createFoodOrder,
  ensureBranchAccess,
  consumeOrderStock,
  restoreQueuedOrderStock,
  executeOrderCommand,
  acknowledgeKitchenTicket,
  updateKitchenItem,
  resolveKitchenIssue,
  executeDeliveryTransition,
  recordPayment,
};
