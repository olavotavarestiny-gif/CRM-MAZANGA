const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

// GET all tasks, optionally filtered by done status
router.get('/', async (req, res) => {
  try {
    const { done, contactId } = req.query;
    const where = {};

    if (done !== undefined) {
      where.done = done === 'true';
    }

    if (contactId !== undefined) {
      where.contactId = parseInt(contactId);
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST create a new task
router.post('/', async (req, res) => {
  try {
    const { contactId, title, notes, dueDate, priority } = req.body;

    if (!contactId || !title) {
      return res.status(400).json({ error: 'contactId and title are required' });
    }

    const task = await prisma.task.create({
      data: {
        contactId: parseInt(contactId),
        title,
        notes: notes || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'Media',
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
      },
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT update a task
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, notes, dueDate, priority, done } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (notes !== undefined) updateData.notes = notes || null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (priority !== undefined) updateData.priority = priority;
    if (done !== undefined) updateData.done = done;

    const task = await prisma.task.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
      },
    });

    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE a task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.task.delete({
      where: { id: parseInt(id) },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
