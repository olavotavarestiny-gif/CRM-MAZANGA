const { domainError } = require('../lib/food-domain');
const { getFoodOperationalReport } = require('./food-operational-report.service');

const OPEN_PURCHASE_STATES = ['draft', 'awaiting_confirmation', 'confirmed', 'in_delivery', 'partial'];
const OPEN_COLLECTION_STATES = ['pending_collection', 'with_courier', 'handed_to_cashier', 'not_received', 'discrepancy'];
const monthlyCloseInclude = {
  branch: { select: { id: true, name: true } },
  events: { orderBy: { version: 'asc' } },
  revisions: { orderBy: { revisionNumber: 'asc' } },
};

function resolveMonth(value, now = new Date()) {
  const month = String(value || now.toISOString().slice(0, 7)).trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw domainError('Utilize o mês no formato AAAA-MM.', 400, 'FOOD_CLOSE_MONTH_INVALID');
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1) - 1);
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (start > currentMonthStart) throw domainError('Não é possível validar um fecho futuro.', 400, 'FOOD_CLOSE_MONTH_FUTURE');
  return { month, start, end };
}

function check(key, label, severity, records, amount = 0, actionHref = null) {
  const count = records.length;
  return {
    key,
    label,
    status: count === 0 ? 'ok' : severity,
    count,
    amount: Math.round(Number(amount || 0) * 100) / 100,
    actionHref,
    records: records.slice(0, 20),
  };
}

async function validateBranch(prisma, access, rawBranchId) {
  const branchId = String(rawBranchId || '').trim() || null;
  if (!branchId) return null;
  if (access.branchIds !== null && !access.branchIds.includes(branchId)) throw domainError('Sem acesso à unidade selecionada.', 403, 'FOOD_BRANCH_ACCESS_DENIED');
  const branch = await prisma.foodBranch.findFirst({ where: { id: branchId, userId: access.organizationId, active: true }, select: { id: true } });
  if (!branch) throw domainError('Unidade Food inválida.', 400, 'FOOD_BRANCH_INVALID');
  return branchId;
}

