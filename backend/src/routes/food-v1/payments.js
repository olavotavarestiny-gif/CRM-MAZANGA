const express = require('express');
const prisma = require('../../lib/prisma');
const { requireFoodPermission } = require('../../lib/food-access');
const { domainError } = require('../../lib/food-domain');
const { idempotencyKeyFromRequest, recordPayment } = require('../../services/food-order.service');
const { issueFoodFiscalDocument } = require('../../services/food-fiscal-adapter');
const { handleFoodV1Error } = require('./errors');
const { recordFoodAudit } = require('../../lib/food-audit');
const { requireOpenFoodShift, verifyFoodStaffPin } = require('../../services/food-workforce.service');
const { reviewFoodCashDifference } = require('../../services/food-workforce-management.service');

const router = express.Router();

router.get('/cash-sessions/current', requireFoodPermission('payments.view'), async (req, res) => {
  try {
    const branchId = req.query.branchId ? String(req.query.branchId) : null;
    if (branchId && !req.foodContext.canAccessBranch(branchId)) throw domainError('Não tem acesso a esta unidade.', 403);
    const session = await prisma.foodCashSession.findFirst({
      where: {
        organizationId: req.foodContext.organizationId,
        status: 'open',
        openedByUserId: req.foodContext.personId,
        ...(branchId && { branchId }),
      },
      include: { branch: { select: { id: true, name: true } }, shift: true },
      orderBy: { openedAt: 'desc' },
    });
    res.json(session);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar a sessão de caixa.');
  }
});

router.post('/cash-sessions', requireFoodPermission('payments.create'), async (req, res) => {
  try {
    const branchId = String(req.body?.branchId || '');
    const openingBalance = Number(req.body?.openingBalance || 0);
    if (!branchId || !req.foodContext.canAccessBranch(branchId)) throw domainError('Unidade Food inválida.', 403);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) throw domainError('Saldo inicial inválido.');
    const branch = await prisma.foodBranch.findFirst({
      where: { id: branchId, userId: req.foodContext.organizationId, active: true },
    });
    if (!branch) throw domainError('Unidade Food não encontrada.', 404);
    await verifyFoodStaffPin(prisma, req.foodContext, req.body?.pin);
    const result = await prisma.$transaction(async (tx) => {
      const shiftLockKey = `food-shift:${req.foodContext.organizationId}:${req.foodContext.personId}`;
      const lockKey = `food-cash:${req.foodContext.organizationId}:${branchId}:${req.foodContext.personId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${shiftLockKey}, 0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const existing = await tx.foodCashSession.findFirst({
        where: {
          organizationId: req.foodContext.organizationId,
          branchId,
          openedByUserId: req.foodContext.personId,
          status: 'open',
        },
        include: { branch: { select: { id: true, name: true } }, shift: true },
      });
      if (existing) return { session: existing, created: false, shiftCreated: false, shift: existing.shift };
      let shift = await tx.foodShift.findFirst({
        where: { organizationId: req.foodContext.organizationId, personId: req.foodContext.personId, status: 'open' },
        include: { branch: { select: { id: true, name: true } } },
      });
      if (shift && shift.branchId !== branchId) throw domainError('Já existe um turno aberto noutra unidade.', 409, 'FOOD_SHIFT_ALREADY_OPEN');
      let shiftCreated = false;
      if (!shift && req.body?.startShift === true) {
        shift = await tx.foodShift.create({
          data: {
            organizationId: req.foodContext.organizationId,
            branchId,
            personId: req.foodContext.personId,
            startDeviceId: String(req.body?.deviceId || '').trim().slice(0, 120) || null,
            createdByUserId: req.foodContext.personId,
          },
          include: { branch: { select: { id: true, name: true } } },
        });
        shiftCreated = true;
      }
      if (!shift) shift = await requireOpenFoodShift(tx, req.foodContext, branchId);
      const session = await tx.foodCashSession.create({
        data: {
          organizationId: req.foodContext.organizationId,
          branchId,
          shiftId: shift.id,
          openedByUserId: req.foodContext.personId,
          openedDeviceId: String(req.body?.deviceId || '').trim().slice(0, 120) || null,
          openingBalance,
          expectedClosingAmount: openingBalance,
          totalsByMethod: {},
        },
        include: { branch: { select: { id: true, name: true } }, shift: true },
      });
      return { session, created: true, shiftCreated, shift };
    });
    if (result.shiftCreated) await recordFoodAudit(prisma, req, { branchId: result.shift.branchId, action: 'shift.started', entityType: 'food_shift', entityId: result.shift.id, payload: { personId: result.shift.personId, deviceId: result.shift.startDeviceId } });
    if (result.created) await recordFoodAudit(prisma, req, { branchId: result.session.branchId, action: 'cash_session.opened', entityType: 'food_cash_session', entityId: result.session.id, payload: { openingBalance: result.session.openingBalance } });
    res.status(result.created ? 201 : 200).json(result.session);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao abrir a sessão de caixa.');
  }
});

router.post('/cash-sessions/:id/close', requireFoodPermission('payments.create'), async (req, res) => {
  try {
    const counted = Number(req.body?.closingCountedAmount);
    if (!Number.isFinite(counted) || counted < 0) throw domainError('Informe o valor contado no fecho.');
    await verifyFoodStaffPin(prisma, req.foodContext, req.body?.pin);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "food_cash_sessions" WHERE "id" = ${req.params.id} FOR UPDATE`;
      const session = await tx.foodCashSession.findFirst({
        where: { id: req.params.id, organizationId: req.foodContext.organizationId, status: 'open' },
      });
      if (!session) throw domainError('Sessão de caixa aberta não encontrada.', 404);
      if (!req.foodContext.canAccessBranch(session.branchId)) throw domainError('Não tem acesso a esta unidade.', 403);
      if (session.openedByUserId !== req.foodContext.personId && !req.foodContext.can('payments.manage')) {
        throw domainError('Apenas o operador ou gestor pode fechar esta sessão.', 403);
      }
      const differenceAmount = counted - session.expectedClosingAmount;
      const notes = String(req.body?.notes || '').trim();
      if (Math.abs(differenceAmount) > 0.005 && notes.length < 3) {
        throw domainError('Informe o motivo da diferença de Caixa.', 400, 'FOOD_CASH_DIFFERENCE_REASON_REQUIRED');
      }
      const closed = await tx.foodCashSession.update({
        where: { id: session.id },
        data: {
          status: 'closed',
          closedByUserId: req.foodContext.personId,
          closingCountedAmount: counted,
          differenceAmount,
          approvalStatus: Math.abs(differenceAmount) > 0.005 ? 'pending' : 'not_required',
          notes: notes || null,
          closedDeviceId: String(req.body?.deviceId || '').trim().slice(0, 120) || null,
          closedAt: new Date(),
        },
      });
      let endedShift = null;
      if (req.body?.endShift === true && session.openedByUserId === req.foodContext.personId) {
        const shift = await tx.foodShift.findFirst({
          where: { id: session.shiftId, organizationId: req.foodContext.organizationId, personId: req.foodContext.personId, status: 'open' },
        });
        if (shift) {
          endedShift = await tx.foodShift.update({
            where: { id: shift.id },
            data: {
              status: 'closed',
              endedAt: new Date(),
              endDeviceId: String(req.body?.deviceId || '').trim().slice(0, 120) || null,
              notes: String(req.body?.notes || '').trim().slice(0, 500) || null,
            },
          });
        }
      }
      return { closed, endedShift };
    });
    const closed = result.closed;
    await recordFoodAudit(prisma, req, { branchId: closed.branchId, action: 'cash_session.closed', entityType: 'food_cash_session', entityId: closed.id, reason: req.body?.notes, payload: { countedAmount: closed.closingCountedAmount, differenceAmount: closed.differenceAmount } });
    if (result.endedShift) await recordFoodAudit(prisma, req, { branchId: result.endedShift.branchId, action: 'shift.ended', entityType: 'food_shift', entityId: result.endedShift.id, reason: req.body?.notes, payload: { personId: result.endedShift.personId, deviceId: result.endedShift.endDeviceId } });
    res.json({ ...closed, shiftEnded: Boolean(result.endedShift) });
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao fechar a sessão de caixa.');
  }
});

