const prisma = require('../lib/prisma');
const whatsapp = require('../lib/whatsapp');
const email = require('../lib/email');
const { resolveStageName } = require('../lib/pipeline-stages');
const { logExecution } = require('./automation-logger.service');

function interpolate(template, contact) {
  if (!template) return '';

  return template
    .replace(/\{\{nome\}\}/g, contact.name || '')
    .replace(/\{\{empresa\}\}/g, contact.company || '')
    .replace(/\{\{telefone\}\}/g, contact.phone || '')
    .replace(/\{\{email\}\}/g, contact.email || '')
    .replace(/\{\{formulario\}\}/g, contact.formTitle || '');
}

function normaliseRunArgs(triggerValueOrContext, maybeContext) {
  if (
    triggerValueOrContext &&
    typeof triggerValueOrContext === 'object' &&
    !Array.isArray(triggerValueOrContext)
  ) {
    return {
      triggerValue: null,
      context: triggerValueOrContext,
    };
  }

  return {
    triggerValue: triggerValueOrContext ?? null,
    context: maybeContext || {},
  };
}

function matchesConditionalTrigger(trigger, automation, contact) {
  if (trigger === 'contact_tag') {
    try {
      const tags = contact.tags ? JSON.parse(contact.tags) : [];
      return tags.includes(automation.triggerValue);
    } catch (error) {
      console.error('Error parsing tags:', error);
      return false;
    }
  }

  if (trigger === 'contact_revenue') {
    return contact.revenue === automation.triggerValue;
  }

  if (trigger === 'contact_sector') {
    return contact.sector === automation.triggerValue;
  }

  return true;
}

function matchesAutomation(trigger, automation, contact, context) {
  if (automation.trigger !== trigger) {
    return false;
  }

  if (['contact_tag', 'contact_revenue', 'contact_sector'].includes(trigger)) {
    return matchesConditionalTrigger(trigger, automation, contact);
  }

  if (trigger === 'form_submission' && automation.formId && automation.formId !== context.formId) {
    return false;
  }

  return true;
}

function resolveOrganizationId(automation, contact, context) {
  const organizationId = automation.userId || contact.userId || context.userId || null;
  return Number.isInteger(organizationId) ? organizationId : null;
}

function buildTriggerData(trigger, triggerValue, context, contact) {
  return {
    trigger,
    triggerValue,
    formId: context.formId || null,
    formTitle: contact.formTitle || null,
    contact: {
      id: contact.id || null,
      name: contact.name || null,
      email: contact.email || null,
      phone: contact.phone || null,
      stage: contact.stage || null,
    },
  };
}

function buildActionData(automation, contact) {
  return {
    targetStage: automation.targetStage || null,
    templateName: automation.templateName || null,
    emailSubject: automation.emailSubject || null,
    taskTitle: automation.taskTitle || null,
    taskPriority: automation.taskPriority || null,
    taskDueDays: automation.taskDueDays ?? null,
    taskAssignedToUserId: automation.taskAssignedToUserId ?? null,
    contact: {
      id: contact.id || null,
      email: contact.email || null,
      phone: contact.phone || null,
    },
  };
}

async function safeLogExecution(data) {
  try {
    await logExecution(data);
  } catch (error) {
    console.error('Error logging automation execution:', error.message);
  }
}

