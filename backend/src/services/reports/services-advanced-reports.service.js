const prisma = require('../../lib/prisma');
const { getPipelineStages } = require('../../lib/pipeline-stages');
const {
  WON_STAGE,
  LOST_STAGE,
  resolveDateRange,
  serializeRange,
  calculateAverage,
  calculateGrowth,
  calculatePercentage,
  roundCurrency,
  limitTop,
  estimateContactValue,
  getReceivablesSummary,
  summarizeComparison,
  assertWorkspaceMode,
  getOrganizationMembers,
  resolveRequestedUserIds,
} = require('./reports-common.service');

function createClientKey(contactId, clientName) {
  if (contactId) return `contact:${contactId}`;
  if (clientName) return `name:${clientName}`;
  return 'unknown';
}

function summarizeClientsByTransactions(transactions) {
  const map = new Map();

  for (const transaction of transactions) {
    const key = createClientKey(transaction.clientId, transaction.clientName);
    if (!map.has(key)) {
      map.set(key, {
        key,
        clientId: transaction.clientId || null,
        clientName: transaction.clientName || 'Sem cliente',
        revenue: 0,
        costs: 0,
      });
    }

    const entry = map.get(key);
    if (transaction.type === 'entrada') entry.revenue += Number(transaction.amountKz || 0);
    if (transaction.type === 'saida') entry.costs += Number(transaction.amountKz || 0);
  }

  return Array.from(map.values()).map((entry) => {
    const netMargin = entry.revenue - entry.costs;
    return {
      clientId: entry.clientId,
      clientName: entry.clientName,
      revenue: roundCurrency(entry.revenue),
      costs: roundCurrency(entry.costs),
      netMargin: roundCurrency(netMargin),
      marginPercent: entry.revenue > 0 ? Number(((netMargin / entry.revenue) * 100).toFixed(1)) : null,
    };
  });
}

function buildStageMetrics(contacts, stages) {
  const stageOrder = new Map(stages.map((stage, index) => [stage.name, index]));
  const totalContacts = contacts.length;
  const totalValue = contacts.reduce((sum, contact) => sum + estimateContactValue(contact), 0);

  const byStage = stages.map((stage, index) => {
    const currentContacts = contacts.filter((contact) => contact.stage === stage.name);
    const reachedCount = contacts.filter((contact) => {
      if (stage.name === WON_STAGE) return contact.stage === WON_STAGE;
      if (stage.name === LOST_STAGE) return contact.stage === LOST_STAGE;
      const currentIndex = stageOrder.get(contact.stage);
      if (currentIndex === undefined) return false;
      return currentIndex >= index;
    }).length;
    const wonAfterReaching = contacts.filter((contact) => {
      if (contact.stage !== WON_STAGE) return false;
      if (stage.name === WON_STAGE) return true;
      const wonIndex = stageOrder.get(contact.stage);
      return wonIndex !== undefined && wonIndex >= index;
    }).length;

    const currentValue = currentContacts.reduce((sum, contact) => sum + estimateContactValue(contact), 0);

    return {
      stage: stage.name,
      color: stage.color,
      count: currentContacts.length,
      value: roundCurrency(currentValue),
      reachedCount,
      advancementRate: calculatePercentage(reachedCount, totalContacts),
      stageConversionRate: stage.name === LOST_STAGE
        ? 0
        : calculatePercentage(wonAfterReaching, reachedCount),
    };
  });

  return {
    totalContacts,
    totalValue: roundCurrency(totalValue),
    byStage,
  };
}

