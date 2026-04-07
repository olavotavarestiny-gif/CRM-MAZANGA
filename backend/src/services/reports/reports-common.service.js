const prisma = require('../../lib/prisma');
const { isInvoicePaid } = require('../reconciliation.service.js');

const PERIOD_DAY_MAP = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const WON_STAGE = 'Fechado';
const LOST_STAGE = 'Perdido';

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function startOfUtcMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfUtcMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function differenceInCalendarDays(start, end) {
  const startMs = startOfUtcDay(start).getTime();
  const endMs = startOfUtcDay(end).getTime();
  return Math.max(1, Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1);
}

function parseDateBoundary(value, boundary) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return null;

  return boundary === 'start'
    ? new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    : new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

function getGranularity(dayCount) {
  if (dayCount <= 31) return 'day';
  if (dayCount <= 120) return 'week';
  return 'month';
}

function resolveDateRange(params = {}) {
  const now = new Date();
  const period = PERIOD_DAY_MAP[params.period] ? params.period : params.period === 'month' ? 'month' : params.period === 'custom' ? 'custom' : '30d';

  let currentStart;
  let currentEnd;

  if (period === 'custom') {
    const parsedStart = parseDateBoundary(params.startDate, 'start');
    const parsedEnd = parseDateBoundary(params.endDate, 'end');

    if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
      throw createError('Intervalo custom inválido. Use startDate e endDate válidos.', 400);
    }

    currentStart = parsedStart;
    currentEnd = parsedEnd;
  } else if (period === 'month') {
    currentStart = startOfUtcMonth(now);
    currentEnd = now;
  } else {
    const days = PERIOD_DAY_MAP[period];
    currentEnd = now;
    currentStart = startOfUtcDay(addUtcDays(now, -(days - 1)));
  }

  const dayCount = differenceInCalendarDays(currentStart, currentEnd);
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = startOfUtcDay(addUtcDays(previousEnd, -(dayCount - 1)));

  return {
    period,
    granularity: getGranularity(dayCount),
    current: {
      start: currentStart,
      end: currentEnd,
    },
    previous: {
      start: previousStart,
      end: previousEnd,
    },
    dayCount,
  };
}

function serializeRange(range) {
  return {
    period: range.period,
    granularity: range.granularity,
    dayCount: range.dayCount,
    start: range.current.start.toISOString(),
    end: range.current.end.toISOString(),
    previousStart: range.previous.start.toISOString(),
    previousEnd: range.previous.end.toISOString(),
  };
}

function calculateGrowth(currentValue, previousValue) {
  if (!previousValue) return currentValue > 0 ? 100 : null;
  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));
}

function calculateAverage(total, count) {
  if (!count) return 0;
  return Number((total / count).toFixed(2));
}

function roundCurrency(value) {
  return Number((Number(value || 0)).toFixed(2));
}

function roundPercentage(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number(Number(value).toFixed(1));
}

function calculatePercentage(part, total) {
  if (!total) return null;
  return roundPercentage((part / total) * 100);
}

function limitTop(items, size = 5) {
  return items.slice(0, size);
}

