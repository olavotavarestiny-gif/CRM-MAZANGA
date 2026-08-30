const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDateOnly, parseTime } = require('../services/food-workforce-management.service');

test('horário Food valida data e hora sem conversão ambígua', () => {
  assert.equal(parseDateOnly('2026-08-24').toISOString(), '2026-08-24T00:00:00.000Z');
  assert.equal(parseTime('08:30', 'Entrada'), '08:30');
  assert.throws(() => parseDateOnly('24/08/2026'), (error) => error.code === 'FOOD_SCHEDULE_DATE_INVALID');
  assert.throws(() => parseTime('25:00', 'Entrada'), (error) => error.code === 'FOOD_SCHEDULE_TIME_INVALID');
});