async function getFoodMonthCloseReadiness(prisma, access, query = {}) {
  const period = resolveMonth(query.month);
  const branchId = await validateBranch(prisma, access, query.branchId);
  const allowedBranchIds = branchId ? [branchId] : access.branchIds;
  const branchScope = allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } };
  const monthRange = { gte: period.start, lte: period.end };
  const [openCashSessions, openCollections, openPurchases, unresolvedCashDifferences, completedOrders, negativeStock, lowStock, openShifts, failedFiscalDocuments] = await Promise.all([
    prisma.foodCashSession.findMany({
      where: { organizationId: access.organizationId, status: 'open', openedAt: { lte: period.end }, ...branchScope },
      include: { branch: { select: { name: true } } }, orderBy: { openedAt: 'asc' },
    }),
    prisma.foodDeliveryCollection.findMany({
      where: { organizationId: access.organizationId, state: { in: OPEN_COLLECTION_STATES }, createdAt: { lte: period.end }, ...branchScope },
      include: { order: { select: { orderNumber: true, customerName: true } } }, orderBy: { createdAt: 'asc' },
    }),
    prisma.foodPurchase.findMany({
      where: { organizationId: access.organizationId, status: { in: OPEN_PURCHASE_STATES }, createdAt: { lte: period.end }, ...branchScope },
      include: { branch: { select: { name: true } }, supplier: { select: { name: true } } }, orderBy: { createdAt: 'asc' },
    }),
    prisma.foodCashSession.findMany({
      where: {
        organizationId: access.organizationId, status: 'closed', closedAt: monthRange,
        approvalStatus: { in: ['pending', 'rejected'] }, ...branchScope,
      },
      include: { branch: { select: { name: true } } }, orderBy: { closedAt: 'asc' },
    }),
    prisma.foodOrder.findMany({
      where: {
        userId: access.organizationId, createdAt: monthRange, orderState: { not: 'cancelled' },
        status: { in: ['delivered', 'completed'] }, ...branchScope,
      },
      include: { payments: { where: { status: 'confirmed' }, select: { amount: true } }, branch: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.foodIngredient.findMany({
      where: { organizationId: access.organizationId, active: true, currentStock: { lt: 0 }, ...(allowedBranchIds === null ? {} : { OR: [{ branchId: null }, { branchId: { in: allowedBranchIds } }] }) },
      include: { branch: { select: { name: true } } }, orderBy: { currentStock: 'asc' },
    }),
    prisma.foodIngredient.findMany({
      where: { organizationId: access.organizationId, active: true, minimumStock: { gt: 0 }, ...(allowedBranchIds === null ? {} : { OR: [{ branchId: null }, { branchId: { in: allowedBranchIds } }] }) },
      include: { branch: { select: { name: true } } }, orderBy: { currentStock: 'asc' },
    }),
    prisma.foodShift.findMany({
      where: { organizationId: access.organizationId, status: 'open', startedAt: { lte: period.end }, ...branchScope },
      include: { branch: { select: { name: true } }, person: { select: { name: true } } }, orderBy: { startedAt: 'asc' },
    }),
    prisma.foodFiscalDocument.findMany({
      where: { userId: access.organizationId, requestedAt: monthRange, status: 'failed', ...branchScope },
      include: { order: { select: { orderNumber: true } } }, orderBy: { requestedAt: 'asc' },
    }),
  ]);
  const paymentMismatches = completedOrders.map((order) => {
    const paid = order.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    return { ...order, paid, difference: Math.round((paid - Number(order.total)) * 100) / 100 };
  }).filter((order) => Math.abs(order.difference) >= 0.01);
  const lowStockItems = lowStock.filter((item) => Number(item.currentStock) <= Number(item.minimumStock) && Number(item.currentStock) >= 0);
  const checks = [
    check('open_cash_sessions', 'Caixas abertos', 'blocked', openCashSessions.map((item) => ({ id: item.id, branchName: item.branch.name, openedAt: item.openedAt, expectedAmount: item.expectedClosingAmount })), openCashSessions.reduce((sum, item) => sum + Number(item.expectedClosingAmount), 0), '/food/gestao/equipa'),
    check('delivery_collections', 'Cobranças Delivery pendentes', 'blocked', openCollections.map((item) => ({ id: item.id, orderNumber: item.order.orderNumber, customerName: item.order.customerName, state: item.state, amount: item.actualAmount ?? item.expectedAmount, reason: item.exceptionReason })), openCollections.reduce((sum, item) => sum + Number(item.actualAmount ?? item.expectedAmount), 0), '/food/delivery'),
    check('open_purchases', 'Compras abertas', 'blocked', openPurchases.map((item) => ({ id: item.id, reference: item.reference, branchName: item.branch.name, supplierName: item.supplier?.name, state: item.status, amount: item.total })), openPurchases.reduce((sum, item) => sum + Number(item.total), 0), '/food/gestao/compras'),
    check('cash_differences', 'Diferenças de Caixa sem decisão', 'blocked', unresolvedCashDifferences.map((item) => ({ id: item.id, branchName: item.branch.name, closedAt: item.closedAt, difference: item.differenceAmount, approvalStatus: item.approvalStatus })), unresolvedCashDifferences.reduce((sum, item) => sum + Number(item.differenceAmount || 0), 0), '/food/gestao/equipa'),
    check('payment_mismatches', 'Pedidos concluídos com pagamento incoerente', 'blocked', paymentMismatches.map((item) => ({ id: item.id, orderNumber: item.orderNumber, branchName: item.branch?.name, total: item.total, paid: item.paid, difference: item.difference })), paymentMismatches.reduce((sum, item) => sum + item.difference, 0), '/food/pedidos'),
    check('negative_stock', 'Stock negativo', 'blocked', negativeStock.map((item) => ({ id: item.id, name: item.name, branchName: item.branch?.name, currentStock: item.currentStock, unit: item.unit })), 0, '/food/gestao/stock'),
    check('open_shifts', 'Turnos ainda abertos', 'blocked', openShifts.map((item) => ({ id: item.id, personName: item.person.name, branchName: item.branch.name, startedAt: item.startedAt })), 0, '/food/gestao/equipa'),
    check('low_stock', 'Ingredientes abaixo do mínimo', 'warning', lowStockItems.map((item) => ({ id: item.id, name: item.name, branchName: item.branch?.name, currentStock: item.currentStock, minimumStock: item.minimumStock, unit: item.unit })), 0, '/food/gestao/stock'),
    check('failed_fiscal_documents', 'Documentos fiscais com falha', 'warning', failedFiscalDocuments.map((item) => ({ id: item.id, orderNumber: item.order.orderNumber, errorCode: item.errorCode, errorMessage: item.errorMessage, requestedAt: item.requestedAt })), 0, '/food/pedidos'),
  ];
  const blocked = checks.filter((item) => item.status === 'blocked');
  const warnings = checks.filter((item) => item.status === 'warning');
  return {
    period: { month: period.month, start: period.start, end: period.end, branchId },
    ready: blocked.length === 0,
    totals: { blockedChecks: blocked.length, blockingRecords: blocked.reduce((sum, item) => sum + item.count, 0), warningChecks: warnings.length, warningRecords: warnings.reduce((sum, item) => sum + item.count, 0) },
    checks,
  };
}

function jsonSnapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

async function createFoodMonthlyClose(prisma, access, input = {}, options = {}) {
  const idempotencyKey = String(options.idempotencyKey || '').trim();
  if (!idempotencyKey) throw domainError('Idempotency-Key é obrigatória para fechar o mês.', 400, 'FOOD_IDEMPOTENCY_KEY_REQUIRED');
  const period = resolveMonth(input.month);
  const branchId = await validateBranch(prisma, access, input.branchId);
  if (!branchId && access.branchIds !== null) throw domainError('Selecione uma unidade para criar o fecho mensal.', 400, 'FOOD_CLOSE_BRANCH_REQUIRED');
  const scopeKey = branchId || 'all';
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${access.organizationId}:${period.month}:${scopeKey}`}, 0))`;
    const repeated = await tx.foodMonthlyClose.findFirst({
      where: { organizationId: access.organizationId, idempotencyKey },
      include: monthlyCloseInclude,
    });
    if (repeated) return { close: repeated, created: false };
    const existing = await tx.foodMonthlyClose.findUnique({
      where: { organizationId_month_scopeKey: { organizationId: access.organizationId, month: period.start, scopeKey } },
      include: monthlyCloseInclude,
    });
    if (existing) throw domainError('Este mês já possui um fecho para o âmbito selecionado.', 409, 'FOOD_MONTH_ALREADY_CLOSED');
    const readiness = await getFoodMonthCloseReadiness(tx, access, { month: period.month, branchId });
    if (!readiness.ready) throw domainError(`Resolva ${readiness.totals.blockingRecords} pendência(s) antes de fechar o mês.`, 409, 'FOOD_MONTH_CLOSE_BLOCKED');
    const report = await getFoodOperationalReport(tx, access, {
      from: period.start.toISOString().slice(0, 10),
      to: period.end.toISOString().slice(0, 10),
      branchId,
    });
    const closedAt = new Date();
    const close = await tx.foodMonthlyClose.create({
      data: {
        organizationId: access.organizationId, branchId, scopeKey, month: period.start,
        snapshot: jsonSnapshot(report), validationSnapshot: jsonSnapshot(readiness),
        closedByUserId: access.personId, idempotencyKey, closedAt,
        events: { create: { organizationId: access.organizationId, version: 1, eventType: 'monthly_close.created', actorUserId: access.personId, idempotencyKey, payload: { month: period.month, scopeKey, closedAt: closedAt.toISOString() } } },
      },
      include: monthlyCloseInclude,
    });
    return { close, created: true };
  }, { isolationLevel: 'Serializable' });
}

