const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('relatório, movimentos e rascunho WhatsApp respeitam organização e unidade', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const { prepareSupplierWhatsAppDraft, listFoodStockMovements, getFoodStockReport } = require('../services/food-stock-report.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  const userIds = [];
  const branchIds = [];
  const ingredientIds = [];
  const supplierIds = [];
  const purchaseIds = [];

  try {
    const ownerA = await prisma.user.create({ data: { name: 'Stock Report A', email: `stock-report-a-${suffix}@example.test`, workspaceMode: 'food' } });
    const ownerB = await prisma.user.create({ data: { name: 'Stock Report B', email: `stock-report-b-${suffix}@example.test`, workspaceMode: 'food' } });
    userIds.push(ownerA.id, ownerB.id);
    const branchA = await prisma.foodBranch.create({ data: { userId: ownerA.id, name: 'Unidade A', isMain: true, createdByUserId: ownerA.id } });
    const branchB = await prisma.foodBranch.create({ data: { userId: ownerB.id, name: 'Unidade B', isMain: true, createdByUserId: ownerB.id } });
    branchIds.push(branchA.id, branchB.id);
    const ingredientA = await prisma.foodIngredient.create({ data: { organizationId: ownerA.id, branchId: branchA.id, internalCode: `RA-${suffix}`, name: 'Farinha A', unit: 'kg', currentStock: 8, minimumStock: 10, idealStock: 20, averageCost: 500, createdByUserId: ownerA.id } });
    const ingredientB = await prisma.foodIngredient.create({ data: { organizationId: ownerB.id, branchId: branchB.id, internalCode: `RB-${suffix}`, name: 'Farinha B', unit: 'kg', currentStock: 99, minimumStock: 0, idealStock: 0, averageCost: 900, createdByUserId: ownerB.id } });
    ingredientIds.push(ingredientA.id, ingredientB.id);
    const supplierA = await prisma.foodSupplier.create({ data: { organizationId: ownerA.id, branchId: branchA.id, name: 'Fornecedor A', phone: '923 123 456', createdByUserId: ownerA.id } });
    const supplierB = await prisma.foodSupplier.create({ data: { organizationId: ownerB.id, branchId: branchB.id, name: 'Fornecedor B', phone: '924 123 456', createdByUserId: ownerB.id } });
    supplierIds.push(supplierA.id, supplierB.id);
    await prisma.foodStockAlert.create({ data: { organizationId: ownerA.id, branchId: branchA.id, ingredientId: ingredientA.id, status: 'open', severity: 'warning', recommendedQuantity: 12 } });
    await prisma.foodStockMovement.createMany({ data: [
      { organizationId: ownerA.id, branchId: branchA.id, ingredientId: ingredientA.id, type: 'adjustment', quantity: 3, previousStock: 5, newStock: 8, unitCost: 500, reason: 'Contagem', createdByUserId: ownerA.id },
      { organizationId: ownerB.id, branchId: branchB.id, ingredientId: ingredientB.id, type: 'adjustment', quantity: 40, previousStock: 59, newStock: 99, unitCost: 900, reason: 'Outro tenant', createdByUserId: ownerB.id },
    ] });
    const receivedPurchase = await prisma.foodPurchase.create({ data: { organizationId: ownerA.id, branchId: branchA.id, supplierId: supplierA.id, status: 'received', total: 5000, purchasedAt: new Date(), receivedAt: new Date(), createdByUserId: ownerA.id } });
    const openPurchase = await prisma.foodPurchase.create({ data: { organizationId: ownerA.id, branchId: branchA.id, supplierId: supplierA.id, status: 'confirmed', total: 3000, purchasedAt: new Date(), createdByUserId: ownerA.id } });
    const foreignPurchase = await prisma.foodPurchase.create({ data: { organizationId: ownerB.id, branchId: branchB.id, supplierId: supplierB.id, status: 'confirmed', total: 99000, purchasedAt: new Date(), createdByUserId: ownerB.id } });
    purchaseIds.push(receivedPurchase.id, openPurchase.id, foreignPurchase.id);
    const contextA = { organizationId: ownerA.id, personId: ownerA.id, branchIds: [branchA.id], canAccessBranch: (id) => !id || id === branchA.id };

    const draft = await prepareSupplierWhatsAppDraft(prisma, contextA, supplierA.id, { items: [{ name: 'Farinha A', packages: 2, purchaseUnit: 'sacos' }] });
    assert.equal(draft.phone, '244923123456');
    assert.match(draft.message, /Farinha A: 2 sacos/);
    assert.match(draft.url, /^https:\/\/wa\.me\/244923123456\?text=/);
    await assert.rejects(
      prepareSupplierWhatsAppDraft(prisma, contextA, supplierB.id, {}),
      (error) => error.code === 'FOOD_SUPPLIER_NOT_FOUND'
    );

    const movements = await listFoodStockMovements(prisma, contextA, { branchId: branchA.id, days: 30 });
    assert.equal(movements.length, 1);
    assert.equal(movements[0].ingredientId, ingredientA.id);
    const report = await getFoodStockReport(prisma, contextA, { branchId: branchA.id, days: 30 });
    assert.equal(report.inventory.ingredients, 1);
    assert.equal(report.inventory.value, 4000);
    assert.equal(report.inventory.alerts, 1);
    assert.equal(report.movements.entries, 3);
    assert.equal(report.purchases.openCount, 1);
    assert.equal(report.purchases.openValue, 3000);
    assert.equal(report.purchases.receivedCount, 1);
    assert.equal(report.purchases.receivedValue, 5000);
  } finally {
    if (ingredientIds.length) await prisma.foodStockAlert.deleteMany({ where: { ingredientId: { in: ingredientIds } } });
    if (ingredientIds.length) await prisma.foodStockMovement.deleteMany({ where: { ingredientId: { in: ingredientIds } } });
    if (purchaseIds.length) await prisma.foodPurchase.deleteMany({ where: { id: { in: purchaseIds } } });
    if (supplierIds.length) await prisma.foodSupplier.deleteMany({ where: { id: { in: supplierIds } } });
    if (ingredientIds.length) await prisma.foodIngredient.deleteMany({ where: { id: { in: ingredientIds } } });
    if (branchIds.length) await prisma.foodBranch.deleteMany({ where: { id: { in: branchIds } } });
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
