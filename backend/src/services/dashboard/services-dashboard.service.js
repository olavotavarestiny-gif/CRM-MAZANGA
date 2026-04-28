const prisma = require('../../lib/prisma');
const { canPerform } = require('../../lib/permissions');
const { getPipelineStages } = require('../../lib/pipeline-stages');

const DAY_MS = 24 * 60 * 60 * 1000;
const WON_STAGE = 'Fechado';
const LOST_STAGE = 'Perdido';

const PERIOD_OPTIONS = [
  { value: 'month', label: 'Este mês' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
];

const ORIGIN_FIELD_CANDIDATES = ['origem_do_lead', 'origem_lead', 'origem'];
const SEGMENT_FIELD_CANDIDATES = ['segmento'];

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

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function parseObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function canView(user, module, action = 'view') {
  if (user?.isSuperAdmin || user?.isAccountOwner || user?.role === 'admin') return true;
  return canPerform(user.permissionsJson, module, action);
}

function isPrivilegedUser(user) {
  return !!(user?.isSuperAdmin || user?.isAccountOwner || user?.role === 'admin');
}

function contactValue(contact, averageDealValue = 0) {
  if (Number(contact.dealValueKz || 0) > 0) return Number(contact.dealValueKz);
  return averageDealValue;
}

function uniqueOptions(values) {
  const seen = new Set();
  const options = [];
  for (const raw of values) {
    const value = String(raw || '').trim();
    if (!value) continue;
    const key = normalizeText(value);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ value, label: value });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, 'pt'));
}

function getCustomFieldValue(contact, fieldKey) {
  if (!fieldKey) return null;
  const customFields = parseObject(contact.customFields);
  const raw = customFields[fieldKey];
  if (Array.isArray(raw)) return raw.filter(Boolean).join(', ');
  return raw === undefined || raw === null ? null : String(raw);
}

function matchesCustomField(contact, fieldKey, expectedValue) {
  if (!expectedValue || !fieldKey) return true;
  const customFields = parseObject(contact.customFields);
  const raw = customFields[fieldKey];
  if (Array.isArray(raw)) {
    return raw.map(normalizeText).includes(normalizeText(expectedValue));
  }
  return normalizeText(raw) === normalizeText(expectedValue);
}

function findField(fields, candidates) {
  const candidateSet = new Set(candidates.map(normalizeText));
  return fields.find((field) =>
    candidateSet.has(normalizeText(field.key)) ||
    candidateSet.has(normalizeText(field.label))
  ) || null;
}

function buildContactWhere(userId, filters) {
  const where = { userId };
  if (filters.stage) {
    where.stage = filters.stage;
  }
  return where;
}

function filterContactsByCustomFields(contacts, customFields, filters) {
  return contacts.filter((contact) =>
    matchesCustomField(contact, customFields.leadOrigin?.key, filters.leadOrigin) &&
    matchesCustomField(contact, customFields.segment?.key, filters.segment)
  );
}

