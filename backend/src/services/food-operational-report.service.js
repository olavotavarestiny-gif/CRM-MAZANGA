const { domainError } = require('../lib/food-domain');

const DAY_MS = 24 * 60 * 60 * 1000;

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function parseDate(value, endOfDay = false) {
  const normalized = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolvePeriod(query = {}, now = new Date()) {
  const defaultTo = new Date(now);
  defaultTo.setUTCHours(23, 59, 59, 999);
  const defaultFrom = new Date(defaultTo.getTime() - (29 * DAY_MS));
  defaultFrom.setUTCHours(0, 0, 0, 0);
  const from = query.from ? parseDate(query.from) : defaultFrom;
  const to = query.to ? parseDate(query.to, true) : defaultTo;
  if (!from || !to) throw domainError('Utilize datas no formato AAAA-MM-DD.', 400, 'FOOD_REPORT_DATE_INVALID');
  if (from > to) throw domainError('A data inicial não pode ser posterior à data final.', 400, 'FOOD_REPORT_PERIOD_INVALID');
  const days = Math.ceil((to.getTime() - from.getTime() + 1) / DAY_MS);
  if (days > 366) throw domainError('O período máximo do relatório é de 366 dias.', 400, 'FOOD_REPORT_PERIOD_TOO_LONG');
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - (to.getTime() - from.getTime()));
  return { from, to, days, previousFrom, previousTo };
}

function percentageChange(current, previous) {
  if (Number(previous) === 0) return Number(current) === 0 ? 0 : null;
  return Math.round(((Number(current) - Number(previous)) / Math.abs(Number(previous))) * 1000) / 10;
}

function summarizePeriod(orders, payments, deliveries, purchases, sessions, deliveryReconciliations = []) {
  const activeOrders = orders.filter((order) => order.orderState !== 'cancelled');
  const cancelledOrders = orders.length - activeOrders.length;
  const received = money(payments.reduce((sum, payment) => sum + Number(payment.amount), 0));
  const heldByCouriers = money(payments
    .filter((payment) => payment.source === 'delivery_collection' && !payment.cashSessionId)
    .reduce((sum, payment) => sum + Number(payment.amount), 0));
  const cashierReconciled = payments.filter((payment) => payment.source !== 'delivery_collection').reduce((sum, payment) => sum + Number(payment.amount), 0);
  const deliveryReconciled = deliveryReconciliations.reduce((sum, collection) => sum + Number(collection.payment?.amount || 0), 0);
  const reconciled = money(cashierReconciled + deliveryReconciled);
  const discounts = money(activeOrders.reduce((sum, order) => sum + Number(order.discountAmount || 0), 0));
  const orderValue = money(activeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0));
  const delivered = deliveries.filter((delivery) => delivery.state === 'delivered').length;
  const failed = deliveries.filter((delivery) => ['failed', 'returned'].includes(delivery.state)).length;
  const purchasesReceived = money(purchases.filter((purchase) => ['partial', 'received'].includes(purchase.status)).reduce((sum, purchase) => sum + Number(purchase.total), 0));
  const cashDifference = money(sessions.filter((session) => session.status === 'closed').reduce((sum, session) => sum + Number(session.differenceAmount || 0), 0));
  return {
    orders: activeOrders.length,
    cancelledOrders,
    cancellationRate: orders.length ? Math.round((cancelledOrders / orders.length) * 1000) / 10 : 0,
    orderValue,
    received,
    reconciled,
    heldByCouriers,
    outstanding: money(Math.max(0, orderValue - received)),
    averageTicket: activeOrders.length ? money(orderValue / activeOrders.length) : 0,
    discounts,
    delivered,
    failedDeliveries: failed,
    deliverySuccessRate: delivered + failed ? Math.round((delivered / (delivered + failed)) * 1000) / 10 : 0,
    purchasesReceived,
    cashDifference,
  };
}

function comparison(current, previous) {
  return Object.fromEntries(['orders', 'orderValue', 'received', 'reconciled', 'averageTicket', 'cancelledOrders', 'delivered', 'purchasesReceived']
    .map((key) => [key, percentageChange(current[key], previous[key])]));
}

async function validateBranch(prisma, access, branchId) {
  if (!branchId) return null;
  if (access.branchIds !== null && !access.branchIds.includes(branchId)) throw domainError('Sem acesso à unidade selecionada.', 403, 'FOOD_BRANCH_ACCESS_DENIED');
  const branch = await prisma.foodBranch.findFirst({ where: { id: branchId, userId: access.organizationId, active: true }, select: { id: true } });
  if (!branch) throw domainError('Unidade Food inválida.', 400, 'FOOD_BRANCH_INVALID');
  return branchId;
}

