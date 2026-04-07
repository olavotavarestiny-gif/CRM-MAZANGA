const express = require('express');
const router = express.Router();
const { requirePermission } = require('../lib/permissions');
const {
  getServicesAdvancedOverview,
  getServicesAdvancedPipeline,
  getServicesAdvancedRevenue,
  getServicesAdvancedTeam,
} = require('../services/reports/services-advanced-reports.service');
const {
  getCommercialAdvancedOverview,
  getCommercialAdvancedSales,
  getCommercialAdvancedProducts,
  getCommercialAdvancedLocations,
  getCommercialAdvancedTeam,
} = require('../services/reports/commercial-advanced-reports.service');

router.use(requirePermission('finances', 'view_reports'));

function buildFilters(req) {
  return {
    organizationId: req.user.effectiveUserId,
    period: req.query.period,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    estabelecimentoId: req.query.estabelecimentoId ? String(req.query.estabelecimentoId) : undefined,
    userId: req.query.userId ? String(req.query.userId) : undefined,
  };
}

async function handleReport(res, callback) {
  try {
    const payload = await callback();
    res.json(payload);
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    if (statusCode >= 500) {
      console.error('Advanced reports error:', error);
    }
    res.status(statusCode).json({ error: error.message || 'Erro ao carregar relatório avançado.' });
  }
}

router.get('/servicos/advanced/overview', async (req, res) => {
  await handleReport(res, () => getServicesAdvancedOverview(buildFilters(req)));
});

router.get('/servicos/advanced/pipeline', async (req, res) => {
  await handleReport(res, () => getServicesAdvancedPipeline(buildFilters(req)));
});

router.get('/servicos/advanced/revenue', async (req, res) => {
  await handleReport(res, () => getServicesAdvancedRevenue(buildFilters(req)));
});

router.get('/servicos/advanced/team', async (req, res) => {
  await handleReport(res, () => getServicesAdvancedTeam(buildFilters(req)));
});

router.get('/comercio/advanced/overview', async (req, res) => {
  await handleReport(res, () => getCommercialAdvancedOverview(buildFilters(req)));
});

router.get('/comercio/advanced/sales', async (req, res) => {
  await handleReport(res, () => getCommercialAdvancedSales(buildFilters(req)));
});

router.get('/comercio/advanced/products', async (req, res) => {
  await handleReport(res, () => getCommercialAdvancedProducts(buildFilters(req)));
});

router.get('/comercio/advanced/locations', async (req, res) => {
  await handleReport(res, () => getCommercialAdvancedLocations(buildFilters(req)));
});

router.get('/comercio/advanced/team', async (req, res) => {
  await handleReport(res, () => getCommercialAdvancedTeam(buildFilters(req)));
});

module.exports = router;