function sanitizeFilters(query = {}) {
  return {
    period: query.period,
    responsibleUserId: Number.parseInt(String(query.responsibleUserId || ''), 10) || null,
    stage: typeof query.stage === 'string' && query.stage !== 'all' ? query.stage : null,
    leadOrigin: typeof query.leadOrigin === 'string' && query.leadOrigin !== 'all' ? query.leadOrigin : null,
    segment: typeof query.segment === 'string' && query.segment !== 'all' ? query.segment : null,
  };
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

async function getOrganizationMembers(userId, currentUser) {
  const members = await prisma.user.findMany({
    where: {
      OR: [
        { id: userId },
        { accountOwnerId: userId },
      ],
    },
    select: { id: true, name: true, email: true },
    orderBy: [{ accountOwnerId: 'asc' }, { createdAt: 'asc' }],
  });

  if (isPrivilegedUser(currentUser)) return members;
  return members.filter((member) => member.id === currentUser.id);
}

async function getDashboardContext(userId, currentUser, filters) {
  const [stages, members, fieldDefs] = await Promise.all([
    getPipelineStages(userId),
    getOrganizationMembers(userId, currentUser),
    prisma.contactFieldDef.findMany({
      where: { userId, active: true },
      select: { key: true, label: true, type: true, options: true },
      orderBy: { order: 'asc' },
    }),
  ]);

  const leadOriginField = findField(fieldDefs, ORIGIN_FIELD_CANDIDATES);
  const segmentField = findField(fieldDefs, SEGMENT_FIELD_CANDIDATES);
  const contactWhere = buildContactWhere(userId, filters);

  const contacts = await prisma.contact.findMany({
    where: contactWhere,
    select: {
      id: true,
      name: true,
      company: true,
      phone: true,
      stage: true,
      inPipeline: true,
      dealValueKz: true,
      customFields: true,
      createdAt: true,
      updatedAt: true,
      lastActivityAt: true,
    },
  });

  const filteredContacts = filterContactsByCustomFields(contacts, {
    leadOrigin: leadOriginField,
    segment: segmentField,
  }, filters);
  const contactIds = filteredContacts.map((contact) => contact.id);

  return {
    stages,
    members,
    optionContacts: contacts,
    contacts: filteredContacts,
    contactIds,
    customFields: {
      leadOrigin: leadOriginField,
      segment: segmentField,
    },
  };
}

async function buildRevenueKpis(userId, range, contactIds, contactFiltersActive) {
  const contactScope = contactFiltersActive ? { clientId: { in: contactIds } } : {};
  const [revenueAgg, avgAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        userId,
        type: 'entrada',
        status: 'pago',
        deleted: false,
        date: { gte: range.start, lte: range.end },
        ...contactScope,
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
        ...contactScope,
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

async function buildPipelineKpis(userId, range, revenue, contacts) {
  const contactIdSet = new Set(contacts.map((contact) => String(contact.id)));
  const [wonLogs, lostLogs] = await Promise.all([
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

  const scopedWonLogs = wonLogs.filter((log) => contactIdSet.has(String(log.entity_id)));
  const scopedLostLogs = lostLogs.filter((log) => contactIdSet.has(String(log.entity_id)));
  const openContacts = contacts.filter((contact) =>
    contact.inPipeline && ![WON_STAGE, LOST_STAGE].includes(contact.stage)
  );
  const wonCount = scopedWonLogs.length;
  const lostCount = scopedLostLogs.length;
  const winRate = wonCount + lostCount > 0 ? wonCount / (wonCount + lostCount) : 0;
  const averageWonDealValue = contacts
    .filter((contact) => contact.stage === WON_STAGE && Number(contact.dealValueKz || 0) > 0)
    .reduce((acc, contact, _, arr) => acc + Number(contact.dealValueKz || 0) / arr.length, 0);
  const averageDealValue = averageWonDealValue || revenue.averagePaidTicket || 0;
  const pipelineOpenValue = openContacts.reduce((sum, contact) => sum + contactValue(contact, averageDealValue), 0);

  const contactsById = new Map(contacts.map((contact) => [String(contact.id), contact]));
  const closeDurations = scopedWonLogs
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

async function buildPipelineHealth(userId, pipelineData, stages) {
  const contactIdSet = new Set(pipelineData.contacts.map((contact) => String(contact.id)));
  const [stageLogs, pendingTasks] = await Promise.all([
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
        contactId: { in: pipelineData.openContacts.map((contact) => contact.id) },
        OR: [{ dueDate: null }, { dueDate: { gte: startOfDay(new Date()) } }],
      },
      select: { contactId: true },
    }),
  ]);

  const latestStageLogByContact = new Map();
  for (const log of stageLogs) {
    if (!contactIdSet.has(String(log.entity_id))) continue;
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

async function buildNextActions(userId, currentUser, filters, contactIds) {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const where = { userId, done: false };
  if (isPrivilegedUser(currentUser) && filters.responsibleUserId) {
    where.assignedToUserId = filters.responsibleUserId;
  } else if (!isPrivilegedUser(currentUser)) {
    where.assignedToUserId = currentUser.id;
  }

  if (contactIds) {
    where.contactId = { in: contactIds };
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
      where: {
        userId,
        status: 'ativo',
        birthDate: { not: null },
        ...(contactIds ? { id: { in: contactIds } } : {}),
      },
      select: { id: true, name: true, company: true, birthDate: true },
      take: 1000,
    }),
    prisma.automationAlert.findMany({
      where: {
        userId,
        status: 'open',
        ...(contactIds ? { contactId: { in: contactIds } } : {}),
      },
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

function buildFilterOptions(context) {
  const leadOriginValues = context.customFields.leadOrigin
    ? [
        ...parseArray(context.customFields.leadOrigin.options),
        ...context.optionContacts.map((contact) => getCustomFieldValue(contact, context.customFields.leadOrigin.key)),
      ]
    : [];
  const segmentValues = context.customFields.segment
    ? [
        ...parseArray(context.customFields.segment.options),
        ...context.optionContacts.map((contact) => getCustomFieldValue(contact, context.customFields.segment.key)),
      ]
    : [];

  return {
    periods: PERIOD_OPTIONS,
    responsibleUsers: context.members.map((member) => ({
      value: String(member.id),
      label: member.name || member.email,
    })),
    stages: context.stages.map((stage) => ({
      value: stage.name,
      label: stage.name,
      color: stage.color,
    })),
    leadOrigins: uniqueOptions(leadOriginValues),
    segments: uniqueOptions(segmentValues),
  };
}

async function getServicesDashboardBase({ user, query }) {
  const userId = user.effectiveUserId;
  await assertServicesWorkspace(userId);
  const filters = sanitizeFilters(query);
  const range = getRange(filters.period);

  const canSeePipeline = canView(user, 'pipeline');
  const canSeeTasks = canView(user, 'tasks');
  const canSeeFinance = canView(user, 'finances', 'transactions_view');
  const context = await getDashboardContext(userId, user, filters);
  const contactFiltersActive = !!(filters.stage || filters.leadOrigin || filters.segment);
  const scopedContactIds = contactFiltersActive ? context.contactIds : null;

  const revenue = canSeeFinance
    ? await buildRevenueKpis(userId, range, context.contactIds, contactFiltersActive)
    : { closedRevenue: null, paidRevenueCount: 0, averagePaidTicket: 0 };
  const pipelineData = canSeePipeline
    ? await buildPipelineKpis(userId, range, revenue, context.contacts)
    : null;

  const [pipelineHealth, nextActions] = await Promise.all([
    pipelineData ? buildPipelineHealth(userId, pipelineData, context.stages) : Promise.resolve(null),
    canSeeTasks ? buildNextActions(userId, user, filters, scopedContactIds) : Promise.resolve(null),
  ]);

  return {
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
    activeFilters: {
      period: range.period,
      responsibleUserId: filters.responsibleUserId ? String(filters.responsibleUserId) : null,
      stage: filters.stage,
      leadOrigin: filters.leadOrigin,
      segment: filters.segment,
    },
    filters: buildFilterOptions(context),
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
  };
}

module.exports = {
  getServicesDashboardBase,
};
