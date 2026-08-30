'use strict';

const { domainError } = require('../lib/food-domain');
const { normalizePhoneToE164 } = require('../lib/phone-normalization');
const { ACTIVE_DELIVERY_STATES, COURIER_BASE_STATUSES, deriveCourierOperationalStatus } = require('../lib/food-courier');

const TRANSPORT_TYPES = new Set(['motorcycle', 'bicycle', 'car', 'on_foot', 'other']);

function nullableText(value, max) {
  if (value === undefined) return undefined;
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

function locationValue(value, min, max, label) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw domainError(`${label} inválida.`);
  return number;
}

async function assertCourierRole(prisma, context, personId = context.personId) {
  const assignment = await prisma.foodStaffRoleAssignment.findFirst({
    where: { organizationId: context.organizationId, personId, role: 'courier', active: true },
    select: { id: true },
  });
  if (!assignment) throw domainError('A função de entregador não está activa para este utilizador.', 403, 'FOOD_COURIER_ROLE_REQUIRED');
}

async function courierSnapshot(prisma, context, personId = context.personId) {
  await assertCourierRole(prisma, context, personId);
  const [profile, shift, activeDelivery, deliveredCount] = await Promise.all([
    prisma.foodCourierProfile.findUnique({
      where: { organizationId_personId: { organizationId: context.organizationId, personId } },
      include: { statusEvents: { orderBy: { createdAt: 'desc' }, take: 10 } },
    }),
    prisma.foodShift.findFirst({
      where: { organizationId: context.organizationId, personId, status: 'open' },
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.foodDelivery.findFirst({
      where: { userId: context.organizationId, courierUserId: personId, state: { in: ACTIVE_DELIVERY_STATES } },
      select: { id: true, state: true, branchId: true, orderId: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.foodDelivery.count({ where: { userId: context.organizationId, courierUserId: personId, state: 'delivered' } }),
  ]);
  return {
    profile,
    shift,
    activeDelivery,
    operationalStatus: deriveCourierOperationalStatus({ profile, shift, activeDelivery }),
    metrics: { deliveredCount },
  };
}

async function saveOwnCourierProfile(prisma, context, input = {}) {
  await assertCourierRole(prisma, context);
  const data = {
    phone: input.phone === undefined ? undefined : (input.phone ? normalizePhoneToE164(input.phone) : null),
    address: nullableText(input.address, 240),
    vehiclePlate: nullableText(input.vehiclePlate, 40),
    updatedByUserId: context.personId,
  };
  if (input.transportType !== undefined) {
    const transportType = String(input.transportType || '').trim();
    if (transportType && !TRANSPORT_TYPES.has(transportType)) throw domainError('Tipo de transporte inválido.');
    data.transportType = transportType || null;
  }
  await prisma.foodCourierProfile.upsert({
    where: { organizationId_personId: { organizationId: context.organizationId, personId: context.personId } },
    create: { organizationId: context.organizationId, personId: context.personId, createdByUserId: context.personId, ...data },
    update: data,
  });
  return courierSnapshot(prisma, context);
}

async function setOwnCourierStatus(prisma, context, input = {}) {
  await assertCourierRole(prisma, context);
  const nextStatus = String(input.status || '').trim();
  if (!COURIER_BASE_STATUSES.includes(nextStatus)) throw domainError('Estado do entregador inválido.');
  const latitude = locationValue(input.latitude, -90, 90, 'Latitude');
  const longitude = locationValue(input.longitude, -180, 180, 'Longitude');
  if ((latitude === undefined) !== (longitude === undefined)) throw domainError('Latitude e longitude devem ser enviadas em conjunto.');

  await prisma.$transaction(async (tx) => {
    const shift = await tx.foodShift.findFirst({
      where: { organizationId: context.organizationId, personId: context.personId, status: 'open' },
      select: { id: true, branchId: true },
    });
    if (nextStatus !== 'unavailable' && !shift) throw domainError('Inicie o turno antes de ficar disponível.', 409, 'FOOD_COURIER_SHIFT_REQUIRED');
    if (shift && !context.canAccessBranch(shift.branchId)) throw domainError('Não tem acesso à unidade do turno.', 403);
    if (nextStatus === 'unavailable') {
      const activeDelivery = await tx.foodDelivery.findFirst({
        where: { userId: context.organizationId, courierUserId: context.personId, state: { in: ACTIVE_DELIVERY_STATES } },
        select: { id: true },
      });
      if (activeDelivery) throw domainError('Conclua ou reporte a entrega activa antes de ficar indisponível.', 409, 'FOOD_COURIER_HAS_ACTIVE_DELIVERY');
    }
    const current = await tx.foodCourierProfile.findUnique({
      where: { organizationId_personId: { organizationId: context.organizationId, personId: context.personId } },
    });
    const profile = await tx.foodCourierProfile.upsert({
      where: { organizationId_personId: { organizationId: context.organizationId, personId: context.personId } },
      create: {
        organizationId: context.organizationId,
        personId: context.personId,
        baseStatus: nextStatus,
        lastLatitude: latitude,
        lastLongitude: longitude,
        lastLocationAt: latitude === undefined ? null : new Date(),
        createdByUserId: context.personId,
        updatedByUserId: context.personId,
      },
      update: {
        baseStatus: nextStatus,
        lastLatitude: latitude,
        lastLongitude: longitude,
        lastLocationAt: latitude === undefined ? undefined : new Date(),
        updatedByUserId: context.personId,
      },
    });
    if (current?.baseStatus !== nextStatus || latitude !== undefined) {
      await tx.foodCourierStatusEvent.create({
        data: {
          organizationId: context.organizationId,
          profileId: profile.id,
          personId: context.personId,
          branchId: shift?.branchId || null,
          previousStatus: current?.baseStatus || 'off_shift',
          newStatus: nextStatus,
          reason: nullableText(input.reason, 240),
          latitude,
          longitude,
          actorUserId: context.personId,
        },
      });
    }
  });
  return courierSnapshot(prisma, context);
}

module.exports = {
  TRANSPORT_TYPES,
  assertCourierRole,
  courierSnapshot,
  saveOwnCourierProfile,
  setOwnCourierStatus,
};
