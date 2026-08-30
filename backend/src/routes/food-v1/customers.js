const express = require('express');
const prisma = require('../../lib/prisma');
const { requireFoodPermission } = require('../../lib/food-access');
const { domainError } = require('../../lib/food-domain');
const { normalizePhoneToE164 } = require('../../lib/phone-normalization');
const { handleFoodV1Error } = require('./errors');
const {
  searchFoodCustomers,
  listFoodCustomers,
  findFoodCustomerDuplicates,
  mergeFoodCustomers,
  previewFoodCustomerImport,
  commitFoodCustomerImport,
  normalizeFoodCustomerPreferences,
  getFoodCustomer,
  updateFoodCustomer,
  archiveFoodCustomer,
  createFoodCustomerAddress,
  updateFoodCustomerAddress,
  archiveFoodCustomerAddress,
} = require('../../services/food-customer.service');
const { recordFoodAudit } = require('../../lib/food-audit');
const { getPlanContext, getPlanCatalog, getLimitState } = require('../../lib/plan-limits');
const {
  listFoodCustomerTimeline,
  createFoodCustomerOccurrence,
  resolveFoodCustomerOccurrence,
} = require('../../services/food-customer-timeline.service');

const router = express.Router();

function optionalText(value, max = 300) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, max) : null;
}

async function getImportLimits(organizationId) {
  const context = await getPlanContext(organizationId);
  const catalog = getPlanCatalog(context.plan, context.workspaceMode);
  const planRows = catalog.operationalLimits.csvImportRows;
  return { maxRows: Number.isFinite(planRows) ? Math.min(planRows, 5000) : 5000 };
}

router.post('/import/preview', requireFoodPermission('customers.edit'), async (req, res) => {
  try {
    const limits = await getImportLimits(req.foodContext.organizationId);
    res.json(await previewFoodCustomerImport(prisma, req.foodContext.organizationId, req.body?.rows, limits));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao validar o ficheiro de clientes.');
  }
});

router.post('/import/commit', requireFoodPermission('customers.edit'), async (req, res) => {
  try {
    const organizationId = req.foodContext.organizationId;
    const limits = await getImportLimits(organizationId);
    const preview = await previewFoodCustomerImport(prisma, organizationId, req.body?.rows, limits);
    const createCount = preview.summary.valid;
    const contactLimit = await getLimitState(organizationId, 'contacts');
    if (contactLimit.rawLimit !== Infinity && contactLimit.current + createCount > contactLimit.rawLimit) {
      throw domainError('A importação ultrapassa o limite de clientes do plano.', 403, 'FOOD_CUSTOMER_PLAN_LIMIT');
    }
    const result = await commitFoodCustomerImport(prisma, organizationId, req.body?.rows, req.body?.strategy, limits);
    const importId = `import-${Date.now()}-${req.foodContext.personId}`;
    await recordFoodAudit(prisma, req, {
      action: 'customer.import.completed',
      entityType: 'food_customer_import',
      entityId: importId,
      reason: optionalText(req.body?.reason, 500) || 'Importação CSV confirmada',
      payload: { strategy: req.body?.strategy, total: result.total, imported: result.imported, updated: result.updated, skipped: result.skipped, invalid: result.invalid },
    });
    res.status(201).json({ ...result, importId });
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao importar os clientes Food.');
  }
});

router.get('/search', requireFoodPermission('customers.view'), async (req, res) => {
  try {
    res.json(await searchFoodCustomers(prisma, req.foodContext.organizationId, req.query.search));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao pesquisar clientes Food.');
  }
});

router.get('/duplicates', requireFoodPermission('customers.view'), async (req, res) => {
  try {
    res.json(await findFoodCustomerDuplicates(prisma, req.foodContext.organizationId));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao procurar clientes duplicados.');
  }
});

router.get('/', requireFoodPermission('customers.view'), async (req, res) => {
  try {
    res.json(await listFoodCustomers(prisma, req.foodContext.organizationId, req.query));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar os clientes Food.');
  }
});

router.post('/:contactId/merge', requireFoodPermission('customers.edit'), async (req, res) => {
  try {
    const reason = optionalText(req.body?.reason, 500);
    if (!reason || reason.length < 3) throw domainError('Indique o motivo da consolidação.');
    const result = await mergeFoodCustomers(prisma, req.foodContext.organizationId, req.params.contactId, req.body?.sourceContactId);
    await recordFoodAudit(prisma, req, {
      branchId: result.customer.foodProfile?.preferredBranchId,
      action: 'customer.merged',
      entityType: 'contact',
      entityId: String(result.customer.id),
      reason,
      payload: { sourceContactId: result.sourceContactId, reasons: result.reasons, moved: result.moved },
    });
    res.json(result);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao consolidar os clientes Food.');
  }
});

