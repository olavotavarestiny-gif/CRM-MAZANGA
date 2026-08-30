const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePin } = require('../services/food-workforce.service');

test('código Food aceita apenas 4 a 6 dígitos', () => {
  assert.equal(normalizePin('1234'), '1234');
  assert.equal(normalizePin('123456'), '123456');
  assert.throws(() => normalizePin('123'), (error) => error.code === 'FOOD_STAFF_PIN_INVALID_FORMAT');
  assert.throws(() => normalizePin('12A4'), (error) => error.code === 'FOOD_STAFF_PIN_INVALID_FORMAT');
  assert.throws(() => normalizePin('1234567'), (error) => error.code === 'FOOD_STAFF_PIN_INVALID_FORMAT');
});
