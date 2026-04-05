const prisma = require('../lib/prisma');

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

function clampPageSize(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(parsed, MAX_PAGE_SIZE);
}

function clampPage(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 1;
  }

  return parsed;
}

function parseDate(value, fieldName) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Data inválida para ${fieldName}`);
  }

  return parsed;
}

function buildCreatedAtFilter(dateRange = {}) {
  const from = parseDate(dateRange.dateFrom || dateRange.from, 'dateFrom');
  const to = parseDate(dateRange.dateTo || dateRange.to, 'dateTo');

  if (!from && !to) {
    return undefined;
  }

  const createdAt = {};
  if (from) {
    createdAt.gte = from;
  }
  if (to) {
    createdAt.lte = to;
  }

  return createdAt;
}

function buildLogWhere({ automationId, organizationId, filters = {} }) {
  const where = {
    organization_id: organizationId,
  };

  if (automationId) {
    where.automation_id = automationId;
  }

  const createdAt = buildCreatedAtFilter(filters);
  if (createdAt) {
    where.created_at = createdAt;
  }

  if (filters.status === 'success') {
    where.success = true;
  }

  if (filters.status === 'failed') {
    where.success = false;
  }

  return where;
}

function calculateSuccessRate(successCount, totalCount) {
  if (!totalCount) {
    return null;
  }

  return Number(((successCount / totalCount) * 100).toFixed(1));
}

function buildDateRangeResponse(dateRange = {}) {
  return {
    from: dateRange.dateFrom || dateRange.from || null,
    to: dateRange.dateTo || dateRange.to || null,
  };
}

async function logExecution(data) {
  return prisma.automationLog.create({
    data: {
      automation_id: data.automation_id,
      organization_id: data.organization_id,
      trigger_type: data.trigger_type,
      trigger_data: data.trigger_data ?? {},
      action_type: data.action_type,
      action_data: data.action_data ?? {},
      success: Boolean(data.success),
      error_message: data.error_message || null,
      contact_id: data.contact_id ?? null,
      duration_ms: data.duration_ms ?? null,
    },
  });
}

async function getAutomationLogs(automationId, organizationId, filters = {}) {
  const page = clampPage(filters.page);
  const pageSize = clampPageSize(filters.pageSize);
  const where = buildLogWhere({ automationId, organizationId, filters });

  const [total, logs] = await Promise.all([
    prisma.automationLog.count({ where }),
    prisma.automationLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        automation: {
          select: {
            id: true,
            trigger: true,
            triggerValue: true,
            action: true,
            targetStage: true,
            templateName: true,
            emailSubject: true,
            taskTitle: true,
            active: true,
            form: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: true,
          },
        },
      },
    }),
  ]);

  return {
    data: logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    filters: {
      status: filters.status || 'all',
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
    },
  };
}

async function getAutomationExecutionSummary(organizationId, options = {}) {
  const automationIds = Array.isArray(options.automationIds) && options.automationIds.length > 0
    ? options.automationIds
    : undefined;
  const successWindowStart = new Date(Date.now() - (options.successWindowDays || 30) * 24 * 60 * 60 * 1000);
  const logWhere = {
    organization_id: organizationId,
  };

  if (automationIds) {
    logWhere.automation_id = { in: automationIds };
  }

  const logs = await prisma.automationLog.findMany({
    where: logWhere,
    orderBy: { created_at: 'desc' },
    select: {
      automation_id: true,
      success: true,
      error_message: true,
      duration_ms: true,
      created_at: true,
    },
  });

  const summary = new Map();

  for (const log of logs) {
    if (!summary.has(log.automation_id)) {
      summary.set(log.automation_id, {
        automationId: log.automation_id,
        totalExecutions: 0,
        executionsLast30Days: 0,
        successfulExecutionsLast30Days: 0,
        failedExecutionsLast30Days: 0,
        successRateLast30Days: null,
        lastExecution: null,
      });
    }

    const current = summary.get(log.automation_id);
    current.totalExecutions += 1;

    if (!current.lastExecution) {
      current.lastExecution = {
        success: log.success,
        error_message: log.error_message,
        duration_ms: log.duration_ms,
        created_at: log.created_at,
      };
    }

    if (log.created_at >= successWindowStart) {
      current.executionsLast30Days += 1;
      if (log.success) {
        current.successfulExecutionsLast30Days += 1;
      } else {
        current.failedExecutionsLast30Days += 1;
      }
    }
  }

  for (const entry of summary.values()) {
    entry.successRateLast30Days = calculateSuccessRate(
      entry.successfulExecutionsLast30Days,
      entry.executionsLast30Days
    );
  }

  return summary;
}

async function getAutomationStats(organizationId, dateRange = {}) {
  const createdAt = buildCreatedAtFilter(dateRange);
  const baseWhere = {
    organization_id: organizationId,
  };

  if (createdAt) {
    baseWhere.created_at = createdAt;
  }

  const [automations, logs, recentExecutions] = await Promise.all([
    prisma.automation.findMany({
      where: { userId: organizationId },
      select: {
        id: true,
        trigger: true,
        triggerValue: true,
        action: true,
        targetStage: true,
        templateName: true,
        emailSubject: true,
        taskTitle: true,
        active: true,
        form: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    }),
    prisma.automationLog.findMany({
      where: baseWhere,
      orderBy: { created_at: 'desc' },
      include: {
        automation: {
          select: {
            id: true,
            trigger: true,
            triggerValue: true,
            action: true,
            targetStage: true,
            templateName: true,
            emailSubject: true,
            taskTitle: true,
            active: true,
            form: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    }),
    prisma.automationLog.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      take: 10,
      include: {
        automation: {
          select: {
            id: true,
            trigger: true,
            triggerValue: true,
            action: true,
            targetStage: true,
            templateName: true,
            emailSubject: true,
            taskTitle: true,
            active: true,
          },
        },
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: true,
          },
        },
      },
    }),
  ]);

  const perAutomation = new Map(
    automations.map((automation) => [
      automation.id,
      {
        automation_id: automation.id,
        automation,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: null,
        lastExecution: null,
      },
    ])
  );

  let successfulExecutions = 0;
  let failedExecutions = 0;

  for (const log of logs) {
    if (!perAutomation.has(log.automation_id)) {
      perAutomation.set(log.automation_id, {
        automation_id: log.automation_id,
        automation: log.automation,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: null,
        lastExecution: null,
      });
    }

    const current = perAutomation.get(log.automation_id);
    current.totalExecutions += 1;

    if (log.success) {
      current.successfulExecutions += 1;
      successfulExecutions += 1;
    } else {
      current.failedExecutions += 1;
      failedExecutions += 1;
    }

    if (!current.lastExecution) {
      current.lastExecution = {
        id: log.id,
        success: log.success,
        error_message: log.error_message,
        duration_ms: log.duration_ms,
        created_at: log.created_at,
      };
    }
  }

  const perAutomationList = Array.from(perAutomation.values()).map((entry) => ({
    ...entry,
    successRate: calculateSuccessRate(entry.successfulExecutions, entry.totalExecutions),
  }));

  const totalExecutions = successfulExecutions + failedExecutions;

  return {
    dateRange: buildDateRangeResponse(dateRange),
    totalAutomations: automations.length,
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    successRate: calculateSuccessRate(successfulExecutions, totalExecutions),
    neverExecutedCount: perAutomationList.filter((entry) => entry.totalExecutions === 0).length,
    perAutomation: perAutomationList,
    mostFailingAutomations: perAutomationList
      .filter((entry) => entry.failedExecutions > 0)
      .sort((left, right) => {
        if (right.failedExecutions !== left.failedExecutions) {
          return right.failedExecutions - left.failedExecutions;
        }
        return right.totalExecutions - left.totalExecutions;
      })
      .slice(0, 5),
    recentExecutions,
  };
}

module.exports = {
  THIRTY_DAYS_IN_MS,
  logExecution,
  getAutomationLogs,
  getAutomationStats,
  getAutomationExecutionSummary,
};
