const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { logFieldChangesActivity } = require('../lib/activity-log');

// GET /api/faturacao/config
router.get('/config', async (req, res) => {
  try {
    let config = await prisma.configuracaoFaturacao.findUnique({
      where: { userId: req.user.effectiveUserId },
    });
    if (!config) {
      config = await prisma.configuracaoFaturacao.create({
        data: { userId: req.user.effectiveUserId },
      });
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: "Erro de servidor. Tente novamente." });
  }
});

// PUT /api/faturacao/config
router.put('/config', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const {
      nifEmpresa,
      nomeEmpresa,
      moradaEmpresa,
      telefoneEmpresa,
      emailEmpresa,
      websiteEmpresa,
      iban,
      logoUrl,
      agtMockMode,
      agtCertNumber,
      defaultSerieId,
      defaultEstabelecimentoId,
    } = req.body;
    const existing = await prisma.configuracaoFaturacao.findUnique({
      where: { userId },
    });
    const config = await prisma.configuracaoFaturacao.upsert({
      where: { userId },
      create: {
        userId,
        nifEmpresa,
        nomeEmpresa,
        moradaEmpresa,
        telefoneEmpresa,
        emailEmpresa,
        websiteEmpresa,
        iban,
        logoUrl,
        agtMockMode,
        agtCertNumber,
        defaultSerieId,
        defaultEstabelecimentoId,
      },
      update: {
        ...(nifEmpresa !== undefined && { nifEmpresa }),
        ...(nomeEmpresa !== undefined && { nomeEmpresa }),
        ...(moradaEmpresa !== undefined && { moradaEmpresa }),
        ...(telefoneEmpresa !== undefined && { telefoneEmpresa }),
        ...(emailEmpresa !== undefined && { emailEmpresa }),
        ...(websiteEmpresa !== undefined && { websiteEmpresa }),
        ...(iban !== undefined && { iban }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(agtMockMode !== undefined && { agtMockMode }),
        ...(agtCertNumber !== undefined && { agtCertNumber }),
        ...(defaultSerieId !== undefined && { defaultSerieId }),
        ...(defaultEstabelecimentoId !== undefined && { defaultEstabelecimentoId }),
      },
    });

    const serieIds = [existing?.defaultSerieId, config.defaultSerieId].filter(Boolean);
    const estabelecimentoIds = [existing?.defaultEstabelecimentoId, config.defaultEstabelecimentoId].filter(Boolean);
    const [series, estabelecimentos] = await Promise.all([
      serieIds.length
        ? prisma.serie.findMany({
            where: { id: { in: serieIds } },
            select: { id: true, seriesCode: true, seriesYear: true },
          })
        : Promise.resolve([]),
      estabelecimentoIds.length
        ? prisma.estabelecimento.findMany({
            where: { id: { in: estabelecimentoIds } },
            select: { id: true, nome: true },
          })
        : Promise.resolve([]),
    ]);

    const seriesMap = new Map(series.map((serie) => [serie.id, `${serie.seriesCode}/${serie.seriesYear}`]));
    const estabelecimentosMap = new Map(estabelecimentos.map((estabelecimento) => [estabelecimento.id, estabelecimento.nome]));

    await logFieldChangesActivity({
      organizationId: userId,
      actor: req,
      entityType: 'billing_config',
      entityId: config.id,
      entityLabel: 'Configuração fiscal',
      changes: [
        {
          fieldChanged: 'nifEmpresa',
          oldValue: existing?.nifEmpresa || 'Sem NIF',
          newValue: config.nifEmpresa || 'Sem NIF',
        },
        {
          fieldChanged: 'nomeEmpresa',
          oldValue: existing?.nomeEmpresa || 'Sem nome',
          newValue: config.nomeEmpresa || 'Sem nome',
        },
        {
          fieldChanged: 'moradaEmpresa',
          oldValue: existing?.moradaEmpresa || 'Sem morada',
          newValue: config.moradaEmpresa || 'Sem morada',
        },
        {
          fieldChanged: 'telefoneEmpresa',
          oldValue: existing?.telefoneEmpresa || 'Sem telefone',
          newValue: config.telefoneEmpresa || 'Sem telefone',
        },
        {
          fieldChanged: 'emailEmpresa',
          oldValue: existing?.emailEmpresa || 'Sem email',
          newValue: config.emailEmpresa || 'Sem email',
        },
        {
          fieldChanged: 'websiteEmpresa',
          oldValue: existing?.websiteEmpresa || 'Sem website',
          newValue: config.websiteEmpresa || 'Sem website',
        },
        {
          fieldChanged: 'iban',
          oldValue: existing?.iban || 'Sem IBAN',
          newValue: config.iban || 'Sem IBAN',
        },
        {
          fieldChanged: 'logoUrl',
          oldValue: existing?.logoUrl || 'Sem logótipo',
          newValue: config.logoUrl || 'Sem logótipo',
        },
        {
          fieldChanged: 'agtMockMode',
          oldValue: existing?.agtMockMode ?? false,
          newValue: config.agtMockMode,
        },
        {
          fieldChanged: 'agtCertNumber',
          oldValue: existing?.agtCertNumber || 'Sem certificado',
          newValue: config.agtCertNumber || 'Sem certificado',
        },
        {
          fieldChanged: 'defaultSerieId',
          oldValue: seriesMap.get(existing?.defaultSerieId) || 'Sem série padrão',
          newValue: seriesMap.get(config.defaultSerieId) || 'Sem série padrão',
        },
        {
          fieldChanged: 'defaultEstabelecimentoId',
          oldValue: estabelecimentosMap.get(existing?.defaultEstabelecimentoId) || 'Sem ponto de venda padrão',
          newValue: estabelecimentosMap.get(config.defaultEstabelecimentoId) || 'Sem ponto de venda padrão',
        },
      ],
    });

    res.json(config);
  } catch (err) {
    res.status(500).json({ error: "Erro de servidor. Tente novamente." });
  }
});

// GET /api/faturacao/config/status
router.get('/config/status', async (req, res) => {
  try {
    const config = await prisma.configuracaoFaturacao.findUnique({
      where: { userId: req.user.effectiveUserId },
    });
    const pendingCount = config ? await prisma.factura.count({
      where: { userId: req.user.effectiveUserId, isOffline: true, offlineSubmittedAt: null },
    }) : 0;
    res.json({
      contingencyMode: config?.contingencyMode ?? false,
      agtMockMode: config?.agtMockMode ?? true,
      pendingCount,
    });
  } catch (err) {
    res.status(500).json({ error: "Erro de servidor. Tente novamente." });
  }
});

module.exports = router;
