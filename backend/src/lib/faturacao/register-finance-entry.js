const IMMEDIATE_PAYMENT_METHODS = new Set([
  'Numerário',
  'Multibanco',
  'Cartão de Crédito',
  'Cartão de Débito',
  'CASH',
]);

function mapCurrencyOrigin(currencyCode) {
  if (!currencyCode || currencyCode === 'AOA') {
    return 'KZ';
  }

  return currencyCode;
}

function deriveFinanceStatus(documentType, paymentMethod) {
  if (documentType === 'FR' || documentType === 'FA') {
    return 'pago';
  }

  return IMMEDIATE_PAYMENT_METHODS.has(paymentMethod || '') ? 'pago' : 'pendente';
}

async function resolveContactId(tx, userId, clienteFaturacaoId) {
  if (!clienteFaturacaoId) {
    return null;
  }

  const billingClient = await tx.clienteFaturacao.findFirst({
    where: { id: clienteFaturacaoId, userId },
    select: { contactId: true },
  });

  return billingClient?.contactId || null;
}

async function registerFacturaFinanceEntry(tx, {
  userId,
  facturaId,
  documentNo,
  documentType,
  documentDate,
  customerName,
  clienteFaturacaoId,
  grossTotal,
  currencyCode,
  currencyAmount,
  exchangeRate,
  paymentMethod,
  cashSessionId,
  reconciled,
  reconciledAt,
  status,
}) {
  if (!['FT', 'FR', 'FA', 'ND'].includes(documentType)) {
    return null;
  }

  const data = await buildFacturaFinanceEntryData(tx, {
    userId,
    facturaId,
    documentNo,
    documentType,
    documentDate,
    customerName,
    clienteFaturacaoId,
    grossTotal,
    currencyCode,
    currencyAmount,
    exchangeRate,
    paymentMethod,
    cashSessionId,
    reconciled,
    reconciledAt,
    status,
  });

  return tx.transaction.create({ data });
}

async function buildFacturaFinanceEntryData(tx, {
  userId,
  facturaId,
  documentNo,
  documentType,
  documentDate,
  customerName,
  clienteFaturacaoId,
  grossTotal,
  currencyCode,
  currencyAmount,
  exchangeRate,
  paymentMethod,
  cashSessionId,
  reconciled,
  reconciledAt,
  status,
}) {
  if (!['FT', 'FR', 'FA', 'ND'].includes(documentType)) {
    return null;
  }

  const resolvedContactId = await resolveContactId(tx, userId, clienteFaturacaoId);
  const baseAmount = currencyCode && currencyCode !== 'AOA'
    ? Number(currencyAmount || grossTotal || 0)
    : Number(grossTotal || 0);
  const resolvedExchangeRate =
    currencyCode && currencyCode !== 'AOA'
      ? Number(exchangeRate || 1)
      : 1;
  const amountKz = baseAmount * resolvedExchangeRate;

  return {
    userId,
    date: documentDate,
    clientId: resolvedContactId,
    clientName: customerName || null,
    invoiceId: facturaId || null,
    cashSessionId: cashSessionId || null,
    type: 'entrada',
    revenueType: 'one-off',
    category: 'Receitas de Faturação',
    subcategory: `Documento ${documentType}`,
    description: `${documentType} ${documentNo} - ${customerName || 'Consumidor Final'}`,
    amountKz,
    currencyOrigin: mapCurrencyOrigin(currencyCode),
    exchangeRate: resolvedExchangeRate,
    paymentMethod: paymentMethod || null,
    status: status || deriveFinanceStatus(documentType, paymentMethod),
    receiptNumber: documentNo,
    notes: `Gerado automaticamente a partir da fatura ${documentNo}${facturaId ? ` (${facturaId})` : ''}.`,
    ...(reconciled !== undefined ? { reconciled } : {}),
    ...(reconciledAt ? { reconciledAt } : {}),
  };
}

module.exports = {
  IMMEDIATE_PAYMENT_METHODS,
  buildFacturaFinanceEntryData,
  deriveFinanceStatus,
  mapCurrencyOrigin,
  registerFacturaFinanceEntry,
};
