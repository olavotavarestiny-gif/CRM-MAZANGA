const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requirePermission, requireDeletePermission } = require('../lib/permissions');
const { getReconciliationReport, isInvoicePaid } = require('../services/reconciliation.service');

// ─── Helpers ────────────────────────────────────────────────────────────────

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function parseYearMonth(year, month) {
  const parsedYear = Number.parseInt(year, 10);
  const parsedMonth = Number.parseInt(month, 10);

  if (!Number.isInteger(parsedYear) || !Number.isInteger(parsedMonth)) return null;
  if (parsedMonth < 1 || parsedMonth > 12) return null;

  return new Date(Date.UTC(parsedYear, parsedMonth - 1, 1, 0, 0, 0, 0));
}

function parseDateBoundary(value, boundary) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return null;

  return boundary === 'start'
    ? new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    : new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

function formatKz(value) {
  return value ?? 0;
}

function getPreviousMonthDateRange(targetDate) {
  const previousMonth = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() - 1, 1, 0, 0, 0, 0));
  return {
    from: startOfMonth(previousMonth),
    to: endOfMonth(previousMonth),
  };
}

function parseReportDateRange(dateFrom, dateTo) {
  const start = parseDateBoundary(dateFrom, 'start');
  const end = parseDateBoundary(dateTo, 'end');

  return { start, end };
}

