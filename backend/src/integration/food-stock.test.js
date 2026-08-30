const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('reposição Food deduplica alertas e isola tenant, unidade e fornecedor', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const { synchronizeFoodReplenishment, assertPreferredSupplier } = require('../services/food-stock-replenishment.service');
  const {
    saveFoodSupplierProduct,
    listFoodSupplierProducts,
    archiveFoodSupplierProduct,
    buildFoodPurchaseSuggestions,
  } = require('../services/food-supplier-catalog.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  const userIds = [];
  const branchIds = [];
  const supplierIds = [];
  const ingredientIds = [];
  const purchaseIds = [];

  try {
    const ownerA = await prisma.user.create({ data: { name: 'Stock A', email: `stock-a-${suffix}@example.test`, workspaceMode: 'food' } });
    const ownerB = await prisma.user.create({ data: { name: 'Stock B', email: `stock-b-${suffix}@example.test`, workspaceMode: 'food' } });
    userIds.push(ownerA.id, ownerB.id);
    const branchA = await prisma.foodBranch.create({ data: { userId: ownerA.id, name: 'Stock A', isMain: true, createdByUserId: ownerA.id } });
    const branchB = await prisma.foodBranch.create({ data: { userId: ownerB.id, name: 'Stock B', isMain: true, createdByUserId: ownerB.id } });
    branchIds.push(branchA.id, branchB.id);
    const supplierA = await prisma.foodSupplier.create({ data: { organizationId: ownerA.id, branchId: branchA.id, name: 'Fornecedor A', createdByUserId: ownerA.id } });
    const supplierA2 = await prisma.foodSupplier.create({ data: { organizationId: ownerA.id, branchId: branchA.id, name: 'Fornecedor A Económico', createdByUserId: ownerA.id } });
    const supplierB = await prisma.foodSupplier.create({ data: { organizationId: ownerB.id, branchId: branchB.id, name: 'Fornecedor B', createdByUserId: ownerB.id } });
    supplierIds.push(supplierA.id, supplierA2.id, supplierB.id);
    const ingredientA = await prisma.foodIngredient.create({ data: { organizationId: ownerA.id, branchId: branchA.id, internalCode: `A-${suffix}`, name: 'Farinha A', unit: 'kg', currentStock: 2, minimumStock: 5, idealStock: 20, purchaseUnit: 'saco', purchaseConversion: 6, preferredSupplierId: supplierA.id, createdByUserId: ownerA.id } });
    const ingredientB = await prisma.foodIngredient.create({ data: { organizationId: ownerB.id, branchId: branchB.id, internalCode: `B-${suffix}`, name: 'Farinha B', unit: 'kg', currentStock: 0, minimumStock: 2, idealStock: 8, createdByUserId: ownerB.id } });
    ingredientIds.push(ingredientA.id, ingredientB.id);
    const purchase = await prisma.foodPurchase.create({ data: { organizationId: ownerA.id, branchId: branchA.id, supplierId: supplierA.id, status: 'ordered', total: 6000, createdByUserId: ownerA.id, items: { create: { organizationId: ownerA.id, ingredientId: ingredientA.id, quantity: 6, unitCost: 1000, total: 6000 } } } });
    purchaseIds.push(purchase.id);

    const contextA = { organizationId: ownerA.id, personId: ownerA.id, branchIds: [branchA.id], canAccessBranch: (id) => id === branchA.id };
    const contextB = { organizationId: ownerB.id, personId: ownerB.id, branchIds: [branchB.id], canAccessBranch: (id) => id === branchB.id };
    const first = await synchronizeFoodReplenishment(prisma, contextA);
    assert.equal(first.items.length, 1);
    assert.equal(first.items[0].pendingQuantity, 6);
    assert.equal(first.items[0].recommendedQuantity, 12);
    assert.equal(first.items[0].recommendedPackages, 2);
    assert.equal(first.items[0].alert.status, 'open');
    const alertId = first.items[0].alert.id;

    const repeated = await synchronizeFoodReplenishment(prisma, contextA);
    assert.equal(repeated.items[0].alert.id, alertId);
    assert.equal(await prisma.foodStockAlert.count({ where: { ingredientId: ingredientA.id } }), 1);
    const isolated = await synchronizeFoodReplenishment(prisma, contextB);
    assert.deepEqual(isolated.items.map((item) => item.ingredient.id), [ingredientB.id]);

    await assert.rejects(
      assertPreferredSupplier(prisma, contextA, supplierB.id, branchA.id),
      (error) => error.code === 'FOOD_SUPPLIER_INVALID'
    );

    const preferredOffer = await saveFoodSupplierProduct(prisma, contextA, { supplierId: supplierA.id, ingredientId: ingredientA.id, purchaseUnit: 'saco', packageQuantity: 6, packagePrice: 6000, minimumPackages: 1, leadTimeDays: 2, qualityRating: 5 });
    const cheaperOffer = await saveFoodSupplierProduct(prisma, contextA, { supplierId: supplierA2.id, ingredientId: ingredientA.id, purchaseUnit: 'saco', packageQuantity: 5, packagePrice: 4000, minimumPackages: 1, leadTimeDays: 4, qualityRating: 4 });
    assert.equal(preferredOffer.normalizedUnitCost, 1000);
    assert.equal(cheaperOffer.normalizedUnitCost, 800);
    const updatedPreferred = await saveFoodSupplierProduct(prisma, contextA, { supplierId: supplierA.id, ingredientId: ingredientA.id, purchaseUnit: 'saco', packageQuantity: 6, packagePrice: 5700, minimumPackages: 1, leadTimeDays: 2 });
    assert.equal(updatedPreferred.id, preferredOffer.id);
    assert.equal((await listFoodSupplierProducts(prisma, contextA, { branchId: branchA.id }))[0].id, cheaperOffer.id);
    assert.equal((await listFoodSupplierProducts(prisma, contextB, { branchId: branchB.id })).length, 0);
    await assert.rejects(
      saveFoodSupplierProduct(prisma, contextA, { supplierId: supplierB.id, ingredientId: ingredientA.id, packageQuantity: 1, packagePrice: 1 }),
      (error) => error.code === 'FOOD_SUPPLIER_INVALID'
    );

    const preferredSuggestion = await buildFoodPurchaseSuggestions(prisma, contextA, branchA.id);
    assert.equal(preferredSuggestion.groups.length, 1);
    assert.equal(preferredSuggestion.groups[0].supplier.id, supplierA.id);
    assert.equal(preferredSuggestion.groups[0].items[0].packages, 2);
    await prisma.foodIngredient.update({ where: { id: ingredientA.id }, data: { preferredSupplierId: null } });
    const cheapestSuggestion = await buildFoodPurchaseSuggestions(prisma, contextA, branchA.id);
    assert.equal(cheapestSuggestion.groups[0].supplier.id, supplierA2.id);
    assert.equal(cheapestSuggestion.groups[0].items[0].packages, 3);
    await archiveFoodSupplierProduct(prisma, contextA, cheaperOffer.id);
    assert.equal((await listFoodSupplierProducts(prisma, contextA, { branchId: branchA.id })).length, 1);

    await prisma.foodIngredient.update({ where: { id: ingredientA.id }, data: { currentStock: 0 } });
    assert.equal((await synchronizeFoodReplenishment(prisma, contextA)).items[0].alert.severity, 'critical');
    await prisma.foodIngredient.update({ where: { id: ingredientA.id }, data: { currentStock: 10 } });
    const resolved = await synchronizeFoodReplenishment(prisma, contextA);
    assert.equal(resolved.items[0].alert.status, 'resolved');
    assert.equal(resolved.items[0].recommendedQuantity, 4);
    await prisma.foodIngredient.update({ where: { id: ingredientA.id }, data: { currentStock: 2 } });
    const reopened = await synchronizeFoodReplenishment(prisma, contextA);
    assert.equal(reopened.items[0].alert.id, alertId);
    assert.equal(reopened.items[0].alert.status, 'open');
  } finally {
    if (purchaseIds.length) await prisma.foodPurchase.deleteMany({ where: { id: { in: purchaseIds } } });
    if (ingredientIds.length) await prisma.foodIngredient.deleteMany({ where: { id: { in: ingredientIds } } });
    if (supplierIds.length) await prisma.foodSupplier.deleteMany({ where: { id: { in: supplierIds } } });
    if (branchIds.length) await prisma.foodBranch.deleteMany({ where: { id: { in: branchIds } } });
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