async function executeAutomationAction(automation, contact, context) {
  if (automation.action === 'send_whatsapp_template') {
    if (!contact.phone) {
      throw new Error('Contacto sem telefone para envio de template WhatsApp');
    }

    await whatsapp.sendTemplate(contact.phone, automation.templateName);
    if (contact.id) {
      await prisma.message.create({
        data: {
          contactId: contact.id,
          direction: 'outbound',
          text: `[Template: ${automation.templateName}]`,
        },
      });
    }
    console.log(`Automation executed: ${automation.trigger} -> ${automation.action}`);
    return;
  }

  if (automation.action === 'send_whatsapp_text') {
    if (!contact.phone) {
      throw new Error('Contacto sem telefone para envio de mensagem WhatsApp');
    }

    const text = interpolate(automation.templateName, contact);
    await whatsapp.sendTextMessage(contact.phone, text);
    if (contact.id) {
      await prisma.message.create({
        data: {
          contactId: contact.id,
          direction: 'outbound',
          text,
        },
      });
    }
    console.log(`Automation executed: ${automation.trigger} -> ${automation.action}`);
    return;
  }

  if (automation.action === 'send_email') {
    if (!contact.email) {
      throw new Error('Contacto sem email para envio');
    }

    const subject = interpolate(automation.emailSubject, contact);
    const body = interpolate(automation.emailBody, contact);

    await email.sendEmail({ to: contact.email, subject, body });
    if (contact.id) {
      await prisma.message.create({
        data: {
          contactId: contact.id,
          direction: 'outbound',
          text: body,
          channel: 'email',
          subject,
        },
      });
    }
    console.log(`Automation executed: ${automation.trigger} -> ${automation.action}`);
    return;
  }

  if (automation.action === 'update_stage') {
    if (!contact.id) {
      throw new Error('Contacto sem identificador para actualizar etapa');
    }

    const resolvedStage = await resolveStageName(contact.userId || context.userId, automation.targetStage);
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        stage: resolvedStage,
        inPipeline: true,
      },
    });

    contact.stage = resolvedStage;
    contact.inPipeline = true;
    console.log(`Automation executed: ${automation.trigger} -> update_stage to ${resolvedStage}`);
    return;
  }

  if (automation.action === 'create_task') {
    const dueDate = automation.taskDueDays === null || automation.taskDueDays === undefined
      ? null
      : new Date(Date.now() + automation.taskDueDays * 24 * 60 * 60 * 1000);

    await prisma.task.create({
      data: {
        userId: contact.userId || context.userId || null,
        contactId: contact.id || null,
        assignedToUserId: automation.taskAssignedToUserId,
        title: interpolate(automation.taskTitle, contact),
        notes: automation.taskNotes ? interpolate(automation.taskNotes, contact) : null,
        dueDate,
        priority: automation.taskPriority || 'Media',
      },
    });

    console.log(`Automation executed: ${automation.trigger} -> create_task`);
    return;
  }

  throw new Error(`Ação de automação não suportada: ${automation.action}`);
}

async function run(trigger, contact, triggerValueOrContext = null, maybeContext = {}) {
  const { triggerValue, context } = normaliseRunArgs(triggerValueOrContext, maybeContext);

  try {
    const automations = await prisma.automation.findMany({
      where: {
        active: true,
        userId: contact.userId || context.userId || undefined,
      },
    });

    const matchingAutomations = automations.filter((automation) =>
      matchesAutomation(trigger, automation, contact, context)
    );

    console.log(
      `Running automations for trigger: ${trigger}, triggerValue: ${triggerValue}, matches: ${matchingAutomations.length}`
    );

    for (const automation of matchingAutomations) {
      const startedAt = Date.now();
      const organizationId = resolveOrganizationId(automation, contact, context);
      const baseLogData = organizationId
        ? {
            automation_id: automation.id,
            organization_id: organizationId,
            trigger_type: trigger,
            trigger_data: buildTriggerData(trigger, triggerValue, context, contact),
            action_type: automation.action,
            action_data: buildActionData(automation, contact),
            contact_id: contact.id || null,
          }
        : null;

      try {
        await executeAutomationAction(automation, contact, context);

        if (baseLogData) {
          await safeLogExecution({
            ...baseLogData,
            success: true,
            duration_ms: Date.now() - startedAt,
          });
        }
      } catch (error) {
        console.error('Error executing automation:', error.message);

        if (baseLogData) {
          await safeLogExecution({
            ...baseLogData,
            success: false,
            error_message: error.message,
            duration_ms: Date.now() - startedAt,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error running automations:', error.message);
  }
}

module.exports = {
  run,
};
