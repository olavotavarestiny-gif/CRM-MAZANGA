'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveMonth } = require('../services/food-month-close.service');

test('fecho mensal resolve limites e rejeita meses futuros', () => {
  const period = resolveMonth('2026-02', new Date('2026-08-24T10:00:00Z'));
  assert.equal(period.start.toISOString(), '2026-02-01T00:00:00.000Z');
  assert.equal(period.end.toISOString(), '2026-02-28T23:59:59.999Z');
  assert.throws(() => resolveMonth('2026-13', new Date('2026-08-24T10:00:00Z')), /AAAA-MM/);
  assert.throws(() => resolveMonth('2026-09', new Date('2026-08-24T10:00:00Z')), /futuro/);
});
