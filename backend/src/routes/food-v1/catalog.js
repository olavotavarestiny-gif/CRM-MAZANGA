const express = require('express');
const prisma = require('../../lib/prisma');
const { requireFoodPermission } = require('../../lib/food-access');
const {
  requireCatalogBranch,
  requireCatalogCategory,
  requireCatalogModifierGroups,
} = require('../../lib/food-catalog-access');
const { toPositiveInt } = require('../../lib/food-foundation');
const { domainError } = require('../../lib/food-domain');
const { recordFoodAudit } = require('../../lib/food-audit');
const { handleFoodV1Error } = require('./errors');

const router = express.Router();

function trimOrNull(value) {
  if (value === undefined) return undefined;
  const normalized = String(value || '').trim();
  return normalized || null;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrDefault(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function productInclude() {
  return {
    branch: { select: { id: true, name: true } },
    category: { select: { id: true, name: true, color: true, icon: true } },
    modifierGroups: {
      orderBy: { sortOrder: 'asc' },
      include: {
        group: {
          include: { options: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
        },
      },
    },
  };
}

async function replaceProductModifierGroups(tx, organizationId, productId, groupIds) {
  await tx.foodProductModifierGroup.deleteMany({ where: { productId, userId: organizationId } });
  for (const [sortOrder, groupId] of groupIds.entries()) {
    await tx.foodProductModifierGroup.create({ data: { userId: organizationId, productId, groupId, sortOrder } });
  }
}

router.get('/categories', requireFoodPermission('catalog.view'), async (req, res) => {
  try {
    const categories = await prisma.foodCategory.findMany({
      where: { userId: req.foodContext.organizationId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    res.json(categories);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar categorias Food.');
  }
});

router.post('/categories', requireFoodPermission('catalog.edit'), async (req, res) => {
  try {
    const name = trimOrNull(req.body?.name);
    if (!name) throw domainError('Nome da categoria é obrigatório.');
    const category = await prisma.foodCategory.create({
      data: {
        userId: req.foodContext.organizationId,
        name,
        color: trimOrNull(req.body?.color) || '#6b7e9a',
        icon: trimOrNull(req.body?.icon),
        sortOrder: toPositiveInt(req.body?.sortOrder, 0, { min: 0, max: 10000 }),
        createdByUserId: req.foodContext.personId,
      },
    });
    await recordFoodAudit(prisma, req, { action: 'catalog.category.created', entityType: 'food_category', entityId: category.id, payload: { name: category.name } });
    res.status(201).json(category);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao criar categoria Food.');
  }
});

router.patch('/categories/:id', requireFoodPermission('catalog.edit'), async (req, res) => {
  try {
    const existing = await prisma.foodCategory.findFirst({
      where: { id: req.params.id, userId: req.foodContext.organizationId, active: true },
      select: { id: true },
    });
    if (!existing) throw domainError('Categoria Food não encontrada.', 404, 'FOOD_CATEGORY_NOT_FOUND');
    const data = {};
    if (req.body?.name !== undefined) {
      const name = trimOrNull(req.body.name);
      if (!name) throw domainError('Nome da categoria é obrigatório.');
      data.name = name;
    }
    if (req.body?.color !== undefined) data.color = trimOrNull(req.body.color) || '#6b7e9a';
    if (req.body?.icon !== undefined) data.icon = trimOrNull(req.body.icon);
    if (req.body?.sortOrder !== undefined) data.sortOrder = toPositiveInt(req.body.sortOrder, 0, { min: 0, max: 10000 });
    if (req.body?.active !== undefined) data.active = Boolean(req.body.active);
    const category = await prisma.foodCategory.update({ where: { id: existing.id }, data });
    await recordFoodAudit(prisma, req, { action: 'catalog.category.updated', entityType: 'food_category', entityId: category.id, reason: req.body?.reason, payload: { fields: Object.keys(data) } });
    res.json(category);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atualizar categoria Food.');
  }
});

router.delete('/categories/:id', requireFoodPermission('catalog.edit'), async (req, res) => {
  try {
    const existing = await prisma.foodCategory.findFirst({
      where: { id: req.params.id, userId: req.foodContext.organizationId, active: true },
      select: { id: true },
    });
    if (!existing) throw domainError('Categoria Food não encontrada.', 404, 'FOOD_CATEGORY_NOT_FOUND');
    await prisma.foodCategory.update({ where: { id: existing.id }, data: { active: false, archivedAt: new Date() } });
    await recordFoodAudit(prisma, req, { action: 'catalog.category.archived', entityType: 'food_category', entityId: existing.id, reason: req.body?.reason || 'Arquivo solicitado pelo utilizador.' });
    res.status(204).end();
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao arquivar categoria Food.');
  }
});

router.get('/modifier-groups', requireFoodPermission('catalog.view'), async (req, res) => {
  try {
    const groups = await prisma.foodModifierGroup.findMany({
      where: { userId: req.foodContext.organizationId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { options: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
    });
    res.json(groups);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar complementos Food.');
  }
});

router.post('/modifier-groups', requireFoodPermission('catalog.edit'), async (req, res) => {
  try {
    const organizationId = req.foodContext.organizationId;
    const name = trimOrNull(req.body?.name);
    if (!name) throw domainError('Nome do grupo é obrigatório.');
    const options = Array.isArray(req.body?.options) ? req.body.options : [];
    const group = await prisma.foodModifierGroup.create({
      data: {
        userId: organizationId,
        name,
        required: Boolean(req.body?.required),
        minSelection: toPositiveInt(req.body?.minSelection, 0, { min: 0, max: 50 }),
        maxSelection: req.body?.maxSelection === undefined ? null : toPositiveInt(req.body.maxSelection, 1, { min: 1, max: 50 }),
        sortOrder: toPositiveInt(req.body?.sortOrder, 0, { min: 0, max: 10000 }),
        createdByUserId: req.foodContext.personId,
        options: {
          create: options.map((option, index) => ({
            userId: organizationId,
            name: trimOrNull(option?.name),
            priceDelta: numberOrDefault(option?.priceDelta),
            sortOrder: toPositiveInt(option?.sortOrder, index, { min: 0, max: 10000 }),
            createdByUserId: req.foodContext.personId,
          })).filter((option) => option.name),
        },
      },
      include: { options: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
    });
    await recordFoodAudit(prisma, req, { action: 'catalog.modifier_group.created', entityType: 'food_modifier_group', entityId: group.id, payload: { name: group.name, options: group.options.length } });
    res.status(201).json(group);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao criar grupo de complementos Food.');
  }
});

router.patch('/modifier-groups/:id', requireFoodPermission('catalog.edit'), async (req, res) => {
  try {
    const existing = await prisma.foodModifierGroup.findFirst({
      where: { id: req.params.id, userId: req.foodContext.organizationId, active: true },
      select: { id: true },
    });
    if (!existing) throw domainError('Grupo de complementos não encontrado.', 404, 'FOOD_MODIFIER_GROUP_NOT_FOUND');
    const data = {};
    if (req.body?.name !== undefined) {
      const name = trimOrNull(req.body.name);
      if (!name) throw domainError('Nome do grupo é obrigatório.');
      data.name = name;
    }
    if (req.body?.required !== undefined) data.required = Boolean(req.body.required);
    if (req.body?.minSelection !== undefined) data.minSelection = toPositiveInt(req.body.minSelection, 0, { min: 0, max: 50 });
    if (req.body?.maxSelection !== undefined) data.maxSelection = req.body.maxSelection === null ? null : toPositiveInt(req.body.maxSelection, 1, { min: 1, max: 50 });
    if (req.body?.sortOrder !== undefined) data.sortOrder = toPositiveInt(req.body.sortOrder, 0, { min: 0, max: 10000 });
    if (req.body?.active !== undefined) data.active = Boolean(req.body.active);
    const group = await prisma.foodModifierGroup.update({
      where: { id: existing.id },
      data,
      include: { options: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
    });
    await recordFoodAudit(prisma, req, { action: 'catalog.modifier_group.updated', entityType: 'food_modifier_group', entityId: group.id, reason: req.body?.reason, payload: { fields: Object.keys(data) } });
    res.json(group);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atualizar grupo de complementos Food.');
  }
});

router.post('/modifier-groups/:id/options', requireFoodPermission('catalog.edit'), async (req, res) => {
  try {
    const organizationId = req.foodContext.organizationId;
    const group = await prisma.foodModifierGroup.findFirst({
      where: { id: req.params.id, userId: organizationId, active: true }, select: { id: true },
    });
    if (!group) throw domainError('Grupo de complementos não encontrado.', 404, 'FOOD_MODIFIER_GROUP_NOT_FOUND');
    const name = trimOrNull(req.body?.name);
    if (!name) throw domainError('Nome do complemento é obrigatório.');
    const option = await prisma.foodModifierOption.create({
      data: {
        userId: organizationId,
        groupId: group.id,
        name,
        priceDelta: numberOrDefault(req.body?.priceDelta),
        sortOrder: toPositiveInt(req.body?.sortOrder, 0, { min: 0, max: 10000 }),
        createdByUserId: req.foodContext.personId,
      },
    });
    await recordFoodAudit(prisma, req, { action: 'catalog.modifier_option.created', entityType: 'food_modifier_option', entityId: option.id, payload: { groupId: group.id, name: option.name } });
    res.status(201).json(option);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao criar complemento Food.');
  }
});

router.patch('/modifier-groups/:id/options/:optionId', requireFoodPermission('catalog.edit'), async (req, res) => {
  try {
    const option = await prisma.foodModifierOption.findFirst({
      where: {
        id: req.params.optionId,
        groupId: req.params.id,
        userId: req.foodContext.organizationId,
        active: true,
      },
      select: { id: true },
    });
    if (!option) throw domainError('Complemento Food não encontrado.', 404, 'FOOD_MODIFIER_OPTION_NOT_FOUND');
    const data = {};
    if (req.body?.name !== undefined) {
      const name = trimOrNull(req.body.name);
      if (!name) throw domainError('Nome do complemento é obrigatório.');
      data.name = name;
    }
    if (req.body?.priceDelta !== undefined) data.priceDelta = numberOrDefault(req.body.priceDelta);
    if (req.body?.sortOrder !== undefined) data.sortOrder = toPositiveInt(req.body.sortOrder, 0, { min: 0, max: 10000 });
    if (req.body?.active !== undefined) data.active = Boolean(req.body.active);
    const updated = await prisma.foodModifierOption.update({ where: { id: option.id }, data });
    await recordFoodAudit(prisma, req, { action: 'catalog.modifier_option.updated', entityType: 'food_modifier_option', entityId: updated.id, reason: req.body?.reason, payload: { groupId: req.params.id, fields: Object.keys(data) } });
    res.json(updated);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atualizar complemento Food.');
  }
});

router.get('/products', requireFoodPermission('catalog.view'), async (req, res) => {
  try {
    const access = req.foodContext;
    const requestedBranchId = trimOrNull(req.query.branchId);
    if (requestedBranchId) await requireCatalogBranch(prisma, access, requestedBranchId);
    const search = trimOrNull(req.query.search);
    const products = await prisma.foodProduct.findMany({
      where: {
        userId: access.organizationId,
        active: req.query.active === undefined ? true : req.query.active === 'true',
        ...(req.query.available !== undefined && { available: req.query.available === 'true' }),
        ...(req.query.categoryId && { categoryId: String(req.query.categoryId) }),
        AND: [
          ...(requestedBranchId
            ? [{ OR: [{ branchId: null }, { branchId: requestedBranchId }] }]
            : access.branchIds === null ? [] : [{ OR: [{ branchId: null }, { branchId: { in: access.branchIds } }] }]),
          ...(search ? [{ OR: [
            { internalCode: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ] }] : []),
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: productInclude(),
    });
    res.json(products);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar produtos Food.');
  }
});

router.post('/products', requireFoodPermission('catalog.edit'), async (req, res) => {
  try {
    const access = req.foodContext;
    const internalCode = trimOrNull(req.body?.internalCode);
    const name = trimOrNull(req.body?.name);
    if (!internalCode || !name) throw domainError('Código interno e nome são obrigatórios.');
    const branchId = await requireCatalogBranch(prisma, access, trimOrNull(req.body?.branchId));
    const categoryId = await requireCatalogCategory(prisma, access.organizationId, trimOrNull(req.body?.categoryId));
    const groupIds = await requireCatalogModifierGroups(prisma, access.organizationId, req.body?.modifierGroupIds);
    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.foodProduct.create({
        data: {
          userId: access.organizationId,
          branchId,
          categoryId,
          internalCode,
          name,
          description: trimOrNull(req.body?.description),
          imageUrl: trimOrNull(req.body?.imageUrl),
          price: numberOrDefault(req.body?.price),
          cost: numberOrNull(req.body?.cost),
          preparationMinutes: toPositiveInt(req.body?.preparationMinutes, 15, { min: 1, max: 600 }),
          available: req.body?.available === undefined ? true : Boolean(req.body.available),
          active: req.body?.active === undefined ? true : Boolean(req.body.active),
          sortOrder: toPositiveInt(req.body?.sortOrder, 0, { min: 0, max: 10000 }),
          createdByUserId: access.personId,
        },
      });
      await replaceProductModifierGroups(tx, access.organizationId, product.id, groupIds);
      return product;
    });
    const product = await prisma.foodProduct.findFirst({
      where: { id: created.id, userId: access.organizationId }, include: productInclude(),
    });
    await recordFoodAudit(prisma, req, { branchId: product.branchId, action: 'catalog.product.created', entityType: 'food_product', entityId: product.id, payload: { name: product.name, internalCode: product.internalCode } });
    res.status(201).json(product);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao criar produto Food.');
  }
});

router.patch('/products/:id', requireFoodPermission('catalog.edit'), async (req, res) => {
  try {
    const access = req.foodContext;
    const existing = await prisma.foodProduct.findFirst({
      where: { id: req.params.id, userId: access.organizationId, active: true },
      select: { id: true, branchId: true },
    });
    if (!existing) throw domainError('Produto Food não encontrado.', 404, 'FOOD_PRODUCT_NOT_FOUND');
    if (existing.branchId && !access.canAccessBranch(existing.branchId)) throw domainError('Não tem acesso a esta unidade.', 403, 'FOOD_BRANCH_ACCESS_DENIED');
    const data = {};
    if (req.body?.internalCode !== undefined) {
      const code = trimOrNull(req.body.internalCode);
      if (!code) throw domainError('Código interno é obrigatório.');
      data.internalCode = code;
    }
    if (req.body?.name !== undefined) {
      const name = trimOrNull(req.body.name);
      if (!name) throw domainError('Nome do produto é obrigatório.');
      data.name = name;
    }
    if (req.body?.branchId !== undefined) data.branchId = await requireCatalogBranch(prisma, access, trimOrNull(req.body.branchId));
    if (req.body?.categoryId !== undefined) data.categoryId = await requireCatalogCategory(prisma, access.organizationId, trimOrNull(req.body.categoryId));
    if (req.body?.description !== undefined) data.description = trimOrNull(req.body.description);
    if (req.body?.imageUrl !== undefined) data.imageUrl = trimOrNull(req.body.imageUrl);
    if (req.body?.price !== undefined) data.price = numberOrDefault(req.body.price);
    if (req.body?.cost !== undefined) data.cost = numberOrNull(req.body.cost);
    if (req.body?.preparationMinutes !== undefined) data.preparationMinutes = toPositiveInt(req.body.preparationMinutes, 15, { min: 1, max: 600 });
    if (req.body?.available !== undefined) data.available = Boolean(req.body.available);
    if (req.body?.active !== undefined) data.active = Boolean(req.body.active);
    if (req.body?.sortOrder !== undefined) data.sortOrder = toPositiveInt(req.body.sortOrder, 0, { min: 0, max: 10000 });
    const groupIds = req.body?.modifierGroupIds === undefined
      ? null
      : await requireCatalogModifierGroups(prisma, access.organizationId, req.body.modifierGroupIds);
    await prisma.$transaction(async (tx) => {
      await tx.foodProduct.update({ where: { id: existing.id }, data });
      if (groupIds) await replaceProductModifierGroups(tx, access.organizationId, existing.id, groupIds);
    });
    const product = await prisma.foodProduct.findFirst({
      where: { id: existing.id, userId: access.organizationId }, include: productInclude(),
    });
    await recordFoodAudit(prisma, req, { branchId: product.branchId, action: 'catalog.product.updated', entityType: 'food_product', entityId: product.id, reason: req.body?.reason, payload: { fields: Object.keys(data), modifierGroupsChanged: groupIds !== null } });
    res.json(product);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atualizar produto Food.');
  }
});

router.delete('/products/:id', requireFoodPermission('catalog.edit'), async (req, res) => {
  try {
    const access = req.foodContext;
    const existing = await prisma.foodProduct.findFirst({
      where: { id: req.params.id, userId: access.organizationId, active: true },
      select: { id: true, branchId: true },
    });
    if (!existing) throw domainError('Produto Food não encontrado.', 404, 'FOOD_PRODUCT_NOT_FOUND');
    if (existing.branchId && !access.canAccessBranch(existing.branchId)) throw domainError('Não tem acesso a esta unidade.', 403, 'FOOD_BRANCH_ACCESS_DENIED');
    await prisma.foodProduct.update({
      where: { id: existing.id },
      data: { active: false, available: false, archivedAt: new Date() },
    });
    await recordFoodAudit(prisma, req, { branchId: existing.branchId, action: 'catalog.product.archived', entityType: 'food_product', entityId: existing.id, reason: req.body?.reason || 'Arquivo solicitado pelo utilizador.' });
    res.status(204).end();
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao arquivar produto Food.');
  }
});

module.exports = router;
