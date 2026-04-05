const prisma = require('../lib/prisma');
const {
  IMMEDIATE_PAYMENT_METHODS,
  buildFacturaFinanceEntryData,
} = require('../lib/faturacao/register-finance-entry');

function normalizeDateRange(dateRange = {}) {
  const normalized = {};

  if (dateRange.start instanceof Date && !Number.isNaN(dateRange.start.getTime())) {
    normalized.start = dateRange.start;
  }

  if (dateRange.end instanceof Date && !Number.isNaN(dateRange.end.getTime())) {
    normalized.end = dateRange.end;
  }

  return normalized;
}

function buildDateFilter(field, dateRange = {}) {
  const normalized = normalizeDateRange(dateRange);
  const filter = {};

  if (normalized.start) filter.gte = normalized.start;
  if (normalized.end) filter.lte = normalized.end;

  return Object.keys(filter).length > 0 ? { [field]: filter } : {};
}

function isInvoicePaid(invoice) {
  if (!invoice) return false;

  return ['FR', 'FA'].includes(invoice.documentType) || IMMEDIATE_PAYMENT_METHODS.has(invoice.paymentMethod || '');
}

function buildInvoiceSelect() {
  return {
    id: true,
    userId: true,
    documentNo: true,
    documentType: true,
    documentDate: true,
    documentStatus: true,
    customerName: true,
    clienteFaturacaoId: true,
    grossTotal: true,
    currencyCode: true,
    currencyAmount: true,
    exchangeRate: true,
    paymentMethod: true,
    caixaSessaoId: true,
  };
}

async function findMatchingFinanceTransaction(tx, invoice, organizationId) {
  return tx.transaction.findFirst({
    where: {
      userId: organizationId,
      deleted: false,
      type: 'entrada',
      OR: [
        { invoiceId: invoice.id },
        {
          invoiceId: null,
          receiptNumber: invoice.documentNo,
        },
      ],
    },
    orderBy: [{ createdAt: 'asc' }],
  });
}

async function reconcileInvoiceRecord(tx, invoice, organizationId, options = {}) {
  if (!invoice || invoice.userId !== organizationId || invoice.documentStatus === 'A') {
    return {
      status: 'skipped',
      reason: 'invoice_not_reconcilable',
      invoiceId: invoice?.id || null,
    };
  }

  const now = new Date();
  const cashSessionId = options.cashSessionId || invoice.caixaSessaoId || null;
  const existingTransaction = await findMatchingFinanceTransaction(tx, invoice, organizationId);

  if (existingTransaction) {
    const updatedTransaction = await tx.transaction.update({
      where: { id: existingTransaction.id },
      data: {
        invoiceId: invoice.id,
        cashSessionId: cashSessionId || existingTransaction.cashSessionId || null,
        status: options.markAsPaid ? 'pago' : existingTransaction.status,
        paymentMethod: invoice.paymentMethod || existingTransaction.paymentMethod,
        receiptNumber: existingTransaction.receiptNumber || invoice.documentNo,
        reconciled: true,
        reconciledAt: now,
      },
    });

    return {
      status: 'updated',
      invoiceId: invoice.id,
      transactionId: updatedTransaction.id,
    };
  }

  const transactionData = await buildFacturaFinanceEntryData(tx, {
    userId: organizationId,
    facturaId: invoice.id,
    documentNo: invoice.documentNo,
    documentType: invoice.documentType,
    documentDate: invoice.documentDate,
    customerName: invoice.customerName,
    clienteFaturacaoId: invoice.clienteFaturacaoId,
    grossTotal: invoice.grossTotal,
    currencyCode: invoice.currencyCode,
    currencyAmount: invoice.currencyAmount,
    exchangeRate: invoice.exchangeRate,
    paymentMethod: invoice.paymentMethod,
    cashSessionId,
    reconciled: true,
    reconciledAt: now,
    status: options.markAsPaid ? 'pago' : undefined,
  });

  if (!transactionData) {
    return {
      status: 'skipped',
      reason: 'unsupported_document_type',
      invoiceId: invoice.id,
    };
  }

  const createdTransaction = await tx.transaction.create({
    data: transactionData,
  });

  return {
    status: 'created',
    invoiceId: invoice.id,
    transactionId: createdTransaction.id,
  };
}

