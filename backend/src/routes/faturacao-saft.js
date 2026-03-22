const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { generateSAFT } = require('../lib/faturacao/saft-generator');

// GET /api/faturacao/saft
router.get('/saft', async (req, res) => {
  try {
    const periodos = await prisma.saftPeriodo.findMany({
      where: { userId: req.user.effectiveUserId },
      orderBy: { periodo: 'desc' },
      select: { id: true, periodo: true, status: true, totalFacturas: true, generatedAt: true },
    });
    res.json(periodos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faturacao/saft/generate
router.post('/saft/generate', async (req, res) => {
  try {
    const { periodo } = req.body; // "2026-01"
    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
      return res.status(400).json({ error: 'Período inválido. Formato: YYYY-MM' });
    }

    const userId = req.user.effectiveUserId;
    const [year, month] = periodo.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const xmlContent = await generateSAFT(userId, periodo);

    const totalFacturas = await prisma.factura.count({
      where: { userId, documentDate: { gte: startDate, lte: endDate }, documentStatus: 'N' },
    });

    const saftPeriodo = await prisma.saftPeriodo.upsert({
      where: { id: `${userId}-${periodo}` },
      create: {
        id: `${userId}-${periodo}`,
        userId,
        periodo,
        startDate,
        endDate,
        status: 'GENERATED',
        xmlContent,
        totalFacturas,
      },
      update: {
        status: 'GENERATED',
        xmlContent,
        totalFacturas,
        generatedAt: new Date(),
      },
    });

    res.json({ ...saftPeriodo, xmlContent: undefined }); // não retornar XML no JSON
  } catch (err) {
    console.error('SAF-T generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/faturacao/saft/:id/download
router.get('/saft/:id/download', async (req, res) => {
  try {
    const periodo = await prisma.saftPeriodo.findUnique({ where: { id: req.params.id } });
    if (!periodo || periodo.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Período não encontrado' });
    }
    if (!periodo.xmlContent) {
      return res.status(404).json({ error: 'Ficheiro XML não disponível' });
    }
    const filename = `saft-${periodo.periodo}.xml`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(periodo.xmlContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
