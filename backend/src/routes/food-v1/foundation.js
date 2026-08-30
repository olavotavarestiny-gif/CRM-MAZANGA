const express = require('express');
const prisma = require('../../lib/prisma');
const { requireAnyFoodPermission, requireFoodPermission } = require('../../lib/food-access');
const { buildFoodSettingsUpdate, serializeFoodSettings } = require('../../lib/food-foundation');
const { domainError } = require('../../lib/food-domain');
const { recordFoodAudit } = require('../../lib/food-audit');
const { handleFoodV1Error } = require('./errors');

const router = express.Router();

function trimOrNull(value) {
  if (value === undefined) return undefined;
  const normalized = String(value || '').trim();
  return normalized || null;
}

async function resolveFiscalLocation(organizationId, estabelecimentoId) {
  if (!estabelecimentoId) return null;
  const location = await prisma.estabelecimento.findFirst({
    where: { id: estabelecimentoId, userId: organizationId },
    select: { id: true },
  });
  if (!location) throw domainError('Ponto fiscal inválido para esta organização.', 400, 'FOOD_FISCAL_LOCATION_INVALID');
  return location.id;
}

router.get('/settings', requireAnyFoodPermission('overview.view', 'settings.view', 'settings.edit', 'kitchen.view', 'orders.create'), async (req, res) => {
  try {
    const settings = await prisma.foodSettings.findUnique({ where: { userId: req.foodContext.organizationId } });
    res.json(serializeFoodSettings(settings));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar configurações Food.');
  }
});

router.patch('/settings', requireFoodPermission('settings.edit'), async (req, res) => {
  try {
    const settings = await prisma.foodSettings.upsert({
      where: { userId: req.foodContext.organizationId },
      create: {
        userId: req.foodContext.organizationId,
        createdByUserId: req.foodContext.personId,
        ...buildFoodSettingsUpdate(req.body || {}),
      },
      update: buildFoodSettingsUpdate(req.body || {}),
    });
    await recordFoodAudit(prisma, req, {
      action: 'settings.updated',
      entityType: 'food_settings',
      entityId: settings.id,
      reason: req.body?.reason,
      payload: { fields: Object.keys(req.body || {}).filter((field) => field !== 'reason') },
    });
    res.json(serializeFoodSettings(settings));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao guardar configurações Food.');
  }
});

router.get('/branches', requireAnyFoodPermission('settings.view', 'settings.edit'), async (req, res) => {
  try {
    const branches = await prisma.foodBranch.findMany({
      where: {
        userId: req.foodContext.organizationId,
        ...(req.foodContext.branchIds === null ? {} : { id: { in: req.foodContext.branchIds } }),
      },
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
      include: { estabelecimento: { select: { id: true, nome: true, nif: true } } },
    });
    res.json(branches);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar unidades Food.');
  }
});

router.get('/audit-events', requireFoodPermission('settings.view'), async (req, res) => {
  try {
    const requestedBranchId = trimOrNull(req.query.branchId);
    if (requestedBranchId && !req.foodContext.canAccessBranch(requestedBranchId)) {
      throw domainError('Não tem acesso a esta unidade.', 403, 'FOOD_BRANCH_ACCESS_DENIED');
    }
    const events = await prisma.foodAuditEvent.findMany({
      where: {
        organizationId: req.foodContext.organizationId,
        ...(requestedBranchId
          ? { branchId: requestedBranchId }
          : req.foodContext.branchIds === null ? {} : { OR: [{ branchId: null }, { branchId: { in: req.foodContext.branchIds } }] }),
        ...(req.query.action && { action: String(req.query.action) }),
        ...(req.query.entityType && { entityType: String(req.query.entityType) }),
        ...(req.query.entityId && { entityId: String(req.query.entityId) }),
      },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(200, Math.max(1, Number(req.query.limit || 100))),
      include: {
        branch: { select: { id: true, name: true } },
        actor: { select: { id: true, name: true, email: true } },
      },
    });
    res.json(events);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar auditoria Food.');
  }
});

router.post('/branches', requireFoodPermission('settings.edit'), async (req, res) => {
  try {
    const organizationId = req.foodContext.organizationId;
    const name = trimOrNull(req.body?.name);
    if (!name) throw domainError('Nome da unidade é obrigatório.');
    const estabelecimentoId = await resolveFiscalLocation(organizationId, trimOrNull(req.body?.estabelecimentoId));
    const isMain = Boolean(req.body?.isMain);
    const branch = await prisma.$transaction(async (tx) => {
      if (isMain) await tx.foodBranch.updateMany({ where: { userId: organizationId }, data: { isMain: false } });
      return tx.foodBranch.create({
        data: {
          userId: organizationId,
          name,
          estabelecimentoId,
          phone: trimOrNull(req.body?.phone),
          email: trimOrNull(req.body?.email),
          address: trimOrNull(req.body?.address),
          neighborhood: trimOrNull(req.body?.neighborhood),
          isMain,
          createdByUserId: req.foodContext.personId,
        },
        include: { estabelecimento: { select: { id: true, nome: true, nif: true } } },
      });
    });
    await recordFoodAudit(prisma, req, {
      branchId: branch.id,
      action: 'branch.created',
      entityType: 'food_branch',
      entityId: branch.id,
      reason: req.body?.reason,
      payload: { name: branch.name, isMain: branch.isMain, fiscalLocationLinked: Boolean(branch.estabelecimentoId) },
    });
    res.status(201).json(branch);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao criar unidade Food.');
  }
});

router.patch('/branches/:id', requireFoodPermission('settings.edit'), async (req, res) => {
  try {
    const organizationId = req.foodContext.organizationId;
    const existing = await prisma.foodBranch.findFirst({
      where: { id: req.params.id, userId: organizationId },
      select: { id: true },
    });
    if (!existing) throw domainError('Unidade Food não encontrada.', 404, 'FOOD_BRANCH_NOT_FOUND');
    if (!req.foodContext.canAccessBranch(existing.id)) throw domainError('Não tem acesso a esta unidade.', 403, 'FOOD_BRANCH_ACCESS_DENIED');

    const data = {};
    if (req.body?.name !== undefined) {
      const name = trimOrNull(req.body.name);
      if (!name) throw domainError('Nome da unidade é obrigatório.');
      data.name = name;
    }
    if (req.body?.estabelecimentoId !== undefined) {
      data.estabelecimentoId = await resolveFiscalLocation(organizationId, trimOrNull(req.body.estabelecimentoId));
    }
    for (const field of ['phone', 'email', 'address', 'neighborhood']) {
      if (req.body?.[field] !== undefined) data[field] = trimOrNull(req.body[field]);
    }
    if (req.body?.active !== undefined) data.active = Boolean(req.body.active);
    if (req.body?.isMain !== undefined) data.isMain = Boolean(req.body.isMain);

    const branch = await prisma.$transaction(async (tx) => {
      if (data.isMain) await tx.foodBranch.updateMany({ where: { userId: organizationId }, data: { isMain: false } });
      return tx.foodBranch.update({
        where: { id: existing.id },
        data,
        include: { estabelecimento: { select: { id: true, nome: true, nif: true } } },
      });
    });
    await recordFoodAudit(prisma, req, {
      branchId: branch.id,
      action: 'branch.updated',
      entityType: 'food_branch',
      entityId: branch.id,
      reason: req.body?.reason,
      payload: { fields: Object.keys(data) },
    });
    res.json(branch);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atualizar unidade Food.');
  }
});

module.exports = router;