async function reconcileInvoicePayment(invoiceId, organizationId) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.factura.findFirst({
      where: { id: invoiceId, userId: organizationId },
      select: buildInvoiceSelect(),
    });

    if (!invoice) {
      return {
        status: 'skipped',
        reason: 'invoice_not_found',
        invoiceId,
      };
    }

    return reconcileInvoiceRecord(tx, invoice, organizationId, {
      markAsPaid: true,
    });
  });
}

async function reconcileCashSession(sessionId, organizationId) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.caixaSessao.findFirst({
      where: { id: sessionId, userId: organizationId },
      select: {
        id: true,
        userId: true,
        status: true,
        closedAt: true,
        facturas: {
          where: { documentStatus: 'N' },
          select: buildInvoiceSelect(),
        },
      },
    });

    if (!session) {
      return {
        status: 'skipped',
        reason: 'session_not_found',
        sessionId,
      };
    }

    const results = [];

    for (const invoice of session.facturas) {
      const result = await reconcileInvoiceRecord(tx, invoice, organizationId, {
        cashSessionId: session.id,
        markAsPaid: true,
      });
      results.push(result);
    }

    return {
      status: 'completed',
      sessionId: session.id,
      sessionStatus: session.status,
      invoicesProcessed: session.facturas.length,
      createdCount: results.filter((result) => result.status === 'created').length,
      updatedCount: results.filter((result) => result.status === 'updated').length,
      skippedCount: results.filter((result) => result.status === 'skipped').length,
      results,
    };
  });
}

