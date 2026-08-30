const { domainError } = require('../lib/food-domain');

const OPEN_PURCHASE_STATUSES = ['draft', 'ordered', 'awaiting_confirmation', 'confirmed', 'in_delivery', 'partial'];

function replenishmentValues(ingredient, pendingQuantity = 0) {
  const currentStock = Number(ingredient.currentStock || 0);
  const minimumStock = Number(ingredient.minimumStock || 0);
  const idealStock = Math.max(minimumStock, Number(ingredient.idealStock || 0));
  const pending = Math.max(0, Number(pendingQuantity || 0));
  const purchaseConversion = Math.max(0.000001, Number(ingredient.purchaseConversion || 1));
  const recommendedQuantity = Math.max(0, idealStock - currentStock - pending);
  return {
    currentStock,
    minimumStock,
    idealStock,
    pendingQuantity: pending,
    recommendedQuantity,
    recommendedPackages: recommendedQuantity > 0 ? Math.ceil(recommendedQuantity / purchaseConversion) : 0,
    needsAlert: minimumStock > 0 && currentStock <= minimumStock,
    severity: currentStock <= 0 ? 'critical' : 'warning',
  };
}

function ingredientScope(context) {
  return {
    organizationId: context.organizationId,
    active: true,
    ...(context.branchIds === null ? {} : { OR: [{ branchId: null }, { branchId: { in: context.branchIds } }] }),
  };
}

async function synchronizeFoodReplenishment(prisma, context) {
  const ingredients = await prisma.foodIngredient.findMany({
    where: ingredientScope(context),
    include: {
      branch: { select: { id: true, name: true } },
      preferredSupplier: { select: { id: true, name: true, phone: true, branchId: true } },
      stockAlert: true,
    },
    orderBy: { name: 'asc' },
  });
  const ingredientIds = ingredients.map((ingredient) => ingredient.id);
  if (!ingredientIds.length) return { summary: { alerts: 0, critical: 0, recommendedItems: 0 }, items: [] };

  const [pendingItems, recentPurchaseItems] = await Promise.all([
    prisma.foodPurchaseItem.findMany({
      where: {
        organizationId: context.organizationId,
        ingredientId: { in: ingredientIds },
        purchase: { status: { in: OPEN_PURCHASE_STATUSES } },
      },
      select: { ingredientId: true, quantity: true, receivedQuantity: true },
    }),
    prisma.foodPurchaseItem.findMany({
      where: { organizationId: context.organizationId, ingredientId: { in: ingredientIds } },
      select: { ingredientId: true, unitCost: true, createdAt: true, purchase: { select: { id: true, status: true, supplierId: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const pendingByIngredient = new Map();
  for (const item of pendingItems) {
    const remaining = Math.max(0, Number(item.quantity) - Number(item.receivedQuantity || 0));
    pendingByIngredient.set(item.ingredientId, (pendingByIngredient.get(item.ingredientId) || 0) + remaining);
  }
  const lastPurchaseByIngredient = new Map();
  for (const item of recentPurchaseItems) {
    if (!lastPurchaseByIngredient.has(item.ingredientId)) lastPurchaseByIngredient.set(item.ingredientId, item);
  }

  const now = new Date();
  const rows = [];
  for (const ingredient of ingredients) {
    const values = replenishmentValues(ingredient, pendingByIngredient.get(ingredient.id));
    let alert = ingredient.stockAlert;
    if (values.needsAlert) {
      const data = {
        organizationId: context.organizationId,
        branchId: ingredient.branchId,
        status: 'open',
        severity: values.severity,
        recommendedQuantity: values.recommendedQuantity,
        resolvedAt: null,
        lastEvaluatedAt: now,
        ...(!alert || alert.status === 'resolved' ? { openedAt: now } : {}),
      };
      alert = alert
        ? await prisma.foodStockAlert.update({ where: { id: alert.id }, data })
        : await prisma.foodStockAlert.create({ data: { ...data, ingredientId: ingredient.id } });
    } else if (alert?.status === 'open') {
      alert = await prisma.foodStockAlert.update({
        where: { id: alert.id },
        data: { status: 'resolved', resolvedAt: now, recommendedQuantity: 0, lastEvaluatedAt: now },
      });
    } else if (alert) {
      alert = await prisma.foodStockAlert.update({ where: { id: alert.id }, data: { lastEvaluatedAt: now } });
    }
    const lastPurchase = lastPurchaseByIngredient.get(ingredient.id);
    rows.push({
      ingredient: { ...ingredient, stockAlert: undefined },
      ...values,
      alert,
      lastUnitCost: lastPurchase ? Number(lastPurchase.unitCost) : null,
      lastPurchaseId: lastPurchase?.purchase.id || null,
    });
  }
  return {
    summary: {
      alerts: rows.filter((row) => row.alert?.status === 'open').length,
      critical: rows.filter((row) => row.alert?.status === 'open' && row.alert.severity === 'critical').length,
      recommendedItems: rows.filter((row) => row.recommendedQuantity > 0).length,
    },
    items: rows,
  };
}

async function assertPreferredSupplier(prisma, context, supplierId, branchId) {
  if (!supplierId) return null;
  const supplier = await prisma.foodSupplier.findFirst({
    where: { id: supplierId, organizationId: context.organizationId, active: true },
    select: { id: true, branchId: true },
  });
  if (!supplier) throw domainError('Fornecedor preferencial inválido.', 400, 'FOOD_SUPPLIER_INVALID');
  if (supplier.branchId && supplier.branchId !== branchId) {
    throw domainError('O fornecedor preferencial pertence a outra unidade.', 400, 'FOOD_SUPPLIER_BRANCH_INVALID');
  }
  if (supplier.branchId && !context.canAccessBranch(supplier.branchId)) {
    throw domainError('Não tem acesso ao fornecedor preferencial.', 403, 'FOOD_SUPPLIER_FORBIDDEN');
  }
  return supplier.id;
}

module.exports = {
  OPEN_PURCHASE_STATUSES,
  replenishmentValues,
  synchronizeFoodReplenishment,
  assertPreferredSupplier,
};
