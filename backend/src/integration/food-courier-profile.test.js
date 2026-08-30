'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('perfil e disponibilidade do entregador respeitam turno, tenant e entrega activa', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  const { courierSnapshot, saveOwnCourierProfile, setOwnCourierStatus } = require('../services/food-courier.service');
  const { executeDeliveryTransition } = require('../services/food-order.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  let owner;
  let other;
  try {
    owner = await prisma.user.create({ data: { name: 'Courier A', email: `courier-a-${suffix}@example.test`, workspaceMode: 'food' } });
    other = await prisma.user.create({ data: { name: 'Courier B', email: `courier-b-${suffix}@example.test`, workspaceMode: 'food' } });
    const branch = await prisma.foodBranch.create({ data: { userId: owner.id, name: `Courier Branch ${suffix}`, isMain: true } });
    await prisma.foodStaffRoleAssignment.create({ data: { organizationId: owner.id, personId: owner.id, branchId: branch.id, role: 'courier', isPrimary: true } });
    const context = {
      organizationId: owner.id,
      personId: owner.id,
      roles: ['courier'],
      primaryRole: 'courier',
      canAccessBranch: (id) => id === branch.id,
    };

    assert.equal((await courierSnapshot(prisma, context)).operationalStatus, 'off_shift');
    const saved = await saveOwnCourierProfile(prisma, context, { phone: '923000111', transportType: 'motorcycle', vehiclePlate: 'LD-12-34-AA' });
    assert.equal(saved.profile.phone, '+244923000111');
    await assert.rejects(
      setOwnCourierStatus(prisma, context, { status: 'available' }),
      (error) => error.statusCode === 409 && error.code === 'FOOD_COURIER_SHIFT_REQUIRED'
    );

    await prisma.foodShift.create({ data: { organizationId: owner.id, branchId: branch.id, personId: owner.id } });
    const available = await setOwnCourierStatus(prisma, context, { status: 'available', latitude: -8.83, longitude: 13.23 });
    assert.equal(available.operationalStatus, 'available');
    assert.equal(available.profile.lastLatitude, -8.83);
    assert.equal(await prisma.foodCourierStatusEvent.count({ where: { organizationId: owner.id, personId: owner.id } }), 1);

    const order = await prisma.foodOrder.create({
      data: {
        userId: owner.id,
        branchId: branch.id,
        orderNumber: 1,
        status: 'awaiting_handoff',
        orderState: 'active',
        kitchenState: 'ready',
        deliveryState: 'assigned',
        paymentState: 'unpaid',
        orderType: 'delivery',
        subtotal: 1000,
        total: 1000,
        delivery: { create: { userId: owner.id, branchId: branch.id, state: 'assigned', courierUserId: owner.id } },
      },
    });
    assert.equal((await courierSnapshot(prisma, context)).operationalStatus, 'assigned');
    await assert.rejects(
      setOwnCourierStatus(prisma, context, { status: 'unavailable' }),
      (error) => error.statusCode === 409 && error.code === 'FOOD_COURIER_HAS_ACTIVE_DELIVERY'
    );
    await prisma.foodDelivery.update({ where: { orderId: order.id }, data: { state: 'arrived', arrivedAt: new Date() } });
    await prisma.foodOrder.update({ where: { id: order.id }, data: { deliveryState: 'arrived' } });
    const delivery = await prisma.foodDelivery.findUnique({ where: { orderId: order.id } });
    await assert.rejects(
      executeDeliveryTransition(prisma, context, delivery.id, 'delivered', { pin: '123456' }, { idempotencyKey: `local-pin-${suffix}` }),
      (error) => error.statusCode === 409 && error.code === 'FOOD_DELIVERY_PIN_PAYMENT_REQUIRED'
    );
    await assert.rejects(
      executeDeliveryTransition(prisma, context, delivery.id, 'delivered', {}, { idempotencyKey: `local-empty-${suffix}` }),
      (error) => error.code === 'FOOD_DELIVERY_LOCAL_PAYMENT_PROOF_REQUIRED'
    );
    const media = await prisma.foodPrivateMedia.create({ data: { organizationId: owner.id, uploadedByUserId: owner.id, kind: 'delivery_proof', storageUrl: 'https://test.blob.vercel-storage.com/proof.jpg', mimeType: 'image/jpeg' } });
    await executeDeliveryTransition(prisma, context, delivery.id, 'delivered', { proofMediaId: media.id }, { idempotencyKey: `local-photo-${suffix}` });

    const paidOrder = await prisma.foodOrder.create({
      data: {
        userId: owner.id, branchId: branch.id, orderNumber: 2, status: 'out_for_delivery', orderState: 'active', kitchenState: 'ready', deliveryState: 'arrived', paymentState: 'paid', orderType: 'delivery', subtotal: 1200, total: 1200,
        delivery: { create: { userId: owner.id, branchId: branch.id, state: 'arrived', courierUserId: owner.id, pinHash: await bcrypt.hash('654321', 8), arrivedAt: new Date() } },
      },
    });
    const paidDelivery = await prisma.foodDelivery.findUnique({ where: { orderId: paidOrder.id } });
    await executeDeliveryTransition(prisma, context, paidDelivery.id, 'delivered', { pin: '654321' }, { idempotencyKey: `paid-pin-${suffix}` });
    assert.equal((await prisma.foodDelivery.findUnique({ where: { id: paidDelivery.id } })).proofType, 'pin');
    assert.equal((await setOwnCourierStatus(prisma, context, { status: 'unavailable' })).operationalStatus, 'unavailable');

    await assert.rejects(
      courierSnapshot(prisma, { ...context, organizationId: other.id, personId: other.id, canAccessBranch: () => true }),
      (error) => error.statusCode === 403 && error.code === 'FOOD_COURIER_ROLE_REQUIRED'
    );
  } finally {
    if (owner) {
      await prisma.foodCourierStatusEvent.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodCourierProfile.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodOrder.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.foodPrivateMedia.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodShift.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodStaffRoleAssignment.deleteMany({ where: { organizationId: owner.id } }).catch(() => {});
      await prisma.foodBranch.deleteMany({ where: { userId: owner.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: owner.id } }).catch(() => {});
    }
    if (other) await prisma.user.deleteMany({ where: { id: other.id } }).catch(() => {});
    await prisma.$disconnect();
  }
});
