const express = require('express');
const prisma = require('../lib/prisma');
const { requirePermission, requireDeletePermission } = require('../lib/permissions');

const router = express.Router();
const VALID_PRIORITIES = ['Baixa', 'Media', 'Alta'];

const TASK_INCLUDE = {
  contact: {
    select: { id: true, name: true, company: true },
  },
};

// GET all tasks
router.get('/', requirePermission('tasks', 'view'), async (req, res) => {
  try {
    const { done, contactId } = req.query;
    const where = { userId: req.user.effectiveUserId };

    if (done !== undefined) where.done = done === 'true';
    if (contactId !== undefined) where.contactId = parseInt(contactId);

    const tasks = await prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST create a new task (contactId is optional)
router.post('/', requirePermission('tasks', 'edit'), async (req, res) => {
  try {
    const { contactId, title, notes, dueDate, priority } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }

    // If contactId provided, verify ownership
    if (contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: parseInt(contactId) },
        select: { userId: true },
      });
      if (!contact || contact.userId !== req.user.effectiveUserId) {
        return res.status(404).json({ error: 'Contact not found' });
      }
    }

    const task = await prisma.task.create({
      data: {
        contactId: contactId ? parseInt(contactId) : null,
        title: title.trim(),
        notes: notes || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'Media',
        userId: req.user.effectiveUserId,
      },
      include: TASK_INCLUDE,
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT update a task
router.put('/:id', requirePermission('tasks', 'edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, notes, dueDate, priority, done, contactId } = req.body;

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }

    const task = await prisma.task.findUnique({
      where: { id: parseInt(id) },
      select: { userId: true },
    });
    if (!task || task.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // If new contactId provided, verify ownership
    if (contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: parseInt(contactId) },
        select: { userId: true },
      });
      if (!contact || contact.userId !== req.user.effectiveUserId) {
        return res.status(404).json({ error: 'Contact not found' });
      }
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (notes !== undefined) updateData.notes = notes || null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (priority !== undefined) updateData.priority = priority;
    if (done !== undefined) updateData.done = done;
    if (contactId !== undefined) updateData.contactId = contactId ? parseInt(contactId) : null;

    const updatedTask = await prisma.task.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: TASK_INCLUDE,
    });

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE a task
router.delete('/:id', requireDeletePermission, async (req, res) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id: parseInt(id) },
      select: { userId: true },
    });
    if (!task || task.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.task.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