async function getFoodOperationalReport(prisma, access, query = {}) {
  const period = resolvePeriod(query);
  const branchId = await validateBranch(prisma, access, String(query.branchId || '').trim() || null);
  const allowedBranchIds = branchId ? [branchId] : access.branchIds;
  const branchScope = allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } };
  const range = { gte: period.from, lte: period.to };
  const previousRange = { gte: period.previousFrom, lte: period.previousTo };
  const orderSelect = { id: true, orderNumber: true, branchId: true, orderType: true, orderState: true, total: true, discountAmount: true, createdAt: true };
  const paymentSelect = { id: true, branchId: true, orderId: true, amount: true, method: true, source: true, cashSessionId: true, courierUserId: true, paidAt: true };
  const deliverySelect = { id: true, branchId: true, orderId: true, courierUserId: true, state: true, createdAt: true, deliveredAt: true };
  const purchaseSelect = { id: true, branchId: true, status: true, total: true, createdAt: true, receivedAt: true };
  const sessionSelect = { id: true, branchId: true, status: true, totalSalesAmount: true, differenceAmount: true, approvalStatus: true, openedAt: true, closedAt: true };
  const [orders, previousOrders, payments, previousPayments, deliveries, previousDeliveries, purchases, previousPurchases, sessions, previousSessions, deliveryReconciliations, previousDeliveryReconciliations, collections, openCashSessions, branches, ingredients, stockMovements] = await Promise.all([
    prisma.foodOrder.findMany({ where: { userId: access.organizationId, createdAt: range, ...branchScope }, select: orderSelect }),
    prisma.foodOrder.findMany({ where: { userId: access.organizationId, createdAt: previousRange, ...branchScope }, select: orderSelect }),
    prisma.foodPayment.findMany({ where: { userId: access.organizationId, status: 'confirmed', paidAt: range, ...branchScope }, select: paymentSelect }),
    prisma.foodPayment.findMany({ where: { userId: access.organizationId, status: 'confirmed', paidAt: previousRange, ...branchScope }, select: paymentSelect }),
    prisma.foodDelivery.findMany({ where: { userId: access.organizationId, createdAt: range, ...branchScope }, select: deliverySelect }),
    prisma.foodDelivery.findMany({ where: { userId: access.organizationId, createdAt: previousRange, ...branchScope }, select: deliverySelect }),
    prisma.foodPurchase.findMany({ where: { organizationId: access.organizationId, createdAt: range, ...branchScope }, select: purchaseSelect }),
    prisma.foodPurchase.findMany({ where: { organizationId: access.organizationId, createdAt: previousRange, ...branchScope }, select: purchaseSelect }),
    prisma.foodCashSession.findMany({ where: { organizationId: access.organizationId, openedAt: range, ...branchScope }, select: sessionSelect }),
    prisma.foodCashSession.findMany({ where: { organizationId: access.organizationId, openedAt: previousRange, ...branchScope }, select: sessionSelect }),
    prisma.foodDeliveryCollection.findMany({ where: { organizationId: access.organizationId, state: 'reconciled', reconciledAt: range, ...branchScope }, select: { branchId: true, reconciledAt: true, payment: { select: { amount: true, method: true } } } }),
    prisma.foodDeliveryCollection.findMany({ where: { organizationId: access.organizationId, state: 'reconciled', reconciledAt: previousRange, ...branchScope }, select: { branchId: true, reconciledAt: true, payment: { select: { amount: true, method: true } } } }),
    prisma.foodDeliveryCollection.findMany({
      where: { organizationId: access.organizationId, state: { in: ['pending_collection', 'with_courier', 'handed_to_cashier', 'not_received', 'discrepancy'] }, ...branchScope },
      include: { order: { select: { orderNumber: true, customerName: true } }, delivery: { select: { state: true } } },
      orderBy: { updatedAt: 'asc' }, take: 100,
    }),
    prisma.foodCashSession.count({ where: { organizationId: access.organizationId, status: 'open', ...branchScope } }),
    prisma.foodBranch.findMany({ where: { userId: access.organizationId, ...(allowedBranchIds === null ? {} : { id: { in: allowedBranchIds } }) }, select: { id: true, name: true } }),
    prisma.foodIngredient.findMany({
      where: { organizationId: access.organizationId, active: true, ...(allowedBranchIds === null ? {} : { OR: [{ branchId: null }, { branchId: { in: allowedBranchIds } }] }) },
      select: { branchId: true, currentStock: true, minimumStock: true, averageCost: true },
    }),
    prisma.foodStockMovement.findMany({ where: { organizationId: access.organizationId, createdAt: range, ...branchScope }, select: { type: true, quantity: true, unitCost: true } }),
  ]);
  const current = summarizePeriod(orders, payments, deliveries, purchases, sessions, deliveryReconciliations);
  const previous = summarizePeriod(previousOrders, previousPayments, previousDeliveries, previousPurchases, previousSessions, previousDeliveryReconciliations);
  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
  const daily = new Map();
  for (let index = 0; index < period.days; index += 1) {
    const date = new Date(period.from.getTime() + (index * DAY_MS)).toISOString().slice(0, 10);
    daily.set(date, { date, orders: 0, orderValue: 0, received: 0, reconciled: 0 });
  }
  for (const order of orders.filter((item) => item.orderState !== 'cancelled')) {
    const row = daily.get(order.createdAt.toISOString().slice(0, 10));
    if (row) { row.orders += 1; row.orderValue = money(row.orderValue + order.total); }
  }
  for (const payment of payments) {
    const row = daily.get(payment.paidAt?.toISOString().slice(0, 10));
    if (row) {
      row.received = money(row.received + payment.amount);
      if (payment.source !== 'delivery_collection') row.reconciled = money(row.reconciled + payment.amount);
    }
  }
  for (const collection of deliveryReconciliations) {
    const row = daily.get(collection.reconciledAt?.toISOString().slice(0, 10));
    if (row) row.reconciled = money(row.reconciled + Number(collection.payment?.amount || 0));
  }
  const byMethod = Object.values(payments.reduce((acc, payment) => {
    acc[payment.method] ||= { method: payment.method, received: 0, reconciled: 0, count: 0 };
    acc[payment.method].received = money(acc[payment.method].received + payment.amount);
    if (payment.source !== 'delivery_collection') acc[payment.method].reconciled = money(acc[payment.method].reconciled + payment.amount);
    acc[payment.method].count += 1;
    return acc;
  }, {}));
  for (const collection of deliveryReconciliations) {
    const method = collection.payment?.method || 'OUTRO';
    const row = byMethod.find((item) => item.method === method);
    if (row) row.reconciled = money(row.reconciled + Number(collection.payment?.amount || 0));
    else byMethod.push({ method, received: 0, reconciled: money(collection.payment?.amount), count: 0 });
  }
  const byBranch = branches.map((branch) => {
    const branchOrders = orders.filter((item) => item.branchId === branch.id);
    const branchPayments = payments.filter((item) => item.branchId === branch.id);
    return { branchId: branch.id, branchName: branch.name, ...summarizePeriod(branchOrders, branchPayments, deliveries.filter((item) => item.branchId === branch.id), purchases.filter((item) => item.branchId === branch.id), sessions.filter((item) => item.branchId === branch.id), deliveryReconciliations.filter((item) => item.branchId === branch.id)) };
  });
  const inventoryValue = money(ingredients.reduce((sum, item) => sum + (Number(item.currentStock) * Number(item.averageCost || 0)), 0));
  const lowStock = ingredients.filter((item) => Number(item.minimumStock) > 0 && Number(item.currentStock) <= Number(item.minimumStock)).length;
  const stockMovementValue = money(stockMovements.reduce((sum, item) => sum + Math.abs(Number(item.quantity)) * Number(item.unitCost || 0), 0));
  return {
    period: { from: period.from, to: period.to, days: period.days, previousFrom: period.previousFrom, previousTo: period.previousTo, branchId },
    summary: current,
    previous,
    comparison: comparison(current, previous),
    daily: [...daily.values()],
    byMethod,
    byBranch,
    stock: { inventoryValue, lowStock, movementCount: stockMovements.length, movementValue: stockMovementValue },
    pending: {
      collections: collections.map((collection) => ({
        id: collection.id, orderId: collection.orderId, orderNumber: collection.order.orderNumber,
        customerName: collection.order.customerName, branchId: collection.branchId,
        branchName: branchNames.get(collection.branchId) || 'Sem unidade', courierUserId: collection.courierUserId,
        state: collection.state, expectedAmount: collection.expectedAmount, actualAmount: collection.actualAmount,
        discrepancyAmount: collection.discrepancyAmount, exceptionReason: collection.exceptionReason,
        deliveryState: collection.delivery.state, updatedAt: collection.updatedAt,
      })),
      openCashSessions,
      cashDifferences: sessions.filter((session) => session.status === 'closed' && Math.abs(Number(session.differenceAmount || 0)) >= 0.01),
    },
  };
}

module.exports = { getFoodOperationalReport, percentageChange, resolvePeriod, summarizePeriod };