async function getServicesAdvancedOverview({ organizationId, period, startDate, endDate }) {
  await assertWorkspaceMode(organizationId, 'servicos');
  const range = resolveDateRange({ period, startDate, endDate });

  const [totalContacts, contactsAddedCurrent, contactsAddedPrevious, pipelineContacts, receivedCurrentAgg, receivedPreviousAgg, currentInvoices, previousInvoices, receivablesSummary, revenueTransactionsCurrent, wonDealsCurrent, lostDealsCurrent] = await Promise.all([
    prisma.contact.count({
      where: { userId: organizationId },
    }),
    prisma.contact.count({
      where: {
        userId: organizationId,
        createdAt: { gte: range.current.start, lte: range.current.end },
      },
    }),
    prisma.contact.count({
      where: {
        userId: organizationId,
        createdAt: { gte: range.previous.start, lte: range.previous.end },
      },
    }),
    prisma.contact.findMany({
      where: {
        userId: organizationId,
        inPipeline: true,
        stage: { notIn: [WON_STAGE, LOST_STAGE] },
      },
      select: {
        id: true,
        dealValueKz: true,
        revenue: true,
        stage: true,
      },
    }),
    prisma.transaction.aggregate({
      where: {
        userId: organizationId,
        deleted: false,
        status: 'pago',
        type: 'entrada',
        date: { gte: range.current.start, lte: range.current.end },
      },
      _sum: { amountKz: true },
    }),
    prisma.transaction.aggregate({
      where: {
        userId: organizationId,
        deleted: false,
        status: 'pago',
        type: 'entrada',
        date: { gte: range.previous.start, lte: range.previous.end },
      },
      _sum: { amountKz: true },
    }),
    prisma.factura.findMany({
      where: {
        userId: organizationId,
        documentStatus: 'N',
        documentDate: { gte: range.current.start, lte: range.current.end },
      },
      select: {
        id: true,
        documentNo: true,
        documentType: true,
        paymentMethod: true,
        grossTotal: true,
      },
    }),
    prisma.factura.findMany({
      where: {
        userId: organizationId,
        documentStatus: 'N',
        documentDate: { gte: range.previous.start, lte: range.previous.end },
      },
      select: {
        grossTotal: true,
      },
    }),
    getReceivablesSummary(organizationId, range.current),
    prisma.transaction.findMany({
      where: {
        userId: organizationId,
        deleted: false,
        status: 'pago',
        type: 'entrada',
        date: { gte: range.current.start, lte: range.current.end },
      },
      select: {
        clientId: true,
        clientName: true,
        amountKz: true,
      },
    }),
    prisma.activityLog.count({
      where: {
        organization_id: organizationId,
        entity_type: 'contact',
        action: 'stage_changed',
        field_changed: 'stage',
        new_value: WON_STAGE,
        created_at: { gte: range.current.start, lte: range.current.end },
      },
    }),
    prisma.activityLog.count({
      where: {
        organization_id: organizationId,
        entity_type: 'contact',
        action: 'stage_changed',
        field_changed: 'stage',
        new_value: LOST_STAGE,
        created_at: { gte: range.current.start, lte: range.current.end },
      },
    }),
  ]);

  const receivedCurrent = Number(receivedCurrentAgg._sum.amountKz || 0);
  const receivedPrevious = Number(receivedPreviousAgg._sum.amountKz || 0);
  const issuedCurrent = currentInvoices.reduce((sum, invoice) => sum + Number(invoice.grossTotal || 0), 0);
  const issuedPrevious = previousInvoices.reduce((sum, invoice) => sum + Number(invoice.grossTotal || 0), 0);
  const negotiationValue = pipelineContacts.reduce((sum, contact) => sum + estimateContactValue(contact), 0);
  const topClients = limitTop(
    summarizeClientsByTransactions(revenueTransactionsCurrent)
      .sort((a, b) => b.revenue - a.revenue)
      .map((entry) => ({
        clientId: entry.clientId,
        clientName: entry.clientName,
        revenue: entry.revenue,
      })),
    5
  );

  return {
    range: serializeRange(range),
    totals: {
      totalContacts,
      contactsAdded: contactsAddedCurrent,
      contactsAddedPrevious,
      contactsAddedGrowthPercent: calculateGrowth(contactsAddedCurrent, contactsAddedPrevious),
      activePipelineContacts: pipelineContacts.length,
      wonDeals: wonDealsCurrent,
      lostDeals: lostDealsCurrent,
      negotiationValue: roundCurrency(negotiationValue),
      invoicesIssued: currentInvoices.length,
      receivablesCount: receivablesSummary.count,
      receivablesTotal: receivablesSummary.total,
    },
    revenue: {
      received: summarizeComparison(receivedCurrent, receivedPrevious),
      issued: summarizeComparison(issuedCurrent, issuedPrevious),
    },
    topClients,
  };
}

