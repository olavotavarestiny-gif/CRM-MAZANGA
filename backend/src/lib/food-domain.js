const ORDER_COMMANDS = Object.freeze({
  SEND_TO_KITCHEN: 'send_to_kitchen',
  KITCHEN_ACCEPT: 'kitchen_accept',
  KITCHEN_START: 'kitchen_start',
  KITCHEN_READY: 'kitchen_ready',
  COMPLETE: 'complete',
  CANCEL: 'cancel',
});

const DELIVERY_TRANSITIONS = Object.freeze({
  awaiting_dispatch: ['assigned', 'failed'],
  assigned: ['assigned', 'approaching_pickup', 'picked_up', 'failed'],
  approaching_pickup: ['picked_up', 'failed'],
  picked_up: ['out_for_delivery', 'failed', 'returned'],
  out_for_delivery: ['arrived', 'delivered', 'failed', 'returned'],
  arrived: ['delivered', 'failed', 'returned'],
  failed: ['assigned', 'returned'],
  delivered: [],
  returned: [],
});

function domainError(message, statusCode = 400, code = 'FOOD_DOMAIN_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function assertState(condition, message, code = 'FOOD_INVALID_TRANSITION') {
  if (!condition) throw domainError(message, 409, code);
}

function legacyStatusFor(state) {
  if (state.orderState === 'cancelled') return 'cancelled';
  if (state.orderState === 'completed') return 'completed';
  if (state.deliveryState === 'delivered') return 'delivered';
  if (['out_for_delivery', 'arrived'].includes(state.deliveryState)) return 'out_for_delivery';
  if (['awaiting_dispatch', 'assigned', 'approaching_pickup', 'picked_up', 'failed', 'returned'].includes(state.deliveryState)) {
    return 'awaiting_handoff';
  }
  if (state.kitchenState === 'ready') return 'ready';
  if (state.kitchenState === 'preparing') return 'preparing';
  if (state.kitchenState === 'accepted') return 'kitchen_accepted';
  if (state.kitchenState === 'queued') return 'sent_to_kitchen';
  if (state.orderState === 'active') return 'confirmed';
  return 'draft';
}

function deriveDisplayStatus(order) {
  const status = legacyStatusFor(order);
  const labels = {
    draft: 'Rascunho',
    confirmed: 'Confirmado',
    sent_to_kitchen: 'Enviado para a cozinha',
    kitchen_accepted: 'Aceite pela cozinha',
    preparing: 'Em preparação',
    ready: 'Pronto',
    awaiting_handoff: order.deliveryState === 'assigned' ? 'Entregador atribuído' : 'A aguardar entrega',
    out_for_delivery: order.deliveryState === 'arrived' ? 'Entregador no destino' : 'Em entrega',
    delivered: 'Entregue',
    completed: 'Concluído',
    cancelled: 'Cancelado',
  };
  return { status, label: labels[status] || status };
}

