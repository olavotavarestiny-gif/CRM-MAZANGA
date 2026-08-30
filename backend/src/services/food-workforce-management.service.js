const { domainError } = require('../lib/food-domain');
const { assertFoodPerson } = require('./food-workforce.service');

function parseDateOnly(value, label = 'Data') {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw domainError(`${label} inválida.`, 400, 'FOOD_SCHEDULE_DATE_INVALID');
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw domainError(`${label} inválida.`, 400, 'FOOD_SCHEDULE_DATE_INVALID');
  return date;
}

function parseTime(value, label) {
  const text = String(value || '').trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw domainError(`${label} inválida.`, 400, 'FOOD_SCHEDULE_TIME_INVALID');
  return text;
}

async function assertScheduleBranch(prisma, context, branchId) {
  if (!branchId || !context.canAccessBranch(branchId)) throw domainError('Unidade Food inválida.', 403, 'FOOD_BRANCH_FORBIDDEN');
  const branch = await prisma.foodBranch.findFirst({ where: { id: branchId, userId: context.organizationId, active: true }, select: { id: true, name: true } });
  if (!branch) throw domainError('Unidade Food não encontrada.', 404, 'FOOD_BRANCH_NOT_FOUND');
  return branch;
}

async function saveFoodWorkSchedule(prisma, context, input = {}) {
  const personId = Number(input.personId);
  const branchId = String(input.branchId || '');
  if (!Number.isInteger(personId)) throw domainError('Colaborador inválido.', 400, 'FOOD_STAFF_PERSON_INVALID');
  await Promise.all([assertFoodPerson(prisma, context.organizationId, personId), assertScheduleBranch(prisma, context, branchId)]);
  if (personId !== context.organizationId) {
    const assignment = await prisma.foodStaffRoleAssignment.findFirst({
      where: { organizationId: context.organizationId, personId, active: true, OR: [{ branchId: null }, { branchId }] },
      select: { id: true },
    });
    if (!assignment) throw domainError('O colaborador não está atribuído a esta unidade.', 400, 'FOOD_STAFF_BRANCH_INVALID');
  }
  const workDate = parseDateOnly(input.workDate);
  const startTime = parseTime(input.startTime, 'Hora inicial');
  const endTime = parseTime(input.endTime, 'Hora final');
  if (startTime === endTime) throw domainError('O horário deve ter uma duração válida.', 400, 'FOOD_SCHEDULE_DURATION_INVALID');
  return prisma.foodWorkSchedule.upsert({
    where: { organizationId_personId_workDate: { organizationId: context.organizationId, personId, workDate } },
    create: {
      organizationId: context.organizationId,
      branchId,
      personId,
      workDate,
      startTime,
      endTime,
      notes: String(input.notes || '').trim().slice(0, 500) || null,
      createdByUserId: context.personId,
      updatedByUserId: context.personId,
    },
    update: {
      branchId,
      startTime,
      endTime,
      notes: String(input.notes || '').trim().slice(0, 500) || null,
      active: true,
      updatedByUserId: context.personId,
    },
    include: { branch: { select: { id: true, name: true } }, person: { select: { id: true, name: true, email: true } } },
  });
}

async function listFoodWorkSchedules(prisma, context, input = {}) {
  const from = parseDateOnly(input.from || new Date().toISOString().slice(0, 10), 'Data inicial');
  const defaultTo = new Date(from);
  defaultTo.setUTCDate(defaultTo.getUTCDate() + 13);
  const to = parseDateOnly(input.to || defaultTo.toISOString().slice(0, 10), 'Data final');
  if (to < from || to.getTime() - from.getTime() > 62 * 86400000) throw domainError('O período de horários deve ter no máximo 63 dias.', 400, 'FOOD_SCHEDULE_RANGE_INVALID');
  const branchId = input.branchId ? String(input.branchId) : null;
  if (branchId) await assertScheduleBranch(prisma, context, branchId);
  const endExclusive = new Date(to);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return prisma.foodWorkSchedule.findMany({
    where: {
      organizationId: context.organizationId,
      active: true,
      workDate: { gte: from, lt: endExclusive },
      ...(branchId ? { branchId } : context.branchIds === null ? {} : { branchId: { in: context.branchIds } }),
    },
    include: { branch: { select: { id: true, name: true } }, person: { select: { id: true, name: true, email: true } } },
    orderBy: [{ workDate: 'asc' }, { startTime: 'asc' }],
  });
}

async function archiveFoodWorkSchedule(prisma, context, id) {
  const schedule = await prisma.foodWorkSchedule.findFirst({ where: { id, organizationId: context.organizationId, active: true } });
  if (!schedule) throw domainError('Horário não encontrado.', 404, 'FOOD_SCHEDULE_NOT_FOUND');
  if (!context.canAccessBranch(schedule.branchId)) throw domainError('Não tem acesso a esta unidade.', 403, 'FOOD_BRANCH_FORBIDDEN');
  return prisma.foodWorkSchedule.update({ where: { id: schedule.id }, data: { active: false, updatedByUserId: context.personId } });
}

function shiftHours(shift, from, now) {
  const start = Math.max(new Date(shift.startedAt).getTime(), from.getTime());
  const end = Math.min(shift.endedAt ? new Date(shift.endedAt).getTime() : now.getTime(), now.getTime());
  return Math.max(0, end - start) / 3600000;
}

