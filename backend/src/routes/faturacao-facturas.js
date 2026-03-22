const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { getNextDocumentNumber } = require('../lib/faturacao/numeracao');
const { validateFactura } = require('../lib/faturacao/validations');
const { generateQRCode, getQRCodeUrl } = require('../lib/faturacao/qrcode');
const { registarFatura, isMock } = require('../lib/faturacao/agt-api');
const { generateFacturaPDF } = require('../lib/faturacao/pdf');
const { logEvent } = require('../lib/faturacao/audit');

// GET /api/faturacao/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [totalMes, receitaMes, pendentesAGT, totalGeral] = await Promise.all([
      prisma.factura.count({ where: { userId, documentDate: { gte: startOfMonth, lte: endOfMonth }, documentStatus: 'N' } }),
      prisma.factura.aggregate({ where: { userId, documentDate: { gte: startOfMonth, lte: endOfMonth }, documentStatus: 'N' }, _sum: { grossTotal: true } }),
      prisma.factura.count({ where: { userId, agtValidationStatus: 'P', documentStatus: 'N' } }),
      prisma.factura.count({ where: { userId, documentStatus: 'N' } }),
    ]);

    res.json({
      totalMes,
      receitaMes: receitaMes._sum.grossTotal || 0,
      pendentesAGT,
      totalGeral,
      mockMode: isMock(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/faturacao/facturas
router.get('/facturas', async (req, res) => {
  try {
    const { page = 1, limit = 20, documentType, documentStatus, agtStatus, search, startDate, endDate } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      userId: req.user.effectiveUserId,
      ...(documentType && { documentType }),
      ...(documentStatus && { documentStatus }),
      ...(agtStatus && { agtValidationStatus: agtStatus }),
      ...(search && { OR: [{ documentNo: { contains: search } }, { customerName: { contains: search, mode: 'insensitive' } }, { customerTaxID: { contains: search } }] }),
      ...(startDate && endDate && { documentDate: { gte: new Date(startDate), lte: new Date(endDate) } }),
    };
    const [facturas, total] = await Promise.all([
      prisma.factura.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { documentDate: 'desc' },
        select: {
          id: true, documentNo: true, documentType: true, documentStatus: true,
          customerName: true, customerTaxID: true, documentDate: true,
          netTotal: true, taxPayable: true, grossTotal: true,
          agtValidationStatus: true, isOffline: true, createdAt: true,
        },
      }),
      prisma.factura.count({ where }),
    ]);
    res.json({ facturas, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/faturacao/facturas/:id
router.get('/facturas/:id', async (req, res) => {
  try {
    const factura = await prisma.factura.findUnique({
      where: { id: req.params.id },
      include: { serie: true, estabelecimento: true },
    });
    if (!factura || factura.userId !== req.user.effectiveUserId) return res.status(404).json({ error: 'Factura não encontrada' });
    res.json({ ...factura, lines: typeof factura.lines === 'string' ? JSON.parse(factura.lines) : factura.lines });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faturacao/facturas — CRIAR (imutável após criação)
router.post('/facturas', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const { documentType, serieId, estabelecimentoId, customerTaxID, customerName, customerAddress, clienteFaturacaoId, lines, currencyCode, currencyAmount, exchangeRate, paymentMethod } = req.body;

    // Calcular totais das linhas
    let netTotal = 0;
    let taxPayable = 0;
    const processedLines = (lines || []).map((line, idx) => {
      const settlementAmount = Number(line.quantity) * Number(line.unitPrice);
      const taxes = line.taxes || [{ taxType: 'IVA', taxCode: 'NOR', taxPercentage: 14, taxAmount: settlementAmount * 0.14 }];
      const taxAmount = taxes.reduce((sum, t) => sum + (settlementAmount * (Number(t.taxPercentage) / 100)), 0);
      netTotal += settlementAmount;
      taxPayable += taxAmount;
      return {
        lineNumber: idx + 1,
        productCode: line.productCode,
        productDescription: line.productDescription,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        unitOfMeasure: line.unitOfMeasure || 'UN',
        settlementAmount,
        taxes,
      };
    });
    const grossTotal = netTotal + taxPayable;

    const payload = { documentType, serieId, estabelecimentoId, customerTaxID, customerName, lines: processedLines, netTotal, grossTotal };
    const { valid, errors } = validateFactura(payload);
    if (!valid) return res.status(400).json({ error: errors.join('; ') });

    // Número sequencial (transação atómica)
    const { documentNo } = await getNextDocumentNumber(serieId);

    // QR Code
    const qrCodeUrl = getQRCodeUrl(documentNo);
    const qrCodeImage = await generateQRCode(documentNo);

    // Submeter à AGT (mock)
    let agtRequestId = null;
    let agtValidationStatus = 'P';
    try {
      const agtResult = await registarFatura([{ documentNo, documentType, customerTaxID, grossTotal }]);
      agtRequestId = agtResult.requestID;
      agtValidationStatus = isMock() ? 'V' : 'P'; // Mock → imediatamente válida
    } catch (agtErr) {
      console.error('AGT submission error:', agtErr);
    }

    const factura = await prisma.factura.create({
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
        qrCodeUrl,
        qrCodeImage,
        agtRequestId,
        agtValidationStatus,
        agtSubmittedAt: new Date(),
        currencyCode: currencyCode || 'AOA',
        currencyAmount: currencyAmount ? Number(currencyAmount) : null,
        exchangeRate: exchangeRate ? Number(exchangeRate) : null,
        paymentMethod: paymentMethod || 'Transferência Bancária',
      },
    });

    await logEvent('CREATE_FACTURA', 'FACTURA', factura.id, userId, req, { documentNo, grossTotal });

    res.status(201).json({ ...factura, lines: processedLines });
  } catch (err) {
    console.error('Error creating factura:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faturacao/facturas/:id/anular — ANULAR (nunca DELETE)
router.post('/facturas/:id/anular', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const { motivo } = req.body;
    if (!motivo?.trim()) return res.status(400).json({ error: 'Motivo de anulação obrigatório' });

    const factura = await prisma.factura.findUnique({ where: { id: req.params.id }, select: { userId: true, documentStatus: true, documentNo: true } });
    if (!factura || factura.userId !== userId) return res.status(404).json({ error: 'Factura não encontrada' });
    if (factura.documentStatus === 'A') return res.status(400).json({ error: 'Factura já está anulada' });

    const updated = await prisma.factura.update({
      where: { id: req.params.id },
      data: { documentStatus: 'A', documentCancelReason: motivo, agtValidationStatus: 'A' },
    });

    await logEvent('CANCEL_FACTURA', 'FACTURA', req.params.id, userId, req, { documentNo: factura.documentNo, motivo });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/faturacao/facturas/:id/pdf
router.get('/facturas/:id/pdf', async (req, res) => {
  try {
    const factura = await prisma.factura.findUnique({
      where: { id: req.params.id },
      include: { serie: true, estabelecimento: true },
    });
    if (!factura || factura.userId !== req.user.effectiveUserId)
      return res.status(404).json({ error: 'Factura não encontrada' });

    const config = await prisma.configuracaoFaturacao.findUnique({
      where: { userId: req.user.effectiveUserId },
    }) || {};

    const facturaWithLines = { ...factura, lines: typeof factura.lines === 'string' ? JSON.parse(factura.lines) : factura.lines };
    const pdfBuffer = await generateFacturaPDF(facturaWithLines, config);

    const safeName = factura.documentNo.replace(/[\s/\\]/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="factura-${safeName}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Bloquear DELETE e PUT de valores (segurança AGT)
router.delete('/facturas/:id', (req, res) => {
  res.status(405).json({ error: 'Facturas não podem ser eliminadas. Use /anular para anular.' });
});

router.put('/facturas/:id', (req, res) => {
  res.status(405).json({ error: 'Facturas não podem ser editadas após emissão.' });
});

module.exports = router;