function parseInvoiceLines(lines) {
  try {
    const parsed = typeof lines === 'string' ? JSON.parse(lines) : lines;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getInvoiceLineBase(line) {
  return Number(line?.quantity || 0) * Number(line?.unitPrice || 0);
}

function getInvoiceLineTax(line) {
  const taxes = Array.isArray(line?.taxes) ? line.taxes : [];
  return taxes.reduce((sum, tax) => {
    if (typeof tax?.taxAmount === 'number') {
      return sum + Number(tax.taxAmount || 0);
    }

    const baseAmount = getInvoiceLineBase(line);
    return sum + ((baseAmount * Number(tax?.taxPercentage || 0)) / 100);
  }, 0);
}

function getInvoiceLineGross(line) {
  return getInvoiceLineBase(line) + getInvoiceLineTax(line);
}

function estimateContactValue(contact) {
  if (Number(contact?.dealValueKz || 0) > 0) {
    return Number(contact.dealValueKz);
  }

  const label = String(contact?.revenue || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (!label) return 0;
  if (label.includes('50') && label.includes('100')) return 75_000_000;
  if (label.includes('100') && label.includes('500')) return 300_000_000;
  if (label.includes('+ 500') || label.includes('500 m')) return 600_000_000;
  if (label.includes('- 50') || label.includes('50m') || label.includes('50 milhoes')) return 25_000_000;
  return 0;
}

function getTimeBucketKey(dateValue, granularity) {
  const date = new Date(dateValue);

  if (granularity === 'month') {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  if (granularity === 'week') {
    const day = date.getUTCDay() || 7;
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
    start.setUTCDate(start.getUTCDate() - day + 1);
    return start.toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function getTimeBucketLabel(key, granularity) {
  if (granularity === 'month') {
    const [year, month] = key.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
  }

  if (granularity === 'week') {
    const date = new Date(`${key}T00:00:00.000Z`);
    const end = addUtcDays(date, 6);
    return `${date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}`;
  }

  return new Date(`${key}T00:00:00.000Z`).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
  });
}

function buildTimeSeries(items, {
  range,
  granularity = range.granularity,
  dateAccessor,
  valueAccessor,
  countAccessor,
}) {
  const bucketMap = new Map();

  for (const item of items) {
    const rawDate = dateAccessor(item);
    if (!rawDate) continue;
    const key = getTimeBucketKey(rawDate, granularity);
    if (!bucketMap.has(key)) {
      bucketMap.set(key, {
        key,
        label: getTimeBucketLabel(key, granularity),
        total: 0,
        count: 0,
      });
    }

    const bucket = bucketMap.get(key);
    bucket.total += Number(valueAccessor ? valueAccessor(item) : 0);
    bucket.count += Number(countAccessor ? countAccessor(item) : 1);
  }

  return Array.from(bucketMap.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((entry) => ({
      ...entry,
      total: roundCurrency(entry.total),
      count: Number(entry.count),
    }));
}

async function assertWorkspaceMode(organizationId, expectedWorkspace) {
  const owner = await prisma.user.findUnique({
    where: { id: organizationId },
    select: { id: true, workspaceMode: true },
  });

  if (!owner) {
    throw createError('Organização não encontrada', 404);
  }

  if (owner.workspaceMode !== expectedWorkspace) {
    throw createError(
      expectedWorkspace === 'servicos'
        ? 'Relatórios avançados de serviços só estão disponíveis no workspace de serviços'
        : 'Relatórios avançados de comércio só estão disponíveis no workspace de comércio',
      403
    );
  }

  return owner;
}

async function getOrganizationMembers(organizationId) {
  return prisma.user.findMany({
    where: {
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
      assignedEstabelecimentoId: true,
    },
    orderBy: [{ accountOwnerId: 'asc' }, { createdAt: 'asc' }],
  });
}

function resolveRequestedUserIds(members, requestedUserId) {
  const parsed = Number.parseInt(String(requestedUserId || ''), 10);
  if (!Number.isInteger(parsed)) return null;
  if (!members.some((member) => member.id === parsed)) {
    throw createError('userId inválido para esta organização', 400);
  }
  return [parsed];
}

async function getReceivablesSummary(organizationId, dateRange) {
  const candidateInvoices = await prisma.factura.findMany({
    where: {
      userId: organizationId,
      documentStatus: 'N',
      documentDate: { gte: dateRange.start, lte: dateRange.end },
    },
    select: {
      id: true,
      documentNo: true,
      documentType: true,
      paymentMethod: true,
      grossTotal: true,
    },
  });

  const openReceivableInvoices = candidateInvoices.filter((invoice) => !isInvoicePaid(invoice));
  const receivableInvoiceIds = openReceivableInvoices.map((invoice) => invoice.id);
  const receivableDocumentNumbers = openReceivableInvoices.map((invoice) => invoice.documentNo);

  const linkedPaidTransactions = receivableInvoiceIds.length || receivableDocumentNumbers.length
    ? await prisma.transaction.findMany({
        where: {
          userId: organizationId,
          deleted: false,
          status: 'pago',
          type: 'entrada',
          OR: [
            ...(receivableInvoiceIds.length ? [{ invoiceId: { in: receivableInvoiceIds } }] : []),
            ...(receivableDocumentNumbers.length ? [{ receiptNumber: { in: receivableDocumentNumbers } }] : []),
          ],
        },
        select: {
          invoiceId: true,
          receiptNumber: true,
        },
      })
    : [];

  const paidByInvoiceId = new Set(linkedPaidTransactions.map((transaction) => transaction.invoiceId).filter(Boolean));
  const paidByReceiptNumber = new Set(linkedPaidTransactions.map((transaction) => transaction.receiptNumber).filter(Boolean));

  const unpaid = openReceivableInvoices.filter((invoice) => (
    !paidByInvoiceId.has(invoice.id) && !paidByReceiptNumber.has(invoice.documentNo)
  ));

  return {
    count: unpaid.length,
    total: roundCurrency(unpaid.reduce((sum, invoice) => sum + Number(invoice.grossTotal || 0), 0)),
  };
}

function summarizeComparison(current, previous) {
  return {
    current: roundCurrency(current),
    previous: roundCurrency(previous),
    growthPercent: calculateGrowth(current, previous),
  };
}

module.exports = {
  WON_STAGE,
  LOST_STAGE,
  createError,
  resolveDateRange,
  serializeRange,
  calculateGrowth,
  calculateAverage,
  calculatePercentage,
  roundCurrency,
  roundPercentage,
  limitTop,
  parseInvoiceLines,
  getInvoiceLineBase,
  getInvoiceLineGross,
  estimateContactValue,
  buildTimeSeries,
  assertWorkspaceMode,
  getOrganizationMembers,
  resolveRequestedUserIds,
  getReceivablesSummary,
  summarizeComparison,
};
