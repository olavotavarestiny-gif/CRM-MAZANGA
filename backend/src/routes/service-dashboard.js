const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { canPerform } = require('../lib/permissions');
const { getPipelineStages } = require('../lib/pipeline-stages');

const DAY_MS = 24 * 60 * 60 * 1000;
const WON_STAGE = 'Fechado';
const LOST_STAGE = 'Perdido';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function getRange(period) {
  const now = new Date();
  const end = now;
  if (period === '7d') return { start: new Date(now.getTime() - 7 * DAY_MS), end, period };
  if (period === '30d') return { start: new Date(now.getTime() - 30 * DAY_MS), end, period };
  if (period === '90d') return { start: new Date(now.getTime() - 90 * DAY_MS), end, period };
  return { start: startOfMonth(now), end, period: 'month' };
}

function toNumber(value) {
  return Number(value || 0);
}

function round(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
}

function daysSince(date) {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS));
}

function canView(req, module, action = 'view') {
  if (req.user?.isSuperAdmin || req.user?.isAccountOwner || req.user?.role === 'admin') return true;
  return canPerform(req.user.permissionsJson, module, action);
}

function contactValue(contact, averageDealValue = 0) {
  if (Number(contact.dealValueKz || 0) > 0) return Number(contact.dealValueKz);
  return averageDealValue;
}

async function assertServicesWorkspace(userId) {
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { workspaceMode: true },
  });
  if (owner?.workspaceMode === 'comercio') {
    const error = new Error('Dashboard de serviços indisponível neste workspace');
    error.statusCode = 404;
    throw error;
  }
}

async function buildRevenueKpis(userId, range) {
  const [revenueAgg, avgAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        userId,
        type: 'entrada',
        status: 'pago',
        deleted: false,
        date: { gte: range.start, lte: range.end },
      },
      _sum: { amountKz: true },
      _count: { id: true },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        type: 'entrada',
        status: 'pago',
        deleted: false,
        amountKz: { gt: 0 },
      },
      _avg: { amountKz: true },
    }),
  ]);

  return {
    closedRevenue: toNumber(revenueAgg._sum.amountKz),
    paidRevenueCount: revenueAgg._count.id || 0,
    averagePaidTicket: toNumber(avgAgg._avg.amountKz),
  };
}

async function buildPipelineKpis(userId, range, revenue) {
  const [contacts, wonLogs, lostLogs] = await Promise.all([
    prisma.contact.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        company: true,
        phone: true,
        stage: true,
        inPipeline: true,
        dealValueKz: true,
        createdAt: true,
        updatedAt: true,
        lastActivityAt: true,
      },
    }),
    prisma.activityLog.findMany({
      where: {
        organization_id: userId,
        entity_type: 'contact',
        action: 'stage_changed',
        field_changed: 'stage',
        new_value: WON_STAGE,
        created_at: { gte: range.start, lte: range.end },
      },
      select: { entity_id: true, created_at: true },
    }),
    prisma.activityLog.findMany({
      where: {
        organization_id: userId,
        entity_type: 'contact',
        action: 'stage_changed',
        field_changed: 'stage',
        new_value: LOST_STAGE,
        created_at: { gte: range.start, lte: range.end },
      },
      select: { entity_id: true },
    }),
  ]);

  const openContacts = contacts.filter((contact) =>
    contact.inPipeline && ![WON_STAGE, LOST_STAGE].includes(contact.stage)
  );
  const wonCount = wonLogs.length;
  const lostCount = lostLogs.length;
  const winRate = wonCount + lostCount > 0 ? wonCount / (wonCount + lostCount) : 0;
  const averageWonDealValue = contacts
    .filter((contact) => contact.stage === WON_STAGE && Number(contact.dealValueKz || 0) > 0)
    .reduce((acc, contact, _, arr) => acc + Number(contact.dealValueKz || 0) / arr.length, 0);
  const averageDealValue = averageWonDealValue || revenue.averagePaidTicket || 0;
  const pipelineOpenValue = openContacts.reduce((sum, contact) => sum + contactValue(contact, averageDealValue), 0);

  const contactsById = new Map(contacts.map((contact) => [String(contact.id), contact]));
  const closeDurations = wonLogs
    .map((log) => {
      const contact = contactsById.get(String(log.entity_id));
      if (!contact) return null;
      return (new Date(log.created_at).getTime() - new Date(contact.createdAt).getTime()) / DAY_MS;
    })
    .filter((value) => value !== null && value >= 0);
  const averageSalesCycleDays = closeDurations.length
    ? closeDurations.reduce((sum, value) => sum + value, 0) / closeDurations.length
    : 30;
  const pipelineVelocity = averageSalesCycleDays > 0
    ? (openContacts.length * averageDealValue * winRate) / averageSalesCycleDays
    : 0;

  return {
    contacts,
    openContacts,
    kpis: {
      pipelineOpenValue: round(pipelineOpenValue, 2),
      winRate: round(winRate * 100, 1),
      averageDealValue: round(averageDealValue, 2),
      averageSalesCycleDays: round(averageSalesCycleDays, 1),
      pipelineVelocity: round(pipelineVelocity, 2),
      openOpportunities: openContacts.length,
      wonCount,
      lostCount,
    },
  };
}

