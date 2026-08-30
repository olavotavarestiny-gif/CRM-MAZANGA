const test = require('node:test');
const assert = require('node:assert/strict');
const { foodAuditData, recordFoodAudit } = require('./food-audit');

function request() {
  return {
    foodContext: { organizationId: 10, personId: 22, primaryRole: 'cashier' },
    headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2', 'user-agent': 'KukuGest Test' },
    get(name) {
      return { 'X-Food-Origin': 'web', 'X-Food-Device': 'caixa-01', 'User-Agent': 'KukuGest Test' }[name];
    },
  };
}

test('auditoria Food normaliza tenant, actor, origem, dispositivo e motivo', () => {
  const data = foodAuditData(request(), {
    branchId: 'branch-a',
    action: 'catalog.product.updated',
    entityType: 'food_product',
    entityId: 'product-a',
    reason: 'Correção de preço',
    idempotencyKey: null,
    payload: { fields: ['price'] },
  });
  assert.deepEqual(data, {
    organizationId: 10,
    branchId: 'branch-a',
    actorUserId: 22,
    actorRole: 'cashier',
    action: 'catalog.product.updated',
    entityType: 'food_product',
    entityId: 'product-a',
    origin: 'web',
    device: 'caixa-01',
    reason: 'Correção de preço',
    idempotencyKey: null,
    ipAddress: '10.0.0.1',
    userAgent: 'KukuGest Test',
    payload: { fields: ['price'] },
  });
});

test('auditoria Food recusa eventos sem contrato mínimo', async () => {
  await assert.rejects(
    recordFoodAudit({ foodAuditEvent: { create: async () => null } }, request(), { action: '', entityType: 'food_product', entityId: '1' }),
    (error) => error.code === 'FOOD_AUDIT_INVALID'
  );
});
