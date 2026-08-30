const bcrypt = require('bcryptjs');
const { domainError } = require('../lib/food-domain');

const PIN_FAILURE_LIMIT = 5;
const PIN_LOCK_MINUTES = 15;

function normalizePin(value) {
  const pin = String(value || '').trim();
  if (!/^\d{4,6}$/.test(pin)) {
    throw domainError('O código pessoal deve ter entre 4 e 6 dígitos.', 400, 'FOOD_STAFF_PIN_INVALID_FORMAT');
  }
  return pin;
}

function cleanDeviceId(value) {
  const deviceId = String(value || '').trim();
  return deviceId ? deviceId.slice(0, 120) : null;
}

async function assertFoodPerson(prisma, organizationId, personId) {
  if (organizationId === personId) return;
  const [homeMember, membership] = await Promise.all([
    prisma.user.findFirst({ where: { id: personId, accountOwnerId: organizationId, active: true }, select: { id: true } }),
    prisma.accountMembership.findFirst({ where: { accountOwnerId: organizationId, personId, active: true }, select: { id: true } }),
  ]);
  if (!homeMember && !membership) throw domainError('O utilizador não pertence a esta organização.', 400, 'FOOD_STAFF_PERSON_INVALID');
}

async function setFoodStaffPin(prisma, context, personIdValue, pinValue) {
  const personId = Number(personIdValue);
  if (!Number.isInteger(personId)) throw domainError('Colaborador inválido.', 400, 'FOOD_STAFF_PERSON_INVALID');
  await assertFoodPerson(prisma, context.organizationId, personId);
  const pin = normalizePin(pinValue);
  const pinHash = await bcrypt.hash(pin, 10);
  const credential = await prisma.foodStaffCredential.upsert({
    where: { organizationId_personId: { organizationId: context.organizationId, personId } },
    create: {
      organizationId: context.organizationId,
      personId,
      pinHash,
      createdByUserId: context.personId,
      updatedByUserId: context.personId,
    },
    update: {
      pinHash,
      active: true,
      failedAttempts: 0,
      lockedUntil: null,
      updatedByUserId: context.personId,
    },
    select: { id: true, organizationId: true, personId: true, active: true, createdAt: true, updatedAt: true },
  });
  return credential;
}

