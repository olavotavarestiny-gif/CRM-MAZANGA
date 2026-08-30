'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('pré-validação mensal identifica bloqueios e respeita tenant e unidade', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const { createFoodMonthlyClose, getFoodMonthCloseReadiness, getFoodMonthlyClose, getFoodMonthlyCloseRevision, listFoodMonthlyCloses, recloseFoodMonthlyClose, reopenFoodMonthlyClose } = require('../services/food-month-close.service');
  const { buildFoodMonthlyCloseCsv } = require('../lib/food-month-close-csv');
  const { buildFoodMonthlyClosePdf } = require('../lib/food-month-close-pdf');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  let owner;
  let other;
  try {
    owner = await prisma.user.create({ data: { name: 'Close Owner', email: `close-owner-${suffix}@example.test`, workspaceMode: 'food' } });
    other = await prisma.user.create({ data: { name: 'Close Other', email: `close-other-${suffix}@example.test`, workspaceMode: 'food' } });
    const branchA = await prisma.foodBranch.create({ data: { userId: owner.id, name: `Close A ${suffix}`, isMain: true } });
    const branchB = await prisma.foodBranch.create({ data: { userId: owner.id, name: `Close B ${suffix}` } });
    const order = await prisma.foodOrder.create({ data: { userId: owner.id, branchId: branchA.id, orderNumber: 1, orderState: 'completed', status: 'completed', paymentState: 'partial', orderType: 'delivery', total: 1000, subtotal: 1000 } });
    const delivery = await prisma.foodDelivery.create({ data: { userId: owner.id, branchId: branchA.id, orderId: order.id, courierUserId: owner.id, state: 'delivered', deliveredAt: new Date() } });
    await prisma.foodDeliveryCollection.create({ data: { organizationId: owner.id, branchId: branchA.id, orderId: order.id, deliveryId: delivery.id, courierUserId: owner.id, state: 'with_courier', expectedAmount: 500, actualAmount: 500, actualMethod: 'CASH' } });
    await prisma.foodPayment.create({ data: { userId: owner.id, branchId: branchA.id, orderId: order.id, amount: 500, method: 'CASH', paidAt: new Date() } });
    await prisma.foodCashSession.create({ data: { organizationId: owner.id, branchId: branchA.id, openedByUserId: owner.id, expectedClosingAmount: 500 } });
    await prisma.foodCashSession.create({ data: { organizationId: owner.id, branchId: branchA.id, openedByUserId: owner.id, closedByUserId: owner.id, status: 'closed', closingCountedAmount: 450, expectedClosingAmount: 500, differenceAmount: -50, approvalStatus: 'pending', closedAt: new Date() } });
    await prisma.foodPurchase.create({ data: { organizationId: owner.id, branchId: branchA.id, status: 'partial', total: 700 } });
    await prisma.foodIngredient.createMany({ data: [
      { organizationId: owner.id, branchId: branchA.id, internalCode: `NEG-${suffix}`, name: 'Stock negativo', unit: 'un', currentStock: -1, minimumStock: 2 },
      { organizationId: owner.id, branchId: branchA.id, internalCode: `LOW-${suffix}`, name: 'Stock baixo', unit: 'un', currentStock: 1, minimumStock: 2 },
    ] });
    await prisma.foodShift.create({ data: { organizationId: owner.id, branchId: branchA.id, personId: owner.id } });
    await prisma.foodFiscalDocument.create({ data: { userId: owner.id, branchId: branchA.id, orderId: order.id, status: 'failed', idempotencyKey: `fiscal-${suffix}`, errorCode: 'TEST' } });
    const access = { organizationId: owner.id, personId: owner.id, roles: ['manager'], primaryRole: 'manager', branchIds: [branchA.id], canAccessBranch: (id) => id === branchA.id };
    const month = new Date().toISOString().slice(0, 7);
    const readiness = await getFoodMonthCloseReadiness(prisma, access, { month });
    assert.equal(readiness.ready, false);
    for (const key of ['open_cash_sessions', 'delivery_collections', 'open_purchases', 'cash_differences', 'payment_mismatches', 'negative_stock', 'open_shifts']) {
      assert.equal(readiness.checks.find((item) => item.key === key)?.status, 'blocked', key);
    }
    assert.equal(readiness.checks.find((item) => item.key === 'low_stock')?.status, 'warning');
    assert.equal(readiness.checks.find((item) => item.key === 'failed_fiscal_documents')?.status, 'warning');
    const branchBReadiness = await getFoodMonthCloseReadiness(prisma, { ...access, branchIds: null }, { month, branchId: branchB.id });
    assert.equal(branchBReadiness.ready, true);
    await assert.rejects(
      createFoodMonthlyClose(prisma, access, { month, branchId: branchA.id }, { idempotencyKey: `blocked-${suffix}` }),
      (error) => error.statusCode === 409 && error.code === 'FOOD_MONTH_CLOSE_BLOCKED'
    );
    const closeKey = `close-${suffix}`;
    const globalAccess = { ...access, branchIds: null, canAccessBranch: () => true };
    const firstClose = await createFoodMonthlyClose(prisma, globalAccess, { month, branchId: branchB.id }, { idempotencyKey: closeKey });
    const repeatedClose = await createFoodMonthlyClose(prisma, globalAccess, { month, branchId: branchB.id }, { idempotencyKey: closeKey });
    assert.equal(firstClose.created, true);
    assert.equal(repeatedClose.created, false);
    assert.equal(repeatedClose.close.id, firstClose.close.id);
    assert.equal(firstClose.close.snapshot.summary.orders, 0);
    assert.equal(firstClose.close.validationSnapshot.ready, true);
    assert.equal(firstClose.close.events.length, 1);
    assert.equal(await prisma.foodMonthlyClose.count({ where: { organizationId: owner.id, branchId: branchB.id } }), 1);
    await assert.rejects(
      createFoodMonthlyClose(prisma, globalAccess, { month, branchId: branchB.id }, { idempotencyKey: `duplicate-${suffix}` }),
      (error) => error.statusCode === 409 && error.code === 'FOOD_MONTH_ALREADY_CLOSED'
    );
    await prisma.foodOrder.create({ data: { userId: owner.id, branchId: branchB.id, orderNumber: 2, orderState: 'active', orderType: 'pickup', total: 5000, subtotal: 5000 } });
    const storedClose = (await listFoodMonthlyCloses(prisma, globalAccess, { branchId: branchB.id }))[0];
    assert.equal(storedClose.snapshot.summary.orders, 0);
    assert.equal((await listFoodMonthlyCloses(prisma, access, {})).length, 0);
    await assert.rejects(
      reopenFoodMonthlyClose(prisma, globalAccess, storedClose.id, { version: 1, reason: 'não' }, { idempotencyKey: `short-reopen-${suffix}` }),
      (error) => error.statusCode === 400 && error.code === 'FOOD_MONTH_REOPEN_REASON_REQUIRED'
    );
    await assert.rejects(
      reopenFoodMonthlyClose(prisma, access, storedClose.id, { version: 1, reason: 'Correção necessária' }, { idempotencyKey: `branch-reopen-${suffix}` }),
      (error) => error.statusCode === 403 && error.code === 'FOOD_BRANCH_ACCESS_DENIED'
    );
    await assert.rejects(
      reopenFoodMonthlyClose(prisma, { ...globalAccess, organizationId: other.id, personId: other.id }, storedClose.id, { version: 1, reason: 'Correção necessária' }, { idempotencyKey: `tenant-reopen-${suffix}` }),
      (error) => error.statusCode === 404 && error.code === 'FOOD_MONTH_CLOSE_NOT_FOUND'
    );
    const originalSnapshot = structuredClone(storedClose.snapshot);
    const originalValidation = structuredClone(storedClose.validationSnapshot);
    const reopenKey = `reopen-${suffix}`;
    const reopened = await reopenFoodMonthlyClose(prisma, globalAccess, storedClose.id, { version: 1, reason: 'Corrigir lançamento do mês' }, { idempotencyKey: reopenKey });
    const repeatedReopen = await reopenFoodMonthlyClose(prisma, globalAccess, storedClose.id, { version: 1, reason: 'Corrigir lançamento do mês' }, { idempotencyKey: reopenKey });
    assert.equal(reopened.reopened, true);
    assert.equal(repeatedReopen.reopened, false);
    assert.equal(reopened.close.status, 'reopened');
    assert.equal(reopened.close.version, 2);
    assert.equal(reopened.close.reopenReason, 'Corrigir lançamento do mês');
    assert.equal(reopened.close.events.length, 2);
    assert.deepEqual(reopened.close.snapshot, originalSnapshot);
    assert.deepEqual(reopened.close.validationSnapshot, originalValidation);
    await assert.rejects(
      recloseFoodMonthlyClose(prisma, globalAccess, storedClose.id, { version: 2, reason: 'não' }, { idempotencyKey: `short-reclose-${suffix}` }),
      (error) => error.statusCode === 400 && error.code === 'FOOD_MONTH_RECLOSE_REASON_REQUIRED'
    );
    await assert.rejects(
      recloseFoodMonthlyClose(prisma, access, storedClose.id, { version: 2, reason: 'Lançamento corrigido' }, { idempotencyKey: `branch-reclose-${suffix}` }),
      (error) => error.statusCode === 403 && error.code === 'FOOD_BRANCH_ACCESS_DENIED'
    );
    await assert.rejects(
      recloseFoodMonthlyClose(prisma, { ...globalAccess, organizationId: other.id, personId: other.id }, storedClose.id, { version: 2, reason: 'Lançamento corrigido' }, { idempotencyKey: `tenant-reclose-${suffix}` }),
      (error) => error.statusCode === 404 && error.code === 'FOOD_MONTH_CLOSE_NOT_FOUND'
    );
    const recloseKey = `reclose-${suffix}`;
    const reclosed = await recloseFoodMonthlyClose(prisma, globalAccess, storedClose.id, { version: 2, reason: 'Lançamento corrigido e conferido' }, { idempotencyKey: recloseKey });
    const repeatedReclose = await recloseFoodMonthlyClose(prisma, globalAccess, storedClose.id, { version: 2, reason: 'Lançamento corrigido e conferido' }, { idempotencyKey: recloseKey });
    assert.equal(reclosed.reclosed, true);
    assert.equal(repeatedReclose.reclosed, false);
    assert.equal(reclosed.close.status, 'closed');
    assert.equal(reclosed.close.version, 3);
    assert.equal(reclosed.close.revisions.length, 1);
    assert.equal(reclosed.revision.revisionNumber, 2);
    assert.equal(reclosed.revision.aggregateVersion, 3);
    assert.equal(reclosed.revision.snapshot.summary.orders, 1);
    assert.deepEqual(reclosed.close.snapshot, originalSnapshot);
    assert.deepEqual(reclosed.close.validationSnapshot, originalValidation);
    const exportedRevision = await getFoodMonthlyCloseRevision(prisma, globalAccess, storedClose.id, reclosed.revision.id);
    assert.match(buildFoodMonthlyCloseCsv(exportedRevision), /"Pedidos";"1"/);
    assert.match(buildFoodMonthlyCloseCsv(exportedRevision), /"Revisão do snapshot";"2"/);
    const revisionPdf = await buildFoodMonthlyClosePdf(exportedRevision, { restaurantName: 'Close Test', currency: 'AOA' });
    assert.equal(revisionPdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(revisionPdf.length > 10000);
    await assert.rejects(
      getFoodMonthlyCloseRevision(prisma, access, storedClose.id, reclosed.revision.id),
      (error) => error.statusCode === 403 && error.code === 'FOOD_BRANCH_ACCESS_DENIED'
    );
    const exportedClose = await getFoodMonthlyClose(prisma, globalAccess, storedClose.id);
    const csv = buildFoodMonthlyCloseCsv(exportedClose);
    assert.match(csv, /"Pedidos";"0"/);
    assert.doesNotMatch(csv, /"Pedidos";"1"/);
    await assert.rejects(
      getFoodMonthlyClose(prisma, access, storedClose.id),
      (error) => error.statusCode === 403 && error.code === 'FOOD_BRANCH_ACCESS_DENIED'
    );
    await assert.rejects(
      getFoodMonthlyClose(prisma, { ...globalAccess, organizationId: other.id, personId: other.id }, storedClose.id),
      (error) => error.statusCode === 404 && error.code === 'FOOD_MONTH_CLOSE_NOT_FOUND'
    );
    const reopenedAgain = await reopenFoodMonthlyClose(prisma, globalAccess, storedClose.id, { version: 3, reason: 'Segunda correcção necessária' }, { idempotencyKey: `second-reopen-${suffix}` });
    assert.equal(reopenedAgain.close.version, 4);
    const competing = await Promise.allSettled([
      recloseFoodMonthlyClose(prisma, globalAccess, storedClose.id, { version: 4, reason: 'Segunda revisão conferida' }, { idempotencyKey: `concurrent-a-${suffix}` }),
      recloseFoodMonthlyClose(prisma, globalAccess, storedClose.id, { version: 4, reason: 'Segunda revisão concorrente' }, { idempotencyKey: `concurrent-b-${suffix}` }),
    ]);
    assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(competing.filter((result) => result.status === 'rejected').length, 1);
    const finalClose = await getFoodMonthlyClose(prisma, globalAccess, storedClose.id);
    assert.equal(finalClose.status, 'closed');
    assert.equal(finalClose.version, 5);
    assert.deepEqual(finalClose.revisions.map((revision) => revision.revisionNumber), [2, 3]);
    assert.deepEqual(finalClose.snapshot, originalSnapshot);
    const otherReadiness = await getFoodMonthCloseReadiness(prisma, { ...access, organizationId: other.id, personId: other.id, branchIds: null }, { month });
    assert.equal(otherReadiness.ready, true);
    await assert.rejects(
      getFoodMonthCloseReadiness(prisma, access, { month, branchId: branchB.id }),
      (error) => error.statusCode === 403 && error.code === 'FOOD_BRANCH_ACCESS_DENIED'
    );
  } finally {
    if (owner) {
      await prisma.foodFiscalDocument.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.foodMonthlyClose.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodOrder.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.foodPurchase.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodIngredient.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodCashSession.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodShift.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodBranch.deleteMany({ where: { userId: owner.id } }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { id: { in: [owner?.id, other?.id].filter(Boolean) } } }).catch(() => {});
    await prisma.$disconnect();
  }
});
