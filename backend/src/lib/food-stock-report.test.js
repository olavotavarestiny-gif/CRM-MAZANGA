const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWhatsAppPhone, listFoodStockMovements } = require('../services/food-stock-report.service');

test('normaliza telefones de Angola para o formato usado pelo WhatsApp', () => {
  assert.equal(normalizeWhatsAppPhone('923 123 456'), '244923123456');
  assert.equal(normalizeWhatsAppPhone('+244 923 123 456'), '244923123456');
  assert.equal(normalizeWhatsAppPhone('00244 923 123 456'), '244923123456');
});

test('rejeita telefone sem comprimento internacional válido', () => {
  assert.equal(normalizeWhatsAppPhone('12345'), null);
  assert.equal(normalizeWhatsAppPhone(null), null);
});

test('histórico usa limites seguros quando período e limite são inválidos', async () => {
  let receivedQuery;
  const prisma = { foodStockMovement: { findMany: async (query) => { receivedQuery = query; return []; } } };
  const context = { organizationId: 10, branchIds: null, canAccessBranch: () => true };
  await listFoodStockMovements(prisma, context, { days: 'inválido', limit: 'inválido' });
  assert.equal(receivedQuery.take, 100);
  assert.equal(Number.isNaN(receivedQuery.where.createdAt.gte.getTime()), false);
});
