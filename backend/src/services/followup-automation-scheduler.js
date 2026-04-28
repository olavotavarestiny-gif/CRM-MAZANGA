const prisma = require('../lib/prisma');
const automationRunner = require('./automationRunner');

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

function daysBetween(from, to = new Date()) {
  if (!from) return null;
  return Math.floor((startOfDay(to).getTime() - startOfDay(new Date(from)).getTime()) / DAY_MS);
}

async function alreadyRanToday(automationId, contactId, todayStart, todayEnd) {
  const existingLog = await prisma.automationLog.findFirst({
    where: {
      automation_id: automationId,
      contact_id: contactId || null,
      success: true,
      created_at: {
        gte: todayStart,
        lt: todayEnd,
      },
    },
    select: { id: true },
  });

  if (existingLog) return true;

  const existingTask = await prisma.task.findFirst({
    where: {
      automationId,
      contactId: contactId || null,
      source: 'automation',
      createdAt: {
        gte: todayStart,
        lt: todayEnd,
      },
    },
    select: { id: true },
  });

  if (existingTask) return true;

  const existingAlert = await prisma.automationAlert.findFirst({
    where: {
      automationId,
      contactId: contactId || null,
      createdAt: {
        gte: todayStart,
        lt: todayEnd,
      },
    },
    select: { id: true },
  });

  return !!existingAlert;
}

async function runForContact(automation, contact, context, todayStart, todayEnd) {
  if (await alreadyRanToday(automation.id, contact.id, todayStart, todayEnd)) {
    return false;
  }

  await automationRunner.run(automation.trigger, contact, automation.triggerValue, context);
  return true;
}

async function processInactivityAutomations(todayStart, todayEnd) {
  const automations = await prisma.automation.findMany({
    where: { active: true, trigger: 'contact_inactivity' },
  });

  let executions = 0;

  for (const automation of automations) {
    const inactivityDays = parseInt(automation.triggerValue || '7', 10);
    const threshold = new Date(Date.now() - inactivityDays * DAY_MS);
    const contacts = await prisma.contact.findMany({
      where: {
        userId: automation.userId,
        status: 'ativo',
        inPipeline: true,
        stage: { notIn: ['Fechado', 'Perdido'] },
        OR: [
          { lastActivityAt: { lte: threshold } },
          { lastActivityAt: null, updatedAt: { lte: threshold } },
        ],
      },
      take: 500,
    });

    for (const contact of contacts) {
      const actualDays = daysBetween(contact.lastActivityAt || contact.updatedAt) || inactivityDays;
      const ran = await runForContact(
        automation,
        { ...contact, inactivityDays: actualDays },
        { userId: automation.userId, inactivityDays: actualDays },
        todayStart,
        todayEnd
      );
      if (ran) executions += 1;
    }
  }

  return executions;
}

async function processBirthdayAutomations(todayStart, todayEnd) {
  const automations = await prisma.automation.findMany({
    where: { active: true, trigger: 'contact_birthday' },
  });

  const today = new Date();
  const month = today.getMonth();
  const date = today.getDate();
  let executions = 0;

  for (const automation of automations) {
    const contacts = await prisma.contact.findMany({
      where: {
        userId: automation.userId,
        status: 'ativo',
        birthDate: { not: null },
      },
      take: 1000,
    });

    for (const contact of contacts) {
      const birthDate = new Date(contact.birthDate);
      if (birthDate.getMonth() !== month || birthDate.getDate() !== date) {
        continue;
      }

      const ran = await runForContact(
        automation,
        contact,
        { userId: automation.userId },
        todayStart,
        todayEnd
      );
      if (ran) executions += 1;
    }
  }

  return executions;
}

async function processFollowUpAutomations() {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const [inactivityExecutions, birthdayExecutions] = await Promise.all([
    processInactivityAutomations(todayStart, todayEnd),
    processBirthdayAutomations(todayStart, todayEnd),
  ]);

  return {
    inactivityExecutions,
    birthdayExecutions,
    totalExecutions: inactivityExecutions + birthdayExecutions,
  };
}

module.exports = {
  processFollowUpAutomations,
};
