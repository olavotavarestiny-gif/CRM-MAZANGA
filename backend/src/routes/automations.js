const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requirePermission, requireDeletePermission } = require('../lib/permissions');
const { canCreateAutomation, buildLimitErrorPayload } = require('../lib/plan-limits');
const { isValidStageName } = require('../lib/pipeline-stages');

const VALID_TRIGGERS = ['new_contact', 'form_submission', 'contact_tag', 'contact_revenue', 'contact_sector'];
const VALID_ACTIONS = ['send_email', 'send_whatsapp_template', 'send_whatsapp_text', 'update_stage', 'create_task'];
const VALID_TASK_PRIORITIES = ['Baixa', 'Media', 'Alta'];

async function validateFormOwnership(userId, formId) {
  if (!formId) {
    return null;
  }

  return prisma.form.findFirst({
    where: { id: formId, userId },
    select: { id: true },
  });
}

async function validateOrgMember(userId, assignedToUserId) {
  if (assignedToUserId === undefined || assignedToUserId === null || assignedToUserId === '') {
    return null;
  }

  const numericAssignedToUserId = parseInt(assignedToUserId, 10);
  if (!Number.isInteger(numericAssignedToUserId)) {
    return false;
  }

  const member = await prisma.user.findFirst({
    where: {
      id: numericAssignedToUserId,
      active: true,
      OR: [{ id: userId }, { accountOwnerId: userId }],
    },
    select: { id: true },
  });

  return member ? numericAssignedToUserId : false;
}

async function validateAutomationPayload({
  userId,
  trigger,
  triggerValue,
  action,
  targetStage,
  templateName,
  emailSubject,
  emailBody,
  formId,
  taskTitle,
  taskNotes,
  taskPriority,
  taskDueDays,
  taskAssignedToUserId,
}) {
  if (!trigger || !action) {
    return 'trigger and action are required';
  }

  if (!VALID_TRIGGERS.includes(trigger)) {
    return `Invalid trigger. Must be one of: ${VALID_TRIGGERS.join(', ')}`;
  }

  if (!VALID_ACTIONS.includes(action)) {
    return `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`;
  }

  if (['contact_tag', 'contact_revenue', 'contact_sector'].includes(trigger) && !triggerValue) {
    return 'triggerValue is required for tag, revenue, and sector triggers';
  }

  if (trigger === 'form_submission' && formId) {
    const form = await validateFormOwnership(userId, formId);
    if (!form) {
      return 'Form not found';
    }
  }

  if (trigger !== 'form_submission' && formId) {
    return 'formId is only supported for form_submission trigger';
  }

  if (action === 'update_stage') {
    if (!targetStage) {
      return 'targetStage is required for update_stage action';
    }

    const stageIsValid = await isValidStageName(userId, targetStage);
    if (!stageIsValid) {
      return 'targetStage is invalid for this account';
    }
  }

  if (['send_whatsapp_template', 'send_whatsapp_text'].includes(action) && !templateName) {
    return 'templateName is required for WhatsApp actions';
  }

  if (action === 'send_email' && (!emailSubject || !emailBody)) {
    return 'emailSubject and emailBody are required for send_email action';
  }

  if (action === 'create_task') {
    if (!taskTitle || !String(taskTitle).trim()) {
      return 'taskTitle is required for create_task action';
    }

    const validAssignee = await validateOrgMember(userId, taskAssignedToUserId);
    if (!validAssignee) {
      return 'taskAssignedToUserId is invalid for this account';
    }

    if (taskPriority && !VALID_TASK_PRIORITIES.includes(taskPriority)) {
      return `taskPriority must be one of: ${VALID_TASK_PRIORITIES.join(', ')}`;
    }

    if (taskDueDays !== undefined && taskDueDays !== null && taskDueDays !== '') {
      const numericTaskDueDays = parseInt(taskDueDays, 10);
      if (!Number.isInteger(numericTaskDueDays) || numericTaskDueDays < 0) {
        return 'taskDueDays must be a non-negative integer';
      }
    }
  }

  return null;
}

