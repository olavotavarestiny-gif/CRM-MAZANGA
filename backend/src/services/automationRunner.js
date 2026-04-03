const prisma = require('../lib/prisma');
const whatsapp = require('../lib/whatsapp');
const email = require('../lib/email');
const { resolveStageName } = require('../lib/pipeline-stages');

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

    console.log(`Running automations for trigger: ${trigger}, triggerValue: ${triggerValue}, matches: ${matchingAutomations.length}`);

    for (const automation of matchingAutomations) {
      if (automation.action === 'send_whatsapp_template') {
        try {
          await whatsapp.sendTemplate(contact.phone, automation.templateName);
          await prisma.message.create({
            data: {
              contactId: contact.id,
              direction: 'outbound',
              text: `[Template: ${automation.templateName}]`,
            },
          });
          console.log(`Automation executed: ${automation.trigger} -> ${automation.action}`);
        } catch (error) {
          console.error('Error executing automation:', error.message);
        }
      }

      if (automation.action === 'send_whatsapp_text') {
        try {
          const text = interpolate(automation.templateName, contact);
          await whatsapp.sendTextMessage(contact.phone, text);
          await prisma.message.create({
            data: {
              contactId: contact.id,
              direction: 'outbound',
              text,
            },
          });
          console.log(`Automation executed: ${automation.trigger} -> ${automation.action}`);
        } catch (error) {
          console.error('Error executing automation:', error.message);
        }
      }

      if (automation.action === 'send_email' && contact.email) {
        try {
          const subject = interpolate(automation.emailSubject, contact);
          const body = interpolate(automation.emailBody, contact);
          await email.sendEmail({ to: contact.email, subject, body });
          await prisma.message.create({
            data: {
              contactId: contact.id,
              direction: 'outbound',
              text: body,
              channel: 'email',
              subject,
            },
          });
          console.log(`Automation executed: ${automation.trigger} -> ${automation.action}`);
        } catch (error) {
          console.error('Error executing automation:', error.message);
        }
      }

      if (automation.action === 'update_stage' && automation.targetStage) {
        if (!contact.id) {
          continue;
        }

        try {
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
        } catch (error) {
          console.error('Error executing automation:', error.message);
        }
      }

      if (automation.action === 'create_task' && automation.taskTitle && automation.taskAssignedToUserId) {
        try {
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
        } catch (error) {
          console.error('Error executing automation:', error.message);
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
