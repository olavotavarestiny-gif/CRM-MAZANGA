const prisma = require('../../lib/prisma');
const {
  resolveDateRange,
  serializeRange,
  calculateAverage,
  calculateGrowth,
  calculatePercentage,
  roundCurrency,
  limitTop,
  parseInvoiceLines,
  getInvoiceLineBase,
  assertWorkspaceMode,
  getOrganizationMembers,
  resolveRequestedUserIds,
  buildTimeSeries,
} = require('./reports-common.service');

function buildInvoiceWhere(organizationId, dateRange, estabelecimentoId) {
  return {
    userId: organizationId,
    documentStatus: 'N',
    documentDate: { gte: dateRange.start, lte: dateRange.end },
    ...(estabelecimentoId ? { estabelecimentoId } : {}),
  };
}

function summarizeInvoices(facturas) {
  const total = facturas.reduce((sum, factura) => sum + Number(factura.grossTotal || 0), 0);
  return {
    total: roundCurrency(total),
    count: facturas.length,
    ticketAverage: roundCurrency(calculateAverage(total, facturas.length)),
  };
}

function buildProductAggregates(facturas, productLookup = new Map()) {
  const productMap = new Map();

  for (const factura of facturas) {
    const lines = parseInvoiceLines(factura.lines);

    for (const line of lines) {
      const productCode = line.productCode || 'SEM-CODIGO';
      const quantity = Number(line.quantity || 0);
      const revenue = getInvoiceLineBase(line);
      const product = productLookup.get(productCode);
      const estimatedCost = product?.cost != null ? quantity * Number(product.cost || 0) : null;

      if (!productMap.has(productCode)) {
        productMap.set(productCode, {
          productCode,
          productId: product?.id || null,
          productDescription: line.productDescription || product?.productDescription || productCode,
          quantityTotal: 0,
          revenueTotal: 0,
          estimatedCostTotal: 0,
          costCoverageCount: 0,
          stock: product?.stock ?? null,
          stockMinimo: product?.stockMinimo ?? null,
        });
      }

      const entry = productMap.get(productCode);
      entry.quantityTotal += quantity;
      entry.revenueTotal += revenue;
      if (estimatedCost !== null) {
        entry.estimatedCostTotal += estimatedCost;
        entry.costCoverageCount += 1;
      }
    }
  }

  return Array.from(productMap.values()).map((entry) => {
    const estimatedMargin = entry.costCoverageCount > 0
      ? roundCurrency(entry.revenueTotal - entry.estimatedCostTotal)
      : null;
    const marginPercent = entry.costCoverageCount > 0 && entry.revenueTotal > 0
      ? Number((((entry.revenueTotal - entry.estimatedCostTotal) / entry.revenueTotal) * 100).toFixed(1))
      : null;
    const turnoverRatio = entry.stock != null
      ? Number((entry.quantityTotal / Math.max((entry.stock || 0) + entry.quantityTotal, 1)).toFixed(2))
      : null;

    return {
      productId: entry.productId,
      productCode: entry.productCode,
      productDescription: entry.productDescription,
      quantityTotal: Number(entry.quantityTotal),
      revenueTotal: roundCurrency(entry.revenueTotal),
      estimatedMargin,
      marginPercent,
      turnoverRatio,
      stock: entry.stock,
      stockMinimo: entry.stockMinimo,
    };
  });
}

function buildClientAggregates(facturas) {
  const clientMap = new Map();

  for (const factura of facturas) {
    const key = `${factura.customerTaxID || 'SEM-NIF'}::${factura.customerName || 'Consumidor Final'}`;
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        customerTaxID: factura.customerTaxID || null,
        customerName: factura.customerName || 'Consumidor Final',
        count: 0,
        total: 0,
      });
    }

    const entry = clientMap.get(key);
    entry.count += 1;
    entry.total += Number(factura.grossTotal || 0);
  }

  return Array.from(clientMap.values()).map((entry) => ({
    ...entry,
    total: roundCurrency(entry.total),
    averageTicket: roundCurrency(calculateAverage(entry.total, entry.count)),
  }));
}