async function listFoodMonthlyCloses(prisma, access, query = {}) {
  const branchId = await validateBranch(prisma, access, query.branchId);
  const where = {
    organizationId: access.organizationId,
    ...(branchId ? { branchId } : access.branchIds === null ? {} : { branchId: { in: access.branchIds } }),
  };
  return prisma.foodMonthlyClose.findMany({
    where,
    include: monthlyCloseInclude,
    orderBy: { month: 'desc' }, take: 120,
  });
}

async function getFoodMonthlyClose(prisma, access, closeId) {
  const close = await prisma.foodMonthlyClose.findFirst({
    where: { id: closeId, organizationId: access.organizationId },
    include: monthlyCloseInclude,
  });
  if (!close) throw domainError('Fecho mensal não encontrado.', 404, 'FOOD_MONTH_CLOSE_NOT_FOUND');
  if (access.branchIds !== null && (!close.branchId || !access.branchIds.includes(close.branchId))) {
    throw domainError('Sem acesso ao âmbito deste fecho.', 403, 'FOOD_BRANCH_ACCESS_DENIED');
  }
  return close;
}

async function reopenFoodMonthlyClose(prisma, access, closeId, input = {}, options = {}) {
  const idempotencyKey = String(options.idempotencyKey || '').trim();
  if (!idempotencyKey) throw domainError('Idempotency-Key é obrigatória para reabrir o mês.', 400, 'FOOD_IDEMPOTENCY_KEY_REQUIRED');
  const reason = String(input.reason || '').trim();
  if (reason.length < 5) throw domainError('Indique um motivo com pelo menos 5 caracteres.', 400, 'FOOD_MONTH_REOPEN_REASON_REQUIRED');
  const expectedVersion = Number(input.version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw domainError('Indique a versão actual do fecho.', 400, 'FOOD_MONTH_CLOSE_VERSION_REQUIRED');
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${access.organizationId}:${closeId}`}, 0))`;
    const previousEvent = await tx.foodMonthlyCloseEvent.findFirst({
      where: { organizationId: access.organizationId, idempotencyKey },
      include: { monthlyClose: { include: monthlyCloseInclude } },
    });
    if (previousEvent) {
      if (previousEvent.monthlyCloseId !== closeId || previousEvent.eventType !== 'monthly_close.reopened') {
        throw domainError('Idempotency-Key já utilizada noutro comando.', 409, 'IDEMPOTENCY_KEY_REUSED');
      }
      return { close: previousEvent.monthlyClose, reopened: false };
    }
    const close = await tx.foodMonthlyClose.findFirst({ where: { id: closeId, organizationId: access.organizationId } });
    if (!close) throw domainError('Fecho mensal não encontrado.', 404, 'FOOD_MONTH_CLOSE_NOT_FOUND');
    if (access.branchIds !== null && (!close.branchId || !access.branchIds.includes(close.branchId))) {
      throw domainError('Sem acesso ao âmbito deste fecho.', 403, 'FOOD_BRANCH_ACCESS_DENIED');
    }
    if (close.status !== 'closed') throw domainError('Este mês já está reaberto.', 409, 'FOOD_MONTH_ALREADY_REOPENED');
    if (close.version !== expectedVersion) throw domainError('O fecho foi alterado noutro dispositivo. Actualize antes de continuar.', 409, 'FOOD_VERSION_CONFLICT');
    const reopenedAt = new Date();
    const updated = await tx.foodMonthlyClose.updateMany({
      where: { id: close.id, organizationId: access.organizationId, status: 'closed', version: expectedVersion },
      data: { status: 'reopened', version: { increment: 1 }, reopenedByUserId: access.personId, reopenedAt, reopenReason: reason.slice(0, 500) },
    });
    if (updated.count !== 1) throw domainError('O fecho foi alterado noutro dispositivo. Actualize antes de continuar.', 409, 'FOOD_VERSION_CONFLICT');
    await tx.foodMonthlyCloseEvent.create({
      data: {
        organizationId: access.organizationId, monthlyCloseId: close.id, version: expectedVersion + 1,
        eventType: 'monthly_close.reopened', actorUserId: access.personId, idempotencyKey,
        payload: { reason: reason.slice(0, 500), reopenedAt: reopenedAt.toISOString(), originalSnapshotPreserved: true },
      },
    });
    return {
      close: await tx.foodMonthlyClose.findUnique({ where: { id: close.id }, include: monthlyCloseInclude }),
      reopened: true,
    };
  }, { isolationLevel: 'Serializable' });
}

