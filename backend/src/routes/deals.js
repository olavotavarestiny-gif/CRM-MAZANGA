const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { log: logActivity } = require('../services/activity-log.service.js');
const { requirePermission, requireDeletePermission } = require('../lib/permissions');
const { logRouteError } = require('../lib/request-log');

const VALID_ROLES = ['tecnico', 'decisor', 'financeiro', 'influenciador', 'outro'];
const VALID_INFLUENCE = ['alto', 'medio', 'baixo'];

// Coage valueKz para número finito ou null (evita NaN a chegar ao Prisma)
function toValueKz(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const dealInclude = {
  company: true,
  stage: true,
  stakeholders: {
    include: { contact: { select: { id: true, name: true, email: true, phone: true } } },
    orderBy: { addedAt: 'asc' },
  },
};

async function loadOwnedDeal(id, userId) {
  const deal = await prisma.deal.findUnique({ where: { id } });
  if (!deal || deal.userId !== userId) return null;
  return deal;
}

// GET /api/deals — todos os deals (para o kanban)
router.get('/', requirePermission('pipeline', 'view'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const where = { userId };
    if (req.query.status) where.status = req.query.status;
    const deals = await prisma.deal.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { company: true, stage: true, _count: { select: { stakeholders: true } } },
    });
    res.json(deals);
  } catch (error) {
    logRouteError('[deals.list] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/deals/:id — detalhe completo
router.get('/:id', requirePermission('pipeline', 'view'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await prisma.deal.findUnique({ where: { id: req.params.id }, include: dealInclude });
    if (!deal || deal.userId !== userId) return res.status(404).json({ error: 'Deal not found' });
    res.json(deal);
  } catch (error) {
    logRouteError('[deals.get] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/deals — cria negociação; aceita companyId OU newCompanyName
router.post('/', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const { title, companyId, newCompanyName, valueKz, stageId } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && newCompanyName && newCompanyName.trim()) {
      const company = await prisma.company.create({ data: { userId, name: newCompanyName.trim() } });
      resolvedCompanyId = company.id;
    }
    if (!resolvedCompanyId) return res.status(400).json({ error: 'Empresa é obrigatória (companyId ou newCompanyName)' });
    const company = await prisma.company.findUnique({ where: { id: resolvedCompanyId } });
    if (!company || company.userId !== userId) return res.status(404).json({ error: 'Company not found' });

    let resolvedStageId = stageId;
    if (!resolvedStageId) {
      const first = await prisma.dealStage.findFirst({ where: { userId }, orderBy: { order: 'asc' } });
      if (!first) return res.status(400).json({ error: 'Nenhuma fase configurada' });
      resolvedStageId = first.id;
    }

    const deal = await prisma.deal.create({
      data: {
        userId, companyId: resolvedCompanyId, stageId: resolvedStageId,
        title: title.trim(),
        valueKz: toValueKz(valueKz),
        ownerUserId: req.user.id,
        stageEnteredAt: new Date(),
      },
      include: dealInclude,
    });
    res.status(201).json(deal);
  } catch (error) {
    logRouteError('[deals.create] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/deals/:id — atualizar título/valor/fase. Mudança de fase -> ActivityLog + reset stageEnteredAt
router.put('/:id', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await loadOwnedDeal(req.params.id, userId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const { title, valueKz, stageId, expectedCloseDate } = req.body;
    const data = {};
    if (title !== undefined) data.title = title.trim();
    if (valueKz !== undefined) data.valueKz = toValueKz(valueKz);
    if (expectedCloseDate !== undefined) data.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;

    let stageChanged = false;
    let oldStageName, newStageName;
    if (stageId !== undefined && stageId !== deal.stageId) {
      const newStage = await prisma.dealStage.findUnique({ where: { id: stageId } });
      if (!newStage || newStage.userId !== userId) return res.status(400).json({ error: 'Invalid stage' });
      const oldStage = await prisma.dealStage.findUnique({ where: { id: deal.stageId } });
      data.stageId = stageId;
      data.stageEnteredAt = new Date();
      stageChanged = true;
      oldStageName = oldStage?.name;
      newStageName = newStage.name;
    }

    const updated = await prisma.deal.update({ where: { id: deal.id }, data, include: dealInclude });

    if (stageChanged) {
      await logActivity({
        organization_id: userId,
        entity_type: 'deal',
        entity_id: deal.id,
        entity_label: updated.title,
        action: 'stage_changed',
        field_changed: 'stage',
        old_value: oldStageName,
        new_value: newStageName,
        user_id: req.user.id,
        user_name: req.user.name,
        metadata: { old_stage_name: oldStageName, new_stage_name: newStageName },
      });
    }
    res.json(updated);
  } catch (error) {
    logRouteError('[deals.update] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/deals/:id/close — { status: 'ganho'|'perdido', lossReason? }
router.post('/:id/close', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await loadOwnedDeal(req.params.id, userId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const { status, lossReason } = req.body;
    if (!['ganho', 'perdido'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (status === 'perdido' && (!lossReason || !lossReason.trim())) {
      return res.status(400).json({ error: 'Motivo de perda é obrigatório' });
    }
    const updated = await prisma.deal.update({
      where: { id: deal.id },
      data: { status, lossReason: status === 'perdido' ? lossReason.trim() : null, closedAt: new Date() },
      include: dealInclude,
    });
    await logActivity({
      organization_id: userId, entity_type: 'deal', entity_id: deal.id, entity_label: updated.title,
      action: status === 'ganho' ? 'deal_won' : 'deal_lost', field_changed: 'status',
      old_value: deal.status, new_value: status, user_id: req.user.id, user_name: req.user.name,
      metadata: { lossReason: updated.lossReason },
    });
    res.json(updated);
  } catch (error) {
    logRouteError('[deals.close] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/deals/:id/reopen
router.post('/:id/reopen', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await loadOwnedDeal(req.params.id, userId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const updated = await prisma.deal.update({
      where: { id: deal.id },
      data: { status: 'aberto', lossReason: null, closedAt: null },
      include: dealInclude,
    });
    res.json(updated);
  } catch (error) {
    logRouteError('[deals.reopen] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/deals/:id
router.delete('/:id', requireDeletePermission, async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await loadOwnedDeal(req.params.id, userId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    await prisma.deal.delete({ where: { id: deal.id } });
    res.json({ message: 'Deal deleted' });
  } catch (error) {
    logRouteError('[deals.delete] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// ---- Stakeholders ----

// POST /api/deals/:id/stakeholders
router.post('/:id/stakeholders', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await loadOwnedDeal(req.params.id, userId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    let { contactId, newContact, role, influence, isPrimary, notes } = req.body;
    if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (influence && !VALID_INFLUENCE.includes(influence)) return res.status(400).json({ error: 'Invalid influence' });

    if (!contactId && newContact && newContact.name && newContact.name.trim()) {
      const created = await prisma.contact.create({
        data: {
          userId,
          name: newContact.name.trim(),
          email: newContact.email || '',
          phone: newContact.phone || '',
          company: '',
          companyId: deal.companyId,
        },
      });
      contactId = created.id;
    }
    if (!contactId) return res.status(400).json({ error: 'contactId ou newContact é obrigatório' });
    contactId = Number(contactId);

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact || contact.userId !== userId) return res.status(404).json({ error: 'Contact not found' });

    const stakeholder = await prisma.dealStakeholder.upsert({
      where: { dealId_contactId: { dealId: deal.id, contactId } },
      update: { role: role || 'outro', influence: influence || null, isPrimary: !!isPrimary, notes: notes || null },
      create: { dealId: deal.id, contactId, role: role || 'outro', influence: influence || null, isPrimary: !!isPrimary, notes: notes || null },
      include: { contact: { select: { id: true, name: true, email: true, phone: true } } },
    });
    res.status(201).json(stakeholder);
  } catch (error) {
    logRouteError('[deals.addStakeholder] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/deals/:id/stakeholders/:stakeholderId
router.put('/:id/stakeholders/:stakeholderId', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await loadOwnedDeal(req.params.id, userId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const sh = await prisma.dealStakeholder.findUnique({ where: { id: req.params.stakeholderId } });
    if (!sh || sh.dealId !== deal.id) return res.status(404).json({ error: 'Stakeholder not found' });

    const { role, influence, isPrimary, notes } = req.body;
    if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (influence && !VALID_INFLUENCE.includes(influence)) return res.status(400).json({ error: 'Invalid influence' });
    const data = {};
    if (role !== undefined) data.role = role;
    if (influence !== undefined) data.influence = influence || null;
    if (isPrimary !== undefined) data.isPrimary = !!isPrimary;
    if (notes !== undefined) data.notes = notes || null;
    const updated = await prisma.dealStakeholder.update({
      where: { id: sh.id }, data,
      include: { contact: { select: { id: true, name: true, email: true, phone: true } } },
    });
    res.json(updated);
  } catch (error) {
    logRouteError('[deals.updateStakeholder] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/deals/:id/stakeholders/:stakeholderId
router.delete('/:id/stakeholders/:stakeholderId', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await loadOwnedDeal(req.params.id, userId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const sh = await prisma.dealStakeholder.findUnique({ where: { id: req.params.stakeholderId } });
    if (!sh || sh.dealId !== deal.id) return res.status(404).json({ error: 'Stakeholder not found' });
    await prisma.dealStakeholder.delete({ where: { id: sh.id } });
    res.json({ message: 'Stakeholder removed' });
  } catch (error) {
    logRouteError('[deals.removeStakeholder] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
