const prisma = require('../lib/prisma');
const whatsapp = require('../lib/whatsapp');
const email = require('../lib/email');

// Replace variables in template
function interpolate(template, contact) {
  if (!template) return '';
  return template
    .replace(/\{\{nome\}\}/g, contact.name || '')
    .replace(/\{\{empresa\}\}/g, contact.company || '')
    .replace(/\{\{telefone\}\}/g, contact.phone || '')
    .replace(/\{\{email\}\}/g, contact.email || '');
}

async function run(trigger, contact, triggerValue = null) {
  try {
    const automations = await prisma.automation.findMany({
      where: { active: true },
    });

    console.log(`Running automations for trigger: ${trigger}, triggerValue: ${triggerValue}`);

    // Filter automations that match this trigger
    const matchingAutomations = automations.filter((auto) => {
      if (auto.trigger === trigger) {
        // For triggers with specific values, check if it matches
        if (['contact_tag', 'contact_revenue', 'contact_sector'].includes(trigger)) {
          // Check if the automation's triggerValue matches the contact's value
          if (trigger === 'contact_tag') {
            try {
              const tags = contact.tags ? JSON.parse(contact.tags) : [];
              const matches = tags.includes(auto.triggerValue);
              console.log(`Tag check: tags=${JSON.stringify(tags)}, looking for=${auto.triggerValue}, matches=${matches}`);
              return matches;
            } catch (e) {
              console.error('Error parsing tags:', e);
              return false;
            }
          }
          if (trigger === 'contact_revenue') {
            const matches = contact.revenue === auto.triggerValue;
            console.log(`Revenue check: contact.revenue=${contact.revenue}, looking for=${auto.triggerValue}, matches=${matches}`);
            return matches;
          }
          if (trigger === 'contact_sector') {
            const matches = contact.sector === auto.triggerValue;
            console.log(`Sector check: contact.sector=${contact.sector}, looking for=${auto.triggerValue}, matches=${matches}`);
            return matches;
          }
        }
        return true; // new_contact and form_submission always match
      }
      return false;
    });

    console.log(`Found ${matchingAutomations.length} matching automations`);

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
          // Save email to message history
          await prisma.message.create({
            data: {
              contactId: contact.id,
              direction: 'outbound',
              text: body,
              channel: 'email',
              subject: subject,
            },
          });
          console.log(`Automation executed: ${automation.trigger} -> ${automation.action}`);
        } catch (error) {
          console.error('Error executing automation:', error.message);
        }
      }

      if (automation.action === 'update_stage' && automation.targetStage) {
        try {
          await prisma.contact.update({
            where: { id: contact.id },
            data: { stage: automation.targetStage },
          });
          console.log(`Automation executed: ${automation.trigger} -> update_stage to ${automation.targetStage}`);
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
