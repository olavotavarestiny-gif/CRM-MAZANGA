const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requirePermission } = require('../lib/permissions');
const { getPipelineStages } = require('../lib/pipeline-stages');

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PERIODS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const WON_STAGE = 'Fechado';
const LOST_STAGE = 'Perdido';

function hasPrivilegedAccess(user) {
  return !!(user?.isSuperAdmin || user?.role === 'admin' || user?.isAccountOwner);
}

function parseOrganizationId(req) {
  const organizationId = Number.parseInt(String(req.query.organization_id || ''), 10);

  if (!Number.isInteger(organizationId)) {
    throw new Error('organization_id é obrigatório');
  }

  if (organizationId !== req.user.effectiveUserId) {
    const error = new Error('organization_id inválido para esta sessão');
    error.statusCode = 403;
    throw error;
  }

  return organizationId;
}

function parsePeriod(periodValue) {
  return PERIODS[periodValue] ? periodValue : '30d';
}

function getPeriodWindow(period) {
  const days = PERIODS[period] || PERIODS['30d'];
  const now = new Date();
  const start = new Date(now.getTime() - days * DAY_IN_MS);
  const previousStart = new Date(start.getTime() - days * DAY_IN_MS);

  return {
    period,
    days,
    now,
    start,
    previousStart,
    previousEnd: start,
  };
}

async function assertServicosWorkspace(organizationId) {
  const owner = await prisma.user.findUnique({
    where: { id: organizationId },
    select: { id: true, workspaceMode: true },
  });

  if (!owner) {
    const error = new Error('Organização não encontrada');
    error.statusCode = 404;
    throw error;
  }

  if (owner.workspaceMode === 'comercio') {
    const error = new Error('Analytics do pipeline só estão disponíveis para organizações de serviços');
    error.statusCode = 403;
    throw error;
  }

  return owner;
}

function normalizeLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function estimateContactValue(revenue) {
  const label = normalizeLabel(revenue);

  if (!label) return 0;
  if (label.includes('50') && label.includes('100')) return 75_000_000;
  if (label.includes('100') && label.includes('500')) return 300_000_000;
  if (label.includes('+ 500') || label.includes('500 m')) return 600_000_000;
  if (label.includes('- 50') || label.includes('50m de kz') || label.includes('50 milhoes')) return 25_000_000;

  return 0;
}

function getContactStageIndex(contact, stageIndexMap) {
  if (contact.stage === LOST_STAGE) {
    return stageIndexMap[LOST_STAGE] ?? Number.MAX_SAFE_INTEGER;
  }

  return stageIndexMap[contact.stage] ?? -1;
}

function reachedStage(contact, stageName, stageIndex, stageIndexMap) {
  if (stageName === WON_STAGE) {
    return contact.stage === WON_STAGE;
  }

  if (stageName === LOST_STAGE) {
    return contact.stage === LOST_STAGE;
  }

  const currentIndex = getContactStageIndex(contact, stageIndexMap);
  if (currentIndex < 0) {
    return false;
  }

  return currentIndex >= stageIndex;
}

function calculateRate(part, total) {
  if (!total) return null;
  return Number(((part / total) * 100).toFixed(1));
}

