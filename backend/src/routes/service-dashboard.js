const express = require('express');
const router = express.Router();
const {
  getServicesDashboardBase,
  getServicesDashboardSettings,
  updateServicesDashboardSettings,
} = require('../services/dashboard/services-dashboard.service');
const { logRouteError, logRouteWarning } = require('../lib/request-log');

router.get('/servicos/base', async (req, res) => {
  const startedAt = Date.now();
  try {
    const payload = await getServicesDashboardBase({
      user: req.user,
      query: req.query,
    });
    const durationMs = Date.now() - startedAt;

    if (durationMs > 3000 || payload?.diagnostics?.contactSampleLimited) {
      logRouteWarning('[services-dashboard.base] slow or limited response', req, {
        status: 200,
        message: payload?.diagnostics?.contactSampleLimited
          ? 'Dashboard carregado com amostra limitada de contactos'
          : 'Dashboard demorou a responder',
        code: payload?.diagnostics?.contactSampleLimited ? 'CONTACT_SAMPLE_LIMITED' : 'SLOW_QUERY',
        durationMs,
      });
    }

    res.json(payload);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      logRouteError('[services-dashboard.base] error', req, error, statusCode);
    }
    res.status(statusCode).json({ error: error.message });
  }
});

router.get('/servicos/settings', async (req, res) => {
  try {
    const payload = await getServicesDashboardSettings({ user: req.user });
    res.json(payload);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      logRouteError('[services-dashboard.settings] error', req, error, statusCode);
    }
    res.status(statusCode).json({ error: error.message });
  }
});

router.patch('/servicos/settings', async (req, res) => {
  try {
    const payload = await updateServicesDashboardSettings({
      user: req.user,
      data: req.body,
    });
    res.json(payload);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      logRouteError('[services-dashboard.settings.update] error', req, error, statusCode);
    }
    res.status(statusCode).json({ error: error.message });
  }
});

module.exports = router;
