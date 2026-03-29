/**
 * Core invoice creation logic — shared by the REST route and the quick-sale route.
 * Handles line processing, hash chain, AGT submission, and DB persistence.
 */
const prisma = require('../prisma');
const { getNextDocumentNumber } = require('./numeracao');
const { validateFactura } = require('./validations');
const { generateQRCode, getQRCodeUrl } = require('./qrcode');
const { registarFatura, isMock } = require('./agt-api');
const { logEvent } = require('./audit');
const { isValidRate, getTaxCode } = require('../fiscal/iva-rates');
const { computeDocumentHash } = require('../fiscal/hash-chain');
const { registerFacturaFinanceEntry } = require('./register-finance-entry');

/**
 * @param {number} userId  - effectiveUserId (accountOwnerId or id)
 * @param {object} body    - same shape as POST /api/faturacao/facturas body
 * @param {object} req     - Express request (optional, used only for audit logging)
 * @returns {Promise<object>} created Factura with parsed lines
 */
async function createFactura(userId, body, req = null) {
  const {
    documentType,
    serieId: inputSerieId,
    estabelecimentoId,
    customerTaxID,
    customerName,
    customerAddress,
    clienteFaturacaoId,
    lines,
    currencyCode,
    currencyAmount,
    exchangeRate,
    paymentMethod,
  } = body;

  let serieId = inputSerieId;
  if (!serieId && estabelecimentoId) {
    const estabelecimento = await prisma.estabelecimento.findFirst({
      where: { id: estabelecimentoId, userId },
      select: { defaultSerieId: true },
    });
    serieId = estabelecimento?.defaultSerieId || null;
  }

  // ── Line processing ──────────────────────────────────────────
  let netTotal = 0;
  let taxPayable = 0;
  const processedLines = (lines || []).map((line, idx) => {
    const isIncluded = !!line.isIncluded;
    const settlementAmount = isIncluded ? 0 : Number(line.quantity) * Number(line.unitPrice);
    const taxes = line.taxes || [
      { taxType: 'IVA', taxCode: isIncluded ? 'ISE' : 'NOR', taxPercentage: isIncluded ? 0 : 14, taxAmount: 0 },
    ];
    const normalisedTaxes = taxes.map((t) => {
      const pct = Number(t.taxPercentage);
      if (!isIncluded && !isValidRate(pct)) {
        throw Object.assign(
          new Error(`Taxa de IVA inválida: ${pct}%. Valores aceites: 0%, 5%, 14%.`),
          { status: 400 }
        );
      }
      return { ...t, taxCode: getTaxCode(pct), taxPercentage: pct };
    });
    const taxAmount = isIncluded
      ? 0
      : normalisedTaxes.reduce((sum, t) => sum + settlementAmount * (t.taxPercentage / 100), 0);
    netTotal += settlementAmount;
    taxPayable += taxAmount;
    return {
      lineNumber: idx + 1,
      productCode: line.productCode,
      productDescription: line.productDescription,
      quantity: Number(line.quantity),
      unitPrice: isIncluded ? 0 : Number(line.unitPrice),
      unitOfMeasure: line.unitOfMeasure || 'UN',
      settlementAmount,
      isIncluded,
      taxes: normalisedTaxes,
    };
  });
  const grossTotal = netTotal + taxPayable;

  // ── Validation ───────────────────────────────────────────────
  const payload = { documentType, serieId, estabelecimentoId, customerTaxID, customerName, lines: processedLines, netTotal, grossTotal };
  const { valid, errors } = validateFactura(payload);
  if (!valid) {
    throw Object.assign(new Error(errors.join('; ')), { status: 400 });
  }

  // ── Sequential document number ───────────────────────────────
  const { documentNo } = await getNextDocumentNumber(serieId);

  // ── QR Code ──────────────────────────────────────────────────
  const qrCodeUrl = getQRCodeUrl(documentNo);
  const qrCodeImage = await generateQRCode(documentNo);

  // ── Hash chain ───────────────────────────────────────────────
  const now = new Date();
  const { hashCode, hashControl } = await computeDocumentHash(prisma, {
    userId,
    serieId,
    invoiceNo: documentNo,
    invoiceDate: now,
    systemEntryDate: now,
    grossTotal,
  });

  // ── AGT submission ───────────────────────────────────────────
  let agtRequestId = null;
  let agtValidationStatus = documentType === 'PF' ? 'NA' : 'P';
  if (documentType !== 'PF') {
    try {
      const agtResult = await registarFatura([{ documentNo, documentType, customerTaxID, grossTotal }]);
      agtRequestId = agtResult.requestID;
      agtValidationStatus = isMock() ? 'V' : 'P';
    } catch (agtErr) {
      console.error('AGT submission error:', agtErr);
    }
  }

  // ── Persist ──────────────────────────────────────────────────
  const resolvedCurrencyCode = currencyCode || 'AOA';
  const resolvedCurrencyAmount = currencyAmount ? Number(currencyAmount) : null;
  const resolvedExchangeRate = exchangeRate ? Number(exchangeRate) : null;
  const resolvedPaymentMethod = paymentMethod || 'Transferência Bancária';

  const factura = await prisma.$transaction(async (tx) => {
    const createdFactura = await tx.factura.create({
      data: {
        userId,
        documentNo,
        documentType,
        serieId,
        estabelecimentoId,
        customerTaxID,
        customerName,
        customerAddress: customerAddress || null,
        clienteFaturacaoId: clienteFaturacaoId || null,
        lines: JSON.stringify(processedLines),
        netTotal,
        taxPayable,
        grossTotal,
        hashCode,
        hashControl,
        qrCodeUrl,
        qrCodeImage,
        agtRequestId,
        agtValidationStatus,
        agtSubmittedAt: new Date(),
        currencyCode: resolvedCurrencyCode,
        currencyAmount: resolvedCurrencyAmount,
        exchangeRate: resolvedExchangeRate,
        paymentMethod: resolvedPaymentMethod,
      },
    });

    await registerFacturaFinanceEntry(tx, {
      userId,
      facturaId: createdFactura.id,
      documentNo,
      documentType,
      documentDate: createdFactura.documentDate,
      customerName,
      clienteFaturacaoId: clienteFaturacaoId || null,
      grossTotal,
      currencyCode: resolvedCurrencyCode,
      currencyAmount: resolvedCurrencyAmount,
      exchangeRate: resolvedExchangeRate,
      paymentMethod: resolvedPaymentMethod,
    });

    return createdFactura;
  });

  await logEvent('CREATE_FACTURA', 'FACTURA', factura.id, userId, req, { documentNo, grossTotal });

  return { ...factura, lines: processedLines };
}

module.exports = { createFactura };
