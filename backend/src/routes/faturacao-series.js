const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET /api/faturacao/series
router.get('/series', async (req, res) => {
  try {
    const series = await prisma.serie.findMany({
      where: { userId: req.user.effectiveUserId },
      include: { estabelecimento: { select: { id: true, nome: true } } },
      orderBy: [{ seriesYear: 'desc' }, { seriesCode: 'asc' }],
    });
    res.json(series);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faturacao/series
router.post('/series', async (req, res) => {
  try {
    const { estabelecimentoId, seriesCode, seriesYear, documentType, firstDocumentNumber } = req.body;
    if (!estabelecimentoId || !seriesCode || !seriesYear || !documentType) {
      return res.status(400).json({ error: 'Campos obrigatórios: estabelecimentoId, seriesCode, seriesYear, documentType' });
    }
    const serie = await prisma.serie.create({
      data: {
        userId: req.user.effectiveUserId,
        estabelecimentoId,
        seriesCode,
        seriesYear: Number(seriesYear),
        documentType,
        firstDocumentNumber: Number(firstDocumentNumber) || 1,
        seriesStatus: 'A',
      },
    });
    res.status(201).json(serie);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Série já existe para este tipo e ano' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/faturacao/series/:id
router.put('/series/:id', async (req, res) => {
  try {
    const serie = await prisma.serie.findUnique({ where: { id: req.params.id }, select: { userId: true, seriesStatus: true } });
    if (!serie || serie.userId !== req.user.effectiveUserId) return res.status(404).json({ error: 'Série não encontrada' });
    if (serie.seriesStatus === 'F') return res.status(400).json({ error: 'Série fechada não pode ser editada' });

    const { seriesStatus } = req.body;
    const updated = await prisma.serie.update({
      where: { id: req.params.id },
      data: { ...(seriesStatus !== undefined && { seriesStatus }) },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/faturacao/series/:id — só fecha (não apaga)
router.delete('/series/:id', async (req, res) => {
  try {
    const serie = await prisma.serie.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!serie || serie.userId !== req.user.effectiveUserId) return res.status(404).json({ error: 'Série não encontrada' });
    const facturaCount = await prisma.factura.count({ where: { serieId: req.params.id } });
    if (facturaCount > 0) return res.status(400).json({ error: 'Série com facturas não pode ser eliminada — feche-a em vez disso' });
    await prisma.serie.delete({ where: { id: req.params.id } });
    res.json({ message: 'Série eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/faturacao/estabelecimentos
router.get('/estabelecimentos', async (req, res) => {
  try {
    const estabs = await prisma.estabelecimento.findMany({
      where: { userId: req.user.effectiveUserId },
      orderBy: { isPrincipal: 'desc' },
    });
    res.json(estabs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faturacao/estabelecimentos
router.post('/estabelecimentos', async (req, res) => {
  try {
    const { nome, nif, morada, telefone, email, isPrincipal } = req.body;
    if (!nome || !nif) return res.status(400).json({ error: 'Nome e NIF obrigatórios' });
    const estab = await prisma.estabelecimento.create({
      data: { userId: req.user.effectiveUserId, nome, nif, morada, telefone, email, isPrincipal: isPrincipal ?? false },
    });
    res.status(201).json(estab);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
