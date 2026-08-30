'use strict';

const ORDER_STATUSES = [
  'draft',
  'pending_confirmation',
  'confirmed',
  'sent_to_kitchen',
  'kitchen_accepted',
  'preparing',
  'ready',
  'awaiting_handoff',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
];

const ORDER_STATUS_LABELS = {
  draft: 'Rascunho',
  pending_confirmation: 'Aguardando confirmação',
  confirmed: 'Confirmado',
  sent_to_kitchen: 'Enviado para a cozinha',
  kitchen_accepted: 'Aceite pela cozinha',
  preparing: 'Em preparação',
  ready: 'Pronto',
  awaiting_handoff: 'Aguardando entrega ou levantamento',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

const ORDER_TYPE_LABELS = {
  delivery: 'Delivery',
  pickup: 'Levantamento',
  dine_in: 'Consumo no local',
};

const PAYMENT_STATUS_LABELS = {
  pending: 'Pendente',
  paid: 'Pago',
  partial: 'Parcial',
  refunded: 'Reembolsado',
};

const ALLOWED_TRANSITIONS = {
  draft: ['pending_confirmation', 'confirmed', 'sent_to_kitchen', 'cancelled'],
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['sent_to_kitchen', 'cancelled'],
  sent_to_kitchen: ['kitchen_accepted', 'preparing', 'ready', 'cancelled'],
  kitchen_accepted: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['awaiting_handoff', 'out_for_delivery', 'delivered', 'completed', 'cancelled'],
  awaiting_handoff: ['out_for_delivery', 'delivered', 'completed', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
};

function foodOrderError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function roundMoney(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function nonNegativeMoney(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return roundMoney(parsed);
}

function positiveQuantity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(999, Math.max(1, Math.round(parsed)));
}

function normalizeStatus(value, fallback = 'draft') {
  const status = String(value || '').trim();
  return ORDER_STATUSES.includes(status) ? status : fallback;
}

function normalizePaymentStatus(value) {
  const status = String(value || 'pending').trim();
  return PAYMENT_STATUS_LABELS[status] ? status : 'pending';
}

function assertOrderTransition(currentStatus, nextStatus, { cancelReason } = {}) {
  const current = normalizeStatus(currentStatus);
  const next = normalizeStatus(nextStatus, '');
  if (!next) throw foodOrderError('Estado do pedido inválido.');
  if (current === next) return { current, next };
  const allowed = ALLOWED_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw foodOrderError(`Transição inválida: ${ORDER_STATUS_LABELS[current] || current} para ${ORDER_STATUS_LABELS[next] || next}.`, 409);
  }
  if (next === 'cancelled' && !String(cancelReason || '').trim()) {
    throw foodOrderError('Cancelamentos exigem motivo.');
  }
  return { current, next };
}

function statusTimestampsFor(status, now = new Date()) {
  const data = {};
  if (['confirmed', 'sent_to_kitchen', 'kitchen_accepted', 'preparing', 'ready', 'awaiting_handoff', 'out_for_delivery', 'delivered', 'completed'].includes(status)) {
    data.confirmedAt = now;
  }
  if (['sent_to_kitchen', 'kitchen_accepted', 'preparing', 'ready', 'awaiting_handoff', 'out_for_delivery', 'delivered', 'completed'].includes(status)) {
    data.sentToKitchenAt = now;
  }
  if (['ready', 'awaiting_handoff', 'out_for_delivery', 'delivered', 'completed'].includes(status)) {
    data.readyAt = now;
  }
  if (status === 'completed') data.completedAt = now;
  if (status === 'cancelled') data.cancelledAt = now;
  return data;
}

function normalizeOrderType(value, allowedTypes = []) {
  const fallback = allowedTypes[0] || 'delivery';
  const type = String(value || fallback).trim();
  return allowedTypes.includes(type) ? type : fallback;
}

function normalizePaymentMethod(value, allowedMethods = []) {
  const method = String(value || '').trim();
  if (!method) return null;
  return allowedMethods.includes(method) ? method : null;
}

function buildOrderItemSnapshots({ requestedItems, productsById }) {
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    throw foodOrderError('Adicione pelo menos um produto ao pedido.');
  }

  return requestedItems.map((input, index) => {
    const productId = String(input?.productId || '').trim();
    const product = productsById.get(productId);
    if (!product || product.active === false) throw foodOrderError('Produto inválido no pedido.');
    if (product.available === false) throw foodOrderError(`Produto indisponível: ${product.name}.`);

    const quantity = positiveQuantity(input?.quantity);
    const offered = Boolean(input?.offered);
    const modifierGroups = (product.modifierGroups || [])
      .map((entry) => entry.group)
      .filter((group) => group && group.active !== false);
    const optionMap = new Map();
    for (const group of modifierGroups) {
      for (const option of group.options || []) {
        if (option.active !== false) optionMap.set(option.id, { group, option });
      }
    }

    const selectedOptionIds = [...new Set((Array.isArray(input?.modifierOptionIds) ? input.modifierOptionIds : []).map(String).filter(Boolean))];
    const selectedByGroup = new Map();
    const modifiers = selectedOptionIds.map((optionId, modifierIndex) => {
      const entry = optionMap.get(optionId);
      if (!entry) throw foodOrderError(`Complemento inválido para ${product.name}.`);
      const count = selectedByGroup.get(entry.group.id) || 0;
      selectedByGroup.set(entry.group.id, count + 1);
      const priceDelta = nonNegativeMoney(entry.option.priceDelta, 0);
      return {
        userId: product.userId,
        modifierGroupId: entry.group.id,
        modifierOptionId: entry.option.id,
        groupName: entry.group.name,
        optionName: entry.option.name,
        priceDelta,
        quantity,
        total: offered ? 0 : roundMoney(priceDelta * quantity),
        sortOrder: modifierIndex,
      };
    });

    for (const group of modifierGroups) {
      const selectedCount = selectedByGroup.get(group.id) || 0;
      const minSelection = group.required ? Math.max(1, Number(group.minSelection || 0)) : Number(group.minSelection || 0);
      if (minSelection > 0 && selectedCount < minSelection) {
        throw foodOrderError(`Seleccione pelo menos ${minSelection} complemento(s) em ${group.name}.`);
      }
      if (group.maxSelection && selectedCount > group.maxSelection) {
        throw foodOrderError(`Seleccione no máximo ${group.maxSelection} complemento(s) em ${group.name}.`);
      }
    }

    const unitPrice = nonNegativeMoney(product.price, 0);
    const modifiersTotalPerUnit = modifiers.reduce((sum, modifier) => sum + modifier.priceDelta, 0);
    const subtotal = offered ? 0 : roundMoney((unitPrice + modifiersTotalPerUnit) * quantity);

    return {
      userId: product.userId,
      productId: product.id,
      productName: product.name,
      productCode: product.internalCode,
      productImageUrl: product.imageUrl || null,
      categoryName: product.category?.name || null,
      unitPrice,
      quantity,
      subtotal,
      notes: String(input?.notes || '').trim() || null,
      offered,
      preparationMinutes: Number(product.preparationMinutes || 0),
      sortOrder: index,
      modifiers,
    };
  });
}

