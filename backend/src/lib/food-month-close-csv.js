const SUMMARY_LABELS = Object.freeze({
  orders: 'Pedidos', cancelledOrders: 'Pedidos cancelados', cancellationRate: 'Taxa de cancelamento (%)',
  orderValue: 'Valor dos pedidos', received: 'Recebido', reconciled: 'Reconciliado',
  heldByCouriers: 'Com entregadores', outstanding: 'Por receber', averageTicket: 'Ticket médio',
  discounts: 'Descontos', delivered: 'Entregas concluídas', failedDeliveries: 'Entregas com falha',
  deliverySuccessRate: 'Taxa de sucesso Delivery (%)', purchasesReceived: 'Compras recebidas',
  cashDifference: 'Diferença de Caixa',
});

function safeCell(value) {
  if (value == null) return '';
  let normalized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^\s*[=+\-@]/.test(normalized)) normalized = `'${normalized}`;
  return normalized;
}

function csvCell(value) {
  return `"${safeCell(value).replace(/"/g, '""')}"`;
}

function row(values) {
  return values.map(csvCell).join(';');
}

function buildFoodMonthlyCloseCsv(close) {
  const snapshot = close?.snapshot && typeof close.snapshot === 'object' ? close.snapshot : {};
  const validation = close?.validationSnapshot && typeof close.validationSnapshot === 'object' ? close.validationSnapshot : {};
  const lines = [];
  lines.push(row(['KukuGest Food', 'Fecho mensal preservado']));
  lines.push(row(['Metadado', 'Valor']));
  lines.push(row(['Mês', String(close.month || '').slice(0, 7)]));
  lines.push(row(['Âmbito', close.branch?.name || (close.scopeKey === 'all' ? 'Organização' : close.scopeKey)]));
  lines.push(row(['Estado', close.status]));
  lines.push(row(['Versão', close.version]));
  if (close.revisionNumber) lines.push(row(['Revisão do snapshot', close.revisionNumber]));
  if (close.reason) lines.push(row(['Motivo da revisão', close.reason]));
  lines.push(row(['Fechado por', close.closedByUserId]));
  lines.push(row(['Fechado em', close.closedAt]));
  lines.push(row(['Reaberto por', close.reopenedByUserId]));
  lines.push(row(['Reaberto em', close.reopenedAt]));
  lines.push(row(['Motivo da reabertura', close.reopenReason]));
  lines.push('');
  lines.push(row(['Resumo', 'Valor']));
  for (const [key, label] of Object.entries(SUMMARY_LABELS)) lines.push(row([label, snapshot.summary?.[key] ?? 0]));
  lines.push('');
  lines.push(row(['Métodos de pagamento']));
  lines.push(row(['Método', 'Operações', 'Recebido', 'Reconciliado']));
  for (const item of Array.isArray(snapshot.byMethod) ? snapshot.byMethod : []) lines.push(row([item.method, item.count, item.received, item.reconciled]));
  lines.push('');
  lines.push(row(['Unidades']));
  lines.push(row(['Unidade', 'Pedidos', 'Cancelados', 'Valor dos pedidos', 'Recebido', 'Reconciliado', 'Ticket médio', 'Entregas concluídas', 'Compras recebidas']));
  for (const item of Array.isArray(snapshot.byBranch) ? snapshot.byBranch : []) lines.push(row([item.branchName, item.orders, item.cancelledOrders, item.orderValue, item.received, item.reconciled, item.averageTicket, item.delivered, item.purchasesReceived]));
  lines.push('');
  lines.push(row(['Histórico diário']));
  lines.push(row(['Data', 'Pedidos', 'Valor dos pedidos', 'Recebido', 'Reconciliado']));
  for (const item of Array.isArray(snapshot.daily) ? snapshot.daily : []) lines.push(row([item.date, item.orders, item.orderValue, item.received, item.reconciled]));
  lines.push('');
  lines.push(row(['Validação do fecho']));
  lines.push(row(['Verificação', 'Estado', 'Registos', 'Valor']));
  for (const item of Array.isArray(validation.checks) ? validation.checks : []) lines.push(row([item.label, item.status, item.count, item.amount]));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function monthlyCloseCsvFilename(close) {
  const month = String(close?.month || '').slice(0, 7) || 'mes';
  const scope = String(close?.branch?.name || close?.scopeKey || 'organizacao').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'organizacao';
  const revision = Number(close?.revisionNumber) > 1 ? `-revisao-${Number(close.revisionNumber)}` : '';
  return `kukugest-food-fecho-${month}-${scope}${revision}.csv`;
}

module.exports = { buildFoodMonthlyCloseCsv, monthlyCloseCsvFilename, safeCell };
