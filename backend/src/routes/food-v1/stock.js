const express = require('express');
const prisma = require('../../lib/prisma');
const { requireFoodPermission } = require('../../lib/food-access');
const { domainError } = require('../../lib/food-domain');
const { recordFoodAudit } = require('../../lib/food-audit');
const { synchronizeFoodReplenishment, assertPreferredSupplier } = require('../../services/food-stock-replenishment.service');
const {
  saveFoodSupplierProduct,
  listFoodSupplierProducts,
  archiveFoodSupplierProduct,
  buildFoodPurchaseSuggestions,
} = require('../../services/food-supplier-catalog.service');
const { PURCHASE_INCLUDE, commandFoodPurchase, receiveFoodPurchaseItems } = require('../../services/food-purchase.service');
const { prepareSupplierWhatsAppDraft, listFoodStockMovements, getFoodStockReport } = require('../../services/food-stock-report.service');
const { handleFoodV1Error } = require('./errors');

const router = express.Router();

function text(value, max = 180) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, max) : null;
}

function nonNegative(value, label) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) throw domainError(`${label} inválido.`);
  return number;
}

function positive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw domainError(`${label} deve ser superior a zero.`);
  return number;
}

async function assertBranch(access, branchId) {
  if (!branchId || !access.canAccessBranch(branchId)) throw domainError('Unidade Food inválida.', 403);
  const branch = await prisma.foodBranch.findFirst({ where: { id: branchId, userId: access.organizationId, active: true } });
  if (!branch) throw domainError('Unidade Food não encontrada.', 404);
  return branch;
}

