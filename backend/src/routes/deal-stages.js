const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { ensureDefaultDealStages } = require('../lib/deal-stages');
const { requirePermission, requireDeletePermission } = require('../lib/permissions');
const { logRouteError } = require('../lib/request-log');

// GET /api/deal-stages
router.get('/', requirePermission('pipeline', 'view'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    await ensureDefaultDealStages(userId);
    const stages = await prisma.dealStage.findMany({ where: { userId }, orderBy: { order: 'asc' } });
    res.json(stages);
  } catch (error) {
    logRouteError('[deal-stages.list] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/deal-stages
router.post('/', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const userId = req.user.effectiveUserId;
    const max = await prisma.dealStage.aggregate({ where: { userId }, _max: { order: true } });
    const stage = await prisma.dealStage.create({
      data: { userId, name: name.trim(), color: color || '#6b7e9a', order: (max._max.order ?? -1) + 1 },
    });
    res.status(201).json(stage);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Stage name already exists' });
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/deal-stages/reorder — antes de /:id
router.put('/reorder', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order array' });
    const userId = req.user.effectiveUserId;
    await Promise.all(order.map(({ id, order: o }) =>
      prisma.dealStage.updateMany({ where: { id, userId }, data: { order: o } })
    ));
    const stages = await prisma.dealStage.findMany({ where: { userId }, orderBy: { order: 'asc' } });
    res.json(stages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/deal-stages/:id
router.put('/:id', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const { name, color } = req.body;
    const existing = await prisma.dealStage.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (color !== undefined) data.color = color;
    const stage = await prisma.dealStage.update({ where: { id: req.params.id }, data });
    res.json(stage);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Stage name already exists' });
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/deal-stages/:id — move deals da fase apagada para a primeira fase restante
router.delete('/:id', requireDeletePermission, async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const existing = await prisma.dealStage.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Stage not found' });

    const total = await prisma.dealStage.count({ where: { userId } });
    if (total <= 1) return res.status(400).json({ error: 'Cannot delete the last stage' });

    const firstOther = await prisma.dealStage.findFirst({
      where: { userId, id: { not: req.params.id } },
      orderBy: { order: 'asc' },
    });
    if (firstOther) {
      await prisma.deal.updateMany({
        where: { userId, stageId: req.params.id },
        data: { stageId: firstOther.id, stageEnteredAt: new Date() },
      });
    }
    await prisma.dealStage.delete({ where: { id: req.params.id } });
    res.json({ message: 'Stage deleted', movedTo: firstOther?.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
