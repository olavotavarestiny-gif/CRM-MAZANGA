const { domainError } = require('../lib/food-domain');
const { synchronizeFoodReplenishment } = require('./food-stock-replenishment.service');

function cleanText(value, max = 180) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, max) : null;
}

function positive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw domainError(`${label} deve ser superior a zero.`);
  return number;
}

function integerAtLeast(value, minimum, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum) throw domainError(`${label} inválido.`);
  return number;
}

function normalizedOffer(offer) {
  return { ...offer, normalizedUnitCost: Number(offer.packagePrice) / Number(offer.packageQuantity) };
}

async function scopedSupplierAndIngredient(prisma, context, supplierId, ingredientId) {
  const [supplier, ingredient] = await Promise.all([
    prisma.foodSupplier.findFirst({ where: { id: supplierId, organizationId: context.organizationId, active: true } }),
    prisma.foodIngredient.findFirst({ where: { id: ingredientId, organizationId: context.organizationId, active: true } }),
  ]);
  if (!supplier) throw domainError('Fornecedor inválido.', 400, 'FOOD_SUPPLIER_INVALID');
  if (!ingredient) throw domainError('Ingrediente inválido.', 400, 'FOOD_INGREDIENT_INVALID');
  if (!context.canAccessBranch(supplier.branchId) || !context.canAccessBranch(ingredient.branchId)) {
    throw domainError('Não tem acesso à unidade desta condição.', 403, 'FOOD_SUPPLIER_PRODUCT_FORBIDDEN');
  }
  if (supplier.branchId && ingredient.branchId && supplier.branchId !== ingredient.branchId) {
    throw domainError('Fornecedor e ingrediente pertencem a unidades diferentes.', 400, 'FOOD_SUPPLIER_PRODUCT_BRANCH_INVALID');
  }
  return { supplier, ingredient };
}

async function saveFoodSupplierProduct(prisma, context, input = {}) {
  const supplierId = String(input.supplierId || '');
  const ingredientId = String(input.ingredientId || '');
  const { ingredient } = await scopedSupplierAndIngredient(prisma, context, supplierId, ingredientId);
  const packageQuantity = positive(input.packageQuantity, 'Quantidade por embalagem');
  const packagePrice = positive(input.packagePrice, 'Preço da embalagem');
  const qualityRating = input.qualityRating === null || input.qualityRating === undefined || input.qualityRating === ''
    ? null
    : Number(input.qualityRating);
  if (qualityRating !== null && (!Number.isFinite(qualityRating) || qualityRating < 1 || qualityRating > 5)) {
    throw domainError('Qualidade deve estar entre 1 e 5.');
  }
  const data = {
    organizationId: context.organizationId,
    purchaseUnit: cleanText(input.purchaseUnit, 30) || ingredient.purchaseUnit || ingredient.unit,
    packageQuantity,
    packagePrice,
    minimumPackages: integerAtLeast(input.minimumPackages ?? 1, 1, 'Mínimo de embalagens'),
    leadTimeDays: integerAtLeast(input.leadTimeDays ?? 0, 0, 'Prazo de entrega'),
    qualityRating,
    paymentTerms: cleanText(input.paymentTerms, 180),
    active: true,
    updatedByUserId: context.personId,
  };
  const offer = await prisma.foodSupplierProduct.upsert({
    where: { supplierId_ingredientId: { supplierId, ingredientId } },
    create: { ...data, supplierId, ingredientId, createdByUserId: context.personId },
    update: data,
    include: { supplier: true, ingredient: { include: { branch: { select: { id: true, name: true } } } } },
  });
  return normalizedOffer(offer);
}