async function verifyFoodStaffPin(prisma, context, pinValue, personId = context.personId) {
  const pin = normalizePin(pinValue);
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "food_staff_credentials" WHERE "organizationId" = ${context.organizationId} AND "personId" = ${personId} FOR UPDATE`;
    const credential = await tx.foodStaffCredential.findUnique({
      where: { organizationId_personId: { organizationId: context.organizationId, personId } },
    });
    if (!credential?.active) return { code: 'FOOD_STAFF_PIN_NOT_CONFIGURED' };
    const now = new Date();
    if (credential.lockedUntil && credential.lockedUntil > now) return { code: 'FOOD_STAFF_PIN_LOCKED' };
    const valid = await bcrypt.compare(pin, credential.pinHash);
    if (!valid) {
      const failedAttempts = credential.failedAttempts + 1;
      const lockedUntil = failedAttempts >= PIN_FAILURE_LIMIT
        ? new Date(now.getTime() + PIN_LOCK_MINUTES * 60 * 1000)
        : null;
      await tx.foodStaffCredential.update({
        where: { id: credential.id },
        data: { failedAttempts: lockedUntil ? 0 : failedAttempts, lockedUntil },
      });
      return { code: lockedUntil ? 'FOOD_STAFF_PIN_LOCKED_NEW' : 'FOOD_STAFF_PIN_INCORRECT' };
    }
    await tx.foodStaffCredential.update({
      where: { id: credential.id },
      data: { failedAttempts: 0, lockedUntil: null, lastVerifiedAt: now },
    });
    return { code: 'OK' };
  });
  if (outcome.code === 'OK') return true;
  if (outcome.code === 'FOOD_STAFF_PIN_NOT_CONFIGURED') throw domainError('Configure o código pessoal antes de iniciar o turno.', 409, outcome.code);
  if (outcome.code === 'FOOD_STAFF_PIN_LOCKED') throw domainError('Código temporariamente bloqueado. Tente novamente mais tarde.', 423, outcome.code);
  if (outcome.code === 'FOOD_STAFF_PIN_LOCKED_NEW') throw domainError('Código bloqueado durante 15 minutos após várias tentativas.', 423, 'FOOD_STAFF_PIN_LOCKED');
  throw domainError('Código pessoal incorreto.', 401, 'FOOD_STAFF_PIN_INCORRECT');
}

async function getCurrentFoodWorkforce(prisma, context, branchIdValue) {
  const branchId = branchIdValue ? String(branchIdValue) : null;
  if (branchId && !context.canAccessBranch(branchId)) throw domainError('Não tem acesso a esta unidade.', 403, 'FOOD_BRANCH_FORBIDDEN');
  const [credential, shift] = await Promise.all([
    prisma.foodStaffCredential.findUnique({
      where: { organizationId_personId: { organizationId: context.organizationId, personId: context.personId } },
      select: { active: true, lockedUntil: true },
    }),
    prisma.foodShift.findFirst({
      where: { organizationId: context.organizationId, personId: context.personId, status: 'open' },
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
    }),
  ]);
  return {
    credentialConfigured: Boolean(credential?.active),
    credentialLockedUntil: credential?.lockedUntil && credential.lockedUntil > new Date() ? credential.lockedUntil : null,
    shift,
  };
}

async function startFoodShift(prisma, context, input = {}) {
  const branchId = String(input.branchId || '');
  if (!branchId || !context.canAccessBranch(branchId)) throw domainError('Unidade Food inválida.', 403, 'FOOD_BRANCH_FORBIDDEN');
  await verifyFoodStaffPin(prisma, context, input.pin);
  return prisma.$transaction(async (tx) => {
    const branch = await tx.foodBranch.findFirst({ where: { id: branchId, userId: context.organizationId, active: true }, select: { id: true, name: true } });
    if (!branch) throw domainError('Unidade Food não encontrada.', 404, 'FOOD_BRANCH_NOT_FOUND');
    const lockKey = `food-shift:${context.organizationId}:${context.personId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const existing = await tx.foodShift.findFirst({
      where: { organizationId: context.organizationId, personId: context.personId, status: 'open' },
      include: { branch: { select: { id: true, name: true } } },
    });
    if (existing) {
      if (existing.branchId !== branchId) throw domainError('Já existe um turno aberto noutra unidade.', 409, 'FOOD_SHIFT_ALREADY_OPEN');
      return { shift: existing, created: false };
    }
    const shift = await tx.foodShift.create({
      data: {
        organizationId: context.organizationId,
        branchId,
        personId: context.personId,
        startDeviceId: cleanDeviceId(input.deviceId),
        createdByUserId: context.personId,
      },
      include: { branch: { select: { id: true, name: true } } },
    });
    return { shift, created: true };
  });
}

async function endFoodShift(prisma, context, shiftId, input = {}) {
  await verifyFoodStaffPin(prisma, context, input.pin);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "food_shifts" WHERE "id" = ${shiftId} FOR UPDATE`;
    const shift = await tx.foodShift.findFirst({
      where: { id: shiftId, organizationId: context.organizationId, personId: context.personId, status: 'open' },
    });
    if (!shift) throw domainError('Turno aberto não encontrado.', 404, 'FOOD_SHIFT_NOT_FOUND');
    if (!context.canAccessBranch(shift.branchId)) throw domainError('Não tem acesso a esta unidade.', 403, 'FOOD_BRANCH_FORBIDDEN');
    const openCashSession = await tx.foodCashSession.findFirst({ where: { shiftId: shift.id, status: 'open' }, select: { id: true } });
    if (openCashSession) throw domainError('Feche a sessão de Caixa antes de terminar o turno.', 409, 'FOOD_SHIFT_HAS_OPEN_CASH_SESSION');
    return tx.foodShift.update({
      where: { id: shift.id },
      data: {
        status: 'closed',
        endedAt: new Date(),
        endDeviceId: cleanDeviceId(input.deviceId),
        notes: String(input.notes || '').trim().slice(0, 500) || null,
      },
      include: { branch: { select: { id: true, name: true } } },
    });
  });
}

async function requireOpenFoodShift(prisma, context, branchId) {
  const shift = await prisma.foodShift.findFirst({
    where: { organizationId: context.organizationId, branchId, personId: context.personId, status: 'open' },
  });
  if (!shift) throw domainError('Inicie o turno nesta unidade antes de abrir o Caixa.', 409, 'FOOD_SHIFT_REQUIRED');
  return shift;
}

module.exports = {
  PIN_FAILURE_LIMIT,
  assertFoodPerson,
  normalizePin,
  setFoodStaffPin,
  verifyFoodStaffPin,
  getCurrentFoodWorkforce,
  startFoodShift,
  endFoodShift,
  requireOpenFoodShift,
};
