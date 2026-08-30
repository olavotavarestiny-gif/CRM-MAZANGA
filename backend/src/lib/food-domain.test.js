const test = require('node:test');
const assert = require('node:assert/strict');
const {
  reduceOrderCommand,
  reduceDeliveryState,
  paymentStateFor,
} = require('./food-domain');

function order(overrides = {}) {
  return {
    orderState: 'draft',
    kitchenState: 'not_required',
    deliveryState: 'not_required',
    paymentState: 'unpaid',
    orderType: 'delivery',
    confirmedAt: null,
    sentToKitchenAt: null,
    readyAt: null,
    ...overrides,
  };
}

test('pedido usa projeções independentes até ficar pronto para delivery', () => {
  const sent = reduceOrderCommand(order(), 'send_to_kitchen');
  assert.equal(sent.orderState, 'active');
  assert.equal(sent.kitchenState, 'queued');
  assert.equal(sent.deliveryState, 'pending');

  const accepted = reduceOrderCommand({ ...order(), ...sent }, 'kitchen_accept');
  const preparing = reduceOrderCommand({ ...order(), ...accepted }, 'kitchen_start');
  const ready = reduceOrderCommand({ ...order(), ...preparing }, 'kitchen_ready');
  assert.equal(ready.kitchenState, 'ready');
  assert.equal(ready.deliveryState, 'awaiting_dispatch');
  assert.equal(ready.status, 'awaiting_handoff');
});

test('pedido delivery não conclui sem prova de entrega', () => {
  assert.throws(
    () => reduceOrderCommand(order({ orderState: 'active', kitchenState: 'ready', deliveryState: 'out_for_delivery' }), 'complete'),
    /entrega comprovada/
  );
});

test('cancelamento limpa filas ainda não iniciadas e bloqueia entrega em curso', () => {
  const cancelled = reduceOrderCommand(order({
    orderState: 'active',
    kitchenState: 'queued',
    deliveryState: 'pending',
  }), 'cancel', { reason: 'Cliente desistiu' });
  assert.equal(cancelled.orderState, 'cancelled');
  assert.equal(cancelled.kitchenState, 'not_required');
  assert.equal(cancelled.deliveryState, 'not_required');
  assert.throws(
    () => reduceOrderCommand(order({ orderState: 'active', deliveryState: 'assigned' }), 'cancel', { reason: 'Cliente desistiu' }),
    /ambiente Delivery/
  );
});

test('transições de delivery exigem entregador e motivo em falhas', () => {
  assert.throws(() => reduceDeliveryState({ state: 'awaiting_dispatch' }, 'assigned'), /entregador válido/);
  assert.throws(() => reduceDeliveryState({ state: 'out_for_delivery' }, 'failed'), /problema/);
  assert.equal(
    reduceDeliveryState({ state: 'awaiting_dispatch' }, 'assigned', { courierUserId: 42 }).courierUserId,
    42
  );
  assert.equal(
    reduceDeliveryState({ state: 'assigned' }, 'assigned', { courierUserId: 84 }).courierUserId,
    84
  );
});

test('estado de pagamento deriva do total confirmado', () => {
  assert.equal(paymentStateFor(1000, 0), 'unpaid');
  assert.equal(paymentStateFor(1000, 400), 'partial');
  assert.equal(paymentStateFor(1000, 1000), 'paid');
  assert.equal(paymentStateFor(1000, 1000, 1000), 'refunded');
});