async function getFoodWorkforceDashboard(prisma, context, input = {}) {
  const parsedDays = Number(input.days || 30);
  const days = Number.isFinite(parsedDays) ? Math.min(90, Math.max(1, Math.trunc(parsedDays))) : 30;
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - days + 1);
  from.setUTCHours(0, 0, 0, 0);
  const now = new Date();
  const branchId = input.branchId ? String(input.branchId) : null;
  if (branchId) await assertScheduleBranch(prisma, context, branchId);
  const branchScope = branchId ? { branchId } : context.branchIds === null ? {} : { branchId: { in: context.branchIds } };
  const [assignments, shifts, sessions, orderGroups, schedules] = await Promise.all([
    prisma.foodStaffRoleAssignment.findMany({ where: { organizationId: context.organizationId, active: true, ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : context.branchIds === null ? {} : { OR: [{ branchId: null }, { branchId: { in: context.branchIds } }] }) }, select: { personId: true, role: true } }),
    prisma.foodShift.findMany({
      where: { organizationId: context.organizationId, ...branchScope, OR: [{ status: 'open' }, { endedAt: { gte: from } }] },
      include: { branch: { select: { id: true, name: true } }, person: { select: { id: true, name: true, email: true } } },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.foodCashSession.findMany({
      where: { organizationId: context.organizationId, ...branchScope, openedAt: { gte: from } },
      include: { branch: { select: { id: true, name: true } }, shift: true },
      orderBy: { openedAt: 'desc' },
      take: 200,
    }),
    prisma.foodOrder.groupBy({
      by: ['createdByUserId'],
      where: { userId: context.organizationId, ...branchScope, createdAt: { gte: from }, createdByUserId: { not: null }, orderState: { not: 'cancelled' } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    listFoodWorkSchedules(prisma, context, { branchId, from: now.toISOString().slice(0, 10) }),
  ]);
  const personIds = [...new Set([
    ...assignments.map((item) => item.personId),
    ...shifts.map((item) => item.personId),
    ...sessions.map((item) => item.openedByUserId),
    ...orderGroups.map((item) => item.createdByUserId).filter(Boolean),
  ])];
  if (!personIds.includes(context.organizationId) && context.organizationId === context.personId) personIds.push(context.organizationId);
  const people = await prisma.user.findMany({ where: { id: { in: personIds } }, select: { id: true, name: true, email: true, active: true } });
  const rolesByPerson = new Map();
  for (const assignment of assignments) rolesByPerson.set(assignment.personId, [...new Set([...(rolesByPerson.get(assignment.personId) || []), assignment.role])]);
  const performance = people.map((person) => {
    const personShifts = shifts.filter((item) => item.personId === person.id);
    const personSessions = sessions.filter((item) => item.openedByUserId === person.id);
    const orders = orderGroups.find((item) => item.createdByUserId === person.id);
    return {
      person,
      roles: person.id === context.organizationId ? ['manager'] : rolesByPerson.get(person.id) || [],
      shiftOpen: personShifts.find((item) => item.status === 'open') || null,
      hours: personShifts.reduce((sum, item) => sum + shiftHours(item, from, now), 0),
      orders: orders?._count._all || 0,
      orderValue: Number(orders?._sum.total || 0),
      cashSales: personSessions.reduce((sum, item) => sum + Number(item.totalSalesAmount || 0), 0),
      cashDifference: personSessions.reduce((sum, item) => sum + Math.abs(Number(item.differenceAmount || 0)), 0),
      pendingApprovals: personSessions.filter((item) => item.approvalStatus === 'pending').length,
    };
  }).sort((a, b) => Number(Boolean(b.shiftOpen)) - Number(Boolean(a.shiftOpen)) || b.orders - a.orders || a.person.name.localeCompare(b.person.name));
  return {
    from,
    days,
    summary: {
      peopleWorking: shifts.filter((item) => item.status === 'open').length,
      openCashSessions: sessions.filter((item) => item.status === 'open').length,
      pendingApprovals: sessions.filter((item) => item.approvalStatus === 'pending').length,
      hours: performance.reduce((sum, item) => sum + item.hours, 0),
      orders: performance.reduce((sum, item) => sum + item.orders, 0),
    },
    activeShifts: shifts.filter((item) => item.status === 'open'),
    performance,
    cashSessions: sessions,
    schedules,
  };
}

async function reviewFoodCashDifference(prisma, context, sessionId, input = {}) {
  const decision = String(input.decision || '');
  if (!['approved', 'rejected'].includes(decision)) throw domainError('Decisão de aprovação inválida.', 400, 'FOOD_CASH_APPROVAL_INVALID');
  const note = String(input.note || '').trim().slice(0, 500);
  if (decision === 'rejected' && note.length < 3) throw domainError('Informe o motivo da rejeição.', 400, 'FOOD_CASH_APPROVAL_NOTE_REQUIRED');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "food_cash_sessions" WHERE "id" = ${sessionId} FOR UPDATE`;
    const session = await tx.foodCashSession.findFirst({ where: { id: sessionId, organizationId: context.organizationId, status: 'closed' } });
    if (!session) throw domainError('Sessão de Caixa fechada não encontrada.', 404, 'FOOD_CASH_SESSION_NOT_FOUND');
    if (!context.canAccessBranch(session.branchId)) throw domainError('Não tem acesso a esta unidade.', 403, 'FOOD_BRANCH_FORBIDDEN');
    if (session.approvalStatus !== 'pending') throw domainError('Esta diferença já foi analisada ou não exige aprovação.', 409, 'FOOD_CASH_APPROVAL_ALREADY_REVIEWED');
    return tx.foodCashSession.update({
      where: { id: session.id },
      data: { approvalStatus: decision, approvedByUserId: context.personId, approvedAt: new Date(), approvalNote: note || null },
      include: { branch: { select: { id: true, name: true } }, shift: true },
    });
  });
}

module.exports = {
  parseDateOnly,
  parseTime,
  saveFoodWorkSchedule,
  listFoodWorkSchedules,
  archiveFoodWorkSchedule,
  getFoodWorkforceDashboard,
  reviewFoodCashDifference,
};