async function getServicesAdvancedPipeline({ organizationId, period, startDate, endDate }) {
  await assertWorkspaceMode(organizationId, 'servicos');
  const range = resolveDateRange({ period, startDate, endDate });
  const stages = await getPipelineStages(organizationId);

  const [currentContacts, previousContacts, currentWonLogs, previousWonLogs] = await Promise.all([
    prisma.contact.findMany({
      where: {
        userId: organizationId,
        createdAt: { gte: range.current.start, lte: range.current.end },
      },
      select: {
        id: true,
        stage: true,
        inPipeline: true,
        dealValueKz: true,
        revenue: true,
        createdAt: true,
      },
    }),
    prisma.contact.findMany({
      where: {
        userId: organizationId,
        createdAt: { gte: range.previous.start, lte: range.previous.end },
      },
      select: {
        id: true,
        stage: true,
        inPipeline: true,
        dealValueKz: true,
        revenue: true,
        createdAt: true,
      },
    }),
    prisma.activityLog.findMany({
      where: {
        organization_id: organizationId,
        entity_type: 'contact',
        action: 'stage_changed',
        field_changed: 'stage',
        new_value: WON_STAGE,
        created_at: { gte: range.current.start, lte: range.current.end },
      },
      select: {
        entity_id: true,
        created_at: true,
      },
    }),
    prisma.activityLog.findMany({
      where: {
        organization_id: organizationId,
        entity_type: 'contact',
        action: 'stage_changed',
        field_changed: 'stage',
        new_value: WON_STAGE,
        created_at: { gte: range.previous.start, lte: range.previous.end },
      },
      select: {
        entity_id: true,
        created_at: true,
      },
    }),
  ]);

  const currentMetrics = buildStageMetrics(currentContacts, stages);
  const previousMetrics = buildStageMetrics(previousContacts, stages);
  const currentStageMap = new Map(currentMetrics.byStage.map((stage) => [stage.stage, stage]));
  const previousStageMap = new Map(previousMetrics.byStage.map((stage) => [stage.stage, stage]));
  const createdAtMap = new Map([
    ...currentContacts.map((contact) => [String(contact.id), contact.createdAt]),
    ...previousContacts.map((contact) => [String(contact.id), contact.createdAt]),
  ]);

  const currentAverageCloseDays = calculateAverage(
    currentWonLogs.reduce((sum, log) => {
      const createdAt = createdAtMap.get(String(log.entity_id));
      if (!createdAt) return sum;
      return sum + ((new Date(log.created_at).getTime() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
    }, 0),
    currentWonLogs.filter((log) => createdAtMap.has(String(log.entity_id))).length
  );

  const previousAverageCloseDays = calculateAverage(
    previousWonLogs.reduce((sum, log) => {
      const createdAt = createdAtMap.get(String(log.entity_id));
      if (!createdAt) return sum;
      return sum + ((new Date(log.created_at).getTime() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
    }, 0),
    previousWonLogs.filter((log) => createdAtMap.has(String(log.entity_id))).length
  );

  const stageComparisons = currentMetrics.byStage.map((stage) => {
    const previous = previousStageMap.get(stage.stage);
    return {
      stage: stage.stage,
      color: stage.color,
      count: stage.count,
      previousCount: previous?.count || 0,
      deltaCount: stage.count - (previous?.count || 0),
      value: stage.value,
      previousValue: previous?.value || 0,
      deltaValue: roundCurrency(stage.value - (previous?.value || 0)),
      reachedCount: stage.reachedCount,
      advancementRate: stage.advancementRate,
      stageConversionRate: stage.stageConversionRate,
    };
  });

  const bottleneckStage = stageComparisons
    .filter((stage) => stage.stage !== WON_STAGE && stage.stage !== LOST_STAGE && stage.advancementRate !== null)
    .sort((a, b) => (a.stageConversionRate ?? 999) - (b.stageConversionRate ?? 999))[0] || null;

  return {
    range: serializeRange(range),
    summary: {
      totalContacts: currentMetrics.totalContacts,
      previousTotalContacts: previousMetrics.totalContacts,
      totalValue: currentMetrics.totalValue,
      previousTotalValue: previousMetrics.totalValue,
      totalConversionRate: calculatePercentage(
        currentStageMap.get(WON_STAGE)?.count || 0,
        currentMetrics.totalContacts
      ),
      previousConversionRate: calculatePercentage(
        previousStageMap.get(WON_STAGE)?.count || 0,
        previousMetrics.totalContacts
      ),
      wonDeals: currentStageMap.get(WON_STAGE)?.count || 0,
      lostDeals: currentStageMap.get(LOST_STAGE)?.count || 0,
      averageCloseDays: roundCurrency(currentAverageCloseDays),
      previousAverageCloseDays: roundCurrency(previousAverageCloseDays),
      bottleneckStage: bottleneckStage
        ? {
            stage: bottleneckStage.stage,
            conversionRate: bottleneckStage.stageConversionRate,
            advancementRate: bottleneckStage.advancementRate,
          }
        : null,
    },
    byStage: stageComparisons,
    stageTime: {
      available: false,
      reason: 'O tempo por etapa ainda não é confiável com os dados actuais, porque o sistema não guarda histórico detalhado de permanência em cada etapa.',
    },
  };
}

function calculateRecurringGrossTotal(recorrente) {
  let total = 0;
  const lines = Array.isArray(recorrente.lines) ? recorrente.lines : [];

  for (const line of lines) {
    total += estimateLineGross(line);
  }

  if (!recorrente.currencyCode || recorrente.currencyCode === 'AOA') {
    return total;
  }

  return total * Number(recorrente.exchangeRate || 1);
}

function estimateLineGross(line) {
  const base = Number(line?.quantity || 0) * Number(line?.unitPrice || 0);
  const taxes = Array.isArray(line?.taxes) ? line.taxes : [];
  const taxAmount = taxes.reduce((sum, tax) => {
    if (typeof tax?.taxAmount === 'number') {
      return sum + Number(tax.taxAmount || 0);
    }
    return sum + ((base * Number(tax?.taxPercentage || 0)) / 100);
  }, 0);
  return base + taxAmount;
}

function monthlyizeRecurringRevenue(recorrente) {
  const grossTotalKz = calculateRecurringGrossTotal(recorrente);
  switch (recorrente.frequency) {
    case 'WEEKLY':
      return (grossTotalKz * 52) / 12;
    case 'QUARTERLY':
      return grossTotalKz / 3;
    case 'ANNUAL':
      return grossTotalKz / 12;
    case 'MONTHLY':
    default:
      return grossTotalKz;
  }
}

async function getServicesAdvancedRevenue({ organizationId, period, startDate, endDate }) {
  await assertWorkspaceMode(organizationId, 'servicos');
  const range = resolveDateRange({ period, startDate, endDate });

  const [transactionsCurrent, transactionsPrevious, invoicesCurrent, invoicesPrevious, recurringInvoices, receivablesSummary] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId: organizationId,
        deleted: false,
        status: 'pago',
        date: { gte: range.current.start, lte: range.current.end },
      },
      select: {
        id: true,
        type: true,
        revenueType: true,
        clientId: true,
        clientName: true,
        amountKz: true,
      },
    }),
    prisma.transaction.findMany({
      where: {
        userId: organizationId,
        deleted: false,
        status: 'pago',
        date: { gte: range.previous.start, lte: range.previous.end },
      },
      select: {
        type: true,
        amountKz: true,
      },
    }),
    prisma.factura.findMany({
      where: {
        userId: organizationId,
        documentStatus: 'N',
        documentDate: { gte: range.current.start, lte: range.current.end },
      },
      select: {
        id: true,
        customerName: true,
        customerTaxID: true,
        grossTotal: true,
      },
    }),
    prisma.factura.findMany({
      where: {
        userId: organizationId,
        documentStatus: 'N',
        documentDate: { gte: range.previous.start, lte: range.previous.end },
      },
      select: {
        grossTotal: true,
      },
    }),
    prisma.facturaRecorrente.findMany({
      where: {
        userId: organizationId,
        isActive: true,
        startDate: { lte: range.current.end },
      },
      select: {
        lines: true,
        currencyCode: true,
        exchangeRate: true,
        frequency: true,
      },
    }),
    getReceivablesSummary(organizationId, range.current),
  ]);

  const receivedCurrent = transactionsCurrent
    .filter((transaction) => transaction.type === 'entrada')
    .reduce((sum, transaction) => sum + Number(transaction.amountKz || 0), 0);
  const receivedPrevious = transactionsPrevious
    .filter((transaction) => transaction.type === 'entrada')
    .reduce((sum, transaction) => sum + Number(transaction.amountKz || 0), 0);
  const issuedCurrent = invoicesCurrent.reduce((sum, invoice) => sum + Number(invoice.grossTotal || 0), 0);
  const issuedPrevious = invoicesPrevious.reduce((sum, invoice) => sum + Number(invoice.grossTotal || 0), 0);
  const recurringMonthlyRevenue = recurringInvoices.reduce((sum, recorrente) => (
    sum + monthlyizeRecurringRevenue({ ...recorrente, lines: Array.isArray(recorrente.lines) ? recorrente.lines : safeJson(recorrente.lines) })
  ), 0);

  const recurringReceived = transactionsCurrent
    .filter((transaction) => transaction.type === 'entrada' && transaction.revenueType === 'recorrente')
    .reduce((sum, transaction) => sum + Number(transaction.amountKz || 0), 0);
  const nonRecurringReceived = Math.max(receivedCurrent - recurringMonthlyRevenue, 0);
  const nonRecurringIssued = Math.max(issuedCurrent - recurringMonthlyRevenue, 0);

  const profitability = summarizeClientsByTransactions(transactionsCurrent)
    .filter((entry) => entry.revenue > 0 || entry.costs > 0);

  const topProfitableClients = limitTop(
    [...profitability].sort((a, b) => b.netMargin - a.netMargin),
    5
  );

  const totalReceivedRevenue = profitability.reduce((sum, entry) => sum + entry.revenue, 0);
  const topFiveRevenue = limitTop(
    [...profitability].sort((a, b) => b.revenue - a.revenue),
    5
  ).reduce((sum, entry) => sum + entry.revenue, 0);

  const uniqueInvoiceClients = new Set(
    invoicesCurrent.map((invoice) => `${invoice.customerTaxID || 'no-tax'}::${invoice.customerName}`)
  );

  return {
    range: serializeRange(range),
    summary: {
      received: summarizeComparison(receivedCurrent, receivedPrevious),
      issued: summarizeComparison(issuedCurrent, issuedPrevious),
      activeRecurringMonthlyRevenue: roundCurrency(recurringMonthlyRevenue),
      recurringReceivedRevenue: roundCurrency(recurringReceived),
      estimatedNonRecurringReceivedRevenue: roundCurrency(nonRecurringReceived),
      estimatedNonRecurringIssuedRevenue: roundCurrency(nonRecurringIssued),
      averageBillingPerClient: roundCurrency(calculateAverage(issuedCurrent, uniqueInvoiceClients.size)),
      invoicesIssued: invoicesCurrent.length,
      invoicesPaid: Math.max(invoicesCurrent.length - receivablesSummary.count, 0),
      receivablesCount: receivablesSummary.count,
      receivablesTotal: receivablesSummary.total,
      top5RevenueConcentrationPercent: calculatePercentage(topFiveRevenue, totalReceivedRevenue),
      classificationNote: 'A componente recorrente usa faturação recorrente activa mensalizada; a componente não recorrente é estimada pela diferença em relação ao recebido/emitido do período.',
    },
    topProfitableClients,
    topRevenueClients: limitTop(
      [...profitability].sort((a, b) => b.revenue - a.revenue),
      5
    ),
  };
}

