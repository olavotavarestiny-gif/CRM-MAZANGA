const express = require('express');
const prisma = require('../../lib/prisma');
const { requireAnyFoodPermission, requireFoodPermission } = require('../../lib/food-access');
const { handleFoodV1Error } = require('./errors');
const { getFoodWorkforceDashboard } = require('../../services/food-workforce-management.service');
const { getFoodOperationalReport } = require('../../services/food-operational-report.service');
const { createFoodMonthlyClose, getFoodMonthCloseReadiness, getFoodMonthlyClose, getFoodMonthlyCloseRevision, listFoodMonthlyCloses, recloseFoodMonthlyClose, reopenFoodMonthlyClose } = require('../../services/food-month-close.service');
const { idempotencyKeyFromRequest } = require('../../services/food-order.service');
const { recordFoodAudit } = require('../../lib/food-audit');
const { buildFoodMonthlyCloseCsv, monthlyCloseCsvFilename } = require('../../lib/food-month-close-csv');
const { buildFoodMonthlyClosePdf, monthlyClosePdfFilename } = require('../../lib/food-month-close-pdf');

const router = express.Router();

router.get('/workforce', requireFoodPermission('team.view'), async (req, res) => {
  try {
    res.json(await getFoodWorkforceDashboard(prisma, req.foodContext, req.query));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar o painel da equipa.');
  }
});

function startOfToday(timezone = 'Africa/Luanda') {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return new Date(`${formatted}T00:00:00+01:00`);
}

router.get('/overview', requireAnyFoodPermission('overview.view', 'reports.view'), async (req, res) => {
  try {
    const settings = await prisma.foodSettings.findUnique({ where: { userId: req.foodContext.organizationId } });
    const from = startOfToday(settings?.timezone);
    const branchScope = req.foodContext.branchIds === null ? {} : { branchId: { in: req.foodContext.branchIds } };
    const [orders, payments, deliveries, lowStock, openSessions] = await Promise.all([
      prisma.foodOrder.groupBy({
        by: ['orderState'],
        where: { userId: req.foodContext.organizationId, createdAt: { gte: from }, ...branchScope },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.foodPayment.aggregate({
        where: { userId: req.foodContext.organizationId, status: 'confirmed', paidAt: { gte: from }, ...branchScope },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.foodDelivery.groupBy({
        by: ['state'],
        where: { userId: req.foodContext.organizationId, createdAt: { gte: from }, ...branchScope },
        _count: { _all: true },
      }),
      prisma.foodIngredient.findMany({
        where: {
          organizationId: req.foodContext.organizationId,
          active: true,
          ...(req.foodContext.branchIds === null ? {} : { OR: [{ branchId: null }, { branchId: { in: req.foodContext.branchIds } }] }),
        },
        select: { currentStock: true, minimumStock: true },
      }),
      prisma.foodCashSession.count({
        where: { organizationId: req.foodContext.organizationId, status: 'open', ...branchScope },
      }),
    ]);
    const totalOrders = orders.reduce((sum, item) => sum + item._count._all, 0);
    const cancelled = orders.find((item) => item.orderState === 'cancelled')?._count._all || 0;
    res.json({
      from,
      orders: { total: totalOrders, cancelled, byState: orders },
      revenue: Number(payments._sum.amount || 0),
      paymentsCount: payments._count._all,
      averageTicket: totalOrders > 0 ? Number(payments._sum.amount || 0) / totalOrders : 0,
      deliveries,
      lowStock: lowStock.filter((ingredient) => ingredient.minimumStock > 0 && ingredient.currentStock <= ingredient.minimumStock).length,
      openSessions,
    });
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar a gestão Food.');
  }
});

router.get('/reports/daily', requireAnyFoodPermission('reports.view', 'overview.view'), async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days || 30)));
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - days + 1);
    from.setUTCHours(0, 0, 0, 0);
    const branchScope = req.foodContext.branchIds === null ? {} : { branchId: { in: req.foodContext.branchIds } };
    const [orders, payments] = await Promise.all([
      prisma.foodOrder.findMany({
        where: { userId: req.foodContext.organizationId, createdAt: { gte: from }, ...branchScope },
        select: { id: true, orderType: true, orderState: true, total: true, createdAt: true },
      }),
      prisma.foodPayment.findMany({
        where: { userId: req.foodContext.organizationId, status: 'confirmed', paidAt: { gte: from }, ...branchScope },
        select: { amount: true, method: true, paidAt: true },
      }),
    ]);
    const byDay = new Map();
    for (let index = 0; index < days; index += 1) {
      const date = new Date(from);
      date.setUTCDate(from.getUTCDate() + index);
      byDay.set(date.toISOString().slice(0, 10), { date: date.toISOString().slice(0, 10), orders: 0, cancelled: 0, revenue: 0 });
    }
    for (const order of orders) {
      const row = byDay.get(order.createdAt.toISOString().slice(0, 10));
      if (row) {
        row.orders += 1;
        if (order.orderState === 'cancelled') row.cancelled += 1;
      }
    }
    for (const payment of payments) {
      const row = byDay.get(payment.paidAt?.toISOString().slice(0, 10));
      if (row) row.revenue += Number(payment.amount);
    }
    res.json({ from, days, rows: [...byDay.values()] });
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao gerar o relatório Food.');
  }
});