router.post('/cash-sessions/:id/approval', requireFoodPermission('payments.manage'), async (req, res) => {
  try {
    const session = await reviewFoodCashDifference(prisma, req.foodContext, req.params.id, req.body);
    await recordFoodAudit(prisma, req, { branchId: session.branchId, action: `cash_session.${session.approvalStatus}`, entityType: 'food_cash_session', entityId: session.id, reason: req.body?.note, payload: { differenceAmount: session.differenceAmount, decision: session.approvalStatus } });
    res.json(session);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao analisar a diferença de Caixa.');
  }
});

router.get('/orders/:orderId/payments', requireFoodPermission('payments.view'), async (req, res) => {
  try {
    const order = await prisma.foodOrder.findFirst({
      where: { id: req.params.orderId, userId: req.foodContext.organizationId },
      select: { id: true, branchId: true },
    });
    if (!order) throw domainError('Pedido Food não encontrado.', 404);
    if (!req.foodContext.canAccessBranch(order.branchId)) throw domainError('Não tem acesso a esta unidade.', 403);
    const payments = await prisma.foodPayment.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } });
    res.json(payments);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar os pagamentos.');
  }
});

router.post('/orders/:orderId/payments', requireFoodPermission('payments.create'), async (req, res) => {
  try {
    const payment = await recordPayment(prisma, req.foodContext, req.params.orderId, req.body || {}, {
      idempotencyKey: idempotencyKeyFromRequest(req),
    });
    await recordFoodAudit(prisma, req, { branchId: payment.branchId, action: 'payment.recorded', entityType: 'food_payment', entityId: payment.id, reason: req.body?.reason, payload: { orderId: payment.orderId, amount: payment.amount, method: payment.method, status: payment.status } });
    res.status(201).json(payment);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao registar o pagamento.');
  }
});

router.post('/orders/:orderId/fiscal-documents', requireFoodPermission('fiscal.emit'), async (req, res) => {
  try {
    const idempotencyKey = idempotencyKeyFromRequest(req);
    const document = await issueFoodFiscalDocument(
      prisma,
      req.foodContext,
      req.params.orderId,
      { ...req.body, idempotencyKey },
      req
    );
    await recordFoodAudit(prisma, req, { branchId: document.branchId, action: 'fiscal_document.requested', entityType: 'food_fiscal_document', entityId: document.id, reason: req.body?.reason, payload: { orderId: document.orderId, documentType: document.documentType, status: document.status } });
    res.status(document.status === 'issued' ? 200 : 201).json(document);
  } catch (error) {
    handleFoodV1Error(res, error, 'Não foi possível emitir o documento fiscal. O pagamento permanece registado.');
  }
});

module.exports = router;