async function getFoodMonthlyCloseRevision(prisma, access, closeId, revisionId) {
  const revision = await prisma.foodMonthlyCloseRevision.findFirst({
    where: { id: revisionId, monthlyCloseId: closeId, organizationId: access.organizationId },
    include: { monthlyClose: { include: { branch: { select: { id: true, name: true } } } } },
  });
  if (!revision) throw domainError('Revisão do fecho mensal não encontrada.', 404, 'FOOD_MONTH_CLOSE_REVISION_NOT_FOUND');
  const close = revision.monthlyClose;
  if (access.branchIds !== null && (!close.branchId || !access.branchIds.includes(close.branchId))) {
    throw domainError('Sem acesso ao âmbito deste fecho.', 403, 'FOOD_BRANCH_ACCESS_DENIED');
  }
  return {
    id: revision.id,
    monthlyCloseId: close.id,
    organizationId: revision.organizationId,
    branchId: close.branchId,
    scopeKey: close.scopeKey,
    month: close.month,
    status: 'closed',
    version: revision.aggregateVersion,
    revisionNumber: revision.revisionNumber,
    snapshot: revision.snapshot,
    validationSnapshot: revision.validationSnapshot,
    closedByUserId: revision.closedByUserId,
    closedAt: revision.closedAt,
    reason: revision.reason,
    branch: close.branch,
  };
}

