const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { createFactura } = require('../lib/faturacao/create-factura');
const { isMock } = require('../lib/faturacao/agt-api');
const { generateFacturaPDF } = require('../lib/faturacao/pdf');

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
    const factura = await createFactura(userId, req.body, req);
    res.status(201).json(factura);
  } catch (err) {
    console.error('Error creating factura:', err);
    const msg = err.message || '';
    if (err.status === 400) return res.status(400).json({ error: msg });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Já existe uma fatura com este número. Por favor tente novamente.' });
    if (msg.includes('Série não encontrada')) return res.status(400).json({ error: 'A série seleccionada não existe. Selecione outra série nas definições.' });
    if (msg.includes('Série está fechada')) return res.status(400).json({ error: 'A série está fechada. Crie ou seleccione uma série activa.' });
    if (msg.includes('serie') || msg.includes('Serie')) return res.status(400).json({ error: 'Problema com a série de faturação. Verifique as configurações de séries.' });
    if (msg.includes('estabelecimento') || msg.includes('Estabelecimento')) return res.status(400).json({ error: 'O ponto de venda seleccionado não foi encontrado. Configure-o na Configuração Fiscal.' });
    if (msg.includes('cliente') || msg.includes('NIF')) return res.status(400).json({ error: 'Dados do cliente inválidos. Verifique o NIF e o nome.' });
    res.status(500).json({ error: 'Erro ao criar a fatura. Verifique todos os campos e tente novamente.' });
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
    console.error('Error cancelling factura:', err);
    res.status(500).json({ error: 'Erro ao anular a fatura. Tente novamente.' });
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
    const accountOwner = await prisma.user.findUnique({
      where: { id: req.user.effectiveUserId },
      select: { workspaceMode: true },
    });

    const facturaWithLines = { ...factura, lines: typeof factura.lines === 'string' ? JSON.parse(factura.lines) : factura.lines };
    const pdfBuffer = await generateFacturaPDF(facturaWithLines, {
      ...config,
      workspaceMode: accountOwner?.workspaceMode === 'comercio' ? 'comercio' : 'servicos',
    });

    const safeName = factura.documentNo.replace(/[\s/\\]/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="factura-${safeName}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'Erro ao gerar o PDF. Verifique se as configurações da empresa estão preenchidas (nome, NIF, morada).' });
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
