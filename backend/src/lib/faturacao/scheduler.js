'use strict';

const { PrismaClient } = require('@prisma/client');
const { getNextDocumentNumber } = require('./numeracao');
const { generateQRCode } = require('./qrcode');
const { registarFatura } = require('./agt-api');

const prisma = new PrismaClient();

/**
 * Calculates the next run date based on frequency.
 * @param {Date} current
 * @param {'WEEKLY'|'MONTHLY'|'QUARTERLY'|'ANNUAL'} frequency
 * @returns {Date}
 */
function calcNextRunDate(current, frequency) {
  const d = new Date(current);
  switch (frequency) {
    case 'WEEKLY':    d.setDate(d.getDate() + 7);        break;
    case 'MONTHLY':   d.setMonth(d.getMonth() + 1);      break;
    case 'QUARTERLY': d.setMonth(d.getMonth() + 3);      break;
    case 'ANNUAL':    d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

/**
 * Processes a single recurring invoice template and creates a real Factura.
 * @param {object} rec - FacturaRecorrente record with serie and estabelecimento included
 */
async function processOne(rec) {
  const lines = JSON.parse(rec.lines);

  // Calculate totals from line template
  let netTotal = 0;
  let taxPayable = 0;
  const processedLines = lines.map((line, i) => {
    const sub = line.quantity * line.unitPrice;
    const taxPct = line.taxes?.[0]?.taxPercentage ?? 14;
    const taxAmt = sub * (taxPct / 100);
    netTotal += sub;
    taxPayable += taxAmt;
    return {
      ...line,
      lineNumber: i + 1,
      settlementAmount: sub,
      taxes: [{
        taxType: 'IVA',
        taxCode: line.taxes?.[0]?.taxCode ?? 'NOR',
        taxPercentage: taxPct,
        taxAmount: taxAmt,
      }],
    };
  });
  const grossTotal = netTotal + taxPayable;

  // Generate sequential document number (transactional)
  const documentNo = await getNextDocumentNumber(rec.serieId);

  // Generate QR code
  const qrCodeImage = await generateQRCode(documentNo).catch(() => null);

  // Get AGT config for this user
  const config = await prisma.configuracaoFaturacao.findUnique({
    where: { userId: rec.userId },
  });

  // Submit to AGT (mock or real)
  const agtResult = await registarFatura(
    { documentNo, customerTaxID: rec.customerTaxID, lines: processedLines, grossTotal },
    config || {}
  ).catch(() => ({ status: 'P', requestId: null }));

  // Create the real Factura
  const factura = await prisma.factura.create({
    data: {
      userId:            rec.userId,
      documentNo,
      documentType:      rec.documentType,
      serieId:           rec.serieId,
      estabelecimentoId: rec.estabelecimentoId,
      customerTaxID:     rec.customerTaxID,
      customerName:      rec.customerName,
      customerAddress:   rec.customerAddress ?? null,
      clienteFaturacaoId: rec.clienteFaturacaoId ?? null,
      lines:             JSON.stringify(processedLines),
      netTotal,
      taxPayable,
      grossTotal,
      qrCodeImage:       qrCodeImage ?? null,
      jwsSignature:      'PLACEHOLDER',
      currencyCode:      rec.currencyCode,
      exchangeRate:      rec.exchangeRate ?? null,
      paymentMethod:     rec.paymentMethod,
      agtValidationStatus: agtResult.status ?? 'P',
      agtRequestId:      agtResult.requestId ?? null,
    },
  });

  return factura;
}

/**
 * Main scheduler function. Finds all due recurring invoices and processes them.
 * Can be called by cron or manually for a specific ID.
 * @param {string|null} specificId - If set, only process this record (ignore nextRunDate)
 */
async function processRecorrentes(specificId = null) {
  const now = new Date();

  const where = specificId
    ? { id: specificId }
    : { isActive: true, nextRunDate: { lte: now } };

  const due = await prisma.facturaRecorrente.findMany({
    where,
    include: { serie: true, estabelecimento: true },
  });

  for (const rec of due) {
    try {
      const factura = await processOne(rec);
      const newTotal = rec.totalGenerated + 1;
      const shouldDeactivate = rec.maxOccurrences != null && newTotal >= rec.maxOccurrences;

      await prisma.facturaRecorrente.update({
        where: { id: rec.id },
        data: {
          lastRunDate:    now,
          lastFacturaId:  factura.id,
          totalGenerated: newTotal,
          nextRunDate:    shouldDeactivate
            ? rec.nextRunDate
            : calcNextRunDate(rec.nextRunDate, rec.frequency),
          isActive: !shouldDeactivate,
        },
      });

      console.log(`[Scheduler] Fatura recorrente ${rec.id} → ${factura.documentNo}`);
    } catch (err) {
      console.error(`[Scheduler] Erro ao processar recorrente ${rec.id}:`, err.message);
    }
  }

  return due.length;
}

module.exports = { processRecorrentes, calcNextRunDate };