async function getCommercialAdvancedOverview({ organizationId, period, startDate, endDate, estabelecimentoId }) {
  await assertWorkspaceMode(organizationId, 'comercio');
  const range = resolveDateRange({ period, startDate, endDate });

  const [currentInvoices, previousInvoices, products, establishments] = await Promise.all([
    prisma.factura.findMany({
      where: buildInvoiceWhere(organizationId, range.current, estabelecimentoId),
      select: {
        id: true,
        lines: true,
        grossTotal: true,
        paymentMethod: true,
        estabelecimentoId: true,
        customerName: true,
        customerTaxID: true,
      },
    }),
    prisma.factura.findMany({
      where: buildInvoiceWhere(organizationId, range.previous, estabelecimentoId),
      select: {
        grossTotal: true,
      },
    }),
    prisma.produto.findMany({
      where: { userId: organizationId, active: true },
      select: {
        id: true,
        productCode: true,
        productDescription: true,
        cost: true,
        stock: true,
        stockMinimo: true,
      },
    }),
    prisma.estabelecimento.findMany({
      where: { userId: organizationId },
      select: { id: true, nome: true },
    }),
  ]);

  const currentSummary = summarizeInvoices(currentInvoices);
  const previousSummary = summarizeInvoices(previousInvoices);
  const productLookup = new Map(products.map((product) => [product.productCode, product]));
  const productAggregates = buildProductAggregates(currentInvoices, productLookup);
  const paymentMethods = Array.from(
    currentInvoices.reduce((map, invoice) => {
      const key = invoice.paymentMethod || 'OUTRO';
      if (!map.has(key)) {
        map.set(key, { method: key, total: 0, count: 0 });
      }
      const entry = map.get(key);
      entry.total += Number(invoice.grossTotal || 0);
      entry.count += 1;
      return map;
    }, new Map()).values()
  )
    .map((entry) => ({ ...entry, total: roundCurrency(entry.total) }))
    .sort((a, b) => b.total - a.total);

  const totalsByEstablishment = Array.from(
    currentInvoices.reduce((map, invoice) => {
      const key = invoice.estabelecimentoId || 'sem-estabelecimento';
      if (!map.has(key)) {
        map.set(key, { estabelecimentoId: key, total: 0, count: 0 });
      }
      const entry = map.get(key);
      entry.total += Number(invoice.grossTotal || 0);
      entry.count += 1;
      return map;
    }, new Map()).values()
  ).map((entry) => ({
    ...entry,
    nome: establishments.find((item) => item.id === entry.estabelecimentoId)?.nome || entry.estabelecimentoId,
    total: roundCurrency(entry.total),
    ticketAverage: roundCurrency(calculateAverage(entry.total, entry.count)),
  })).sort((a, b) => b.total - a.total);

  return {
    range: serializeRange(range),
    summary: {
      totalSales: currentSummary.total,
      previousTotalSales: previousSummary.total,
      growthPercent: calculateGrowth(currentSummary.total, previousSummary.total),
      invoiceCount: currentSummary.count,
      previousInvoiceCount: previousSummary.count,
      ticketAverage: currentSummary.ticketAverage,
      previousTicketAverage: previousSummary.ticketAverage,
      criticalStockCount: products.filter((product) => (product.stock ?? 0) <= (product.stockMinimo ?? 0)).length,
    },
    paymentMethods,
    establishments: totalsByEstablishment,
    topProducts: limitTop(
      [...productAggregates].sort((a, b) => b.quantityTotal - a.quantityTotal),
      5
    ),
    topClients: limitTop(
      buildClientAggregates(currentInvoices).sort((a, b) => b.total - a.total),
      5
    ),
    criticalProducts: limitTop(
      products
        .filter((product) => (product.stock ?? 0) <= (product.stockMinimo ?? 0))
        .map((product) => ({
          productId: product.id,
          productCode: product.productCode,
          productDescription: product.productDescription,
          stock: product.stock ?? 0,
          stockMinimo: product.stockMinimo ?? 0,
        })),
      5
    ),
  };
}

async function getCommercialAdvancedSales({ organizationId, period, startDate, endDate, estabelecimentoId }) {
  await assertWorkspaceMode(organizationId, 'comercio');
  const range = resolveDateRange({ period, startDate, endDate });

  const [currentInvoices, previousInvoices] = await Promise.all([
    prisma.factura.findMany({
      where: buildInvoiceWhere(organizationId, range.current, estabelecimentoId),
      select: {
        id: true,
        grossTotal: true,
        documentDate: true,
      },
    }),
    prisma.factura.findMany({
      where: buildInvoiceWhere(organizationId, range.previous, estabelecimentoId),
      select: {
        grossTotal: true,
        documentDate: true,
      },
    }),
  ]);

  const currentSummary = summarizeInvoices(currentInvoices);
  const previousSummary = summarizeInvoices(previousInvoices);
  const series = buildTimeSeries(currentInvoices, {
    range,
    dateAccessor: (invoice) => invoice.documentDate,
    valueAccessor: (invoice) => invoice.grossTotal,
    countAccessor: () => 1,
  });

  const trendGrowthPercent = series.length >= 2
    ? calculateGrowth(series[series.length - 1].total, series[0].total)
    : null;

  return {
    range: serializeRange(range),
    summary: {
      totalSales: currentSummary.total,
      previousTotalSales: previousSummary.total,
      growthPercent: calculateGrowth(currentSummary.total, previousSummary.total),
      documentCount: currentSummary.count,
      previousDocumentCount: previousSummary.count,
      ticketAverage: currentSummary.ticketAverage,
      previousTicketAverage: previousSummary.ticketAverage,
      trendGrowthPercent,
    },
    series,
  };
}