async function listFoodSupplierProducts(prisma, context, input = {}) {
  const branchIds = input.branchId ? [String(input.branchId)] : context.branchIds;
  if (input.branchId && !context.canAccessBranch(String(input.branchId))) throw domainError('Não tem acesso a esta unidade.', 403);
  const branchScope = branchIds === null ? {} : { OR: [{ branchId: null }, { branchId: { in: branchIds } }] };
  const offers = await prisma.foodSupplierProduct.findMany({
    where: {
      organizationId: context.organizationId,
      active: input.active !== false,
      ...(input.ingredientId ? { ingredientId: String(input.ingredientId) } : {}),
      supplier: { active: true, ...branchScope },
      ingredient: { active: true, ...branchScope },
    },
    include: { supplier: true, ingredient: { include: { branch: { select: { id: true, name: true } } } } },
  });
  return offers.map(normalizedOffer).sort((left, right) => left.normalizedUnitCost - right.normalizedUnitCost || left.leadTimeDays - right.leadTimeDays);
}

async function archiveFoodSupplierProduct(prisma, context, id) {
  const offer = await prisma.foodSupplierProduct.findFirst({
    where: { id, organizationId: context.organizationId, active: true },
    include: { supplier: true, ingredient: true },
  });
  if (!offer) throw domainError('Condição de fornecimento não encontrada.', 404, 'FOOD_SUPPLIER_PRODUCT_NOT_FOUND');
  if (!context.canAccessBranch(offer.supplier.branchId) || !context.canAccessBranch(offer.ingredient.branchId)) {
    throw domainError('Não tem acesso a esta condição.', 403, 'FOOD_SUPPLIER_PRODUCT_FORBIDDEN');
  }
  return prisma.foodSupplierProduct.update({ where: { id: offer.id }, data: { active: false, updatedByUserId: context.personId } });
}

async function buildFoodPurchaseSuggestions(prisma, context, branchId) {
  if (!branchId || !context.canAccessBranch(branchId)) throw domainError('Unidade Food inválida.', 403, 'FOOD_BRANCH_INVALID');
  const branch = await prisma.foodBranch.findFirst({ where: { id: branchId, userId: context.organizationId, active: true }, select: { id: true, name: true } });
  if (!branch) throw domainError('Unidade Food não encontrada.', 404, 'FOOD_BRANCH_NOT_FOUND');
  const replenishment = await synchronizeFoodReplenishment(prisma, context);
  const needs = replenishment.items.filter((item) => item.recommendedQuantity > 0 && (!item.ingredient.branchId || item.ingredient.branchId === branchId));
  const offers = await listFoodSupplierProducts(prisma, context, { branchId });
  const byIngredient = new Map();
  for (const offer of offers) {
    const current = byIngredient.get(offer.ingredientId) || [];
    current.push(offer);
    byIngredient.set(offer.ingredientId, current);
  }
  const groups = new Map();
  const unpriced = [];
  for (const item of needs) {
    const candidates = byIngredient.get(item.ingredient.id) || [];
    const preferred = candidates.find((offer) => offer.supplierId === item.ingredient.preferredSupplierId);
    const offer = preferred || candidates[0];
    if (!offer) {
      unpriced.push({ ingredient: item.ingredient, recommendedQuantity: item.recommendedQuantity });
      continue;
    }
    const packages = Math.max(offer.minimumPackages, Math.ceil(item.recommendedQuantity / Number(offer.packageQuantity)));
    const suggestionItem = {
      ingredient: item.ingredient,
      offer,
      packages,
      quantity: packages * Number(offer.packageQuantity),
      unitCost: offer.normalizedUnitCost,
      total: packages * Number(offer.packagePrice),
    };
    const key = offer.supplierId;
    const group = groups.get(key) || { supplier: offer.supplier, branch, items: [], total: 0 };
    group.items.push(suggestionItem);
    group.total += suggestionItem.total;
    groups.set(key, group);
  }
  return { branch, groups: [...groups.values()], unpriced };
}

module.exports = {
  normalizedOffer,
  saveFoodSupplierProduct,
  listFoodSupplierProducts,
  archiveFoodSupplierProduct,
  buildFoodPurchaseSuggestions,
};