function safeJson(value) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return [];
  }
}

async function getServicesAdvancedTeam({ organizationId, period, startDate, endDate, userId }) {
  await assertWorkspaceMode(organizationId, 'servicos');
  const range = resolveDateRange({ period, startDate, endDate });
  const members = await getOrganizationMembers(organizationId);
  const requestedUserIds = resolveRequestedUserIds(members, userId);
  const scopedMemberIds = requestedUserIds || members.map((member) => member.id);

  const [taskCompletionLogs, contactCreatedLogs, allActivityLogs, dealWonLogs, overdueTasks] = await Promise.all([
    prisma.activityLog.findMany({
      where: {
        organization_id: organizationId,
        entity_type: 'task',
        action: 'status_changed',
        field_changed: 'done',
        new_value: 'Concluída',
        user_id: { in: scopedMemberIds },
        created_at: { gte: range.current.start, lte: range.current.end },
      },
      select: { user_id: true },
    }),
    prisma.activityLog.findMany({
      where: {
        organization_id: organizationId,
        entity_type: 'contact',
        action: 'created',
        user_id: { in: scopedMemberIds },
        created_at: { gte: range.current.start, lte: range.current.end },
      },
      select: { user_id: true },
    }),
    prisma.activityLog.findMany({
      where: {
        organization_id: organizationId,
        user_id: { in: scopedMemberIds },
        created_at: { gte: range.current.start, lte: range.current.end },
      },
      select: { user_id: true },
    }),
    prisma.activityLog.findMany({
      where: {
        organization_id: organizationId,
        entity_type: 'contact',
        action: 'stage_changed',
        field_changed: 'stage',
        new_value: WON_STAGE,
        user_id: { in: scopedMemberIds },
        created_at: { gte: range.current.start, lte: range.current.end },
      },
      select: { user_id: true },
    }),
    prisma.task.findMany({
      where: {
        userId: organizationId,
        assignedToUserId: { in: scopedMemberIds },
        done: false,
        dueDate: { lt: new Date() },
      },
      select: { assignedToUserId: true },
    }),
  ]);

  const completionMap = new Map();
  const contactMap = new Map();
  const activityMap = new Map();
  const wonMap = new Map();
  const overdueMap = new Map();

  for (const log of taskCompletionLogs) completionMap.set(log.user_id, (completionMap.get(log.user_id) || 0) + 1);
  for (const log of contactCreatedLogs) contactMap.set(log.user_id, (contactMap.get(log.user_id) || 0) + 1);
  for (const log of allActivityLogs) activityMap.set(log.user_id, (activityMap.get(log.user_id) || 0) + 1);
  for (const log of dealWonLogs) wonMap.set(log.user_id, (wonMap.get(log.user_id) || 0) + 1);
  for (const task of overdueTasks) overdueMap.set(task.assignedToUserId, (overdueMap.get(task.assignedToUserId) || 0) + 1);

  const data = members
    .filter((member) => scopedMemberIds.includes(member.id))
    .map((member) => ({
      userId: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      tasksCompleted: completionMap.get(member.id) || 0,
      overdueTasks: overdueMap.get(member.id) || 0,
      contactsCreated: contactMap.get(member.id) || 0,
      activityCount: activityMap.get(member.id) || 0,
      closedDeals: wonMap.get(member.id) || 0,
    }));

  return {
    range: serializeRange(range),
    summary: {
      members: data.length,
      totalTaskCompletions: data.reduce((sum, item) => sum + item.tasksCompleted, 0),
      totalOverdueTasks: data.reduce((sum, item) => sum + item.overdueTasks, 0),
      totalContactsCreated: data.reduce((sum, item) => sum + item.contactsCreated, 0),
      totalActivityEvents: data.reduce((sum, item) => sum + item.activityCount, 0),
      totalClosedDeals: data.reduce((sum, item) => sum + item.closedDeals, 0),
      closedDealsAttribution: {
        available: true,
        reason: null,
      },
    },
    members: data,
  };
}

module.exports = {
  getServicesAdvancedOverview,
  getServicesAdvancedPipeline,
  getServicesAdvancedRevenue,
  getServicesAdvancedTeam,
};
