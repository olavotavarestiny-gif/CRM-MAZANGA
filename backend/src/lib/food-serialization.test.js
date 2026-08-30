const test = require('node:test');
const assert = require('node:assert/strict');
const { exposeOrganizationId } = require('./food-serialization');

test('API Food expõe organizationId preservando userId e datas', () => {
  const createdAt = new Date('2026-08-23T00:00:00.000Z');
  const result = exposeOrganizationId({ id: 'order', userId: 10, createdAt, items: [{ id: 'item', userId: 10 }] });
  assert.equal(result.userId, 10);
  assert.equal(result.organizationId, 10);
  assert.equal(result.items[0].organizationId, 10);
  assert.equal(result.createdAt, createdAt);
});