// GET all automations
router.get('/', requirePermission('automations', 'view'), async (req, res) => {
  try {
    const automations = await prisma.automation.findMany({
      where: { userId: req.user.effectiveUserId },
      include: {
        form: {
          select: { id: true, title: true },
        },
      },
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
      formId,
      taskTitle,
      taskNotes,
      taskPriority,
      taskDueDays,
      taskAssignedToUserId,
    } = req.body;

    const validationError = await validateAutomationPayload({
      userId: req.user.effectiveUserId,
      trigger,
      triggerValue,
      action,
      targetStage,
      templateName,
      emailSubject,
      emailBody,
      formId,
      taskTitle,
      taskNotes,
      taskPriority,
      taskDueDays,
      taskAssignedToUserId,
    });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const limitState = await canCreateAutomation(req.user.effectiveUserId);
    if (!limitState.allowed) {
      return res.status(403).json(buildLimitErrorPayload(limitState));
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
    if (trigger === 'form_submission') data.formId = formId || null;
    if (taskTitle !== undefined) data.taskTitle = taskTitle?.trim() || null;
    if (taskNotes !== undefined) data.taskNotes = taskNotes?.trim() || null;
    if (taskPriority !== undefined) data.taskPriority = taskPriority || null;
    if (taskDueDays !== undefined && taskDueDays !== null && taskDueDays !== '') {
      data.taskDueDays = parseInt(taskDueDays, 10);
    } else if (taskDueDays !== undefined) {
      data.taskDueDays = null;
    }
    if (taskAssignedToUserId !== undefined) {
      data.taskAssignedToUserId = taskAssignedToUserId ? parseInt(taskAssignedToUserId, 10) : null;
    }

    const automation = await prisma.automation.create({
      data,
      include: {
        form: {
          select: { id: true, title: true },
        },
      },
    });

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
      select: {
        userId: true,
        trigger: true,
        triggerValue: true,
        action: true,
        targetStage: true,
        templateName: true,
        emailSubject: true,
        emailBody: true,
        formId: true,
        taskTitle: true,
        taskNotes: true,
        taskPriority: true,
        taskDueDays: true,
        taskAssignedToUserId: true,
      },
    });
    if (!automation || automation.userId !== req.user.effectiveUserId) {
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
      formId,
      taskTitle,
      taskNotes,
      taskPriority,
      taskDueDays,
      taskAssignedToUserId,
    } = req.body;

    const nextTrigger = trigger ?? automation.trigger;
    const nextAction = action ?? automation.action;
    const nextTriggerValue = triggerValue !== undefined ? triggerValue : automation.triggerValue;
    const nextTargetStage = targetStage !== undefined ? targetStage : automation.targetStage;
    const nextTemplateName = templateName !== undefined ? templateName : automation.templateName;
    const nextEmailSubject = emailSubject !== undefined ? emailSubject : automation.emailSubject;
    const nextEmailBody = emailBody !== undefined ? emailBody : automation.emailBody;
    const nextFormId = formId !== undefined ? formId : automation.formId;
    const nextTaskTitle = taskTitle !== undefined ? taskTitle : automation.taskTitle;
    const nextTaskNotes = taskNotes !== undefined ? taskNotes : automation.taskNotes;
    const nextTaskPriority = taskPriority !== undefined ? taskPriority : automation.taskPriority;
    const nextTaskDueDays = taskDueDays !== undefined ? taskDueDays : automation.taskDueDays;
    const nextTaskAssignedToUserId = taskAssignedToUserId !== undefined ? taskAssignedToUserId : automation.taskAssignedToUserId;

    const validationError = await validateAutomationPayload({
      userId: req.user.effectiveUserId,
      trigger: nextTrigger,
      triggerValue: nextTriggerValue,
      action: nextAction,
      targetStage: nextTargetStage,
      templateName: nextTemplateName,
      emailSubject: nextEmailSubject,
      emailBody: nextEmailBody,
      formId: nextFormId,
      taskTitle: nextTaskTitle,
      taskNotes: nextTaskNotes,
      taskPriority: nextTaskPriority,
      taskDueDays: nextTaskDueDays,
      taskAssignedToUserId: nextTaskAssignedToUserId,
    });
    if (validationError) {
      return res.status(400).json({ error: validationError });
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
    if (formId !== undefined) updateData.formId = formId || null;
    if (taskTitle !== undefined) updateData.taskTitle = taskTitle?.trim() || null;
    if (taskNotes !== undefined) updateData.taskNotes = taskNotes?.trim() || null;
    if (taskPriority !== undefined) updateData.taskPriority = taskPriority || null;
    if (taskDueDays !== undefined) {
      updateData.taskDueDays = taskDueDays === null || taskDueDays === '' ? null : parseInt(taskDueDays, 10);
    }
    if (taskAssignedToUserId !== undefined) {
      updateData.taskAssignedToUserId = taskAssignedToUserId ? parseInt(taskAssignedToUserId, 10) : null;
    }

    const updatedAutomation = await prisma.automation.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        form: {
          select: { id: true, title: true },
        },
      },
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