function calculateOrderTotals({ itemSnapshots, orderType, discountAmount, deliveryFee, taxAmount }) {
  const subtotal = roundMoney(itemSnapshots.reduce((sum, item) => sum + item.subtotal, 0));
  const discount = Math.min(nonNegativeMoney(discountAmount, 0), subtotal);
  const delivery = orderType === 'delivery' ? nonNegativeMoney(deliveryFee, 0) : 0;
  const tax = nonNegativeMoney(taxAmount, 0);
  const total = roundMoney(Math.max(0, subtotal - discount + delivery + tax));
  const estimatedPreparationMinutes = Math.max(
    1,
    ...itemSnapshots.map((item) => Number(item.preparationMinutes || 0)).filter((value) => Number.isFinite(value))
  );

  return {
    subtotal,
    discountAmount: discount,
    deliveryFee: delivery,
    taxAmount: tax,
    total,
    estimatedPreparationMinutes,
  };
}

module.exports = {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  ALLOWED_TRANSITIONS,
  foodOrderError,
  roundMoney,
  nonNegativeMoney,
  normalizeStatus,
  normalizePaymentStatus,
  normalizeOrderType,
  normalizePaymentMethod,
  assertOrderTransition,
  statusTimestampsFor,
  buildOrderItemSnapshots,
  calculateOrderTotals,
};
