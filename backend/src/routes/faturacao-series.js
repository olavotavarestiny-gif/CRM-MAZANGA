const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { generateUniqueSeriesCode } = require('../lib/faturacao/series-code');
const { getPlanContext, isPlanAtLeast } = require('../lib/plan-limits');
const {
  logFieldChangesActivity,
  logSerieCreatedActivity,
  logSerieDeletedActivity,
  logStoreCreatedActivity,
} = require('../lib/activity-log');

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

    await logSerieCreatedActivity(serie, req);

    res.status(201).json(serie);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Série já existe para este tipo e ano' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/faturacao/series/:id
router.put('/series/:id', async (req, res) => {
  try {
    const serie = await prisma.serie.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        userId: true,
        seriesCode: true,
        seriesYear: true,
        seriesStatus: true,
      },
    });
    if (!serie || serie.userId !== req.user.effectiveUserId) return res.status(404).json({ error: 'Série não encontrada' });
    if (serie.seriesStatus === 'F') return res.status(400).json({ error: 'Série fechada não pode ser editada' });

    const { seriesStatus } = req.body;
    const updated = await prisma.serie.update({
      where: { id: req.params.id },
        data: { ...(seriesStatus !== undefined && { seriesStatus }) },
    });

    await logFieldChangesActivity({
      organizationId: updated.userId,
      actor: req,
      entityType: 'serie',
      entityId: updated.id,
      entityLabel: `${updated.seriesCode}/${updated.seriesYear}`,
      changes: [
        {
          fieldChanged: 'seriesStatus',
          oldValue: serie.seriesStatus,
          newValue: updated.seriesStatus,
        },
      ],
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/faturacao/series/:id — só fecha (não apaga)
router.delete('/series/:id', async (req, res) => {
  try {
    const serie = await prisma.serie.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        userId: true,
        seriesCode: true,
        seriesYear: true,
        documentType: true,
        estabelecimentoId: true,
      },
    });
    if (!serie || serie.userId !== req.user.effectiveUserId) return res.status(404).json({ error: 'Série não encontrada' });
    const facturaCount = await prisma.factura.count({ where: { serieId: req.params.id } });
    if (facturaCount > 0) return res.status(400).json({ error: 'Série com facturas não pode ser eliminada — feche-a em vez disso' });
    await prisma.serie.delete({ where: { id: req.params.id } });
    await logSerieDeletedActivity(serie, req);
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
      select: {
        id: true,
        nome: true,
        nif: true,
        defaultSerieId: true,
        morada: true,
        telefone: true,
        email: true,
        isPrincipal: true,
        createdAt: true,
        defaultSerie: {
          select: {
            id: true,
            seriesCode: true,
            seriesYear: true,
            documentType: true,
          },
        },
      },
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
    if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });

    const { plan, workspaceMode } = await getPlanContext(req.user.effectiveUserId);

    let resolvedNif = (nif || '').trim();
    if (workspaceMode === 'comercio') {
      const totalEstabelecimentos = await prisma.estabelecimento.count({
        where: { userId: req.user.effectiveUserId },
      });
      if (totalEstabelecimentos >= 1 && !isPlanAtLeast(plan, 'enterprise')) {
        return res.status(403).json({
          error: 'Multi-estabelecimento no comércio está disponível no plano Estabilidade.',
        });
      }

      const config = await prisma.configuracaoFaturacao.findUnique({
        where: { userId: req.user.effectiveUserId },
        select: { nifEmpresa: true },
      });
      resolvedNif = config?.nifEmpresa?.trim() || '';
      if (!resolvedNif) {
        return res.status(400).json({ error: 'Configure primeiro o NIF da empresa na Configuração Fiscal.' });
      }
    } else if (!resolvedNif) {
      return res.status(400).json({ error: 'Nome e NIF obrigatórios' });
    }

    const userId = req.user.effectiveUserId;
    const now = new Date();
    const seriesYear = now.getFullYear();

    const { estab, defaultSerie } = await prisma.$transaction(async (tx) => {
      const createdEstab = await tx.estabelecimento.create({
        data: {
          userId,
          nome,
          nif: resolvedNif,
          morada,
          telefone,
          email,
          isPrincipal: isPrincipal ?? false,
        },
      });

      const seriesCode = await generateUniqueSeriesCode(tx, userId, {
        nome,
        morada,
        documentType: 'FT',
        year: seriesYear,
      });

      const createdSerie = await tx.serie.create({
        data: {
          userId,
          estabelecimentoId: createdEstab.id,
          seriesCode,
          seriesYear,
          documentType: 'FT',
          firstDocumentNumber: 1,
          seriesStatus: 'A',
        },
      });

      const updatedEstab = await tx.estabelecimento.update({
        where: { id: createdEstab.id },
        data: { defaultSerieId: createdSerie.id },
        select: {
          id: true,
          nome: true,
          nif: true,
          defaultSerieId: true,
          morada: true,
          telefone: true,
          email: true,
          isPrincipal: true,
          createdAt: true,
        },
      });

      const existingConfig = await tx.configuracaoFaturacao.findUnique({
        where: { userId },
        select: { id: true, defaultSerieId: true, defaultEstabelecimentoId: true },
      });

      const shouldPromoteToGlobalDefault =
        (isPrincipal ?? false) ||
        !existingConfig?.defaultSerieId ||
        !existingConfig?.defaultEstabelecimentoId;

      if (shouldPromoteToGlobalDefault) {
        await tx.configuracaoFaturacao.upsert({
          where: { userId },
          create: {
            userId,
            defaultSerieId: createdSerie.id,
            defaultEstabelecimentoId: createdEstab.id,
          },
          update: {
            defaultSerieId: createdSerie.id,
            defaultEstabelecimentoId: createdEstab.id,
          },
        });
      }

      return { estab: updatedEstab, defaultSerie: createdSerie };
    });

    await logStoreCreatedActivity(estab, req);
    await logSerieCreatedActivity(defaultSerie, req);

    res.status(201).json({ ...estab, defaultSerie });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
