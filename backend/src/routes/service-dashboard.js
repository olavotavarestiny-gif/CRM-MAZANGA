const express = require('express');
const router = express.Router();
const { getServicesDashboardBase } = require('../services/dashboard/services-dashboard.service');

router.get('/servicos/base', async (req, res) => {
  try {
    const payload = await getServicesDashboardBase({
      user: req.user,
      query: req.query,
    });
    res.json(payload);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      console.error('Error fetching services dashboard:', error);
    }
    res.status(statusCode).json({ error: error.message });
  }
});

module.exports = router;
