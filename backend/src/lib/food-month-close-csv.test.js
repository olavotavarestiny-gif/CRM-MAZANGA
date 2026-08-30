'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFoodMonthlyCloseCsv, monthlyCloseCsvFilename, safeCell } = require('./food-month-close-csv');

test('CSV mensal usa snapshot preservado e neutraliza fórmulas', () => {
  const csv = buildFoodMonthlyCloseCsv({
    month: '2026-08-01T00:00:00.000Z', scopeKey: 'all', status: 'closed', version: 1,
    closedByUserId: 10, closedAt: '2026-08-31T23:59:00.000Z',
    snapshot: { summary: { orders: 2, reconciled: 1500 }, byMethod: [{ method: '=CMD()', count: 1, received: 1500, reconciled: 1500 }], byBranch: [], daily: [{ date: '2026-08-01', orders: 2, orderValue: 1500, received: 1500, reconciled: 1500 }] },
    validationSnapshot: { checks: [{ label: 'Caixas abertos', status: 'ok', count: 0, amount: 0 }] },
  });
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.match(csv, /"Pedidos";"2"/);
  assert.match(csv, /"Reconciliado";"1500"/);
  assert.match(csv, /"'=CMD\(\)"/);
  assert.equal(safeCell('  +SUM(A1:A2)'), "'  +SUM(A1:A2)");
  assert.equal(monthlyCloseCsvFilename({ month: '2026-08-01', branch: { name: 'Matéria Preta' } }), 'kukugest-food-fecho-2026-08-materia-preta.csv');
  assert.equal(monthlyCloseCsvFilename({ month: '2026-08-01', scopeKey: 'all', revisionNumber: 2 }), 'kukugest-food-fecho-2026-08-all-revisao-2.csv');
  const revisionCsv = buildFoodMonthlyCloseCsv({
    month: '2026-08-01', scopeKey: 'all', status: 'closed', version: 3, revisionNumber: 2,
    reason: 'Valores corrigidos', closedByUserId: 10, closedAt: '2026-09-01T10:00:00.000Z',
    snapshot: { summary: {} }, validationSnapshot: { checks: [] },
  });
  assert.match(revisionCsv, /"Revisão do snapshot";"2"/);
  assert.match(revisionCsv, /"Motivo da revisão";"Valores corrigidos"/);
});