router.post('/', requireFoodPermission('customers.edit'), async (req, res) => {
  try {
    const name = optionalText(req.body?.name, 180);
    const phone = normalizePhoneToE164(req.body?.phone);
    if (!name) throw domainError('Nome do cliente é obrigatório.');
    if (!phone) throw domainError('Telefone angolano inválido. Use 9XXXXXXXX, 2449XXXXXXXX ou +244 9XXXXXXXX.');
    let birthDate;
    if (req.body?.birthDate) {
      birthDate = new Date(`${String(req.body.birthDate).slice(0, 10)}T00:00:00.000Z`);
      if (Number.isNaN(birthDate.getTime())) throw domainError('Data de nascimento inválida.');
    }
    const requestedTags = Array.isArray(req.body?.tags)
      ? [...new Set(['food', ...req.body.tags.map((tag) => optionalText(tag, 40)).filter(Boolean)])].slice(0, 20)
      : null;
    const preferredBranchId = optionalText(req.body?.preferredBranchId, 80);
    if (preferredBranchId) {
      const branch = await prisma.foodBranch.findFirst({ where: { id: preferredBranchId, userId: req.foodContext.organizationId, active: true } });
      if (!branch || !req.foodContext.canAccessBranch(branch.id)) throw domainError('Unidade preferida inválida.');
    }
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.contact.findFirst({
        where: { userId: req.foodContext.organizationId, phone },
      });
      const contact = existing
        ? await tx.contact.update({
          where: { id: existing.id },
          data: {
            name,
            email: optionalText(req.body?.email, 180) || existing.email,
            company: optionalText(req.body?.company, 180) || existing.company,
            location: optionalText(req.body?.location, 240) || existing.location,
            birthDate: birthDate || existing.birthDate,
            ...(requestedTags && { tags: JSON.stringify(requestedTags) }),
            contactType: 'cliente',
            status: 'ativo',
          },
        })
        : await tx.contact.create({
          data: {
            userId: req.foodContext.organizationId,
            name,
            phone,
            email: optionalText(req.body?.email, 180) || '',
            company: optionalText(req.body?.company, 180) || '',
            location: optionalText(req.body?.location, 240),
            birthDate: birthDate || null,
            contactType: 'cliente',
            status: 'ativo',
            stage: 'Cliente Food',
            inPipeline: false,
            tags: JSON.stringify(requestedTags || ['food']),
          },
        });
      const profile = await tx.foodCustomerProfile.upsert({
        where: { organizationId_contactId: { organizationId: req.foodContext.organizationId, contactId: contact.id } },
        update: {
          preferredBranchId,
          marketingConsent: req.body?.marketingConsent === true,
          transactionalConsent: req.body?.transactionalConsent !== false,
          preferences: normalizeFoodCustomerPreferences(req.body?.preferences),
          notes: optionalText(req.body?.notes, 1000),
        },
        create: {
          organizationId: req.foodContext.organizationId,
          contactId: contact.id,
          preferredBranchId,
          marketingConsent: req.body?.marketingConsent === true,
          transactionalConsent: req.body?.transactionalConsent !== false,
          preferences: normalizeFoodCustomerPreferences(req.body?.preferences),
          notes: optionalText(req.body?.notes, 1000),
        },
      });
      return { ...contact, foodProfile: profile };
    });
    await recordFoodAudit(prisma, req, { action: 'customer.saved', entityType: 'contact', entityId: String(result.id), reason: req.body?.reason, payload: { profileId: result.foodProfile.id } });
    res.status(201).json(result);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao guardar o cliente Food.');
  }
});

router.patch('/:contactId/profile', requireFoodPermission('customers.edit'), async (req, res) => {
  try {
    const result = await updateFoodCustomer(prisma, req.foodContext, req.params.contactId, req.body);
    const profile = result.customer.foodProfile;
    await recordFoodAudit(prisma, req, { branchId: profile?.preferredBranchId, action: 'customer.profile.updated', entityType: 'food_customer_profile', entityId: profile?.id, reason: req.body?.reason, payload: { fields: result.changedFields } });
    res.json(profile);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atualizar o perfil Food.');
  }
});

