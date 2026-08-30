const express = require('express');
const prisma = require('../../lib/prisma');
const { FOOD_ROLES, FOOD_ROLE_LABELS, requireFoodPermission } = require('../../lib/food-access');
const { domainError } = require('../../lib/food-domain');
const { recordFoodAudit } = require('../../lib/food-audit');
const { setFoodStaffPin, getCurrentFoodWorkforce, startFoodShift, endFoodShift } = require('../../services/food-workforce.service');
const { saveFoodWorkSchedule, listFoodWorkSchedules, archiveFoodWorkSchedule } = require('../../services/food-workforce-management.service');
const { handleFoodV1Error } = require('./errors');

const router = express.Router();

function serializeAssignment(assignment) {
  return {
    ...assignment,
    roleLabel: FOOD_ROLE_LABELS[assignment.role] || assignment.role,
  };
}

async function assertPersonBelongsToOrganization(organizationId, personId) {
  if (organizationId === personId) return;
  const [homeMember, membership] = await Promise.all([
    prisma.user.findFirst({
      where: { id: personId, accountOwnerId: organizationId, active: true },
      select: { id: true },
    }),
    prisma.accountMembership.findFirst({
      where: { accountOwnerId: organizationId, personId, active: true },
      select: { id: true },
    }),
  ]);
  if (!homeMember && !membership) throw domainError('O utilizador não pertence a esta organização.', 400);
}

async function assertBranch(organizationId, branchId) {
  if (!branchId) return;
  const branch = await prisma.foodBranch.findFirst({ where: { id: branchId, userId: organizationId, active: true } });
  if (!branch) throw domainError('Unidade Food inválida.', 400);
}

router.get('/', requireFoodPermission('team.view'), async (req, res) => {
  try {
    const [assignments, credentials] = await Promise.all([
      prisma.foodStaffRoleAssignment.findMany({
        where: { organizationId: req.foodContext.organizationId },
        include: {
          person: { select: { id: true, name: true, email: true, active: true } },
          branch: { select: { id: true, name: true, active: true } },
        },
        orderBy: [{ person: { name: 'asc' } }, { isPrimary: 'desc' }, { role: 'asc' }],
      }),
      prisma.foodStaffCredential.findMany({
        where: { organizationId: req.foodContext.organizationId, active: true },
        select: { personId: true, lockedUntil: true },
      }),
    ]);
    const credentialByPerson = new Map(credentials.map((item) => [item.personId, item]));
    res.json({
      roles: FOOD_ROLES.map((role) => ({ value: role, label: FOOD_ROLE_LABELS[role] })),
      assignments: assignments.map((assignment) => ({
        ...serializeAssignment(assignment),
        credentialConfigured: credentialByPerson.has(assignment.personId),
        credentialLockedUntil: credentialByPerson.get(assignment.personId)?.lockedUntil || null,
      })),
    });
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar a equipa Food.');
  }
});

router.post('/credentials/self', requireFoodPermission('shifts.manage_own'), async (req, res) => {
  try {
    const credential = await setFoodStaffPin(prisma, req.foodContext, req.foodContext.personId, req.body?.pin);
    await recordFoodAudit(prisma, req, { action: 'team.credential.self_configured', entityType: 'food_staff_credential', entityId: credential.id, payload: { personId: credential.personId } });
    res.json({ configured: true, updatedAt: credential.updatedAt });
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao configurar o código pessoal.');
  }
});

router.post('/credentials', requireFoodPermission('team.edit'), async (req, res) => {
  try {
    const credential = await setFoodStaffPin(prisma, req.foodContext, req.body?.personId, req.body?.pin);
    await recordFoodAudit(prisma, req, { action: 'team.credential.configured', entityType: 'food_staff_credential', entityId: credential.id, reason: req.body?.reason, payload: { personId: credential.personId } });
    res.json({ configured: true, personId: credential.personId, updatedAt: credential.updatedAt });
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao configurar o código do colaborador.');
  }
});

router.get('/workforce/current', requireFoodPermission('shifts.view_own'), async (req, res) => {
  try {
    res.json(await getCurrentFoodWorkforce(prisma, req.foodContext, req.query.branchId));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar o turno actual.');
  }
});

router.post('/shifts/start', requireFoodPermission('shifts.manage_own'), async (req, res) => {
  try {
    const result = await startFoodShift(prisma, req.foodContext, req.body);
    if (result.created) await recordFoodAudit(prisma, req, { branchId: result.shift.branchId, action: 'shift.started', entityType: 'food_shift', entityId: result.shift.id, payload: { personId: result.shift.personId, deviceId: result.shift.startDeviceId } });
    res.status(result.created ? 201 : 200).json(result.shift);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao iniciar o turno.');
  }
});

router.post('/shifts/:id/end', requireFoodPermission('shifts.manage_own'), async (req, res) => {
  try {
    const shift = await endFoodShift(prisma, req.foodContext, req.params.id, req.body);
    await recordFoodAudit(prisma, req, { branchId: shift.branchId, action: 'shift.ended', entityType: 'food_shift', entityId: shift.id, reason: req.body?.notes, payload: { personId: shift.personId, deviceId: shift.endDeviceId } });
    res.json(shift);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao terminar o turno.');
  }
});