function reduceOrderCommand(order, command, payload = {}, now = new Date()) {
  const state = {
    orderState: order.orderState,
    kitchenState: order.kitchenState,
    deliveryState: order.deliveryState,
    paymentState: order.paymentState,
  };
  const timestamps = {};

  switch (command) {
    case ORDER_COMMANDS.SEND_TO_KITCHEN:
      assertState(['draft', 'active'].includes(state.orderState), 'Este pedido já não pode ser enviado para a cozinha.');
      assertState(['not_required', 'queued'].includes(state.kitchenState), 'O pedido já foi aceite pela cozinha.');
      state.orderState = 'active';
      state.kitchenState = 'queued';
      if (order.orderType === 'delivery' && state.deliveryState === 'not_required') state.deliveryState = 'pending';
      timestamps.confirmedAt = order.confirmedAt || now;
      timestamps.sentToKitchenAt = order.sentToKitchenAt || now;
      break;
    case ORDER_COMMANDS.KITCHEN_ACCEPT:
      assertState(state.orderState === 'active' && state.kitchenState === 'queued', 'Apenas pedidos novos podem ser aceites pela cozinha.');
      state.kitchenState = 'accepted';
      break;
    case ORDER_COMMANDS.KITCHEN_START:
      assertState(['accepted', 'queued'].includes(state.kitchenState), 'Este pedido não pode iniciar preparação no estado atual.');
      state.kitchenState = 'preparing';
      break;
    case ORDER_COMMANDS.KITCHEN_READY:
      assertState(['accepted', 'preparing'].includes(state.kitchenState), 'Este pedido ainda não pode ser marcado como pronto.');
      state.kitchenState = 'ready';
      timestamps.readyAt = order.readyAt || now;
      if (order.orderType === 'delivery') state.deliveryState = 'awaiting_dispatch';
      break;
    case ORDER_COMMANDS.COMPLETE:
      assertState(state.orderState === 'active', 'Apenas pedidos ativos podem ser concluídos.');
      if (order.orderType === 'delivery') {
        assertState(state.deliveryState === 'delivered', 'O pedido só pode ser concluído depois da entrega comprovada.');
      } else {
        assertState(state.kitchenState === 'ready', 'O pedido só pode ser concluído depois de ficar pronto.');
      }
      state.orderState = 'completed';
      timestamps.completedAt = now;
      break;
    case ORDER_COMMANDS.CANCEL:
      assertState(!['completed', 'cancelled'].includes(state.orderState), 'Este pedido já não pode ser cancelado.');
      assertState(
        !['assigned', 'approaching_pickup', 'picked_up', 'out_for_delivery', 'arrived', 'delivered'].includes(state.deliveryState),
        'Uma entrega em curso deve ser tratada no ambiente Delivery.'
      );
      assertState(String(payload.reason || '').trim().length >= 3, 'Indique o motivo do cancelamento.');
      state.orderState = 'cancelled';
      if (state.kitchenState === 'queued') state.kitchenState = 'not_required';
      if (['pending', 'awaiting_dispatch'].includes(state.deliveryState)) state.deliveryState = 'not_required';
      timestamps.cancelledAt = now;
      timestamps.cancelReason = String(payload.reason).trim();
      break;
    default:
      throw domainError('Comando de pedido desconhecido.', 400, 'FOOD_UNKNOWN_COMMAND');
  }

  return {
    ...state,
    ...timestamps,
    status: legacyStatusFor(state),
  };
}

function reduceDeliveryState(delivery, nextState, payload = {}, now = new Date()) {
  const allowed = DELIVERY_TRANSITIONS[delivery.state] || [];
  assertState(allowed.includes(nextState), `A entrega não pode passar de ${delivery.state} para ${nextState}.`);
  const update = { state: nextState };
  if (nextState === 'assigned') {
    assertState(Number.isInteger(Number(payload.courierUserId)), 'Selecione um entregador válido.');
    update.courierUserId = Number(payload.courierUserId);
    update.assignedAt = now;
    update.attemptCount = { increment: 1 };
    update.failureReason = null;
  }
  if (nextState === 'picked_up') update.pickedUpAt = now;
  if (nextState === 'arrived') update.arrivedAt = now;
  if (nextState === 'delivered') update.deliveredAt = now;
  if (nextState === 'failed') {
    assertState(String(payload.reason || '').trim().length >= 3, 'Indique o problema da entrega.');
    update.failureReason = String(payload.reason).trim();
  }
  if (nextState === 'returned') {
    assertState(String(payload.reason || '').trim().length >= 3, 'Indique o motivo da devolução.');
    update.returnReason = String(payload.reason).trim();
    update.returnedAt = now;
  }
  return update;
}

function paymentStateFor(total, confirmedAmount, refundedAmount = 0) {
  const paid = Math.max(0, Number(confirmedAmount || 0) - Number(refundedAmount || 0));
  if (refundedAmount > 0 && paid <= 0) return 'refunded';
  if (paid <= 0) return 'unpaid';
  if (paid + 0.005 < Number(total || 0)) return 'partial';
  return 'paid';
}

module.exports = {
  ORDER_COMMANDS,
  DELIVERY_TRANSITIONS,
  domainError,
  legacyStatusFor,
  deriveDisplayStatus,
  reduceOrderCommand,
  reduceDeliveryState,
  paymentStateFor,
};
