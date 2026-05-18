const express = require('express');
const router = express.Router();
const whatsapp = require('../lib/whatsapp');
const { requirePermission } = require('../lib/permissions');

// GET templates WhatsApp aprovados
router.get('/templates', requirePermission('contacts', 'edit'), async (req, res) => {
  try {
    const templates = await whatsapp.getTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