async function recloseFoodMonthlyClose(prisma, access, closeId, input = {}, options = {}) {
  const idempotencyKey = String(options.idempotencyKey || '').trim();
  if (!idempotencyKey) throw domainError('Idempotency-Key é obrigatória para fechar novamente o mês.', 400, 'FOOD_IDEMPOTENCY_KEY_REQUIRED');
  const reason = String(input.reason || '').trim();
  if (reason.length < 5) throw domainError('Indique o motivo das correcções com pelo menos 5 caracteres.', 400, 'FOOD_MONTH_RECLOSE_REASON_REQUIRED');
  const expectedVersion = Number(input.version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw domainError('Indique a versão actual do fecho.', 400, 'FOOD_MONTH_CLOSE_VERSION_REQUIRED');

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${access.organizationId}:${closeId}`}, 0))`;
    const previousEvent = await tx.foodMonthlyCloseEvent.findFirst({
      where: { organizationId: access.organizationId, idempotencyKey },
      include: { monthlyClose: { include: monthlyCloseInclude } },
    });
    if (previousEvent) {
      if (previousEvent.monthlyCloseId !== closeId || previousEvent.eventType !== 'monthly_close.reclosed') {
        throw domainError('Idempotency-Key já utilizada noutro comando.', 409, 'IDEMPOTENCY_KEY_REUSED');
      }
      const revision = await tx.foodMonthlyCloseRevision.findFirst({ where: { organizationId: access.organizationId, idempotencyKey } });
      return { close: previousEvent.monthlyClose, revision, reclosed: false };
    }

    const close = await tx.foodMonthlyClose.findFirst({
      where: { id: closeId, organizationId: access.organizationId },
      include: { revisions: { orderBy: { revisionNumber: 'asc' } } },
    });
    if (!close) throw domainError('Fecho mensal não encontrado.', 404, 'FOOD_MONTH_CLOSE_NOT_FOUND');
    if (access.branchIds !== null && (!close.branchId || !access.branchIds.includes(close.branchId))) {
      throw domainError('Sem acesso ao âmbito deste fecho.', 403, 'FOOD_BRANCH_ACCESS_DENIED');
    }
    if (close.status !== 'reopened') throw domainError('Este mês não está reaberto.', 409, 'FOOD_MONTH_NOT_REOPENED');
    if (close.version !== expectedVersion) throw domainError('O fecho foi alterado noutro dispositivo. Actualize antes de continuar.', 409, 'FOOD_VERSION_CONFLICT');

    const month = close.month.toISOString().slice(0, 7);
    const readiness = await getFoodMonthCloseReadiness(tx, access, { month, branchId: close.branchId });
    if (!readiness.ready) throw domainError(`Resolva ${readiness.totals.blockingRecords} pendência(s) antes de fechar novamente o mês.`, 409, 'FOOD_MONTH_CLOSE_BLOCKED');
    const period = resolveMonth(month);
    const report = await getFoodOperationalReport(tx, access, {
      from: period.start.toISOString().slice(0, 10),
      to: period.end.toISOString().slice(0, 10),
      branchId: close.branchId,
    });
    const aggregateVersion = expectedVersion + 1;
    const revisionNumber = close.revisions.length + 2;
    const closedAt = new Date();
    const updated = await tx.foodMonthlyClose.updateMany({
      where: { id: close.id, organizationId: access.organizationId, status: 'reopened', version: expectedVersion },
      data: { status: 'closed', version: { increment: 1 } },
    });
    if (updated.count !== 1) throw domainError('O fecho foi alterado noutro dispositivo. Actualize antes de continuar.', 409, 'FOOD_VERSION_CONFLICT');
    const revision = await tx.foodMonthlyCloseRevision.create({
      data: {
        organizationId: access.organizationId,
        monthlyCloseId: close.id,
        revisionNumber,
        aggregateVersion,
        snapshot: jsonSnapshot(report),
        validationSnapshot: jsonSnapshot(readiness),
        reason: reason.slice(0, 500),
        closedByUserId: access.personId,
        idempotencyKey,
        closedAt,
      },
    });
    await tx.foodMonthlyCloseEvent.create({
      data: {
        organizationId: access.organizationId,
        monthlyCloseId: close.id,
        version: aggregateVersion,
        eventType: 'monthly_close.reclosed',
        actorUserId: access.personId,
        idempotencyKey,
        payload: { revisionId: revision.id, revisionNumber, reason: reason.slice(0, 500), closedAt: closedAt.toISOString(), previousSnapshotsPreserved: true },
      },
    });
    return {
      close: await tx.foodMonthlyClose.findUnique({ where: { id: close.id }, include: monthlyCloseInclude }),
      revision,
      reclosed: true,
    };
  }, { isolationLevel: 'Serializable' });
}

module.exports = {
  createFoodMonthlyClose,
  getFoodMonthCloseReadiness,
  getFoodMonthlyClose,
  getFoodMonthlyCloseRevision,
  listFoodMonthlyCloses,
  recloseFoodMonthlyClose,
  reopenFoodMonthlyClose,
  resolveMonth,
};
