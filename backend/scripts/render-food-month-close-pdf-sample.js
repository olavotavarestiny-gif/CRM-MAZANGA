'use strict';

const fs = require('fs/promises');
const path = require('path');
const { buildFoodMonthlyClosePdf } = require('../src/lib/food-month-close-pdf');

async function main() {
  const output = path.resolve(process.argv[2] || 'output/pdf/kukugest-food-fecho-exemplo.pdf');
  const daily = Array.from({ length: 31 }, (_, index) => ({
    date: `2026-08-${String(index + 1).padStart(2, '0')}`,
    orders: 18 + index,
    orderValue: 220000 + (index * 12500),
    received: 200000 + (index * 11000),
    reconciled: 195000 + (index * 10500),
  }));
  const pdf = await buildFoodMonthlyClosePdf({
    month: '2026-08-01T00:00:00.000Z', scopeKey: 'all', status: 'closed', version: 3,
    revisionNumber: 2, reason: 'Reconciliação de duas diferenças de Caixa concluída e conferida pelo gestor.',
    closedByUserId: 25, closedAt: '2026-09-01T10:30:00.000Z',
    snapshot: {
      summary: { orders: 842, orderValue: 12845000, received: 12280000, reconciled: 12140000, outstanding: 565000, averageTicket: 15255.34, heldByCouriers: 140000, cashDifference: 0, discounts: 315000, cancellationRate: 2.4 },
      byMethod: [
        { method: 'CASH', count: 310, received: 4680000, reconciled: 4680000 },
        { method: 'TPA', count: 286, received: 4210000, reconciled: 4210000 },
        { method: 'TRANSFER', count: 146, received: 2260000, reconciled: 2260000 },
        { method: 'MULTICAIXA EXPRESS', count: 100, received: 1130000, reconciled: 990000 },
      ],
      byBranch: [
        { branchName: 'Matéria Preta - Talatona', orders: 522, orderValue: 8045000, received: 7750000 },
        { branchName: 'Matéria Preta - Kilamba', orders: 320, orderValue: 4800000, received: 4530000 },
      ],
      daily,
    },
    validationSnapshot: { checks: [
      { label: 'Caixas abertos', status: 'ok', count: 0, amount: 0 },
      { label: 'Cobranças Delivery pendentes', status: 'ok', count: 0, amount: 0 },
      { label: 'Compras abertas', status: 'ok', count: 0, amount: 0 },
      { label: 'Diferenças de Caixa sem decisão', status: 'ok', count: 0, amount: 0 },
      { label: 'Pedidos concluídos com pagamento incoerente', status: 'ok', count: 0, amount: 0 },
      { label: 'Stock negativo', status: 'ok', count: 0, amount: 0 },
      { label: 'Turnos ainda abertos', status: 'ok', count: 0, amount: 0 },
      { label: 'Ingredientes abaixo do mínimo', status: 'warning', count: 3, amount: 0 },
      { label: 'Documentos fiscais com falha', status: 'warning', count: 1, amount: 0 },
    ] },
  }, { restaurantName: 'Matéria Preta', currency: 'AOA', primaryColor: '#0F766E' });
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, pdf);
  process.stdout.write(`${output}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