async function getCommercialAdvancedProducts({ organizationId, period, startDate, endDate, estabelecimentoId }) {
  await assertWorkspaceMode(organizationId, 'comercio');
  const range = resolveDateRange({ period, startDate, endDate });

  const [currentInvoices, products] = await Promise.all([
    prisma.factura.findMany({
      where: buildInvoiceWhere(organizationId, range.current, estabelecimentoId),
      select: {
        lines: true,
      },
    }),
    prisma.produto.findMany({
      where: { userId: organizationId, active: true },
      select: {
        id: true,
        productCode: true,
        productDescription: true,
        cost: true,
        stock: true,
        stockMinimo: true,
      },
    }),
  ]);

  const productLookup = new Map(products.map((product) => [product.productCode, product]));
  const aggregates = buildProductAggregates(currentInvoices, productLookup);
  const soldCodes = new Set(aggregates.map((item) => item.productCode));
  const criticalProducts = products
    .filter((product) => (product.stock ?? 0) <= (product.stockMinimo ?? 0))
    .map((product) => ({
      productId: product.id,
      productCode: product.productCode,
      productDescription: product.productDescription,
      stock: product.stock ?? 0,
      stockMinimo: product.stockMinimo ?? 0,
    }));
  const unsoldProducts = products
    .filter((product) => !soldCodes.has(product.productCode))
    .map((product) => ({
      productId: product.id,
      productCode: product.productCode,
      productDescription: product.productDescription,
      stock: product.stock ?? 0,
      stockMinimo: product.stockMinimo ?? 0,
    }));

  return {
    range: serializeRange(range),
    summary: {
      totalProducts: products.length,
      soldProducts: aggregates.length,
      unsoldProducts: unsoldProducts.length,
      criticalStockCount: criticalProducts.length,
    },
    topSold: limitTop([...aggregates].sort((a, b) => b.quantityTotal - a.quantityTotal), 10),
    leastSold: limitTop([...aggregates].filter((item) => item.quantityTotal > 0).sort((a, b) => a.quantityTotal - b.quantityTotal), 10),
    topRevenue: limitTop([...aggregates].sort((a, b) => b.revenueTotal - a.revenueTotal), 10),
    lowMovement: limitTop([...aggregates].sort((a, b) => (a.turnoverRatio ?? 999) - (b.turnoverRatio ?? 999)), 10),
    criticalProducts: limitTop(criticalProducts, 10),
    unsoldProducts: limitTop(unsoldProducts, 10),
  };
}

async function getCommercialAdvancedLocations({ organizationId, period, startDate, endDate }) {
  await assertWorkspaceMode(organizationId, 'comercio');
  const range = resolveDateRange({ period, startDate, endDate });

  const [currentInvoices, previousInvoices, establishments, sessions] = await Promise.all([
    prisma.factura.findMany({
      where: buildInvoiceWhere(organizationId, range.current),
      select: {
        grossTotal: true,
        estabelecimentoId: true,
      },
    }),
    prisma.factura.findMany({
      where: buildInvoiceWhere(organizationId, range.previous),
      select: {
        grossTotal: true,
        estabelecimentoId: true,
      },
    }),
    prisma.estabelecimento.findMany({
      where: { userId: organizationId },
      select: { id: true, nome: true },
    }),
    prisma.caixaSessao.findMany({
      where: {
        userId: organizationId,
        openedAt: { gte: range.current.start, lte: range.current.end },
      },
      select: {
        estabelecimentoId: true,
        totalCash: true,
      },
    }),
  ]);

  const currentMap = new Map();
  const previousMap = new Map();
  const cashMap = new Map();

  for (const invoice of currentInvoices) {
    if (!currentMap.has(invoice.estabelecimentoId)) {
      currentMap.set(invoice.estabelecimentoId, { total: 0, count: 0 });
    }
    const entry = currentMap.get(invoice.estabelecimentoId);
    entry.total += Number(invoice.grossTotal || 0);
    entry.count += 1;
  }

  for (const invoice of previousInvoices) {
    if (!previousMap.has(invoice.estabelecimentoId)) {
      previousMap.set(invoice.estabelecimentoId, { total: 0, count: 0 });
    }
    const entry = previousMap.get(invoice.estabelecimentoId);
    entry.total += Number(invoice.grossTotal || 0);
    entry.count += 1;
  }

  for (const session of sessions) {
    cashMap.set(session.estabelecimentoId, (cashMap.get(session.estabelecimentoId) || 0) + Number(session.totalCash || 0));
  }

  const locations = establishments.map((establishment) => {
    const current = currentMap.get(establishment.id) || { total: 0, count: 0 };
    const previous = previousMap.get(establishment.id) || { total: 0, count: 0 };
    return {
      id: establishment.id,
      nome: establishment.nome,
      totalSales: roundCurrency(current.total),
      previousTotalSales: roundCurrency(previous.total),
      growthPercent: calculateGrowth(current.total, previous.total),
      salesCount: current.count,
      previousSalesCount: previous.count,
      ticketAverage: roundCurrency(calculateAverage(current.total, current.count)),
      totalCashInSessions: roundCurrency(cashMap.get(establishment.id) || 0),
    };
  }).sort((a, b) => b.totalSales - a.totalSales);

  return {
    range: serializeRange(range),
    summary: {
      locations: locations.length,
      bestLocation: locations[0] || null,
      totalCashInSessions: roundCurrency(locations.reduce((sum, item) => sum + item.totalCashInSessions, 0)),
    },
    locations,
  };
}

