const test = require('node:test');
const assert = require('node:assert/strict');
const { replenishmentValues } = require('../services/food-stock-replenishment.service');

test('reposição desconta compras pendentes e converte necessidade em embalagens', () => {
  const result = replenishmentValues({ currentStock: 2, minimumStock: 5, idealStock: 20, purchaseConversion: 6 }, 6);
  assert.equal(result.recommendedQuantity, 12);
  assert.equal(result.recommendedPackages, 2);
  assert.equal(result.needsAlert, true);
  assert.equal(result.severity, 'warning');
});

test('stock mínimo zero desativa alerta e stock zero configurado é crítico', () => {
  assert.equal(replenishmentValues({ currentStock: 0, minimumStock: 0, idealStock: 0, purchaseConversion: 1 }).needsAlert, false);
  const critical = replenishmentValues({ currentStock: 0, minimumStock: 5, idealStock: 10, purchaseConversion: 4 });
  assert.equal(critical.needsAlert, true);
  assert.equal(critical.severity, 'critical');
  assert.equal(critical.recommendedPackages, 3);
});