async function buildPipelineHealth(userId, pipelineData) {
  const [stages, stageLogs, pendingTasks] = await Promise.all([
    getPipelineStages(userId),
    prisma.activityLog.findMany({
      where: {
        organization_id: userId,
        entity_type: 'contact',
        action: 'stage_changed',
        field_changed: 'stage',
      },
      orderBy: { created_at: 'desc' },
      select: { entity_id: true, new_value: true, created_at: true },
    }),
    prisma.task.findMany({
      where: {
        userId,
        done: false,
        contactId: { not: null },
        OR: [{ dueDate: null }, { dueDate: { gte: startOfDay(new Date()) } }],
      },
      select: { contactId: true },
    }),
  ]);

  const latestStageLogByContact = new Map();
  for (const log of stageLogs) {
    if (!latestStageLogByContact.has(log.entity_id)) {
      latestStageLogByContact.set(log.entity_id, log);
    }
  }

  const stageOrder = new Map(stages.map((stage, index) => [stage.name, index]));
  const totalContacts = pipelineData.contacts.length;
  const wonContacts = pipelineData.contacts.filter((contact) => contact.stage === WON_STAGE).length;
  const pendingTaskContactIds = new Set(pendingTasks.map((task) => task.contactId).filter(Boolean));

  const byStage = stages.map((stage, index) => {
    const contactsInStage = pipelineData.openContacts.filter((contact) => contact.stage === stage.name);
    const ages = contactsInStage.map((contact) => {
      const log = latestStageLogByContact.get(String(contact.id));
      return daysSince(log?.created_at || contact.updatedAt) || 0;
    });
    const averageDays = ages.length ? ages.reduce((sum, value) => sum + value, 0) / ages.length : 0;
    const reachedCount = pipelineData.contacts.filter((contact) => {
      const currentIndex = stageOrder.get(contact.stage);
      if (stage.name === WON_STAGE) return contact.stage === WON_STAGE;
      if (stage.name === LOST_STAGE) return contact.stage === LOST_STAGE;
      return currentIndex !== undefined && currentIndex >= index;
    }).length;

    return {
      stage: stage.name,
      color: stage.color,
      count: contactsInStage.length,
      averageDaysInStage: round(averageDays, 1),
      conversionRate: totalContacts > 0 ? round((reachedCount / totalContacts) * 100, 1) : null,
      winRateFromStage: reachedCount > 0 ? round((wonContacts / reachedCount) * 100, 1) : null,
    };
  });

  const slowestStage = byStage
    .filter((stage) => ![WON_STAGE, LOST_STAGE].includes(stage.stage))
    .sort((a, b) => (b.averageDaysInStage || 0) - (a.averageDaysInStage || 0))[0] || null;

  const staleDeals = pipelineData.openContacts
    .map((contact) => {
      const log = latestStageLogByContact.get(String(contact.id));
      const daysInStage = daysSince(log?.created_at || contact.updatedAt) || 0;
      return {
        id: contact.id,
        name: contact.name,
        company: contact.company,
        stage: contact.stage,
        daysInStage,
        lastActivityDays: daysSince(contact.lastActivityAt || contact.updatedAt),
      };
    })
    .filter((contact) => contact.daysInStage >= 14)
    .sort((a, b) => b.daysInStage - a.daysInStage)
    .slice(0, 10);

  const leadsWithoutFollowUp = pipelineData.openContacts
    .filter((contact) => !pendingTaskContactIds.has(contact.id))
    .slice(0, 10)
    .map((contact) => ({
      id: contact.id,
      name: contact.name,
      company: contact.company,
      stage: contact.stage,
      lastActivityDays: daysSince(contact.lastActivityAt || contact.updatedAt),
    }));

  return {
    byStage,
    slowestStage,
    staleDeals,
    leadsWithoutFollowUp,
  };
}

