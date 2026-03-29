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

async function resolveContactId(tx, clienteFaturacaoId) {
  if (!clienteFaturacaoId) {
    return null;
  }

  const billingClient = await tx.clienteFaturacao.findUnique({
    where: { id: clienteFaturacaoId },
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
}) {
  if (!['FT', 'FR', 'FA', 'ND'].includes(documentType)) {
    return null;
  }

  const resolvedContactId = await resolveContactId(tx, clienteFaturacaoId);
  const baseAmount = currencyCode && currencyCode !== 'AOA'
    ? Number(currencyAmount || grossTotal || 0)
    : Number(grossTotal || 0);
  const resolvedExchangeRate =
    currencyCode && currencyCode !== 'AOA'
      ? Number(exchangeRate || 1)
      : 1;
  const amountKz = baseAmount * resolvedExchangeRate;

  return tx.transaction.create({
    data: {
      userId,
      date: documentDate,
      clientId: resolvedContactId,
      clientName: customerName || null,
      type: 'entrada',
      revenueType: 'one-off',
      category: 'Receitas de Faturação',
      subcategory: `Documento ${documentType}`,
      description: `${documentType} ${documentNo} — ${customerName || 'Consumidor Final'}`,
      amountKz,
      currencyOrigin: mapCurrencyOrigin(currencyCode),
      exchangeRate: resolvedExchangeRate,
      paymentMethod: paymentMethod || null,
      status: deriveFinanceStatus(documentType, paymentMethod),
      receiptNumber: documentNo,
      notes: `Gerado automaticamente a partir da fatura ${documentNo}${facturaId ? ` (${facturaId})` : ''}.`,
    },
  });
}

module.exports = {
  registerFacturaFinanceEntry,
};