async function getCommercialAdvancedTeam({ organizationId, period, startDate, endDate, estabelecimentoId, userId }) {
  await assertWorkspaceMode(organizationId, 'comercio');
  const range = resolveDateRange({ period, startDate, endDate });
  const members = await getOrganizationMembers(organizationId);
  const requestedUserIds = resolveRequestedUserIds(members, userId);
  const scopedMemberIds = requestedUserIds || members.map((member) => member.id);

  const [createdInvoiceLogs, invoices, openedSessions, closedSessions] = await Promise.all([
    prisma.activityLog.findMany({
      where: {
        organization_id: organizationId,
        entity_type: 'invoice',
        action: 'created',
        user_id: { in: scopedMemberIds },
        created_at: { gte: range.current.start, lte: range.current.end },
      },
      select: {
        entity_id: true,
        user_id: true,
      },
    }),
    prisma.factura.findMany({
      where: buildInvoiceWhere(organizationId, range.current, estabelecimentoId),
      select: {
        id: true,
        grossTotal: true,
      },
    }),
    prisma.caixaSessao.findMany({
      where: {
        userId: organizationId,
        openedByUserId: { in: scopedMemberIds },
        ...(estabelecimentoId ? { estabelecimentoId } : {}),
        openedAt: { gte: range.current.start, lte: range.current.end },
      },
      select: {
        openedByUserId: true,
      },
    }),
    prisma.caixaSessao.findMany({
      where: {
        userId: organizationId,
        closedByUserId: { in: scopedMemberIds },
        ...(estabelecimentoId ? { estabelecimentoId } : {}),
        closedAt: { gte: range.current.start, lte: range.current.end },
      },
      select: {
        closedByUserId: true,
      },
    }),
  ]);

  const invoiceValueMap = new Map(invoices.map((invoice) => [invoice.id, Number(invoice.grossTotal || 0)]));
  const salesCountMap = new Map();
  const salesTotalMap = new Map();
  const openedMap = new Map();
  const closedMap = new Map();

  for (const log of createdInvoiceLogs) {
    salesCountMap.set(log.user_id, (salesCountMap.get(log.user_id) || 0) + 1);
    salesTotalMap.set(log.user_id, (salesTotalMap.get(log.user_id) || 0) + (invoiceValueMap.get(log.entity_id) || 0));
  }

  for (const session of openedSessions) {
    openedMap.set(session.openedByUserId, (openedMap.get(session.openedByUserId) || 0) + 1);
  }

  for (const session of closedSessions) {
    closedMap.set(session.closedByUserId, (closedMap.get(session.closedByUserId) || 0) + 1);
  }

  const data = members
    .filter((member) => scopedMemberIds.includes(member.id))
    .map((member) => ({
      userId: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      salesCount: salesCountMap.get(member.id) || 0,
      totalSold: roundCurrency(salesTotalMap.get(member.id) || 0),
      sessionsOpened: openedMap.get(member.id) || 0,
      sessionsClosed: closedMap.get(member.id) || 0,
    }));

  return {
    range: serializeRange(range),
    summary: {
      members: data.length,
      totalSalesCount: data.reduce((sum, item) => sum + item.salesCount, 0),
      totalSold: roundCurrency(data.reduce((sum, item) => sum + item.totalSold, 0)),
      sessionsOpened: data.reduce((sum, item) => sum + item.sessionsOpened, 0),
      sessionsClosed: data.reduce((sum, item) => sum + item.sessionsClosed, 0),
      attributionNote: 'A atribuição de vendas por utilizador usa os eventos reais de criação de fatura e as sessões de caixa existentes.',
    },
    members: data,
  };
}

module.exports = {
  getCommercialAdvancedOverview,
  getCommercialAdvancedSales,
  getCommercialAdvancedProducts,
  getCommercialAdvancedLocations,
  getCommercialAdvancedTeam,
};
