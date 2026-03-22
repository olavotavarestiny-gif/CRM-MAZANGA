const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

const DEFAULT_STAGES = [
  { name: 'Novo',             color: '#3B82F6', order: 0 },
  { name: 'Contactado',       color: '#F59E0B', order: 1 },
  { name: 'Qualificado',      color: '#8B5CF6', order: 2 },
  { name: 'Proposta Enviada', color: '#F97316', order: 3 },
  { name: 'Fechado',          color: '#10B981', order: 4 },
  { name: 'Perdido',          color: '#6B7280', order: 5 },
];

// Seed default stages if user has none
async function ensureDefaultStages(userId) {
  const count = await prisma.pipelineStage.count({ where: { userId } });
  if (count === 0) {
    await prisma.pipelineStage.createMany({
      data: DEFAULT_STAGES.map(s => ({ ...s, userId })),
      skipDuplicates: true,
    });
  }
}

// GET /api/pipeline-stages
router.get('/', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    await ensureDefaultStages(userId);
    const stages = await prisma.pipelineStage.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
    res.json(stages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/pipeline-stages
router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const userId = req.user.effectiveUserId;

    const max = await prisma.pipelineStage.aggregate({ where: { userId }, _max: { order: true } });
    const stage = await prisma.pipelineStage.create({
      data: {
        userId,
        name: name.trim(),
        color: color || '#6b7e9a',
        order: (max._max.order ?? -1) + 1,
      },
    });
    res.status(201).json(stage);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Stage name already exists' });
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/pipeline-stages/reorder — MUST be before /:id
router.put('/reorder', async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order array' });
    const userId = req.user.effectiveUserId;
    await Promise.all(
      order.map(({ id, order: o }) =>
        prisma.pipelineStage.updateMany({ where: { id, userId }, data: { order: o } })
      )
    );
    const stages = await prisma.pipelineStage.findMany({ where: { userId }, orderBy: { order: 'asc' } });
    res.json(stages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/pipeline-stages/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, color } = req.body;
    const existing = await prisma.pipelineStage.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (color !== undefined) data.color = color;
    const stage = await prisma.pipelineStage.update({ where: { id: req.params.id }, data });
    res.json(stage);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Stage name already exists' });
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/pipeline-stages/:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const existing = await prisma.pipelineStage.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    // Check at least 1 stage remains
    const total = await prisma.pipelineStage.count({ where: { userId } });
    if (total <= 1) return res.status(400).json({ error: 'Cannot delete the last stage' });

    // Move contacts in this stage to the first remaining stage
    const firstOther = await prisma.pipelineStage.findFirst({
      where: { userId, id: { not: req.params.id } },
      orderBy: { order: 'asc' },
    });
    if (firstOther) {
      await prisma.contact.updateMany({
        where: { userId, stage: existing.name },
        data: { stage: firstOther.name },
      });
    }

    await prisma.pipelineStage.delete({ where: { id: req.params.id } });
    res.json({ message: 'Stage deleted', movedTo: firstOther?.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