async function getReconciliationReport(organizationId, dateRange = {}) {
  const normalizedRange = normalizeDateRange(dateRange);
  const invoiceWhere = {
    userId: organizationId,
    documentStatus: 'N',
    ...buildDateFilter('documentDate', normalizedRange),
  };
  const financeWhere = {
    userId: organizationId,
    deleted: false,
    type: 'entrada',
    ...buildDateFilter('date', normalizedRange),
  };
  const closedSessionWhere = {
    userId: organizationId,
    status: 'closed',
    ...buildDateFilter('closedAt', normalizedRange),
  };

  const paidInvoiceWhere = {
    ...invoiceWhere,
    OR: [
      { documentType: { in: ['FR', 'FA'] } },
      { paymentMethod: { in: Array.from(IMMEDIATE_PAYMENT_METHODS) } },
    ],
  };

  const [invoiceTotals, financeTotals, manualTransactions, paidInvoices, closedSessions] = await Promise.all([
    prisma.factura.aggregate({
      where: invoiceWhere,
      _sum: { grossTotal: true },
      _count: { id: true },
    }),
    prisma.transaction.aggregate({
      where: financeWhere,
      _sum: { amountKz: true },
      _count: { id: true },
    }),
    prisma.transaction.findMany({
      where: {
        ...financeWhere,
        invoiceId: null,
        OR: [
          { receiptNumber: null },
          { category: { not: 'Receitas de Faturação' } },
        ],
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        date: true,
        clientName: true,
        category: true,
        description: true,
        amountKz: true,
        paymentMethod: true,
        status: true,
        cashSessionId: true,
        reconciled: true,
      },
    }),
    prisma.factura.findMany({
      where: paidInvoiceWhere,
      orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        documentNo: true,
        documentType: true,
        documentDate: true,
        customerName: true,
        grossTotal: true,
        paymentMethod: true,
        caixaSessaoId: true,
      },
    }),
    prisma.caixaSessao.findMany({
      where: closedSessionWhere,
      orderBy: [{ closedAt: 'desc' }, { openedAt: 'desc' }],
      select: {
        id: true,
        openedAt: true,
        closedAt: true,
        totalSalesAmount: true,
        salesCount: true,
        estabelecimento: {
          select: { id: true, nome: true },
        },
        facturas: {
          where: { documentStatus: 'N' },
          select: {
            id: true,
            documentNo: true,
            documentType: true,
            customerName: true,
            grossTotal: true,
            paymentMethod: true,
          },
        },
      },
    }),
  ]);

  const invoiceIds = paidInvoices.map((invoice) => invoice.id);
  const documentNumbers = paidInvoices.map((invoice) => invoice.documentNo);
  const sessionInvoiceIds = closedSessions.flatMap((session) => session.facturas.map((invoice) => invoice.id));
  const sessionDocumentNumbers = closedSessions.flatMap((session) => session.facturas.map((invoice) => invoice.documentNo));
  const candidateInvoiceIds = Array.from(new Set([...invoiceIds, ...sessionInvoiceIds]));
  const candidateDocumentNumbers = Array.from(new Set([...documentNumbers, ...sessionDocumentNumbers]));

  const linkedFinanceTransactions = candidateInvoiceIds.length || candidateDocumentNumbers.length
    ? await prisma.transaction.findMany({
        where: {
          userId: organizationId,
          deleted: false,
          type: 'entrada',
          OR: [
            ...(candidateInvoiceIds.length ? [{ invoiceId: { in: candidateInvoiceIds } }] : []),
            ...(candidateDocumentNumbers.length ? [{ receiptNumber: { in: candidateDocumentNumbers } }] : []),
          ],
        },
        select: {
          id: true,
          invoiceId: true,
          receiptNumber: true,
          cashSessionId: true,
          reconciled: true,
        },
      })
    : [];

  const financeByInvoiceId = new Map();
  const financeByReceiptNumber = new Map();

  for (const transaction of linkedFinanceTransactions) {
    if (transaction.invoiceId) {
      const list = financeByInvoiceId.get(transaction.invoiceId) || [];
      list.push(transaction);
      financeByInvoiceId.set(transaction.invoiceId, list);
    }

    if (transaction.receiptNumber) {
      const list = financeByReceiptNumber.get(transaction.receiptNumber) || [];
      list.push(transaction);
      financeByReceiptNumber.set(transaction.receiptNumber, list);
    }
  }

  const paidInvoicesWithoutTransaction = paidInvoices
    .filter((invoice) => {
      const matches = [
        ...(financeByInvoiceId.get(invoice.id) || []),
        ...(financeByReceiptNumber.get(invoice.documentNo) || []),
      ];

      return matches.length === 0;
    })
    .map((invoice) => ({
      id: invoice.id,
      documentNo: invoice.documentNo,
      documentType: invoice.documentType,
      documentDate: invoice.documentDate,
      customerName: invoice.customerName,
      grossTotal: invoice.grossTotal,
      paymentMethod: invoice.paymentMethod,
      caixaSessaoId: invoice.caixaSessaoId,
    }));

  const closedSessionsWithoutReconciliation = closedSessions
    .map((session) => {
      const missingInvoices = session.facturas.filter((invoice) => {
        const matches = [
          ...(financeByInvoiceId.get(invoice.id) || []),
          ...(financeByReceiptNumber.get(invoice.documentNo) || []),
        ];

        return !matches.some(
          (transaction) => transaction.cashSessionId === session.id && transaction.reconciled
        );
      });

      if (missingInvoices.length === 0) {
        return null;
      }

      return {
        id: session.id,
        estabelecimento: session.estabelecimento,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        totalSalesAmount: session.totalSalesAmount,
        salesCount: session.salesCount,
        unreconciledInvoicesCount: missingInvoices.length,
        unreconciledInvoices: missingInvoices.map((invoice) => ({
          id: invoice.id,
          documentNo: invoice.documentNo,
          documentType: invoice.documentType,
          customerName: invoice.customerName,
          grossTotal: invoice.grossTotal,
          paymentMethod: invoice.paymentMethod,
        })),
      };
    })
    .filter(Boolean);

  const totalInvoicedKz = invoiceTotals._sum.grossTotal || 0;
  const totalFinanceKz = financeTotals._sum.amountKz || 0;
  const manualEntriesAmountKz = manualTransactions.reduce((sum, transaction) => sum + (transaction.amountKz || 0), 0);

  return {
    dateRange: {
      start: normalizedRange.start || null,
      end: normalizedRange.end || null,
    },
    summary: {
      totalInvoicedKz,
      totalFinanceKz,
      differenceKz: totalFinanceKz - totalInvoicedKz,
      invoicesCount: invoiceTotals._count.id || 0,
      financeEntriesCount: financeTotals._count.id || 0,
      manualEntriesCount: manualTransactions.length,
      manualEntriesAmountKz,
      paidInvoicesWithoutTransactionCount: paidInvoicesWithoutTransaction.length,
      closedSessionsWithoutReconciliationCount: closedSessionsWithoutReconciliation.length,
    },
    manualTransactions,
    paidInvoicesWithoutTransaction,
    closedSessionsWithoutReconciliation,
  };
}

module.exports = {
  getReconciliationReport,
  isInvoicePaid,
  reconcileCashSession,
  reconcileInvoicePayment,
};
