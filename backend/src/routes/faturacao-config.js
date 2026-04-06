const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

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
    const config = await prisma.configuracaoFaturacao.upsert({
      where: { userId: req.user.effectiveUserId },
      create: {
        userId: req.user.effectiveUserId,
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