router.get('/reports/operational', requireFoodPermission('reports.view'), async (req, res) => {
  try {
    res.json(await getFoodOperationalReport(prisma, req.foodContext, req.query));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao gerar o relatório operacional Food.');
  }
});

router.get('/month-close/readiness', requireFoodPermission('reports.view'), async (req, res) => {
  try {
    res.json(await getFoodMonthCloseReadiness(prisma, req.foodContext, req.query));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao validar a prontidão do fecho mensal.');
  }
});

router.get('/month-close', requireFoodPermission('reports.view'), async (req, res) => {
  try {
    res.json(await listFoodMonthlyCloses(prisma, req.foodContext, req.query));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar os fechos mensais.');
  }
});

router.get('/month-close/:id/export.csv', requireFoodPermission('reports.view'), async (req, res) => {
  try {
    const close = await getFoodMonthlyClose(prisma, req.foodContext, req.params.id);
    const filename = monthlyCloseCsvFilename(close);
    await recordFoodAudit(prisma, req, { branchId: close.branchId, action: 'management.month_close.exported_csv', entityType: 'food_monthly_close', entityId: close.id, payload: { month: close.month, version: close.version, filename } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buildFoodMonthlyCloseCsv(close));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao exportar o fecho mensal.');
  }
});

router.get('/month-close/:id/export.pdf', requireFoodPermission('reports.view'), async (req, res) => {
  try {
    const close = await getFoodMonthlyClose(prisma, req.foodContext, req.params.id);
    const settings = await prisma.foodSettings.findUnique({ where: { userId: req.foodContext.organizationId }, select: { restaurantName: true, primaryColor: true, currency: true } }) || {};
    const filename = monthlyClosePdfFilename(close);
    const pdf = await buildFoodMonthlyClosePdf(close, settings);
    await recordFoodAudit(prisma, req, { branchId: close.branchId, action: 'management.month_close.exported_pdf', entityType: 'food_monthly_close', entityId: close.id, payload: { month: close.month, version: close.version, filename } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao gerar o PDF do fecho mensal.');
  }
});

router.get('/month-close/:id/print.pdf', requireFoodPermission('reports.view'), async (req, res) => {
  try {
    const close = await getFoodMonthlyClose(prisma, req.foodContext, req.params.id);
    const settings = await prisma.foodSettings.findUnique({ where: { userId: req.foodContext.organizationId }, select: { restaurantName: true, primaryColor: true, currency: true } }) || {};
    const filename = monthlyClosePdfFilename(close);
    const pdf = await buildFoodMonthlyClosePdf(close, settings);
    await recordFoodAudit(prisma, req, { branchId: close.branchId, action: 'management.month_close.opened_for_print', entityType: 'food_monthly_close', entityId: close.id, payload: { month: close.month, version: close.version, filename, snapshot: 'original' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao preparar a impressão do fecho mensal.');
  }
});

router.get('/month-close/:id/revisions/:revisionId/export.csv', requireFoodPermission('reports.view'), async (req, res) => {
  try {
    const revision = await getFoodMonthlyCloseRevision(prisma, req.foodContext, req.params.id, req.params.revisionId);
    const filename = monthlyCloseCsvFilename(revision);
    await recordFoodAudit(prisma, req, { branchId: revision.branchId, action: 'management.month_close.revision_exported_csv', entityType: 'food_monthly_close_revision', entityId: revision.id, payload: { monthlyCloseId: revision.monthlyCloseId, month: revision.month, revisionNumber: revision.revisionNumber, filename } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buildFoodMonthlyCloseCsv(revision));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao exportar a revisão do fecho mensal.');
  }
});

router.get('/month-close/:id/revisions/:revisionId/export.pdf', requireFoodPermission('reports.view'), async (req, res) => {
  try {
    const revision = await getFoodMonthlyCloseRevision(prisma, req.foodContext, req.params.id, req.params.revisionId);
    const settings = await prisma.foodSettings.findUnique({ where: { userId: req.foodContext.organizationId }, select: { restaurantName: true, primaryColor: true, currency: true } }) || {};
    const filename = monthlyClosePdfFilename(revision);
    const pdf = await buildFoodMonthlyClosePdf(revision, settings);
    await recordFoodAudit(prisma, req, { branchId: revision.branchId, action: 'management.month_close.revision_exported_pdf', entityType: 'food_monthly_close_revision', entityId: revision.id, payload: { monthlyCloseId: revision.monthlyCloseId, month: revision.month, revisionNumber: revision.revisionNumber, filename } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao gerar o PDF da revisão do fecho mensal.');
  }
});

router.get('/month-close/:id/revisions/:revisionId/print.pdf', requireFoodPermission('reports.view'), async (req, res) => {
  try {
    const revision = await getFoodMonthlyCloseRevision(prisma, req.foodContext, req.params.id, req.params.revisionId);
    const settings = await prisma.foodSettings.findUnique({ where: { userId: req.foodContext.organizationId }, select: { restaurantName: true, primaryColor: true, currency: true } }) || {};
    const filename = monthlyClosePdfFilename(revision);
    const pdf = await buildFoodMonthlyClosePdf(revision, settings);
    await recordFoodAudit(prisma, req, { branchId: revision.branchId, action: 'management.month_close.revision_opened_for_print', entityType: 'food_monthly_close_revision', entityId: revision.id, payload: { monthlyCloseId: revision.monthlyCloseId, month: revision.month, revisionNumber: revision.revisionNumber, filename } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao preparar a impressão da revisão do fecho mensal.');
  }
});

router.post('/month-close', requireFoodPermission('reports.close'), async (req, res) => {
  try {
    const result = await createFoodMonthlyClose(prisma, req.foodContext, req.body || {}, { idempotencyKey: idempotencyKeyFromRequest(req) });
    if (result.created) await recordFoodAudit(prisma, req, { branchId: result.close.branchId, action: 'management.month_close.created', entityType: 'food_monthly_close', entityId: result.close.id, payload: { month: result.close.month, scopeKey: result.close.scopeKey } });
    res.status(result.created ? 201 : 200).json(result.close);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao fechar o mês Food.');
  }
});

router.post('/month-close/:id/reopen', requireFoodPermission('reports.reopen'), async (req, res) => {
  try {
    const result = await reopenFoodMonthlyClose(prisma, req.foodContext, req.params.id, req.body || {}, { idempotencyKey: idempotencyKeyFromRequest(req) });
    if (result.reopened) await recordFoodAudit(prisma, req, { branchId: result.close.branchId, action: 'management.month_close.reopened', entityType: 'food_monthly_close', entityId: result.close.id, reason: req.body?.reason, payload: { month: result.close.month, version: result.close.version, originalSnapshotPreserved: true } });
    res.json(result.close);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao reabrir o mês Food.');
  }
});

router.post('/month-close/:id/reclose', requireFoodPermission('reports.close'), async (req, res) => {
  try {
    const result = await recloseFoodMonthlyClose(prisma, req.foodContext, req.params.id, req.body || {}, { idempotencyKey: idempotencyKeyFromRequest(req) });
    if (result.reclosed) await recordFoodAudit(prisma, req, { branchId: result.close.branchId, action: 'management.month_close.reclosed', entityType: 'food_monthly_close_revision', entityId: result.revision.id, reason: req.body?.reason, payload: { monthlyCloseId: result.close.id, month: result.close.month, version: result.close.version, revisionNumber: result.revision.revisionNumber, previousSnapshotsPreserved: true } });
    res.status(result.reclosed ? 201 : 200).json(result.close);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao fechar novamente o mês Food.');
  }
});

module.exports = router;
