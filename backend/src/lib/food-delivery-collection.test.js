'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { collectionDifference, money } = require('./food-delivery-collection');

test('normaliza valores e calcula diferenças de reconciliação em cêntimos', () => {
  assert.equal(money(10.005), 10.01);
  assert.equal(collectionDifference(1250, 1250), 0);
  assert.equal(collectionDifference(1250, 1200), -50);
  assert.equal(collectionDifference(1250, 1300), 50);
});
