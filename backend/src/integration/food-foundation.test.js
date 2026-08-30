const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('Food foundation isola catálogo e activação entre empresas', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const { isFoodEnabled } = require('../lib/food-foundation');
  const {
    requireCatalogBranch,
    requireCatalogCategory,
    requireCatalogModifierGroups,
  } = require('../lib/food-catalog-access');
  const { searchFoodCustomers } = require('../services/food-customer.service');
  const { recordFoodAudit } = require('../lib/food-audit');
  const prisma = new PrismaClient();
  const rollback = new Error('ROLLBACK_FOOD_FOUNDATION_TEST');
  const suffix = crypto.randomUUID();

  try {
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        const ownerA = await tx.user.create({
          data: { name: 'Food A', email: `food-a-${suffix}@example.test`, workspaceMode: 'food' },
        });
        const ownerB = await tx.user.create({
          data: { name: 'Food B', email: `food-b-${suffix}@example.test`, workspaceMode: 'food' },
        });

        await tx.foodSettings.create({
          data: {
            userId: ownerA.id,
            isEnabled: true,
            restaurantName: 'Restaurante A',
            createdByUserId: ownerA.id,
          },
        });

        const categoryA = await tx.foodCategory.create({
          data: {
            userId: ownerA.id,
            name: 'Burgers',
            createdByUserId: ownerA.id,
          },
        });
        const categoryB = await tx.foodCategory.create({
          data: { userId: ownerB.id, name: 'Categoria B', createdByUserId: ownerB.id },
        });
        const branchA = await tx.foodBranch.create({
          data: { userId: ownerA.id, name: 'Unidade A', isMain: true, createdByUserId: ownerA.id },
        });
        const branchB = await tx.foodBranch.create({
          data: { userId: ownerB.id, name: 'Unidade B', isMain: true, createdByUserId: ownerB.id },
        });
        const modifierB = await tx.foodModifierGroup.create({
          data: { userId: ownerB.id, name: 'Extras B', createdByUserId: ownerB.id },
        });

        const productA = await tx.foodProduct.create({
          data: {
            userId: ownerA.id,
            categoryId: categoryA.id,
            internalCode: 'FD-001',
            name: 'Burger clássico',
            price: 2500,
            createdByUserId: ownerA.id,
          },
        });
        const customerA = await tx.contact.create({
          data: {
            userId: ownerA.id,
            name: 'Cliente Métricas Food',
            phone: '+244923111222',
            email: '',
            company: 'Cliente Métricas Food',
            status: 'ativo',
          },
        });
        await tx.foodOrder.createMany({ data: [
          {
            userId: ownerA.id,
            branchId: branchA.id,
            contactId: customerA.id,
            orderNumber: 1,
            status: 'completed',
            orderState: 'completed',
            kitchenState: 'ready',
            deliveryState: 'not_required',
            paymentState: 'paid',
            orderType: 'pickup',
            customerName: customerA.name,
            customerPhone: customerA.phone,
            subtotal: 1000,
            total: 1000,
            completedAt: new Date(),
            createdAt: new Date(Date.now() - 1000),
          },
          {
            userId: ownerA.id,
            branchId: branchA.id,
            contactId: customerA.id,
            orderNumber: 2,
            status: 'cancelled',
            orderState: 'cancelled',
            kitchenState: 'not_required',
            deliveryState: 'not_required',
            paymentState: 'unpaid',
            orderType: 'pickup',
            customerName: customerA.name,
            customerPhone: customerA.phone,
            subtotal: 500,
            total: 500,
            cancelledAt: new Date(Date.now() + 1000),
            createdAt: new Date(),
          },
        ] });

        assert.equal(await isFoodEnabled(tx, ownerA.id), true);
        assert.equal(await isFoodEnabled(tx, ownerB.id), false);

        const visibleToA = await tx.foodProduct.count({ where: { userId: ownerA.id, active: true } });
        const visibleToB = await tx.foodProduct.count({ where: { userId: ownerB.id, active: true } });
        assert.equal(visibleToA, 1);
        assert.equal(visibleToB, 0);
        const customerResults = await searchFoodCustomers(tx, ownerA.id, 'Métricas');
        assert.equal(customerResults.length, 1);
        assert.equal(customerResults[0].totalOrders, 1);
        assert.equal(customerResults[0].totalSpent, 1000);
        assert.equal(customerResults[0].lastOrder.displayNumber, '#0002');
        assert.equal((await searchFoodCustomers(tx, ownerB.id, 'Métricas')).length, 0);

        const auditRequest = {
          foodContext: { organizationId: ownerA.id, personId: ownerA.id, primaryRole: 'manager' },
          headers: { 'user-agent': 'Food Integration Test' },
          ip: '127.0.0.1',
          get(name) {
            return { 'Idempotency-Key': `audit-${suffix}`, 'X-Food-Origin': 'integration-test', 'X-Food-Device': 'test-runner', 'User-Agent': 'Food Integration Test' }[name];
          },
        };
        const auditEvent = await recordFoodAudit(tx, auditRequest, {
          branchId: branchA.id,
          action: 'catalog.product.updated',
          entityType: 'food_product',
          entityId: productA.id,
          reason: 'Teste de auditoria',
          payload: { fields: ['price'] },
        });
        const repeatedAudit = await recordFoodAudit(tx, auditRequest, {
          branchId: branchA.id,
          action: 'catalog.product.updated',
          entityType: 'food_product',
          entityId: productA.id,
        });
        assert.equal(repeatedAudit.id, auditEvent.id);
        assert.equal(await tx.foodAuditEvent.count({ where: { organizationId: ownerA.id } }), 1);
        assert.equal(await tx.foodAuditEvent.count({ where: { organizationId: ownerB.id } }), 0);
        assert.equal(auditEvent.actorRole, 'manager');
        assert.equal(auditEvent.device, 'test-runner');
        assert.equal(auditEvent.reason, 'Teste de auditoria');

        const accessA = {
          organizationId: ownerA.id,
          canAccessBranch: (branchId) => branchId === branchA.id,
        };
        assert.equal(await requireCatalogBranch(tx, accessA, branchA.id), branchA.id);
        await assert.rejects(
          requireCatalogBranch(tx, accessA, branchB.id),
          (error) => error.code === 'FOOD_BRANCH_INVALID'
        );
        await assert.rejects(
          requireCatalogCategory(tx, ownerA.id, categoryB.id),
          (error) => error.code === 'FOOD_CATEGORY_INVALID'
        );
        await assert.rejects(
          requireCatalogModifierGroups(tx, ownerA.id, [modifierB.id]),
          (error) => error.code === 'FOOD_MODIFIER_GROUP_INVALID'
        );

        await tx.foodProduct.update({
          where: { id: productA.id },
          data: { active: false, available: false, archivedAt: new Date() },
        });

        const archived = await tx.foodProduct.findFirst({
          where: { id: productA.id, userId: ownerA.id },
          select: { active: true, available: true, archivedAt: true },
        });
        assert.equal(archived.active, false);
        assert.equal(archived.available, false);
        assert.ok(archived.archivedAt);
        assert.equal(await tx.foodProduct.count({ where: { userId: ownerA.id, active: true } }), 0);

        throw rollback;
      }),
      (error) => error === rollback
    );
  } finally {
    await prisma.$disconnect();
  }
});
