const express = require('express');
const prisma = require('../lib/prisma');
const {
  requirePermission,
  requireDeletePermission,
  canPerform,
  canTaskAssignment,
} = require('../lib/permissions');
const { log: logActivity } = require('../services/activity-log.service.js');
const { canCreateTask, buildLimitErrorPayload } = require('../lib/plan-limits');
const {
  CalendarIntegrationError,
  pushEventToGoogle,
  deleteEventFromGoogle,
  getGoogleErrorDetails,
} = require('../lib/google-calendar');

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

  if (!canAssignTaskToUser(req, assignee)) {
    return { error: 'Só pode atribuir tarefas a si mesmo ou a admin/owner autorizado' };
  }

  return { assignedToUserId, assignee };
}

function canAssignTaskToUser(req, assignee) {
  if (isPrivilegedTaskManager(req)) return true;
  if (assignee.id === req.user.id) return true;

  const canAssignAdminOwner = canTaskAssignment(req.user.permissionsJson, 'assign_admin_owner');
  const isAdminOrOwner = assignee.role === 'admin' || !assignee.accountOwnerId;

  return canAssignAdminOwner && isAdminOrOwner;
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

async function logTaskActivity(req, data) {
  await logActivity({
    organization_id: req.user.effectiveUserId,
    user_id: req.user.id,
    user_name: req.user.name,
    ...data,
  });
}

function trimTaskSyncError(message) {
  if (!message) return null;
  return String(message).slice(0, 1000);
}

function isAllDayDueDate(value) {
  if (!value) return false;

  const serialized = value instanceof Date
    ? value.toISOString()
    : String(value);

  return !serialized.includes('T')
    || /T00:00(:00(?:\.000)?)?(Z|[+-]\d{2}:\d{2})?$/.test(serialized);
}

function buildTaskGoogleDescription(task) {
  const parts = [];

  if (task.notes?.trim()) {
    parts.push(task.notes.trim());
  }

  if (task.contact?.name) {
    parts.push(`Contacto CRM: ${task.contact.name}`);
  }

  parts.push(`Tarefa CRM #${task.id}`);

  return parts.filter(Boolean).join('\n\n');
}

function addOneUtcDay(date) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function buildTaskGooglePayload(task, rawDueDate) {
  if (!task?.dueDate) return null;

  const dueAt = new Date(task.dueDate);
  if (Number.isNaN(dueAt.getTime())) return null;

  const allDay = rawDueDate !== undefined
    ? isAllDayDueDate(rawDueDate)
    : isAllDayDueDate(dueAt);

  const description = buildTaskGoogleDescription(task);

  if (allDay) {
    return {
      title: task.title,
      description,
      allDay: true,
      startDate: dueAt.toISOString().slice(0, 10),
      endDate: addOneUtcDay(dueAt).toISOString().slice(0, 10),
      googleEventId: task.googleCalendarEventId || undefined,
    };
  }

  return {
    title: task.title,
    description,
    startTime: dueAt.toISOString(),
    endTime: new Date(dueAt.getTime() + 60 * 60 * 1000).toISOString(),
    googleEventId: task.googleCalendarEventId || undefined,
  };
}

async function getCalendarConnectionStatus(userId) {
  if (!userId) return null;

  return prisma.googleCalendarToken.findUnique({
    where: { userId },
    select: { status: true },
  });
}

async function clearTaskGoogleState(taskId) {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      googleCalendarEventId: null,
      googleCalendarHtmlLink: null,
      googleCalendarSyncedAt: null,
      googleCalendarSyncError: null,
    },
    include: TASK_INCLUDE,
  });
}

async function setTaskGoogleSyncError(taskId, error) {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      googleCalendarSyncError: trimTaskSyncError(error),
    },
    include: TASK_INCLUDE,
  });
}

async function markTaskGoogleSynced(taskId, result) {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      googleCalendarEventId: result.googleEventId,
      googleCalendarHtmlLink: result.htmlLink,
      googleCalendarSyncedAt: new Date(),
      googleCalendarSyncError: null,
    },
    include: TASK_INCLUDE,
  });
}

async function tryDeleteTaskGoogleEvent(calendarUserId, googleEventId, contextLabel) {
  if (!calendarUserId || !googleEventId) return;

  const connection = await getCalendarConnectionStatus(calendarUserId);
  if (!connection) return;

  try {
    await deleteEventFromGoogle(calendarUserId, googleEventId);
  } catch (error) {
    const details = getGoogleErrorDetails(error);
    console.warn(`[tasks/google] failed to delete Google event during ${contextLabel}:`, details.message);
  }
}