async function buildNextActions(userId, req) {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const where = { userId, done: false };
  if (!(req.user?.isSuperAdmin || req.user?.isAccountOwner || req.user?.role === 'admin')) {
    where.assignedToUserId = req.user.id;
  }

  const [tasks, birthdays, alerts] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...where,
        dueDate: { lt: tomorrow },
      },
      include: { contact: { select: { id: true, name: true, company: true } } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 25,
    }),
    prisma.contact.findMany({
      where: { userId, status: 'ativo', birthDate: { not: null } },
      select: { id: true, name: true, company: true, birthDate: true },
      take: 1000,
    }),
    prisma.automationAlert.findMany({
      where: { userId, status: 'open' },
      include: { contact: { select: { id: true, name: true, company: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  return {
    overdueTasks: tasks.filter((task) => task.dueDate && task.dueDate < today),
    followUpsToday: tasks.filter((task) => task.dueDate && task.dueDate >= today && task.dueDate < tomorrow),
    birthdaysToday: birthdays.filter((contact) => {
      const birthDate = new Date(contact.birthDate);
      return birthDate.getMonth() === todayMonth && birthDate.getDate() === todayDate;
    }),
    alerts,
  };
}

router.get('/servicos/base', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    await assertServicesWorkspace(userId);
    const range = getRange(req.query.period);

    const canSeePipeline = canView(req, 'pipeline');
    const canSeeTasks = canView(req, 'tasks');
    const canSeeFinance = canView(req, 'finances', 'transactions_view');

    const revenue = canSeeFinance
      ? await buildRevenueKpis(userId, range)
      : { closedRevenue: null, paidRevenueCount: 0, averagePaidTicket: 0 };
    const pipelineData = canSeePipeline
      ? await buildPipelineKpis(userId, range, revenue)
      : null;

    const [pipelineHealth, nextActions] = await Promise.all([
      pipelineData ? buildPipelineHealth(userId, pipelineData) : Promise.resolve(null),
      canSeeTasks ? buildNextActions(userId, req) : Promise.resolve(null),
    ]);

    res.json({
      range: {
        period: range.period,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      },
      permissions: {
        revenue: canSeeFinance,
        pipeline: canSeePipeline,
        tasks: canSeeTasks,
      },
      kpis: {
        closedRevenue: revenue.closedRevenue,
        ...(pipelineData?.kpis || {
          pipelineOpenValue: null,
          winRate: null,
          averageDealValue: null,
          averageSalesCycleDays: null,
          pipelineVelocity: null,
          openOpportunities: null,
          wonCount: null,
          lostCount: null,
        }),
      },
      pipelineHealth,
      nextActions,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      console.error('Error fetching services dashboard:', error);
    }
    res.status(statusCode).json({ error: error.message });
  }
});

module.exports = router;