function parseRecurringLines(lines) {
  if (!lines) return [];

  try {
    const parsed = typeof lines === 'string' ? JSON.parse(lines) : lines;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function calculateRecurringGrossTotalKz(recorrente) {
  const grossTotal = parseRecurringLines(recorrente.lines).reduce((sum, line) => {
    const quantity = Number(line?.quantity || 0);
    const unitPrice = Number(line?.unitPrice || 0);
    const baseAmount = quantity * unitPrice;
    const taxes = Array.isArray(line?.taxes) ? line.taxes : [];
    const taxAmount = taxes.reduce((taxSum, tax) => {
      if (typeof tax?.taxAmount === 'number') {
        return taxSum + Number(tax.taxAmount || 0);
      }

      const percentage = Number(tax?.taxPercentage || 0);
      return taxSum + (baseAmount * percentage) / 100;
    }, 0);

    return sum + baseAmount + taxAmount;
  }, 0);

  if (!recorrente.currencyCode || recorrente.currencyCode === 'AOA') {
    return grossTotal;
  }

  return grossTotal * Number(recorrente.exchangeRate || 1);
}

function monthlyizeRecurringRevenue(recorrente) {
  const grossTotalKz = calculateRecurringGrossTotalKz(recorrente);

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

// ─── GET /api/finances/dashboard ────────────────────────────────────────────
router.get('/dashboard', requirePermission('finances', 'transactions_view'), async (req, res) => {
  try {
    const { year, month } = req.query;
    const now = new Date();
    const targetDate = parseYearMonth(year, month) || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const from = startOfMonth(targetDate);
    const to = endOfMonth(targetDate);
    const previousRange = getPreviousMonthDateRange(targetDate);

    const baseWhere = {
      userId: req.user.effectiveUserId,
      deleted: false,
      status: 'pago',
      date: { gte: from, lte: to },
    };
    const previousBaseWhere = {
      ...baseWhere,
      date: { gte: previousRange.from, lte: previousRange.to },
    };

    const [revenueAgg, expensesAgg, recurringInvoices, prevRevenueAgg, prevExpensesAgg, receivableInvoices] = await Promise.all([
      prisma.transaction.aggregate({
        where: { ...baseWhere, type: 'entrada' },
        _sum: { amountKz: true },
      }),
      prisma.transaction.aggregate({
        where: { ...baseWhere, type: 'saida' },
        _sum: { amountKz: true },
      }),
      prisma.facturaRecorrente.findMany({
        where: {
          userId: req.user.effectiveUserId,
          isActive: true,
          startDate: { lte: to },
        },
        select: {
          lines: true,
          currencyCode: true,
          exchangeRate: true,
          frequency: true,
        },
      }),
      prisma.transaction.aggregate({
        where: { ...previousBaseWhere, type: 'entrada' },
        _sum: { amountKz: true },
      }),
      prisma.transaction.aggregate({
        where: { ...previousBaseWhere, type: 'saida' },
        _sum: { amountKz: true },
      }),
      prisma.factura.findMany({
        where: {
          userId: req.user.effectiveUserId,
          documentStatus: 'N',
          documentDate: { gte: from, lte: to },
        },
        select: {
          id: true,
          documentNo: true,
          documentType: true,
          paymentMethod: true,
          grossTotal: true,
        },
      }),
    ]);

    const revenue = formatKz(revenueAgg._sum.amountKz);
    const expenses = formatKz(expensesAgg._sum.amountKz);
    const profit = revenue - expenses;
    const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;
    const receitaMensal = recurringInvoices.reduce((sum, recorrente) => sum + monthlyizeRecurringRevenue(recorrente), 0);
    const mrr = formatKz(receitaMensal);
    const prevRevenue = formatKz(prevRevenueAgg._sum.amountKz);
    const prevExpenses = formatKz(prevExpensesAgg._sum.amountKz);
    const prevProfit = prevRevenue - prevExpenses;

    const openReceivableInvoices = receivableInvoices.filter((invoice) => !isInvoicePaid(invoice));
    const receivableInvoiceIds = openReceivableInvoices.map((invoice) => invoice.id);
    const receivableDocumentNumbers = openReceivableInvoices.map((invoice) => invoice.documentNo);

    const linkedPaidTransactions = receivableInvoiceIds.length || receivableDocumentNumbers.length
      ? await prisma.transaction.findMany({
          where: {
            userId: req.user.effectiveUserId,
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

    const unpaidReceivables = openReceivableInvoices.filter((invoice) => (
      !paidByInvoiceId.has(invoice.id) && !paidByReceiptNumber.has(invoice.documentNo)
    ));
    const receivablesCount = unpaidReceivables.length;
    const receivablesTotal = unpaidReceivables.reduce((sum, invoice) => sum + formatKz(invoice.grossTotal), 0);

    res.json({
      revenue,
      expenses,
      profit,
      marginPercent: parseFloat(marginPercent.toFixed(1)),
      mrr,
      receitaMensal: mrr,
      prevRevenue,
      prevExpenses,
      prevProfit,
      receivablesCount,
      receivablesTotal,
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/finances/reconciliation-report ────────────────────────────────
router.get('/reconciliation-report', requirePermission('finances', 'transactions_view'), async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const report = await getReconciliationReport(
      req.user.effectiveUserId,
      parseReportDateRange(dateFrom, dateTo)
    );

    res.json(report);
  } catch (error) {
    console.error('Error fetching reconciliation report:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/finances/transactions ─────────────────────────────────────────
router.get('/transactions', requirePermission('finances', 'transactions_view'), async (req, res) => {
  try {
    const {
      page = '1',
      limit = '50',
      type,
      status,
      clientId,
      category,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where = { userId: req.user.effectiveUserId, deleted: false };

    if (type && ['entrada', 'saida'].includes(type)) where.type = type;
    if (status && ['pago', 'pendente', 'atrasado'].includes(status)) where.status = status;
    if (clientId) where.clientId = parseInt(clientId);
    if (category) where.category = category;
    const parsedDateFrom = parseDateBoundary(dateFrom, 'start');
    const parsedDateTo = parseDateBoundary(dateTo, 'end');
    if (parsedDateFrom || parsedDateTo) {
      where.date = {};
      if (parsedDateFrom) where.date.gte = parsedDateFrom;
      if (parsedDateTo) where.date.lte = parsedDateTo;
    }
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { receiptNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limitNum,
        include: {
          contact: { select: { id: true, name: true, company: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      data,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/finances/transactions ────────────────────────────────────────
router.post('/transactions', requirePermission('finances', 'transactions_edit'), async (req, res) => {
  try {
    const {
      date,
      clientId,
      clientName,
      type,
      revenueType,
      contractDurationMonths,
      nextPaymentDate,
      category,
      subcategory,
      description,
      amountKz,
      currencyOrigin,
      exchangeRate,
      paymentMethod,
      status,
      receiptNumber,
      notes,
    } = req.body;

    // Validações obrigatórias
    if (!type || !['entrada', 'saida'].includes(type)) {
      return res.status(400).json({ error: 'Tipo inválido. Use "entrada" ou "saida".' });
    }
    if (!date) return res.status(400).json({ error: 'Data é obrigatória.' });
    if (!category) return res.status(400).json({ error: 'Categoria é obrigatória.' });
    if (!amountKz || parseFloat(amountKz) <= 0) {
      return res.status(400).json({ error: 'Valor deve ser maior que 0.' });
    }
    if (!status || !['pago', 'pendente', 'atrasado'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido.' });
    }
    if (type === 'entrada' && revenueType === 'recorrente') {
      if (!contractDurationMonths || contractDurationMonths < 1) {
        return res.status(400).json({ error: 'Duração do contrato é obrigatória para receitas recorrentes.' });
      }
      if (!nextPaymentDate) {
        return res.status(400).json({ error: 'Próximo pagamento é obrigatório para receitas recorrentes.' });
      }
    }

    // Resolver clientName a partir do contacto se só tiver clientId
    let resolvedClientName = clientName || null;
    if (clientId && !resolvedClientName) {
      const contact = await prisma.contact.findUnique({
        where: { id: parseInt(clientId) },
        select: { name: true },
      });
      resolvedClientName = contact?.name || null;
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user.effectiveUserId,
        date: new Date(date),
        clientId: clientId ? parseInt(clientId) : null,
        clientName: resolvedClientName,
        type,
        revenueType: revenueType || null,
        contractDurationMonths: contractDurationMonths ? parseInt(contractDurationMonths) : null,
        nextPaymentDate: nextPaymentDate ? new Date(nextPaymentDate) : null,
        category,
        subcategory: subcategory || null,
        description: description || null,
        amountKz: parseFloat(amountKz),
        currencyOrigin: currencyOrigin || 'KZ',
        exchangeRate: exchangeRate ? parseFloat(exchangeRate) : 1.0,
        paymentMethod: paymentMethod || null,
        status,
        receiptNumber: receiptNumber || null,
        notes: notes || null,
      },
      include: {
        contact: { select: { id: true, name: true, company: true } },
      },
    });

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── PUT /api/finances/transactions/:id ─────────────────────────────────────
router.put('/transactions/:id', requirePermission('finances', 'transactions_edit'), async (req, res) => {
  try {
    const existing = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deleted || existing.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    const {
      date, clientId, clientName, type, revenueType, contractDurationMonths,
      nextPaymentDate, category, subcategory, description, amountKz,
      currencyOrigin, exchangeRate, paymentMethod, status, receiptNumber, notes,
    } = req.body;

    const data = {};
    if (date !== undefined) data.date = new Date(date);
    if (clientId !== undefined) data.clientId = clientId ? parseInt(clientId) : null;
    if (clientName !== undefined) data.clientName = clientName || null;
    if (type !== undefined) data.type = type;
    if (revenueType !== undefined) data.revenueType = revenueType || null;
    if (contractDurationMonths !== undefined) data.contractDurationMonths = contractDurationMonths ? parseInt(contractDurationMonths) : null;
    if (nextPaymentDate !== undefined) data.nextPaymentDate = nextPaymentDate ? new Date(nextPaymentDate) : null;
    if (category !== undefined) data.category = category;
    if (subcategory !== undefined) data.subcategory = subcategory || null;
    if (description !== undefined) data.description = description || null;
    if (amountKz !== undefined) data.amountKz = parseFloat(amountKz);
    if (currencyOrigin !== undefined) data.currencyOrigin = currencyOrigin;
    if (exchangeRate !== undefined) data.exchangeRate = parseFloat(exchangeRate);
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod || null;
    if (status !== undefined) data.status = status;
    if (receiptNumber !== undefined) data.receiptNumber = receiptNumber || null;
    if (notes !== undefined) data.notes = notes || null;

    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data,
      include: { contact: { select: { id: true, name: true, company: true } } },
    });

    res.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── DELETE /api/finances/transactions/:id (soft delete) ────────────────────
router.delete('/transactions/:id', requireDeletePermission, async (req, res) => {
  try {
    const existing = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deleted || existing.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    await prisma.transaction.update({
      where: { id: req.params.id },
      data: { deleted: true },
    });

    res.json({ message: 'Transação eliminada.' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/finances/transactions/:id/mark-paid ──────────────────────────
router.post('/transactions/:id/mark-paid', requirePermission('finances', 'transactions_edit'), async (req, res) => {
  try {
    const original = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!original || original.deleted || original.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }
    if (original.type !== 'entrada' || original.revenueType !== 'recorrente') {
      return res.status(400).json({ error: 'Só transações recorrentes podem ser marcadas como pagas aqui.' });
    }
    if (!original.nextPaymentDate) {
      return res.status(400).json({ error: 'Contrato já concluído ou sem próximo pagamento.' });
    }

    // Contar pagamentos já feitos para este contrato (transações com mesmo clientId + category + revenueType)
    const paymentsMade = await prisma.transaction.count({
      where: {
        deleted: false,
        clientId: original.clientId,
        category: original.category,
        revenueType: 'recorrente',
        status: 'pago',
        id: { not: original.id },
      },
    });
    const totalPayments = paymentsMade + 1; // incluindo o original

    // Criar nova transação para o pagamento actual
    const newTransaction = await prisma.transaction.create({
      data: {
        date: original.nextPaymentDate,
        clientId: original.clientId,
        clientName: original.clientName,
        type: 'entrada',
        revenueType: 'recorrente',
        contractDurationMonths: original.contractDurationMonths,
        category: original.category,
        subcategory: original.subcategory,
        description: original.description,
        amountKz: original.amountKz,
        currencyOrigin: original.currencyOrigin,
        exchangeRate: original.exchangeRate,
        paymentMethod: original.paymentMethod,
        status: 'pago',
        notes: original.notes,
      },
    });

    // Calcular próximo pagamento (+1 mês)
    const nextDate = new Date(original.nextPaymentDate);
    nextDate.setMonth(nextDate.getMonth() + 1);

    // Verificar se o contrato terminou
    const contractComplete = original.contractDurationMonths && totalPayments >= original.contractDurationMonths;

    await prisma.transaction.update({
      where: { id: original.id },
      data: { nextPaymentDate: contractComplete ? null : nextDate },
    });

    res.json({
      message: contractComplete ? 'Pagamento registado. Contrato concluído!' : 'Pagamento registado.',
      newTransaction,
      contractComplete,
    });
  } catch (error) {
    console.error('Error marking paid:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/finances/profitability ────────────────────────────────────────
router.get('/profitability', requirePermission('finances', 'transactions_view'), async (req, res) => {
  try {
    // Agregar entradas e saídas por cliente
    const [revenues, costs] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['clientId', 'clientName'],
        where: { userId: req.user.effectiveUserId, deleted: false, type: 'entrada', status: 'pago', clientId: { not: null } },
        _sum: { amountKz: true },
      }),
      prisma.transaction.groupBy({
        by: ['clientId', 'clientName'],
        where: { userId: req.user.effectiveUserId, deleted: false, type: 'saida', status: 'pago', clientId: { not: null } },
        _sum: { amountKz: true },
      }),
    ]);

    // Combinar resultados
    const clientMap = new Map();

    revenues.forEach((r) => {
      clientMap.set(r.clientId, {
        clientId: r.clientId,
        clientName: r.clientName || 'Desconhecido',
        totalRevenue: r._sum.amountKz || 0,
        totalCosts: 0,
      });
    });

    costs.forEach((c) => {
      if (clientMap.has(c.clientId)) {
        clientMap.get(c.clientId).totalCosts = c._sum.amountKz || 0;
      } else {
        clientMap.set(c.clientId, {
          clientId: c.clientId,
          clientName: c.clientName || 'Desconhecido',
          totalRevenue: 0,
          totalCosts: c._sum.amountKz || 0,
        });
      }
    });

    const result = Array.from(clientMap.values()).map((c) => {
      const netMargin = c.totalRevenue - c.totalCosts;
      const marginPercent = c.totalRevenue > 0 ? (netMargin / c.totalRevenue) * 100 : 0;
      return {
        ...c,
        netMargin,
        marginPercent: parseFloat(marginPercent.toFixed(1)),
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json(result);
  } catch (error) {
    console.error('Error fetching profitability:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/finances/profitability/:clientId ──────────────────────────────
router.get('/profitability/:clientId', requirePermission('finances', 'transactions_view'), async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);

    // Verify contact belongs to user's org
    const contact = await prisma.contact.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, company: true, userId: true },
    });

    if (!contact || contact.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const [transactions, costsByCategory] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: req.user.effectiveUserId, deleted: false, clientId, status: 'pago' },
        orderBy: { date: 'desc' },
        take: 20,
      }),
      prisma.transaction.groupBy({
        by: ['category'],
        where: { userId: req.user.effectiveUserId, deleted: false, clientId, type: 'saida', status: 'pago' },
        _sum: { amountKz: true },
      }),
    ]);

    // Contratos recorrentes activos
    const activeRecurringInvoices = await prisma.facturaRecorrente.findMany({
      where: {
        userId: req.user.effectiveUserId,
        isActive: true,
        clienteFaturacao: {
          is: {
            contactId: clientId,
          },
        },
      },
      orderBy: { nextRunDate: 'asc' },
      select: {
        id: true,
        customerName: true,
        frequency: true,
        nextRunDate: true,
        totalGenerated: true,
        maxOccurrences: true,
        lines: true,
        currencyCode: true,
        exchangeRate: true,
      },
    });

    // Totais
    const totalRevenue = transactions
      .filter((t) => t.type === 'entrada')
      .reduce((sum, t) => sum + t.amountKz, 0);
    const totalCosts = transactions
      .filter((t) => t.type === 'saida')
      .reduce((sum, t) => sum + t.amountKz, 0);
    const netMargin = totalRevenue - totalCosts;
    const marginPercent = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;

    res.json({
      contact,
      summary: {
        totalRevenue,
        totalCosts,
        netMargin,
        marginPercent: parseFloat(marginPercent.toFixed(1)),
      },
      costsByCategory: costsByCategory.map((c) => ({
        category: c.category,
        total: c._sum.amountKz || 0,
      })),
      recentTransactions: transactions,
      activeRecurringInvoices: activeRecurringInvoices.map((invoice) => ({
        id: invoice.id,
        customerName: invoice.customerName,
        frequency: invoice.frequency,
        nextRunDate: invoice.nextRunDate,
        totalGenerated: invoice.totalGenerated,
        maxOccurrences: invoice.maxOccurrences,
        grossTotalKz: calculateRecurringGrossTotalKz(invoice),
        monthlyAmountKz: monthlyizeRecurringRevenue(invoice),
      })),
    });
  } catch (error) {
    console.error('Error fetching client profitability:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/finances/categories ───────────────────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.financialCategory.findMany({
      where: { active: true },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    });
    const parsed = categories.map((c) => ({
      ...c,
      subcategories: c.subcategories ? JSON.parse(c.subcategories) : [],
    }));
    res.json(parsed);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/finances/seed-categories ─────────────────────────────────────
router.post('/seed-categories', async (req, res) => {
  try {
    const categories = [
      // ENTRADAS
      { type: 'entrada', category: 'Receitas de Faturação', subcategories: ['Documento FT', 'Documento FR', 'Documento FA', 'Documento ND'], color: '#0EA5E9', icon: '🧾', sortOrder: 1 },
      { type: 'entrada', category: 'Serviços Recorrentes', subcategories: ['Cliente Angola', 'Cliente Suíça', 'Cliente Portugal', 'Cliente Brasil', 'Cliente França'], color: '#10B981', icon: '💰', sortOrder: 2 },
      { type: 'entrada', category: 'Projetos One-off', subcategories: ['Website', 'Landing Page', 'Diagnóstico', 'Consultoria', 'Setup CRM'], color: '#3B82F6', icon: '🚀', sortOrder: 3 },
      { type: 'entrada', category: 'Serviços Extras', subcategories: ['Vídeo adicional', 'Posts extras', 'Fotografia', 'Design pontual'], color: '#8B5CF6', icon: '✨', sortOrder: 4 },
      { type: 'entrada', category: 'Outras Receitas', subcategories: ['Formação', 'Comissões', 'Parceria', 'Diversos'], color: '#06B6D4', icon: '💡', sortOrder: 5 },
      // SAÍDAS
      { type: 'saida', category: 'Design', subcategories: ['Designer freelance', 'Designer mensal', 'Assets (stock)', 'Impressão'], color: '#EC4899', icon: '🎨', sortOrder: 1 },
      { type: 'saida', category: 'Ferramentas', subcategories: ['Claude Pro', 'CapCut Pro', 'Canva Pro', 'Buffer/Later', 'GHL/CRM', 'Google Workspace', 'Adobe CC', 'Outras'], color: '#F59E0B', icon: '🛠️', sortOrder: 2 },
      { type: 'saida', category: 'Transporte', subcategories: ['Gasolina', 'Uber/Táxi', 'Estacionamento', 'Manutenção viatura'], color: '#6366F1', icon: '🚗', sortOrder: 3 },
      { type: 'saida', category: 'Produção Audiovisual', subcategories: ['Videógrafo freelance', 'Equipamento', 'Props/cenário', 'Aluguer'], color: '#EF4444', icon: '🎬', sortOrder: 4 },
      { type: 'saida', category: 'Fotografia', subcategories: ['Fotógrafo freelance', 'Edição fotos', 'Props'], color: '#14B8A6', icon: '📸', sortOrder: 5 },
      { type: 'saida', category: 'CRM/Tecnologia', subcategories: ['Desenvolvimento CRM', 'Hosting/Servidor', 'Domínios', 'APIs', 'Manutenção'], color: '#8B5CF6', icon: '💻', sortOrder: 6 },
      { type: 'saida', category: 'Anúncios Online', subcategories: ['Meta Ads', 'Google Ads', 'LinkedIn Ads', 'Outras'], color: '#F97316', icon: '📢', sortOrder: 7 },
      { type: 'saida', category: 'Operação', subcategories: ['Internet', 'Telefone', 'Eletricidade', 'Espaço trabalho', 'Material escritório'], color: '#64748B', icon: '🏢', sortOrder: 8 },
      { type: 'saida', category: 'Networking/Comercial', subcategories: ['Almoços clientes', 'Jantares negócio', 'Eventos', 'Materiais marketing'], color: '#10B981', icon: '🤝', sortOrder: 9 },
      { type: 'saida', category: 'Pessoal', subcategories: ['Retirada Olavo', 'Colaborador fixo', 'Freelancer pontual', 'Formação/Cursos'], color: '#06B6D4', icon: '👤', sortOrder: 10 },
      { type: 'saida', category: 'Legal/Administrativo', subcategories: ['Contabilidade', 'Advogado', 'Impostos', 'Taxas/Licenças'], color: '#84CC16', icon: '⚖️', sortOrder: 11 },
      { type: 'saida', category: 'Reserva/Investimento', subcategories: ['Fundo emergência', 'Investimento futuro', 'Buffer estratégico'], color: '#A855F7', icon: '🏦', sortOrder: 12 },
    ];

    let created = 0;
    for (const cat of categories) {
      await prisma.financialCategory.upsert({
        where: { type_category: { type: cat.type, category: cat.category } },
        update: { subcategories: JSON.stringify(cat.subcategories), color: cat.color, icon: cat.icon, sortOrder: cat.sortOrder },
        create: { type: cat.type, category: cat.category, subcategories: JSON.stringify(cat.subcategories), color: cat.color, icon: cat.icon, sortOrder: cat.sortOrder },
      });
      created++;
    }

    res.json({ message: `${created} categorias criadas/actualizadas.` });
  } catch (error) {
    console.error('Error seeding categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/finances/export-csv ───────────────────────────────────────────
router.get('/export-csv', requirePermission('finances', 'transactions_view'), async (req, res) => {
  try {
    const { dateFrom, dateTo, type, status } = req.query;
    const where = { userId: req.user.effectiveUserId, deleted: false };
    if (type) where.type = type;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const header = 'ID,Data,Cliente,Tipo,Tipo Receita,Categoria,Subcategoria,Descrição,Valor Kz,Moeda,Taxa Câmbio,Método Pagamento,Status,Nº Recibo,Notas\n';
    const rows = transactions.map((t) => {
      const cols = [
        t.id,
        new Date(t.date).toLocaleDateString('pt-PT'),
        t.clientName || '',
        t.type,
        t.revenueType || '',
        t.category,
        t.subcategory || '',
        (t.description || '').replace(/,/g, ';'),
        t.amountKz.toFixed(2),
        t.currencyOrigin,
        t.exchangeRate,
        t.paymentMethod || '',
        t.status,
        t.receiptNumber || '',
        (t.notes || '').replace(/,/g, ';'),
      ];
      return cols.join(',');
    });

    const csv = header + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transacoes-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\uFEFF' + csv); // BOM para Excel reconhecer UTF-8
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
