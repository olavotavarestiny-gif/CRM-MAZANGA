const { domainError } = require('./food-domain');

async function requireCatalogBranch(prisma, access, branchId) {
  if (!branchId) return null;
  const branch = await prisma.foodBranch.findFirst({
    where: { id: branchId, userId: access.organizationId },
    select: { id: true },
  });
  if (!branch) throw domainError('Unidade Food inválida para esta organização.', 400, 'FOOD_BRANCH_INVALID');
  if (!access.canAccessBranch(branch.id)) throw domainError('Não tem acesso a esta unidade.', 403, 'FOOD_BRANCH_ACCESS_DENIED');
  return branch.id;
}

async function requireCatalogCategory(prisma, organizationId, categoryId) {
  if (!categoryId) return null;
  const category = await prisma.foodCategory.findFirst({
    where: { id: categoryId, userId: organizationId, active: true },
    select: { id: true },
  });
  if (!category) throw domainError('Categoria Food inválida para esta organização.', 400, 'FOOD_CATEGORY_INVALID');
  return category.id;
}

async function requireCatalogModifierGroups(prisma, organizationId, values) {
  const ids = [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
  if (!ids.length) return [];
  const groups = await prisma.foodModifierGroup.findMany({
    where: { id: { in: ids }, userId: organizationId, active: true },
    select: { id: true },
  });
  if (groups.length !== ids.length) {
    throw domainError('Um ou mais grupos de complementos são inválidos.', 400, 'FOOD_MODIFIER_GROUP_INVALID');
  }
  return ids;
}

module.exports = {
  requireCatalogBranch,
  requireCatalogCategory,
  requireCatalogModifierGroups,
};
