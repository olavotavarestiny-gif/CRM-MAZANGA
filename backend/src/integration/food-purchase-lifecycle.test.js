const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('compras Food versionam comandos e recebem stock parcialmente uma única vez', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const { commandFoodPurchase, receiveFoodPurchaseItems } = require('../services/food-purchase.service');
  const { synchronizeFoodReplenishment } = require('../services/food-stock-replenishment.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  const userIds = [];
  const branchIds = [];
  const ingredientIds = [];
  const purchaseIds = [];

  try {
    const ownerA = await prisma.user.create({ data: { name: 'Purchase A', email: `purchase-a-${suffix}@example.test`, workspaceMode: 'food' } });
    const ownerB = await prisma.user.create({ data: { name: 'Purchase B', email: `purchase-b-${suffix}@example.test`, workspaceMode: 'food' } });
    userIds.push(ownerA.id, ownerB.id);
    const branchA = await prisma.foodBranch.create({ data: { userId: ownerA.id, name: 'Purchase A', isMain: true, createdByUserId: ownerA.id } });
    const branchB = await prisma.foodBranch.create({ data: { userId: ownerB.id, name: 'Purchase B', isMain: true, createdByUserId: ownerB.id } });
    branchIds.push(branchA.id, branchB.id);
    const ingredientA1 = await prisma.foodIngredient.create({ data: { organizationId: ownerA.id, branchId: branchA.id, internalCode: `PA1-${suffix}`, name: 'Ingrediente A1', unit: 'kg', currentStock: 0, minimumStock: 2, idealStock: 20, averageCost: 0, createdByUserId: ownerA.id } });
    const ingredientA2 = await prisma.foodIngredient.create({ data: { organizationId: ownerA.id, branchId: branchA.id, internalCode: `PA2-${suffix}`, name: 'Ingrediente A2', unit: 'l', currentStock: 0, minimumStock: 1, idealStock: 8, averageCost: 0, createdByUserId: ownerA.id } });
    ingredientIds.push(ingredientA1.id, ingredientA2.id);
    const purchase = await prisma.foodPurchase.create({ data: { organizationId: ownerA.id, branchId: branchA.id, status: 'draft', total: 14000, createdByUserId: ownerA.id, items: { create: [
      { organizationId: ownerA.id, ingredientId: ingredientA1.id, quantity: 10, unitCost: 1000, total: 10000 },
      { organizationId: ownerA.id, ingredientId: ingredientA2.id, quantity: 4, unitCost: 1000, total: 4000 },
    ] } }, include: { items: true } });
    purchaseIds.push(purchase.id);
    const contextA = { organizationId: ownerA.id, personId: ownerA.id, branchIds: [branchA.id], canAccessBranch: (id) => id === branchA.id };
    const contextB = { organizationId: ownerB.id, personId: ownerB.id, branchIds: [branchB.id], canAccessBranch: (id) => id === branchB.id };

    const submitted = await commandFoodPurchase(prisma, contextA, purchase.id, { command: 'submit', version: 1 }, 'submit-1');
    assert.equal(submitted.status, 'awaiting_confirmation');
    assert.equal(submitted.version, 2);
    const repeatedSubmit = await commandFoodPurchase(prisma, contextA, purchase.id, { command: 'submit', version: 1 }, 'submit-1');
    assert.equal(repeatedSubmit.version, 2);
    assert.equal(await prisma.foodPurchaseEvent.count({ where: { purchaseId: purchase.id, idempotencyKey: 'submit-1' } }), 1);
    await assert.rejects(
      commandFoodPurchase(prisma, contextA, purchase.id, { command: 'confirm', version: 1 }, 'confirm-conflict'),
      (error) => error.code === 'FOOD_PURCHASE_VERSION_CONFLICT'
    );
    const confirmed = await commandFoodPurchase(prisma, contextA, purchase.id, { command: 'confirm', version: 2 }, 'confirm-1');
    const dispatched = await commandFoodPurchase(prisma, contextA, purchase.id, { command: 'dispatch', version: confirmed.version }, 'dispatch-1');
    assert.equal(dispatched.status, 'in_delivery');
    assert.equal(dispatched.version, 4);

    await assert.rejects(
      commandFoodPurchase(prisma, contextB, purchase.id, { command: 'cancel', version: 4, reason: 'Ataque externo' }, 'foreign-command'),
      (error) => error.code === 'FOOD_PURCHASE_NOT_FOUND'
    );
    const item1 = purchase.items.find((item) => item.ingredientId === ingredientA1.id);
    const item2 = purchase.items.find((item) => item.ingredientId === ingredientA2.id);
    const partial = await receiveFoodPurchaseItems(prisma, contextA, purchase.id, { version: 4, items: [
      { purchaseItemId: item1.id, quantity: 4 },
      { purchaseItemId: item2.id, quantity: 4 },
    ] }, 'receipt-1');
    assert.equal(partial.status, 'partial');
    assert.equal(partial.version, 5);
    assert.equal((await prisma.foodIngredient.findUnique({ where: { id: ingredientA1.id } })).currentStock, 4);
    assert.equal((await prisma.foodIngredient.findUnique({ where: { id: ingredientA2.id } })).currentStock, 4);
    const partialReplenishment = await synchronizeFoodReplenishment(prisma, contextA);
    assert.equal(partialReplenishment.items.find((item) => item.ingredient.id === ingredientA1.id).pendingQuantity, 6);
    assert.equal(partialReplenishment.items.find((item) => item.ingredient.id === ingredientA2.id).pendingQuantity, 0);
    const repeatedReceipt = await receiveFoodPurchaseItems(prisma, contextA, purchase.id, { version: 4, items: [{ purchaseItemId: item1.id, quantity: 4 }] }, 'receipt-1');
    assert.equal(repeatedReceipt.version, 5);
    assert.equal((await prisma.foodIngredient.findUnique({ where: { id: ingredientA1.id } })).currentStock, 4);
    await assert.rejects(
      receiveFoodPurchaseItems(prisma, contextA, purchase.id, { version: 5, items: [{ purchaseItemId: item1.id, quantity: 7 }] }, 'receipt-invalid'),
      (error) => error.code === 'FOOD_PURCHASE_RECEIPT_QUANTITY_INVALID'
    );
    const completed = await receiveFoodPurchaseItems(prisma, contextA, purchase.id, { version: 5, items: [{ purchaseItemId: item1.id, quantity: 6 }] }, 'receipt-2');
    assert.equal(completed.status, 'received');
    assert.equal(completed.version, 6);
    assert.equal(completed.items.find((item) => item.id === item1.id).receivedQuantity, 10);
    assert.equal((await prisma.foodIngredient.findUnique({ where: { id: ingredientA1.id } })).currentStock, 10);
    assert.equal(await prisma.foodStockMovement.count({ where: { purchaseId: purchase.id } }), 3);

    const cancelPurchase = await prisma.foodPurchase.create({ data: { organizationId: ownerA.id, branchId: branchA.id, status: 'draft', total: 3000, createdByUserId: ownerA.id, items: { create: { organizationId: ownerA.id, ingredientId: ingredientA1.id, quantity: 3, unitCost: 1000, total: 3000 } } } });
    purchaseIds.push(cancelPurchase.id);
    const beforeCancel = await synchronizeFoodReplenishment(prisma, contextA);
    assert.equal(beforeCancel.items.find((item) => item.ingredient.id === ingredientA1.id).pendingQuantity, 3);
    const cancelled = await commandFoodPurchase(prisma, contextA, cancelPurchase.id, { command: 'cancel', version: 1, reason: 'Fornecedor indisponível' }, 'cancel-1');
    assert.equal(cancelled.status, 'cancelled');
    assert.equal((await synchronizeFoodReplenishment(prisma, contextA)).items.find((item) => item.ingredient.id === ingredientA1.id).pendingQuantity, 0);
  } finally {
    if (ingredientIds.length) await prisma.foodStockMovement.deleteMany({ where: { ingredientId: { in: ingredientIds } } });
    if (purchaseIds.length) await prisma.foodPurchase.deleteMany({ where: { id: { in: purchaseIds } } });
    if (ingredientIds.length) await prisma.foodIngredient.deleteMany({ where: { id: { in: ingredientIds } } });
    if (branchIds.length) await prisma.foodBranch.deleteMany({ where: { id: { in: branchIds } } });
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
