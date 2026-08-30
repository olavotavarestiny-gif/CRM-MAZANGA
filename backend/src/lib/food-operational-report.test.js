'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { percentageChange, resolvePeriod, summarizePeriod } = require('../services/food-operational-report.service');

test('relatório operacional valida período e calcula comparação', () => {
  const period = resolvePeriod({ from: '2026-08-01', to: '2026-08-30' });
  assert.equal(period.days, 30);
  assert.equal(period.previousFrom.toISOString().slice(0, 10), '2026-07-02');
  assert.equal(period.previousTo.toISOString().slice(0, 10), '2026-07-31');
  assert.equal(percentageChange(120, 100), 20);
  assert.equal(percentageChange(10, 0), null);
  assert.throws(() => resolvePeriod({ from: '2026-08-30', to: '2026-08-01' }), /data inicial/i);
});

test('pagamento com entregador não é contado como reconciliado', () => {
  const summary = summarizePeriod(
    [{ orderState: 'active', total: 1000, discountAmount: 50 }, { orderState: 'cancelled', total: 200 }],
    [
      { amount: 400, source: 'cashier', cashSessionId: 'cash-1' },
      { amount: 600, source: 'delivery_collection', cashSessionId: null },
    ],
    [{ state: 'delivered' }, { state: 'returned' }],
    [{ status: 'received', total: 300 }],
    [{ status: 'closed', differenceAmount: -10 }]
  );
  assert.equal(summary.received, 1000);
  assert.equal(summary.reconciled, 400);
  assert.equal(summary.heldByCouriers, 600);
  assert.equal(summary.cancelledOrders, 1);
  assert.equal(summary.deliverySuccessRate, 50);
});
