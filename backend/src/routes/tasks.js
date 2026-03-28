const express = require('express');
const prisma = require('../lib/prisma');
const { requirePermission, requireDeletePermission, canPerform } = require('../lib/permissions');
const { canCreateTask, buildLimitErrorPayload } = require('../lib/plan-limits');

const router = express.Router();
const VALID_PRIORITIES = ['Baixa', 'Media', 'Alta'];

const TASK_INCLUDE = {
  contact: {
    select: { id: true, name: true, company: true },
  },
  assignedTo: {
    select: { id: true, name: true, email: true },
  },
};

function isPrivilegedTaskManager(req) {
  return !!(req.user?.isSuperAdmin || req.user?.isAccountOwner || req.user?.role === 'admin');
}

function getTaskAccessWhere(req) {
  const baseWhere = { userId: req.user.effectiveUserId };
  if (isPrivilegedTaskManager(req)) return baseWhere;
  return {
    ...baseWhere,
    assignedToUserId: req.user.id,
  };
}

async function getOrgMember(orgId, targetUserId) {
  return prisma.user.findFirst({
    where: {
      id: targetUserId,
      active: true,
      OR: [{ id: orgId }, { accountOwnerId: orgId }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      permissions: true,
      role: true,
      isSuperAdmin: true,
      accountOwnerId: true,
    },
  });
}

async function resolveAssigneeId(req, rawAssigneeId) {
  if (rawAssigneeId === undefined) return { mode: 'unchanged' };
  if (rawAssigneeId === null || rawAssigneeId === '') {
    return { error: 'Responsável é obrigatório' };
  }

  const assignedToUserId = parseInt(rawAssigneeId, 10);
  if (!Number.isInteger(assignedToUserId)) {
    return { error: 'Responsável inválido' };
  }

  const assignee = await getOrgMember(req.user.effectiveUserId, assignedToUserId);
  if (!assignee) {
    return { error: 'Responsável não encontrado nesta conta' };
  }

  if (!isPrivilegedTaskManager(req) && assignee.id !== req.user.id) {
    return { error: 'Só pode atribuir tarefas a si mesmo' };
  }

  return { assignedToUserId, assignee };
}

async function ensureDirectChannel(orgId, userAId, userBId) {
  const existing = await prisma.chatChannel.findFirst({
    where: {
      orgId,
      type: 'dm',
      AND: [
        { members: { some: { userId: userAId } } },
        { members: { some: { userId: userBId } } },
      ],
    },
  });

  if (existing) return existing;

  const targetUser = await prisma.user.findUnique({
    where: { id: userBId },
    select: { name: true },
  });

  return prisma.chatChannel.create({
    data: {
      orgId,
      name: targetUser?.name || `DM-${userBId}`,
      type: 'dm',
      createdById: userAId,
      members: {
        create: [{ userId: userAId }, { userId: userBId }],
      },
    },
  });
}

function canReceiveInternalChat(user) {
  if (!user) return false;
  if (user.isSuperAdmin || user.role === 'admin' || !user.accountOwnerId) return true;
  return canPerform(user.permissions, 'chat', 'view') || canPerform(user.permissions, 'chat', 'edit');
}

async function notifyTaskAssignment({ req, assignedToUserId, taskTitle, taskId, previousAssignedToUserId }) {
  if (!assignedToUserId || assignedToUserId === req.user.id) return;
  if (previousAssignedToUserId === assignedToUserId) return;

  const assignee = await getOrgMember(req.user.effectiveUserId, assignedToUserId);
  if (!assignee || !canReceiveInternalChat(assignee)) return;

  const dmChannel = await ensureDirectChannel(req.user.effectiveUserId, req.user.id, assignedToUserId);
  const messageText = `Nova tarefa atribuída: "${taskTitle}" por ${req.user.name}. Consulta em /tasks (ref. #${taskId}).`;

  await prisma.chatMessage.create({
    data: {
      channelId: dmChannel.id,
      senderId: req.user.id,
      text: messageText,
      attachments: '[]',
      mentions: '[]',
    },
  });
}

// GET all tasks
router.get('/', requirePermission('tasks', 'view'), async (req, res) => {
  try {
    const { done, contactId } = req.query;
    const where = getTaskAccessWhere(req);

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
    const { contactId, title, notes, dueDate, priority, assignedToUserId: rawAssignedToUserId } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }

    const limitState = await canCreateTask(req.user.effectiveUserId);
    if (!limitState.allowed) {
      return res.status(403).json(buildLimitErrorPayload(limitState));
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

    const assigneeResult = await resolveAssigneeId(req, rawAssignedToUserId);
    if (assigneeResult.error) {
      return res.status(400).json({ error: assigneeResult.error });
    }
    if (assigneeResult.mode === 'unchanged') {
      return res.status(400).json({ error: 'Responsável é obrigatório' });
    }

    const task = await prisma.task.create({
      data: {
        contactId: contactId ? parseInt(contactId) : null,
        assignedToUserId: assigneeResult.assignedToUserId,
        title: title.trim(),
        notes: notes || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'Media',
        userId: req.user.effectiveUserId,
      },
      include: TASK_INCLUDE,
    });

    await notifyTaskAssignment({
      req,
      assignedToUserId: assigneeResult.assignedToUserId,
      taskTitle: task.title,
      taskId: task.id,
      previousAssignedToUserId: null,
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
    const { title, notes, dueDate, priority, done, contactId, assignedToUserId: rawAssignedToUserId } = req.body;

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }

    const task = await prisma.task.findFirst({
      where: { id: parseInt(id), userId: req.user.effectiveUserId },
      select: { userId: true, assignedToUserId: true, title: true },
    });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (!isPrivilegedTaskManager(req) && task.assignedToUserId !== req.user.id) {
      return res.status(403).json({ error: 'Sem acesso a esta tarefa' });
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

    const assigneeResult = await resolveAssigneeId(req, rawAssignedToUserId);
    if (assigneeResult.error) {
      return res.status(400).json({ error: assigneeResult.error });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (notes !== undefined) updateData.notes = notes || null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (priority !== undefined) updateData.priority = priority;
    if (done !== undefined) updateData.done = done;
    if (contactId !== undefined) updateData.contactId = contactId ? parseInt(contactId) : null;
    if (assigneeResult.mode !== 'unchanged') updateData.assignedToUserId = assigneeResult.assignedToUserId;

    const updatedTask = await prisma.task.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: TASK_INCLUDE,
    });

    await notifyTaskAssignment({
      req,
      assignedToUserId: updatedTask.assignedToUserId,
      taskTitle: updatedTask.title,
      taskId: updatedTask.id,
      previousAssignedToUserId: task.assignedToUserId,
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

    const task = await prisma.task.findFirst({
      where: { id: parseInt(id), userId: req.user.effectiveUserId },
      select: { userId: true },
    });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.task.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
