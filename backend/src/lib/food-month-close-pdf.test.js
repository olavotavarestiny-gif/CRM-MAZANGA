'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { amount, buildFoodMonthlyClosePdf, monthlyClosePdfFilename } = require('./food-month-close-pdf');

test('PDF mensal é válido e identifica original e revisão no nome', async () => {
  const close = {
    month: '2026-08-01T00:00:00.000Z', scopeKey: 'all', status: 'closed', version: 3,
    revisionNumber: 2, reason: 'Valores corrigidos', closedByUserId: 10, closedAt: '2026-09-01T10:00:00.000Z',
    snapshot: {
      summary: { orders: 12, orderValue: 120000, received: 100000, reconciled: 95000, outstanding: 20000, averageTicket: 10000 },
      byMethod: [{ method: 'CASH', count: 4, received: 40000, reconciled: 35000 }],
      byBranch: [{ branchName: 'Sede', orders: 12, orderValue: 120000, received: 100000 }],
      daily: [{ date: '2026-08-01', orders: 12, orderValue: 120000, received: 100000, reconciled: 95000 }],
    },
    validationSnapshot: { checks: [{ label: 'Caixas abertos', status: 'ok', count: 0, amount: 0 }] },
  };
  const pdf = await buildFoodMonthlyClosePdf(close, { restaurantName: 'Matéria Preta', currency: 'AOA', primaryColor: '#0F766E' });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.match(pdf.subarray(-20).toString(), /%%EOF/);
  assert.ok(pdf.length > 10000);
  assert.equal(amount(1500, 'AOA'), '1500,00 Kz');
  assert.equal(monthlyClosePdfFilename(close), 'kukugest-food-fecho-2026-08-all-revisao-2.pdf');
});