router.post('/:contactId/addresses', requireFoodPermission('customers.edit'), async (req, res) => {
  try {
    const created = await createFoodCustomerAddress(prisma, req.foodContext.organizationId, req.params.contactId, req.body);
    await recordFoodAudit(prisma, req, { action: 'customer.address.created', entityType: 'food_customer_address', entityId: created.id, payload: { profileId: created.profileId, isPrimary: created.isPrimary } });
    res.status(201).json(created);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao guardar a morada.');
  }
});

router.patch('/:contactId/addresses/:addressId', requireFoodPermission('customers.edit'), async (req, res) => {
  try {
    const updated = await updateFoodCustomerAddress(prisma, req.foodContext.organizationId, req.params.contactId, req.params.addressId, req.body);
    await recordFoodAudit(prisma, req, { action: 'customer.address.updated', entityType: 'food_customer_address', entityId: updated.id, reason: req.body?.reason, payload: { profileId: updated.profileId, fields: Object.keys(req.body || {}).filter((field) => field !== 'reason') } });
    res.json(updated);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atualizar a morada.');
  }
});

router.delete('/:contactId/addresses/:addressId', requireFoodPermission('customers.edit'), async (req, res) => {
  try {
    const archived = await archiveFoodCustomerAddress(prisma, req.foodContext.organizationId, req.params.contactId, req.params.addressId);
    await recordFoodAudit(prisma, req, { action: 'customer.address.archived', entityType: 'food_customer_address', entityId: archived.addressId, reason: req.body?.reason, payload: { profileId: archived.profileId } });
    res.status(204).send();
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao arquivar a morada.');
  }
});

router.get('/:contactId/timeline', requireFoodPermission('customers.view'), async (req, res) => {
  try {
    res.json(await listFoodCustomerTimeline(prisma, req.foodContext.organizationId, req.params.contactId, req.query));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar a actividade do cliente.');
  }
});

router.post('/:contactId/occurrences', requireFoodPermission('customers.edit'), async (req, res) => {
  try {
    const occurrence = await createFoodCustomerOccurrence(prisma, req.foodContext, req.params.contactId, req.body);
    await recordFoodAudit(prisma, req, { branchId: occurrence.branchId, action: 'customer.occurrence.created', entityType: 'contact', entityId: String(occurrence.contactId), reason: req.body?.reason, payload: { occurrenceId: occurrence.id, type: occurrence.type, severity: occurrence.severity } });
    res.status(201).json(occurrence);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao registar a ocorrência.');
  }
});

router.post('/:contactId/occurrences/:occurrenceId/resolve', requireFoodPermission('customers.edit'), async (req, res) => {
  try {
    const occurrence = await resolveFoodCustomerOccurrence(prisma, req.foodContext, req.params.contactId, req.params.occurrenceId, req.body?.resolutionNote);
    await recordFoodAudit(prisma, req, { branchId: occurrence.branchId, action: 'customer.occurrence.resolved', entityType: 'contact', entityId: String(occurrence.contactId), reason: req.body?.resolutionNote, payload: { occurrenceId: occurrence.id, type: occurrence.type, severity: occurrence.severity } });
    res.json(occurrence);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao resolver a ocorrência.');
  }
});

router.get('/:contactId', requireFoodPermission('customers.view'), async (req, res) => {
  try {
    res.json(await getFoodCustomer(prisma, req.foodContext.organizationId, req.params.contactId));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar o cliente Food.');
  }
});

router.patch('/:contactId', requireFoodPermission('customers.edit'), async (req, res) => {
  try {
    const result = await updateFoodCustomer(prisma, req.foodContext, req.params.contactId, req.body);
    await recordFoodAudit(prisma, req, { branchId: result.customer.foodProfile?.preferredBranchId, action: 'customer.updated', entityType: 'contact', entityId: String(result.customer.id), reason: req.body?.reason, payload: { fields: result.changedFields } });
    res.json(result.customer);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atualizar o cliente Food.');
  }
});

router.delete('/:contactId', requireFoodPermission('customers.edit'), async (req, res) => {
  try {
    const archived = await archiveFoodCustomer(prisma, req.foodContext.organizationId, req.params.contactId);
    await recordFoodAudit(prisma, req, { action: 'customer.archived', entityType: 'contact', entityId: String(archived.contactId), reason: req.body?.reason, payload: { profileId: archived.profileId } });
    res.status(204).send();
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao arquivar o cliente Food.');
  }
});

module.exports = router;
