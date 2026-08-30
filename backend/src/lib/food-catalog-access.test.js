const test = require('node:test');
const assert = require('node:assert/strict');
const {
  requireCatalogBranch,
  requireCatalogCategory,
  requireCatalogModifierGroups,
} = require('./food-catalog-access');

test('catálogo valida organização e acesso à unidade', async () => {
  const prisma = {
    foodBranch: { findFirst: async ({ where }) => where.id === 'branch-a' && where.userId === 10 ? { id: 'branch-a' } : null },
  };
  const access = { organizationId: 10, canAccessBranch: (id) => id === 'branch-a' };

  assert.equal(await requireCatalogBranch(prisma, access, 'branch-a'), 'branch-a');
  assert.equal(await requireCatalogBranch(prisma, access, null), null);
  await assert.rejects(
    requireCatalogBranch(prisma, access, 'branch-b'),
    (error) => error.statusCode === 400 && error.code === 'FOOD_BRANCH_INVALID'
  );
  await assert.rejects(
    requireCatalogBranch(prisma, { ...access, canAccessBranch: () => false }, 'branch-a'),
    (error) => error.statusCode === 403 && error.code === 'FOOD_BRANCH_ACCESS_DENIED'
  );
});

test('catálogo rejeita categorias e grupos de extras de outra organização', async () => {
  const prisma = {
    foodCategory: { findFirst: async ({ where }) => where.id === 'category-a' && where.userId === 10 ? { id: 'category-a' } : null },
    foodModifierGroup: { findMany: async ({ where }) => where.userId === 10 ? [{ id: 'group-a' }] : [] },
  };

  assert.equal(await requireCatalogCategory(prisma, 10, 'category-a'), 'category-a');
  await assert.rejects(
    requireCatalogCategory(prisma, 10, 'category-b'),
    (error) => error.statusCode === 400 && error.code === 'FOOD_CATEGORY_INVALID'
  );
  assert.deepEqual(await requireCatalogModifierGroups(prisma, 10, ['group-a', 'group-a']), ['group-a']);
  await assert.rejects(
    requireCatalogModifierGroups(prisma, 10, ['group-a', 'group-b']),
    (error) => error.statusCode === 400 && error.code === 'FOOD_MODIFIER_GROUP_INVALID'
  );
});