function roundDays(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  return Number(value.toFixed(1));
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function serialiseRange(window) {
  return {
    period: window.period,
    start: window.start.toISOString(),
    end: window.now.toISOString(),
    previousStart: window.previousStart.toISOString(),
    previousEnd: window.previousEnd.toISOString(),
  };
}

async function loadStageContext(organizationId) {
  const stages = await getPipelineStages(organizationId);
  const stageIndexMap = Object.fromEntries(stages.map((stage, index) => [stage.name, index]));

  return {
    stages,
    stageIndexMap,
    funnelStages: stages.filter((stage) => stage.name !== LOST_STAGE),
  };
}

async function loadContactsForAnalytics(organizationId) {
  return prisma.contact.findMany({
    where: { userId: organizationId },
    select: {
      id: true,
      name: true,
      stage: true,
      inPipeline: true,
      revenue: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

function buildConversionResponse(contacts, stages, stageIndexMap, range) {
  const cohort = contacts.filter((contact) => contact.createdAt >= range.start);
  const totalContacts = cohort.length;
  const closedContacts = cohort.filter((contact) => contact.stage === WON_STAGE).length;

  return {
    range: serialiseRange(range),
    totalContacts,
    closedContacts,
    totalConversionRate: calculateRate(closedContacts, totalContacts),
    byStage: stages.map((stage, index) => {
      const currentCount = cohort.filter((contact) => contact.stage === stage.name).length;
      const reachedCount = cohort.filter((contact) =>
        reachedStage(contact, stage.name, index, stageIndexMap)
      ).length;

      return {
        stage: stage.name,
        color: stage.color,
        currentCount,
        reachedCount,
        advancementRate: calculateRate(reachedCount, totalContacts),
        stageConversionRate: stage.name === LOST_STAGE
          ? 0
          : stage.name === WON_STAGE
          ? calculateRate(closedContacts, totalContacts)
          : calculateRate(closedContacts, reachedCount),
      };
    }),
  };
}

function buildVelocityResponse(contacts, stages, range) {
  const byStage = stages.map((stage) => {
    const currentValues = contacts
      .filter((contact) => contact.stage === stage.name && contact.updatedAt >= range.start)
      .map((contact) => (range.now.getTime() - new Date(contact.updatedAt).getTime()) / DAY_IN_MS);

    const previousValues = contacts
      .filter((contact) => contact.stage === stage.name && contact.updatedAt >= range.previousStart && contact.updatedAt < range.previousEnd)
      .map((contact) => (range.previousEnd.getTime() - new Date(contact.updatedAt).getTime()) / DAY_IN_MS);

    const currentAverage = average(currentValues);
    const previousAverage = average(previousValues);

    return {
      stage: stage.name,
      color: stage.color,
      contactCount: currentValues.length,
      currentDays: roundDays(currentAverage),
      previousDays: roundDays(previousAverage),
      deltaDays: currentAverage !== null && previousAverage !== null
        ? roundDays(currentAverage - previousAverage)
        : null,
    };
  });

  const validCurrent = byStage.map((item) => item.currentDays).filter((value) => value !== null);
  const validPrevious = byStage.map((item) => item.previousDays).filter((value) => value !== null);

  return {
    range: serialiseRange(range),
    averageCurrentDays: roundDays(average(validCurrent)),
    averagePreviousDays: roundDays(average(validPrevious)),
    byStage,
  };
}

function buildHistoricalWinRates(contacts, stages, stageIndexMap) {
  const totalClosedContacts = contacts.filter((contact) => contact.stage === WON_STAGE).length;

  return {
    totalClosedContacts,
    byStage: Object.fromEntries(
      stages.map((stage, index) => {
        if (stage.name === LOST_STAGE) {
          return [stage.name, 0];
        }

        if (stage.name === WON_STAGE) {
          return [stage.name, 100];
        }

        const reachedCount = contacts.filter((contact) =>
          reachedStage(contact, stage.name, index, stageIndexMap)
        ).length;

        return [stage.name, calculateRate(totalClosedContacts, reachedCount) || 0];
      })
    ),
  };
}

function buildForecastResponse(contacts, funnelStages, historicalWinRates) {
  const openContacts = contacts.filter(
    (contact) => contact.inPipeline && ![WON_STAGE, LOST_STAGE].includes(contact.stage)
  );

  const stageForecasts = funnelStages
    .filter((stage) => ![WON_STAGE, LOST_STAGE].includes(stage.name))
    .map((stage) => {
      const stageContacts = openContacts.filter((contact) => contact.stage === stage.name);
      const currentValue = stageContacts.reduce((sum, contact) => sum + estimateContactValue(contact.revenue), 0);
      const conversionRate = historicalWinRates.byStage[stage.name] || 0;
      const weightedValue = currentValue * (conversionRate / 100);

      return {
        stage: stage.name,
        color: stage.color,
        contacts: stageContacts.length,
        currentValue,
        historicalConversionRate: conversionRate,
        weightedForecastValue: Number(weightedValue.toFixed(2)),
      };
    });

  const currentValue = stageForecasts.reduce((sum, item) => sum + item.currentValue, 0);
  const forecastValue = stageForecasts.reduce((sum, item) => sum + item.weightedForecastValue, 0);

  return {
    currentValue,
    forecastValue: Number(forecastValue.toFixed(2)),
    totalClosedContacts: historicalWinRates.totalClosedContacts,
    low_confidence: historicalWinRates.totalClosedContacts < 10,
    stageForecasts,
  };
}

async function buildTeamAnalytics(organizationId) {
  const [members, contacts, tasks] = await Promise.all([
    prisma.user.findMany({
      where: {
        active: true,
        OR: [
          { id: organizationId },
          { accountOwnerId: organizationId },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: [{ accountOwnerId: 'asc' }, { name: 'asc' }],
    }),
    prisma.contact.findMany({
      where: { userId: organizationId },
      select: {
        id: true,
        stage: true,
        inPipeline: true,
      },
    }),
    prisma.task.findMany({
      where: {
        userId: organizationId,
        contactId: { not: null },
        assignedToUserId: { not: null },
      },
      select: {
        contactId: true,
        assignedToUserId: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const latestResponsibleByContact = new Map();
  for (const task of tasks) {
    if (!task.contactId || !task.assignedToUserId || latestResponsibleByContact.has(task.contactId)) {
      continue;
    }

    latestResponsibleByContact.set(task.contactId, task.assignedToUserId);
  }

  const owner = members.find((member) => member.id === organizationId) || members[0] || null;
  const membersById = new Map(members.map((member) => [member.id, member]));
  const emptyMetrics = {
    activeContacts: 0,
    closedContacts: 0,
    totalContacts: 0,
  };
  const metricsByMember = new Map(members.map((member) => [member.id, { ...emptyMetrics }]));

  for (const contact of contacts) {
    const responsibleId = latestResponsibleByContact.get(contact.id) || owner?.id;
    if (!responsibleId || !metricsByMember.has(responsibleId)) {
      continue;
    }

    const metrics = metricsByMember.get(responsibleId);
    metrics.totalContacts += 1;

    if (contact.stage === WON_STAGE) {
      metrics.closedContacts += 1;
    } else if (contact.inPipeline && ![WON_STAGE, LOST_STAGE].includes(contact.stage)) {
      metrics.activeContacts += 1;
    }
  }

  return {
    members: members.map((member) => {
      const metrics = metricsByMember.get(member.id) || emptyMetrics;
      const showConversionRate = metrics.closedContacts >= 5;

      return {
        userId: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        activeContacts: metrics.activeContacts,
        closedContacts: metrics.closedContacts,
        totalContacts: metrics.totalContacts,
        showConversionRate,
        conversionRate: showConversionRate
          ? calculateRate(metrics.closedContacts, metrics.totalContacts)
          : null,
      };
    }),
  };
}

async function loadAnalyticsContext(req) {
  const organizationId = parseOrganizationId(req);
  const period = parsePeriod(req.query.period);
  const range = getPeriodWindow(period);

  await assertServicosWorkspace(organizationId);

  return { organizationId, period, range };
}

router.get('/conversion', requirePermission('pipeline', 'view'), async (req, res) => {
  try {
    const { organizationId, range } = await loadAnalyticsContext(req);
    const [{ stages, stageIndexMap }, contacts] = await Promise.all([
      loadStageContext(organizationId),
      loadContactsForAnalytics(organizationId),
    ]);

    res.json(buildConversionResponse(contacts, stages, stageIndexMap, range));
  } catch (error) {
    const statusCode = error.statusCode || (error.message?.includes('organization_id') ? 400 : 500);
    if (statusCode >= 500) {
      console.error('Error fetching pipeline conversion analytics:', error);
    }
    res.status(statusCode).json({ error: error.message });
  }
});

router.get('/velocity', requirePermission('pipeline', 'view'), async (req, res) => {
  try {
    const { organizationId, range } = await loadAnalyticsContext(req);
    const [{ stages }, contacts] = await Promise.all([
      loadStageContext(organizationId),
      loadContactsForAnalytics(organizationId),
    ]);

    res.json(buildVelocityResponse(contacts, stages, range));
  } catch (error) {
    const statusCode = error.statusCode || (error.message?.includes('organization_id') ? 400 : 500);
    if (statusCode >= 500) {
      console.error('Error fetching pipeline velocity analytics:', error);
    }
    res.status(statusCode).json({ error: error.message });
  }
});

router.get('/forecast', requirePermission('pipeline', 'view'), async (req, res) => {
  try {
    const { organizationId } = await loadAnalyticsContext(req);
    const [{ funnelStages, stages, stageIndexMap }, contacts] = await Promise.all([
      loadStageContext(organizationId),
      loadContactsForAnalytics(organizationId),
    ]);

    const historicalWinRates = buildHistoricalWinRates(contacts, stages, stageIndexMap);
    res.json(buildForecastResponse(contacts, funnelStages, historicalWinRates));
  } catch (error) {
    const statusCode = error.statusCode || (error.message?.includes('organization_id') ? 400 : 500);
    if (statusCode >= 500) {
      console.error('Error fetching pipeline forecast analytics:', error);
    }
    res.status(statusCode).json({ error: error.message });
  }
});

router.get('/team', requirePermission('pipeline', 'view'), async (req, res) => {
  try {
    if (!hasPrivilegedAccess(req.user)) {
      return res.status(403).json({ error: 'Acesso restrito ao owner ou administrador' });
    }

    const { organizationId } = await loadAnalyticsContext(req);
    res.json(await buildTeamAnalytics(organizationId));
  } catch (error) {
    const statusCode = error.statusCode || (error.message?.includes('organization_id') ? 400 : 500);
    if (statusCode >= 500) {
      console.error('Error fetching pipeline team analytics:', error);
    }
    res.status(statusCode).json({ error: error.message });
  }
});

module.exports = router;