router.get('/shifts', requireFoodPermission('team.view'), async (req, res) => {
  try {
    const branchId = req.query.branchId ? String(req.query.branchId) : null;
    if (branchId && !req.foodContext.canAccessBranch(branchId)) throw domainError('Não tem acesso a esta unidade.', 403);
    const shifts = await prisma.foodShift.findMany({
      where: {
        organizationId: req.foodContext.organizationId,
        ...(branchId ? { branchId } : req.foodContext.branchIds === null ? {} : { branchId: { in: req.foodContext.branchIds } }),
        ...(req.query.status && req.query.status !== 'all' ? { status: String(req.query.status) } : {}),
      },
      include: { branch: { select: { id: true, name: true } }, person: { select: { id: true, name: true, email: true } } },
      orderBy: { startedAt: 'desc' },
      take: 200,
    });
    res.json(shifts);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar os turnos.');
  }
});

router.get('/schedules', requireFoodPermission('team.view'), async (req, res) => {
  try {
    res.json(await listFoodWorkSchedules(prisma, req.foodContext, req.query));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar os horários.');
  }
});

router.post('/schedules', requireFoodPermission('team.edit'), async (req, res) => {
  try {
    const schedule = await saveFoodWorkSchedule(prisma, req.foodContext, req.body);
    await recordFoodAudit(prisma, req, { branchId: schedule.branchId, action: 'schedule.saved', entityType: 'food_work_schedule', entityId: schedule.id, reason: req.body?.notes, payload: { personId: schedule.personId, workDate: schedule.workDate, startTime: schedule.startTime, endTime: schedule.endTime } });
    res.status(201).json(schedule);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao guardar o horário.');
  }
});

router.delete('/schedules/:id', requireFoodPermission('team.edit'), async (req, res) => {
  try {
    const schedule = await archiveFoodWorkSchedule(prisma, req.foodContext, req.params.id);
    await recordFoodAudit(prisma, req, { branchId: schedule.branchId, action: 'schedule.archived', entityType: 'food_work_schedule', entityId: schedule.id, reason: req.body?.reason, payload: { personId: schedule.personId, workDate: schedule.workDate } });
    res.status(204).end();
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao remover o horário.');
  }
});

router.post('/', requireFoodPermission('team.edit'), async (req, res) => {
  try {
    const personId = Number(req.body?.personId);
    const role = String(req.body?.role || '').trim();
    const branchId = req.body?.branchId ? String(req.body.branchId) : null;
    if (!Number.isInteger(personId)) throw domainError('Utilizador inválido.');
    if (!FOOD_ROLES.includes(role)) throw domainError('Função Food inválida.');
    await Promise.all([
      assertPersonBelongsToOrganization(req.foodContext.organizationId, personId),
      assertBranch(req.foodContext.organizationId, branchId),
    ]);
    const existing = await prisma.foodStaffRoleAssignment.findFirst({
      where: { organizationId: req.foodContext.organizationId, personId, role, branchId },
    });
    const assignment = existing
      ? await prisma.foodStaffRoleAssignment.update({
        where: { id: existing.id },
        data: { active: true, isPrimary: req.body?.isPrimary === true },
        include: { person: { select: { id: true, name: true, email: true, active: true } }, branch: true },
      })
      : await prisma.foodStaffRoleAssignment.create({
        data: {
          organizationId: req.foodContext.organizationId,
          personId,
          branchId,
          role,
          isPrimary: req.body?.isPrimary === true,
          createdByUserId: req.foodContext.personId,
        },
        include: { person: { select: { id: true, name: true, email: true, active: true } }, branch: true },
      });
    if (assignment.isPrimary) {
      await prisma.foodStaffRoleAssignment.updateMany({
        where: { organizationId: req.foodContext.organizationId, personId, id: { not: assignment.id } },
        data: { isPrimary: false },
      });
    }
    await recordFoodAudit(prisma, req, { branchId: assignment.branchId, action: existing ? 'team.assignment.reactivated' : 'team.assignment.created', entityType: 'food_staff_role_assignment', entityId: assignment.id, reason: req.body?.reason, payload: { personId: assignment.personId, role: assignment.role, isPrimary: assignment.isPrimary } });
    res.status(existing ? 200 : 201).json(serializeAssignment(assignment));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atribuir a função Food.');
  }
});

router.patch('/:id', requireFoodPermission('team.edit'), async (req, res) => {
  try {
    const existing = await prisma.foodStaffRoleAssignment.findFirst({
      where: { id: req.params.id, organizationId: req.foodContext.organizationId },
    });
    if (!existing) throw domainError('Atribuição Food não encontrada.', 404);
    const data = {};
    if (req.body?.active !== undefined) data.active = req.body.active === true;
    if (req.body?.isPrimary !== undefined) data.isPrimary = req.body.isPrimary === true;
    const assignment = await prisma.foodStaffRoleAssignment.update({
      where: { id: existing.id },
      data,
      include: { person: { select: { id: true, name: true, email: true, active: true } }, branch: true },
    });
    if (assignment.isPrimary) {
      await prisma.foodStaffRoleAssignment.updateMany({
        where: { organizationId: req.foodContext.organizationId, personId: assignment.personId, id: { not: assignment.id } },
        data: { isPrimary: false },
      });
    }
    await recordFoodAudit(prisma, req, { branchId: assignment.branchId, action: 'team.assignment.updated', entityType: 'food_staff_role_assignment', entityId: assignment.id, reason: req.body?.reason, payload: { personId: assignment.personId, role: assignment.role, fields: Object.keys(data) } });
    res.json(serializeAssignment(assignment));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atualizar a função Food.');
  }
});

module.exports = router;
