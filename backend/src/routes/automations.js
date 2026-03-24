const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requirePermission, requireDeletePermission } = require('../lib/permissions');

const VALID_TRIGGERS = ['new_contact', 'form_submission', 'contact_tag', 'contact_revenue', 'contact_sector'];
const VALID_ACTIONS = ['send_email', 'send_whatsapp_template', 'send_whatsapp_text', 'update_stage'];

// GET all automations
router.get('/', requirePermission('automations', 'view'), async (req, res) => {
  try {
    const automations = await prisma.automation.findMany({
      where: { userId: req.user.effectiveUserId },
    });
    res.json(automations);
  } catch (error) {
    console.error('Error fetching automations:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create automation
router.post('/', requirePermission('automations', 'edit'), async (req, res) => {
  try {
    const {
      trigger,
      triggerValue,
      action,
      targetStage,
      templateName,
      emailSubject,
      emailBody,
    } = req.body;

    if (!trigger || !action) {
      return res.status(400).json({ error: 'trigger and action are required' });
    }

    if (!VALID_TRIGGERS.includes(trigger)) {
      return res.status(400).json({ error: `Invalid trigger. Must be one of: ${VALID_TRIGGERS.join(', ')}` });
    }

    if (!VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` });
    }

    // Validate trigger value for conditional triggers
    if (
      ['contact_tag', 'contact_revenue', 'contact_sector'].includes(trigger) &&
      !triggerValue
    ) {
      return res
        .status(400)
        .json({
          error: 'triggerValue is required for tag, revenue, and sector triggers',
        });
    }

    // Validate action-specific fields
    if (action === 'update_stage' && !targetStage) {
      return res
        .status(400)
        .json({ error: 'targetStage is required for update_stage action' });
    }

    if (
      ['send_whatsapp_template', 'send_whatsapp_text'].includes(action) &&
      !templateName
    ) {
      return res
        .status(400)
        .json({ error: 'templateName is required for WhatsApp actions' });
    }

    if (action === 'send_email' && (!emailSubject || !emailBody)) {
      return res
        .status(400)
        .json({
          error: 'emailSubject and emailBody are required for send_email action',
        });
    }

    const data = {
      userId: req.user.effectiveUserId,
      trigger,
      action,
    };

    if (triggerValue) data.triggerValue = triggerValue;
    if (targetStage) data.targetStage = targetStage;
    if (templateName) data.templateName = templateName;
    if (emailSubject) data.emailSubject = emailSubject;
    if (emailBody) data.emailBody = emailBody;

    const automation = await prisma.automation.create({ data });

    res.status(201).json(automation);
  } catch (error) {
    console.error('Error creating automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update automation
router.put('/:id', requirePermission('automations', 'edit'), async (req, res) => {
  try {
    const automation = await prisma.automation.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!automation || automation.userId !== req.user.id) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    const {
      active,
      trigger,
      triggerValue,
      action,
      targetStage,
      templateName,
      emailSubject,
      emailBody,
    } = req.body;

    if (trigger !== undefined && !VALID_TRIGGERS.includes(trigger)) {
      return res.status(400).json({ error: `Invalid trigger. Must be one of: ${VALID_TRIGGERS.join(', ')}` });
    }

    if (action !== undefined && !VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` });
    }

    const updateData = {};

    if (active !== undefined) updateData.active = active;
    if (trigger !== undefined) updateData.trigger = trigger;
    if (triggerValue !== undefined) updateData.triggerValue = triggerValue;
    if (action !== undefined) updateData.action = action;
    if (targetStage !== undefined) updateData.targetStage = targetStage;
    if (templateName !== undefined) updateData.templateName = templateName;
    if (emailSubject !== undefined) updateData.emailSubject = emailSubject;
    if (emailBody !== undefined) updateData.emailBody = emailBody;

    const updatedAutomation = await prisma.automation.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(updatedAutomation);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Automation not found' });
    }
    console.error('Error updating automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE automation
router.delete('/:id', requireDeletePermission, async (req, res) => {
  try {
    const automation = await prisma.automation.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!automation || automation.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    await prisma.automation.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Automation deleted' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Automation not found' });
    }
    console.error('Error deleting automation:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