async function syncTaskGoogleEvent({
  task,
  rawDueDate,
  previousAssignedToUserId = null,
  previousGoogleCalendarEventId = null,
}) {
  const assigneeUserId = task.assignedToUserId || null;
  const assigneeChanged = previousAssignedToUserId
    && assigneeUserId
    && previousAssignedToUserId !== assigneeUserId;

  if (assigneeChanged && previousGoogleCalendarEventId) {
    await tryDeleteTaskGoogleEvent(
      previousAssignedToUserId,
      previousGoogleCalendarEventId,
      `task reassignment #${task.id}`
    );

    await prisma.task.update({
      where: { id: task.id },
      data: {
        googleCalendarEventId: null,
        googleCalendarHtmlLink: null,
        googleCalendarSyncedAt: null,
        googleCalendarSyncError: null,
      },
    });

    task.googleCalendarEventId = null;
    task.googleCalendarHtmlLink = null;
  }

  if (!task.dueDate) {
    if (!task.googleCalendarEventId) {
      return clearTaskGoogleState(task.id);
    }

    const connection = await getCalendarConnectionStatus(assigneeUserId);
    if (!connection) {
      return clearTaskGoogleState(task.id);
    }

    try {
      await deleteEventFromGoogle(assigneeUserId, task.googleCalendarEventId);
      return clearTaskGoogleState(task.id);
    } catch (error) {
      const details = getGoogleErrorDetails(error);
      return setTaskGoogleSyncError(task.id, details.message);
    }
  }

  const connection = await getCalendarConnectionStatus(assigneeUserId);
  if (!connection) {
    return clearTaskGoogleState(task.id);
  }

  const payload = buildTaskGooglePayload(task, rawDueDate);
  if (!payload) {
    return setTaskGoogleSyncError(task.id, 'Data inválida para sincronização com Google Calendar');
  }

  if (assigneeChanged) {
    payload.googleEventId = undefined;
  }

  try {
    const result = await pushEventToGoogle(assigneeUserId, payload);
    return markTaskGoogleSynced(task.id, result);
  } catch (error) {
    const details = error instanceof CalendarIntegrationError
      ? { message: error.message }
      : getGoogleErrorDetails(error);
    return setTaskGoogleSyncError(task.id, details.message);
  }
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

    const createdTask = await prisma.task.create({
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
      taskTitle: createdTask.title,
      taskId: createdTask.id,
      previousAssignedToUserId: null,
    });

    await logTaskActivity(req, {
      entity_type: 'task',
      entity_id: createdTask.id,
      entity_label: createdTask.title,
      action: 'created',
      metadata: {
        task_id: createdTask.id,
        assigned_to_name: createdTask.assignedTo?.name || null,
      },
    });

    const task = await syncTaskGoogleEvent({
      task: createdTask,
      rawDueDate: dueDate,
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
      select: {
        id: true,
        userId: true,
        assignedToUserId: true,
        title: true,
        done: true,
        dueDate: true,
        googleCalendarEventId: true,
      },
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

    const persistedTask = await prisma.task.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: TASK_INCLUDE,
    });

    await notifyTaskAssignment({
      req,
      assignedToUserId: persistedTask.assignedToUserId,
      taskTitle: persistedTask.title,
      taskId: persistedTask.id,
      previousAssignedToUserId: task.assignedToUserId,
    });

    if (task.done !== persistedTask.done) {
      await logTaskActivity(req, {
        entity_type: 'task',
        entity_id: persistedTask.id,
        entity_label: persistedTask.title,
        action: 'status_changed',
        field_changed: 'done',
        old_value: task.done ? 'Concluída' : 'Por fazer',
        new_value: persistedTask.done ? 'Concluída' : 'Por fazer',
        metadata: {
          task_id: persistedTask.id,
        },
      });
    }

    if (task.assignedToUserId !== persistedTask.assignedToUserId) {
      const previousAssignee = task.assignedToUserId
        ? await getOrgMember(req.user.effectiveUserId, task.assignedToUserId)
        : null;

      await logTaskActivity(req, {
        entity_type: 'task',
        entity_id: persistedTask.id,
        entity_label: persistedTask.title,
        action: 'updated',
        field_changed: 'assigned_to',
        old_value: previousAssignee?.name || 'Sem responsável',
        new_value: persistedTask.assignedTo?.name || 'Sem responsável',
        metadata: {
          task_id: persistedTask.id,
          previous_assigned_to_name: previousAssignee?.name || null,
          new_assigned_to_name: persistedTask.assignedTo?.name || null,
        },
      });
    }

    const updatedTask = await syncTaskGoogleEvent({
      task: persistedTask,
      rawDueDate: dueDate,
      previousAssignedToUserId: task.assignedToUserId,
      previousGoogleCalendarEventId: task.googleCalendarEventId,
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
      select: {
        id: true,
        userId: true,
        title: true,
        assignedToUserId: true,
        googleCalendarEventId: true,
      },
    });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.googleCalendarEventId) {
      await tryDeleteTaskGoogleEvent(
        task.assignedToUserId,
        task.googleCalendarEventId,
        `task deletion #${task.id}`
      );
    }

    await prisma.task.delete({ where: { id: parseInt(id) } });
    await logTaskActivity(req, {
      entity_type: 'task',
      entity_id: task.id,
      entity_label: task.title,
      action: 'deleted',
      metadata: {
        task_id: task.id,
      },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
