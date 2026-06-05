const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requirePermission, requireDeletePermission } = require('../lib/permissions');
const { logRouteError } = require('../lib/request-log');

// GET /api/companies — lista com contagem de deals
router.get('/', requirePermission('pipeline', 'view'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const companies = await prisma.company.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { deals: true } } },
    });
    res.json(companies);
  } catch (error) {
    logRouteError('[companies.list] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/companies/:id — empresa + todos os deals + contactos conhecidos
router.get('/:id', requirePermission('pipeline', 'view'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        deals: { include: { stage: true, _count: { select: { stakeholders: true } } }, orderBy: { createdAt: 'desc' } },
        contacts: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!company || company.userId !== userId) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (error) {
    logRouteError('[companies.get] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/companies
router.post('/', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const { name, nif, sector, website, location, sizeTier } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const company = await prisma.company.create({
      data: {
        userId: req.user.effectiveUserId,
        name: name.trim(),
        nif: nif || null, sector: sector || null, website: website || null,
        location: location || null, sizeTier: sizeTier || null,
      },
    });
    res.status(201).json(company);
  } catch (error) {
    logRouteError('[companies.create] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/companies/:id
router.put('/:id', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const existing = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Company not found' });
    const { name, nif, sector, website, location, sizeTier } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (nif !== undefined) data.nif = nif || null;
    if (sector !== undefined) data.sector = sector || null;
    if (website !== undefined) data.website = website || null;
    if (location !== undefined) data.location = location || null;
    if (sizeTier !== undefined) data.sizeTier = sizeTier || null;
    const company = await prisma.company.update({ where: { id: req.params.id }, data });
    res.json(company);
  } catch (error) {
    logRouteError('[companies.update] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/companies/:id — bloqueado se tiver deals
router.delete('/:id', requireDeletePermission, async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const existing = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { deals: true } } },
    });
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Company not found' });
    if (existing._count.deals > 0) {
      return res.status(400).json({ error: 'Não é possível apagar uma empresa com negociações. Apague ou mova as negociações primeiro.' });
    }
    await prisma.company.delete({ where: { id: req.params.id } });
    res.json({ message: 'Company deleted' });
  } catch (error) {
    logRouteError('[companies.delete] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
