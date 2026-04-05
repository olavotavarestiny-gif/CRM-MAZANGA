const prisma = require('../lib/prisma');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function clampPage(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE;
}

function clampPageSize(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(parsed, MAX_PAGE_SIZE);
}

function parseDate(value, fieldName) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Data inválida para ${fieldName}`);
  }
  return parsed;
}

function buildDateFilter(filters = {}) {
  const from = parseDate(filters.dateFrom, 'dateFrom');
  const to = parseDate(filters.dateTo, 'dateTo');

  if (!from && !to) return undefined;

  const created_at = {};
  if (from) created_at.gte = from;
  if (to) created_at.lte = to;
  return created_at;
}

function buildOrganizationWhere(organizationId, filters = {}) {
  const where = {
    organization_id: organizationId,
  };

  const created_at = buildDateFilter(filters);
  if (created_at) where.created_at = created_at;
  if (filters.userId) {
    const parsedUserId = Number.parseInt(filters.userId, 10);
    if (Number.isInteger(parsedUserId)) {
      where.user_id = parsedUserId;
    }
  }
  if (filters.entityType) where.entity_type = filters.entityType;
  if (filters.search) {
    where.OR = [
      { entity_label: { contains: filters.search, mode: 'insensitive' } },
      { user_name: { contains: filters.search, mode: 'insensitive' } },
      { old_value: { contains: filters.search, mode: 'insensitive' } },
      { new_value: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

function buildPagination(page, pageSize, total) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

async function log(data) {
  try {
    return await prisma.activityLog.create({
      data: {
        organization_id: data.organization_id,
        entity_type: data.entity_type,
        entity_id: String(data.entity_id),
        entity_label: data.entity_label,
        action: data.action,
        field_changed: data.field_changed || null,
        old_value: data.old_value ?? null,
        new_value: data.new_value ?? null,
        user_id: data.user_id,
        user_name: data.user_name,
        metadata: data.metadata ?? null,
      },
    });
  } catch {
    return null;
  }
}

async function getEntityHistory(entityType, entityId, organizationId, filters = {}) {
  const page = clampPage(filters.page);
  const pageSize = clampPageSize(filters.pageSize);
  const where = {
    organization_id: organizationId,
    entity_type: entityType,
    entity_id: String(entityId),
  };

  const [total, data] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    data,
    pagination: buildPagination(page, pageSize, total),
  };
}

async function getOrganizationFeed(organizationId, filters = {}) {
  const page = clampPage(filters.page);
  const pageSize = clampPageSize(filters.pageSize);
  const where = buildOrganizationWhere(organizationId, filters);

  const [total, data] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    data,
    pagination: buildPagination(page, pageSize, total),
    filters: {
      userId: filters.userId && Number.isInteger(Number.parseInt(filters.userId, 10))
        ? Number.parseInt(filters.userId, 10)
        : null,
      entityType: filters.entityType || null,
      search: filters.search || '',
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
    },
  };
}

async function exportOrganizationFeedCsv(organizationId, filters = {}) {
  const where = buildOrganizationWhere(organizationId, filters);
  const rows = await prisma.activityLog.findMany({
    where,
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
  });

  const header = ['Data', 'Utilizador', 'Tipo', 'Entidade', 'Ação', 'Campo', 'Valor Anterior', 'Valor Novo'];
  const lines = rows.map((row) => ([
    row.created_at.toISOString(),
    row.user_name,
    row.entity_type,
    row.entity_label,
    row.action,
    row.field_changed || '',
    row.old_value || '',
    row.new_value || '',
  ]).map(csvEscape).join(','));

  return [header.join(','), ...lines].join('\n');
}

module.exports = {
  log,
  getEntityHistory,
  getOrganizationFeed,
  exportOrganizationFeedCsv,
};
