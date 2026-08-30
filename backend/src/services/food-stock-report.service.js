const { domainError } = require('../lib/food-domain');

function normalizeWhatsAppPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 9) digits = `244${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

function cleanText(value, max = 2000) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, max) : null;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(number)));
}

async function resolveBranchScope(prisma, context, branchIdValue) {
  const branchId = cleanText(branchIdValue, 80);
  if (branchId) {
    if (!context.canAccessBranch(branchId)) throw domainError('Não tem acesso a esta unidade.', 403, 'FOOD_BRANCH_FORBIDDEN');
    const branch = await prisma.foodBranch.findFirst({ where: { id: branchId, userId: context.organizationId, active: true }, select: { id: true, name: true } });
    if (!branch) throw domainError('Unidade Food não encontrada.', 404, 'FOOD_BRANCH_NOT_FOUND');
    return { branch, branchIds: [branch.id] };
  }
  return { branch: null, branchIds: context.branchIds };
}

async function prepareSupplierWhatsAppDraft(prisma, context, supplierId, input = {}) {
  const supplier = await prisma.foodSupplier.findFirst({ where: { id: supplierId, organizationId: context.organizationId, active: true } });
  if (!supplier) throw domainError('Fornecedor não encontrado.', 404, 'FOOD_SUPPLIER_NOT_FOUND');
  if (!context.canAccessBranch(supplier.branchId)) throw domainError('Não tem acesso a este fornecedor.', 403, 'FOOD_SUPPLIER_FORBIDDEN');
  const phone = normalizeWhatsAppPhone(supplier.phone);
  if (!phone) throw domainError('O fornecedor não possui um telefone válido para WhatsApp.', 400, 'FOOD_SUPPLIER_PHONE_INVALID');
  const items = (Array.isArray(input.items) ? input.items : []).slice(0, 100).map((item) => ({
    name: cleanText(item.name, 180),
    packages: Number(item.packages || 0),
    purchaseUnit: cleanText(item.purchaseUnit, 30),
  })).filter((item) => item.name && Number.isFinite(item.packages) && item.packages > 0);
  const defaultMessage = [
    `Olá, ${supplier.name}. Gostaria de confirmar a disponibilidade dos seguintes itens:`,
    ...items.map((item) => `- ${item.name}: ${item.packages} ${item.purchaseUnit || 'embalagens'}`),
    'Por favor, confirme o valor total e o prazo de entrega. Obrigado.',
  ].join('\n');
  const message = cleanText(input.message, 2000) || defaultMessage;
  return { supplier: { id: supplier.id, name: supplier.name, phone: supplier.phone }, phone, message, url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}` };
}

async function listFoodStockMovements(prisma, context, input = {}) {
  const { branchIds } = await resolveBranchScope(prisma, context, input.branchId);
  const days = boundedInteger(input.days, 30, 1, 365);
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - days + 1);
  from.setUTCHours(0, 0, 0, 0);
  const limit = boundedInteger(input.limit, 100, 10, 500);
  return prisma.foodStockMovement.findMany({
    where: {
      organizationId: context.organizationId,
      createdAt: { gte: from },
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(input.ingredientId ? { ingredientId: String(input.ingredientId) } : {}),
      ...(input.type && input.type !== 'all' ? { type: String(input.type) } : {}),
    },
    include: {
      branch: { select: { id: true, name: true } },
      ingredient: { select: { id: true, name: true, unit: true, internalCode: true } },
      purchase: { select: { id: true, reference: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

async function getFoodStockReport(prisma, context, input = {}) {
  const { branch, branchIds } = await resolveBranchScope(prisma, context, input.branchId);
  const days = boundedInteger(input.days, 30, 1, 365);
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - days + 1);
  from.setUTCHours(0, 0, 0, 0);
  const ingredientBranchScope = branchIds === null ? {} : { OR: [{ branchId: null }, { branchId: { in: branchIds } }] };
  const operationalBranchScope = branchIds === null ? {} : { branchId: { in: branchIds } };
  const [ingredients, alerts, movements, purchases, receivedPurchases] = await Promise.all([
    prisma.foodIngredient.findMany({ where: { organizationId: context.organizationId, active: true, ...ingredientBranchScope }, select: { currentStock: true, averageCost: true } }),
    prisma.foodStockAlert.count({ where: { organizationId: context.organizationId, status: 'open', ingredient: { active: true, ...ingredientBranchScope } } }),
    prisma.foodStockMovement.findMany({ where: { organizationId: context.organizationId, createdAt: { gte: from }, ...operationalBranchScope }, select: { type: true, quantity: true, unitCost: true } }),
    prisma.foodPurchase.groupBy({ by: ['status'], where: { organizationId: context.organizationId, createdAt: { gte: from }, ...operationalBranchScope }, _count: { _all: true }, _sum: { total: true } }),
    prisma.foodPurchase.aggregate({ where: { organizationId: context.organizationId, status: 'received', receivedAt: { gte: from }, ...operationalBranchScope }, _sum: { total: true }, _count: { _all: true } }),
  ]);
  const entries = movements.filter((item) => Number(item.quantity) > 0).reduce((sum, item) => sum + Number(item.quantity), 0);
  const exits = movements.filter((item) => Number(item.quantity) < 0).reduce((sum, item) => sum + Math.abs(Number(item.quantity)), 0);
  const openStatuses = new Set(['draft', 'ordered', 'awaiting_confirmation', 'confirmed', 'in_delivery', 'partial']);
  const openPurchases = purchases.filter((item) => openStatuses.has(item.status));
  return {
    branch,
    from,
    days,
    inventory: {
      ingredients: ingredients.length,
      value: ingredients.reduce((sum, item) => sum + Number(item.currentStock) * Number(item.averageCost), 0),
      alerts,
    },
    movements: { count: movements.length, entries, exits },
    purchases: {
      byStatus: purchases,
      openCount: openPurchases.reduce((sum, item) => sum + item._count._all, 0),
      openValue: openPurchases.reduce((sum, item) => sum + Number(item._sum.total || 0), 0),
      receivedCount: receivedPurchases._count._all,
      receivedValue: Number(receivedPurchases._sum.total || 0),
    },
  };
}

module.exports = { normalizeWhatsAppPhone, prepareSupplierWhatsAppDraft, listFoodStockMovements, getFoodStockReport };