router.get('/ingredients', requireFoodPermission('stock.view'), async (req, res) => {
  try {
    const where = {
      organizationId: req.foodContext.organizationId,
      ...(req.query.active !== 'all' && { active: req.query.active !== 'false' }),
      ...(req.foodContext.branchIds === null ? {} : { OR: [{ branchId: null }, { branchId: { in: req.foodContext.branchIds } }] }),
      ...(req.query.search && { name: { contains: String(req.query.search), mode: 'insensitive' } }),
    };
    const ingredients = await prisma.foodIngredient.findMany({
      where,
      include: { branch: { select: { id: true, name: true } }, preferredSupplier: { select: { id: true, name: true, phone: true } }, _count: { select: { recipeItems: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(ingredients.map((ingredient) => ({
      ...ingredient,
      lowStock: ingredient.minimumStock > 0 && ingredient.currentStock <= ingredient.minimumStock,
    })));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar os ingredientes.');
  }
});

router.get('/replenishment', requireFoodPermission('stock.view'), async (req, res) => {
  try {
    res.json(await synchronizeFoodReplenishment(prisma, req.foodContext));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao calcular a reposição de stock.');
  }
});

router.get('/movements', requireFoodPermission('stock.view'), async (req, res) => {
  try {
    res.json(await listFoodStockMovements(prisma, req.foodContext, req.query));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar o histórico de stock.');
  }
});

router.get('/reports/summary', requireFoodPermission('stock.view'), async (req, res) => {
  try {
    res.json(await getFoodStockReport(prisma, req.foodContext, req.query));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao gerar o relatório de stock.');
  }
});

router.post('/ingredients', requireFoodPermission('stock.edit'), async (req, res) => {
  try {
    const internalCode = text(req.body?.internalCode, 50);
    const name = text(req.body?.name);
    const branchId = text(req.body?.branchId, 80);
    if (!internalCode || !name) throw domainError('Código e nome do ingrediente são obrigatórios.');
    if (branchId) await assertBranch(req.foodContext, branchId);
    const preferredSupplierId = await assertPreferredSupplier(prisma, req.foodContext, text(req.body?.preferredSupplierId, 80), branchId);
    const minimumStock = nonNegative(req.body?.minimumStock, 'Stock mínimo');
    const idealStock = nonNegative(req.body?.idealStock, 'Nível ideal');
    if (idealStock < minimumStock) throw domainError('O nível ideal não pode ser inferior ao stock mínimo.');
    const ingredient = await prisma.foodIngredient.create({
      data: {
        organizationId: req.foodContext.organizationId,
        branchId,
        internalCode,
        name,
        unit: text(req.body?.unit, 30) || 'unit',
        currentStock: nonNegative(req.body?.currentStock, 'Stock atual'),
        minimumStock,
        idealStock,
        purchaseUnit: text(req.body?.purchaseUnit, 30) || text(req.body?.unit, 30) || 'unit',
        purchaseConversion: positive(req.body?.purchaseConversion ?? 1, 'Conversão de compra'),
        preferredSupplierId,
        averageCost: nonNegative(req.body?.averageCost, 'Custo médio'),
        createdByUserId: req.foodContext.personId,
      },
    });
    await synchronizeFoodReplenishment(prisma, req.foodContext);
    await recordFoodAudit(prisma, req, { branchId: ingredient.branchId, action: 'stock.ingredient.created', entityType: 'food_ingredient', entityId: ingredient.id, payload: { internalCode: ingredient.internalCode } });
    res.status(201).json(ingredient);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao criar o ingrediente.');
  }
});

router.patch('/ingredients/:id', requireFoodPermission('stock.edit'), async (req, res) => {
  try {
    const existing = await prisma.foodIngredient.findFirst({
      where: { id: req.params.id, organizationId: req.foodContext.organizationId },
    });
    if (!existing) throw domainError('Ingrediente não encontrado.', 404);
    if (!req.foodContext.canAccessBranch(existing.branchId)) throw domainError('Não tem acesso a esta unidade.', 403);
    const data = {};
    if (req.body?.name !== undefined) data.name = text(req.body.name) || existing.name;
    if (req.body?.unit !== undefined) data.unit = text(req.body.unit, 30) || existing.unit;
    if (req.body?.minimumStock !== undefined) data.minimumStock = nonNegative(req.body.minimumStock, 'Stock mínimo');
    if (req.body?.idealStock !== undefined) data.idealStock = nonNegative(req.body.idealStock, 'Nível ideal');
    if (req.body?.purchaseUnit !== undefined) data.purchaseUnit = text(req.body.purchaseUnit, 30) || existing.purchaseUnit;
    if (req.body?.purchaseConversion !== undefined) data.purchaseConversion = positive(req.body.purchaseConversion, 'Conversão de compra');
    if (req.body?.preferredSupplierId !== undefined) data.preferredSupplierId = await assertPreferredSupplier(prisma, req.foodContext, text(req.body.preferredSupplierId, 80), existing.branchId);
    if (req.body?.averageCost !== undefined) data.averageCost = nonNegative(req.body.averageCost, 'Custo médio');
    if (req.body?.active !== undefined) data.active = req.body.active === true;
    const resultingMinimum = data.minimumStock ?? existing.minimumStock;
    const resultingIdeal = data.idealStock ?? existing.idealStock;
    if (resultingIdeal < resultingMinimum) throw domainError('O nível ideal não pode ser inferior ao stock mínimo.');
    const ingredient = await prisma.foodIngredient.update({ where: { id: existing.id }, data });
    await synchronizeFoodReplenishment(prisma, req.foodContext);
    await recordFoodAudit(prisma, req, { branchId: ingredient.branchId, action: 'stock.policy.updated', entityType: 'food_ingredient', entityId: ingredient.id, reason: req.body?.reason, payload: { fields: Object.keys(data) } });
    res.json(ingredient);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atualizar o ingrediente.');
  }
});

router.post('/ingredients/:id/adjustments', requireFoodPermission('stock.edit'), async (req, res) => {
  try {
    const delta = Number(req.body?.quantity);
    if (!Number.isFinite(delta) || delta === 0) throw domainError('A quantidade do ajuste não pode ser zero.');
    const result = await prisma.$transaction(async (tx) => {
      const ingredient = await tx.foodIngredient.findFirst({
        where: { id: req.params.id, organizationId: req.foodContext.organizationId, active: true },
      });
      if (!ingredient) throw domainError('Ingrediente não encontrado.', 404);
      if (!req.foodContext.canAccessBranch(ingredient.branchId)) throw domainError('Não tem acesso a esta unidade.', 403);
      const newStock = Number(ingredient.currentStock) + delta;
      if (newStock < 0) throw domainError('O ajuste deixaria o stock negativo.');
      const updated = await tx.foodIngredient.update({ where: { id: ingredient.id }, data: { currentStock: newStock } });
      await tx.foodStockMovement.create({
        data: {
          organizationId: req.foodContext.organizationId,
          branchId: ingredient.branchId,
          ingredientId: ingredient.id,
          type: 'adjustment',
          quantity: delta,
          previousStock: ingredient.currentStock,
          newStock,
          unitCost: ingredient.averageCost,
          reason: text(req.body?.reason, 240) || 'Ajuste manual',
          createdByUserId: req.foodContext.personId,
        },
      });
      return updated;
    });
    await synchronizeFoodReplenishment(prisma, req.foodContext);
    await recordFoodAudit(prisma, req, { branchId: result.branchId, action: 'stock.adjusted', entityType: 'food_ingredient', entityId: result.id, reason: req.body?.reason, payload: { quantity: delta, currentStock: result.currentStock } });
    res.json(result);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao ajustar o stock.');
  }
});

router.get('/products/:productId/recipe', requireFoodPermission('stock.view'), async (req, res) => {
  try {
    const product = await prisma.foodProduct.findFirst({
      where: { id: req.params.productId, userId: req.foodContext.organizationId, active: true },
      select: { id: true, branchId: true },
    });
    if (!product) throw domainError('Produto Food não encontrado.', 404);
    if (!req.foodContext.canAccessBranch(product.branchId)) throw domainError('Não tem acesso a esta unidade.', 403);
    const recipe = await prisma.foodRecipeItem.findMany({
      where: { organizationId: req.foodContext.organizationId, productId: product.id },
      include: { ingredient: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(recipe);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar a ficha técnica.');
  }
});

router.put('/products/:productId/recipe', requireFoodPermission('stock.edit'), async (req, res) => {
  try {
    const product = await prisma.foodProduct.findFirst({
      where: { id: req.params.productId, userId: req.foodContext.organizationId, active: true },
    });
    if (!product) throw domainError('Produto Food não encontrado.', 404);
    if (!req.foodContext.canAccessBranch(product.branchId)) throw domainError('Não tem acesso a esta unidade.', 403);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const ingredientIds = [...new Set(items.map((item) => String(item.ingredientId || '')).filter(Boolean))];
    const ingredients = await prisma.foodIngredient.findMany({
      where: { id: { in: ingredientIds }, organizationId: req.foodContext.organizationId, active: true },
    });
    if (ingredients.length !== ingredientIds.length) throw domainError('Uma ou mais matérias-primas são inválidas.');
    if (ingredients.some((ingredient) => ingredient.branchId && ingredient.branchId !== product.branchId)) {
      throw domainError('A ficha técnica contém um ingrediente limitado a outra unidade.');
    }
    const normalized = items.map((item) => {
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) throw domainError('As quantidades da ficha técnica devem ser superiores a zero.');
      return {
        organizationId: req.foodContext.organizationId,
        ingredientId: String(item.ingredientId),
        quantity,
        unit: text(item.unit, 30) || ingredients.find((ingredient) => ingredient.id === item.ingredientId)?.unit || 'unit',
        wastePercent: Math.min(100, nonNegative(item.wastePercent, 'Percentagem de desperdício')),
      };
    });
    const recipe = await prisma.$transaction(async (tx) => {
      await tx.foodRecipeItem.deleteMany({ where: { productId: product.id } });
      if (normalized.length) {
        await tx.foodRecipeItem.createMany({ data: normalized.map((item) => ({ ...item, productId: product.id })) });
      }
      return tx.foodRecipeItem.findMany({ where: { productId: product.id }, include: { ingredient: true } });
    });
    await recordFoodAudit(prisma, req, { branchId: product.branchId, action: 'stock.recipe.updated', entityType: 'food_product', entityId: product.id, payload: { ingredients: recipe.length } });
    res.json(recipe);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao guardar a ficha técnica.');
  }
});

router.get('/suppliers', requireFoodPermission('stock.view'), async (req, res) => {
  try {
    const suppliers = await prisma.foodSupplier.findMany({
      where: {
        organizationId: req.foodContext.organizationId,
        active: true,
        ...(req.foodContext.branchIds === null ? {} : { OR: [{ branchId: null }, { branchId: { in: req.foodContext.branchIds } }] }),
      },
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(suppliers);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar os fornecedores.');
  }
});

router.post('/suppliers', requireFoodPermission('stock.edit'), async (req, res) => {
  try {
    const name = text(req.body?.name);
    const branchId = text(req.body?.branchId, 80);
    if (!name) throw domainError('Nome do fornecedor é obrigatório.');
    if (branchId) await assertBranch(req.foodContext, branchId);
    const supplier = await prisma.foodSupplier.create({
      data: {
        organizationId: req.foodContext.organizationId,
        branchId,
        name,
        nif: text(req.body?.nif, 40),
        phone: text(req.body?.phone, 40),
        email: text(req.body?.email, 180),
        address: text(req.body?.address, 300),
        createdByUserId: req.foodContext.personId,
      },
    });
    await recordFoodAudit(prisma, req, { branchId: supplier.branchId, action: 'stock.supplier.created', entityType: 'food_supplier', entityId: supplier.id, payload: { name: supplier.name } });
    res.status(201).json(supplier);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao criar o fornecedor.');
  }
});

router.post('/suppliers/:id/whatsapp-draft', requireFoodPermission('stock.edit'), async (req, res) => {
  try {
    const draft = await prepareSupplierWhatsAppDraft(prisma, req.foodContext, req.params.id, req.body);
    const supplier = await prisma.foodSupplier.findUnique({ where: { id: draft.supplier.id }, select: { branchId: true } });
    await recordFoodAudit(prisma, req, { branchId: supplier?.branchId, action: 'stock.supplier.whatsapp_prepared', entityType: 'food_supplier', entityId: draft.supplier.id, payload: { items: Array.isArray(req.body?.items) ? req.body.items.length : 0 } });
    res.json(draft);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao preparar a mensagem para o fornecedor.');
  }
});

router.get('/supplier-products', requireFoodPermission('stock.view'), async (req, res) => {
  try {
    res.json(await listFoodSupplierProducts(prisma, req.foodContext, req.query));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar as condições dos fornecedores.');
  }
});

router.post('/supplier-products', requireFoodPermission('stock.edit'), async (req, res) => {
  try {
    const offer = await saveFoodSupplierProduct(prisma, req.foodContext, req.body);
    await recordFoodAudit(prisma, req, { branchId: offer.supplier.branchId || offer.ingredient.branchId, action: 'stock.supplier_product.saved', entityType: 'food_supplier_product', entityId: offer.id, payload: { supplierId: offer.supplierId, ingredientId: offer.ingredientId, normalizedUnitCost: offer.normalizedUnitCost } });
    res.status(201).json(offer);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao guardar a condição do fornecedor.');
  }
});

router.delete('/supplier-products/:id', requireFoodPermission('stock.edit'), async (req, res) => {
  try {
    const offer = await archiveFoodSupplierProduct(prisma, req.foodContext, req.params.id);
    await recordFoodAudit(prisma, req, { action: 'stock.supplier_product.archived', entityType: 'food_supplier_product', entityId: offer.id, reason: req.body?.reason, payload: { supplierId: offer.supplierId, ingredientId: offer.ingredientId } });
    res.status(204).end();
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao arquivar a condição do fornecedor.');
  }
});

router.get('/purchase-suggestions', requireFoodPermission('stock.view'), async (req, res) => {
  try {
    res.json(await buildFoodPurchaseSuggestions(prisma, req.foodContext, String(req.query.branchId || '')));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao preparar as sugestões de compra.');
  }
});

router.get('/purchases', requireFoodPermission('stock.view'), async (req, res) => {
  try {
    const purchases = await prisma.foodPurchase.findMany({
      where: {
        organizationId: req.foodContext.organizationId,
        ...(req.foodContext.branchIds === null ? {} : { branchId: { in: req.foodContext.branchIds } }),
      },
      include: PURCHASE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(purchases);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar as compras.');
  }
});

router.post('/purchases', requireFoodPermission('stock.edit'), async (req, res) => {
  try {
    const branchId = String(req.body?.branchId || '');
    await assertBranch(req.foodContext, branchId);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) throw domainError('Adicione pelo menos um ingrediente à compra.');
    const ingredientIds = [...new Set(items.map((item) => String(item.ingredientId || '')).filter(Boolean))];
    const ingredients = await prisma.foodIngredient.findMany({
      where: { id: { in: ingredientIds }, organizationId: req.foodContext.organizationId, active: true },
    });
    if (ingredients.length !== ingredientIds.length) throw domainError('Uma ou mais matérias-primas são inválidas.');
    if (ingredients.some((ingredient) => ingredient.branchId && ingredient.branchId !== branchId)) {
      throw domainError('A compra contém um ingrediente limitado a outra unidade.');
    }
    const normalized = items.map((item) => {
      const quantity = Number(item.quantity);
      const unitCost = Number(item.unitCost);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
        throw domainError('Quantidade ou custo de compra inválido.');
      }
      return { ingredientId: String(item.ingredientId), quantity, unitCost, total: quantity * unitCost };
    });
    const supplierId = text(req.body?.supplierId, 80);
    if (supplierId) {
      const supplier = await prisma.foodSupplier.findFirst({ where: { id: supplierId, organizationId: req.foodContext.organizationId, active: true } });
      if (!supplier) throw domainError('Fornecedor inválido.');
      if (supplier.branchId && supplier.branchId !== branchId) throw domainError('O fornecedor pertence a outra unidade.');
    }
    const purchase = await prisma.$transaction(async (tx) => {
      const created = await tx.foodPurchase.create({
        data: {
          organizationId: req.foodContext.organizationId,
          branchId,
          supplierId,
          status: 'draft',
          reference: text(req.body?.reference, 100),
          total: normalized.reduce((sum, item) => sum + item.total, 0),
          createdByUserId: req.foodContext.personId,
          items: { create: normalized.map((item) => ({ ...item, organizationId: req.foodContext.organizationId })) },
        },
      });
      await tx.foodPurchaseEvent.create({
        data: { organizationId: req.foodContext.organizationId, branchId, purchaseId: created.id, type: 'purchase.created', statusTo: 'draft', version: 1, actorUserId: req.foodContext.personId, idempotencyKey: `created:${created.id}`, payload: { total: created.total, items: normalized.length } },
      });
      return tx.foodPurchase.findUnique({ where: { id: created.id }, include: PURCHASE_INCLUDE });
    });
    await synchronizeFoodReplenishment(prisma, req.foodContext);
    await recordFoodAudit(prisma, req, { branchId: purchase.branchId, action: 'stock.purchase.created', entityType: 'food_purchase', entityId: purchase.id, payload: { supplierId: purchase.supplierId, total: purchase.total, items: purchase.items.length } });
    res.status(201).json(purchase);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao criar a compra.');
  }
});

router.post('/purchases/:id/commands', requireFoodPermission('stock.edit'), async (req, res) => {
  try {
    const purchase = await commandFoodPurchase(prisma, req.foodContext, req.params.id, req.body, req.get('Idempotency-Key'));
    await synchronizeFoodReplenishment(prisma, req.foodContext);
    await recordFoodAudit(prisma, req, { branchId: purchase.branchId, action: `stock.purchase.${req.body?.command}`, entityType: 'food_purchase', entityId: purchase.id, reason: req.body?.reason, payload: { status: purchase.status, version: purchase.version } });
    res.json(purchase);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao actualizar o estado da compra.');
  }
});

router.post('/purchases/:id/receipts', requireFoodPermission('stock.edit'), async (req, res) => {
  try {
    const purchase = await receiveFoodPurchaseItems(prisma, req.foodContext, req.params.id, req.body, req.get('Idempotency-Key'));
    await synchronizeFoodReplenishment(prisma, req.foodContext);
    await recordFoodAudit(prisma, req, { branchId: purchase.branchId, action: 'stock.purchase.receipt_confirmed', entityType: 'food_purchase', entityId: purchase.id, payload: { status: purchase.status, version: purchase.version, items: req.body?.items?.length || 0 } });
    res.json(purchase);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao confirmar a receção da compra.');
  }
});

router.post('/purchases/:id/receive', requireFoodPermission('stock.edit'), async (req, res) => {
  try {
    const purchase = await receiveFoodPurchaseItems(prisma, req.foodContext, req.params.id, {}, req.get('Idempotency-Key') || `legacy-receive:${req.params.id}`, { allowCurrentVersion: true });
    await synchronizeFoodReplenishment(prisma, req.foodContext);
    await recordFoodAudit(prisma, req, { branchId: purchase.branchId, action: 'stock.purchase.received', entityType: 'food_purchase', entityId: purchase.id, payload: { total: purchase.total, items: purchase.items.length } });
    res.json(purchase);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao receber a compra.');
  }
});

module.exports = router;
