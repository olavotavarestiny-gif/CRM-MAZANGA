const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizedOffer } = require('../services/food-supplier-catalog.service');

test('condição do fornecedor normaliza o preço pela unidade interna', () => {
  const offer = normalizedOffer({ packagePrice: 7500, packageQuantity: 25 });
  assert.equal(offer.normalizedUnitCost, 300);
});
