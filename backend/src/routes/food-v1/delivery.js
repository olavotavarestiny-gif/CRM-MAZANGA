const crypto = require('crypto');
const { Readable } = require('stream');
const bcrypt = require('bcryptjs');
const express = require('express');
const prisma = require('../../lib/prisma');
const { requireAnyFoodPermission, requireFoodPermission } = require('../../lib/food-access');
const { deriveDisplayStatus, domainError } = require('../../lib/food-domain');
const {
  executeDeliveryTransition,
  idempotencyKeyFromRequest,
} = require('../../services/food-order.service');
const { handleFoodV1Error } = require('./errors');
const { recordFoodAudit } = require('../../lib/food-audit');
const { courierSnapshot, saveOwnCourierProfile, setOwnCourierStatus } = require('../../services/food-courier.service');
const { buildDeliveryContactAction, serializeDeliveryForViewer } = require('../../lib/food-delivery-privacy');
const {
  confirmDeliveryCollection,
  handoffDeliveryCollection,
  reconcileDeliveryCollection,
} = require('../../services/food-delivery-collection.service');

const router = express.Router();

function deliveryScope(req) {
  const where = { userId: req.foodContext.organizationId };
  if (req.foodContext.branchIds !== null) where.branchId = { in: req.foodContext.branchIds };
  if (req.foodContext.roles.includes('courier') && !req.foodContext.can('delivery.view')) {
    where.courierUserId = req.foodContext.personId;
  }
  return where;
}

router.get('/', requireAnyFoodPermission('delivery.view', 'delivery.view_own'), async (req, res) => {
  try {
    const state = req.query.state ? String(req.query.state) : null;
    const deliveries = await prisma.foodDelivery.findMany({
      where: { ...deliveryScope(req), ...(state && { state }) },
      include: {
        branch: { select: { id: true, name: true } },
        order: {
          include: {
            items: { include: { modifiers: true }, orderBy: { sortOrder: 'asc' } },
            contact: { select: { id: true, name: true, phone: true } },
          },
        },
        proofMedia: { select: { id: true, kind: true, mimeType: true, createdAt: true } },
        collection: { include: { payment: true, events: { orderBy: { createdAt: 'asc' } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    res.json(deliveries.map((delivery) => {
      const display = deriveDisplayStatus(delivery.order);
      return serializeDeliveryForViewer({
        ...delivery,
        order: {
          ...delivery.order,
          displayNumber: `#${String(delivery.order.orderNumber).padStart(4, '0')}`,
          status: display.status,
          statusLabel: display.label,
        },
      }, req.foodContext);
    }));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar as entregas.');
  }
});

router.post('/:id/contact/:channel', requireFoodPermission('delivery.view_own'), async (req, res) => {
  try {
    const delivery = await prisma.foodDelivery.findFirst({
      where: { id: req.params.id, ...deliveryScope(req) },
      include: { order: { include: { contact: { select: { phone: true } } } } },
    });
    if (!delivery) throw domainError('Entrega não encontrada.', 404);
    const settings = await prisma.foodSettings.findUnique({ where: { userId: req.foodContext.organizationId }, select: { restaurantName: true } });
    const action = buildDeliveryContactAction(delivery, settings, String(req.params.channel || ''));
    await recordFoodAudit(prisma, req, { branchId: delivery.branchId, action: `delivery.contact.${action.channel}`, entityType: 'food_delivery', entityId: delivery.id, payload: { orderId: delivery.orderId, channel: action.channel } });
    res.json(action);
  } catch (error) {
    handleFoodV1Error(res, error, 'Não foi possível contactar o cliente.');
  }
});

router.get('/couriers', requireFoodPermission('delivery.dispatch'), async (req, res) => {
  try {
    const assignments = await prisma.foodStaffRoleAssignment.findMany({
      where: {
        organizationId: req.foodContext.organizationId,
        role: 'courier',
        active: true,
        ...(req.query.branchId ? { OR: [{ branchId: String(req.query.branchId) }, { branchId: null }] } : {}),
      },
      include: { person: { select: { id: true, name: true, email: true, active: true } }, branch: { select: { id: true, name: true } } },
      orderBy: { person: { name: 'asc' } },
    });
    const snapshots = new Map();
    await Promise.all([...new Set(assignments.map((assignment) => assignment.personId))].map(async (personId) => {
      snapshots.set(personId, await courierSnapshot(prisma, req.foodContext, personId));
    }));
    res.json(assignments.map((assignment) => {
      const snapshot = snapshots.get(assignment.personId);
      const legacyEligible = !snapshot.profile;
      return {
        ...assignment,
        courierProfile: snapshot.profile,
        currentShift: snapshot.shift,
        activeDelivery: snapshot.activeDelivery,
        operationalStatus: legacyEligible ? 'available' : snapshot.operationalStatus,
        assignmentEligible: legacyEligible || snapshot.operationalStatus === 'available',
        legacyProfile: legacyEligible,
        metrics: snapshot.metrics,
      };
    }));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar os entregadores.');
  }
});

router.get('/couriers/me', requireFoodPermission('delivery.view_own'), async (req, res) => {
  try {
    res.json(await courierSnapshot(prisma, req.foodContext));
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar o perfil do entregador.');
  }
});

router.patch('/couriers/me', requireFoodPermission('delivery.update_own'), async (req, res) => {
  try {
    const snapshot = await saveOwnCourierProfile(prisma, req.foodContext, req.body || {});
    await recordFoodAudit(prisma, req, { action: 'delivery.courier_profile.updated', entityType: 'food_courier_profile', entityId: snapshot.profile.id, payload: { transportType: snapshot.profile.transportType, vehiclePlate: snapshot.profile.vehiclePlate } });
    res.json(snapshot);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao guardar o perfil do entregador.');
  }
});

router.post('/couriers/me/status', requireFoodPermission('delivery.update_own'), async (req, res) => {
  try {
    const snapshot = await setOwnCourierStatus(prisma, req.foodContext, req.body || {});
    await recordFoodAudit(prisma, req, { branchId: snapshot.shift?.branchId, action: `delivery.courier_status.${snapshot.profile.baseStatus}`, entityType: 'food_courier_profile', entityId: snapshot.profile.id, reason: req.body?.reason, payload: { operationalStatus: snapshot.operationalStatus } });
    res.json(snapshot);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atualizar a disponibilidade do entregador.');
  }
});

router.post('/:id/collection/confirm', requireFoodPermission('delivery.update_own'), async (req, res) => {
  try {
    const collection = await confirmDeliveryCollection(prisma, req.foodContext, req.params.id, req.body || {}, { idempotencyKey: idempotencyKeyFromRequest(req) });
    await recordFoodAudit(prisma, req, { branchId: collection.branchId, action: `delivery.collection.${collection.state}`, entityType: 'food_delivery_collection', entityId: collection.id, reason: req.body?.reason, payload: { deliveryId: req.params.id, method: collection.actualMethod, amount: collection.actualAmount } });
    res.json(collection);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao confirmar a cobrança da entrega.');
  }
});

router.post('/:id/collection/handoff', requireFoodPermission('delivery.update_own'), async (req, res) => {
  try {
    const collection = await handoffDeliveryCollection(prisma, req.foodContext, req.params.id, { idempotencyKey: idempotencyKeyFromRequest(req) });
    await recordFoodAudit(prisma, req, { branchId: collection.branchId, action: 'delivery.collection.handed_to_cashier', entityType: 'food_delivery_collection', entityId: collection.id, payload: { deliveryId: req.params.id, amount: collection.actualAmount } });
    res.json(collection);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao entregar o valor ao caixa.');
  }
});

router.post('/collections/:id/reconcile', requireFoodPermission('delivery.manage'), async (req, res) => {
  try {
    const collection = await reconcileDeliveryCollection(prisma, req.foodContext, req.params.id, req.body || {}, { idempotencyKey: idempotencyKeyFromRequest(req) });
    await recordFoodAudit(prisma, req, { branchId: collection.branchId, action: `delivery.collection.${collection.state}`, entityType: 'food_delivery_collection', entityId: collection.id, reason: req.body?.reason, payload: { countedAmount: req.body?.countedAmount, discrepancyAmount: collection.discrepancyAmount } });
    res.json(collection);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao reconciliar a cobrança da entrega.');
  }
});

router.post('/:id/transitions/:state', requireAnyFoodPermission('delivery.dispatch', 'delivery.manage', 'delivery.update_own'), async (req, res) => {
  try {
    const nextState = String(req.params.state || '');
    if (nextState === 'assigned' && !req.foodContext.can('delivery.dispatch')) {
      throw domainError('Apenas o gestor de delivery pode atribuir entregadores.', 403);
    }
    if (nextState === 'assigned') {
      const courierUserId = Number(req.body?.courierUserId);
      const delivery = await prisma.foodDelivery.findFirst({
        where: { id: req.params.id, ...deliveryScope(req) },
        select: { branchId: true },
      });
      if (!delivery) throw domainError('Entrega não encontrada.', 404);
      const assignment = await prisma.foodStaffRoleAssignment.findFirst({
        where: {
          organizationId: req.foodContext.organizationId,
          personId: courierUserId,
          role: 'courier',
          active: true,
          OR: [{ branchId: null }, { branchId: delivery.branchId }],
          person: { active: true },
        },
        select: { id: true },
      });
      if (!assignment) throw domainError('O entregador não está activo ou autorizado para esta unidade.');
      const profile = await prisma.foodCourierProfile.findUnique({
        where: { organizationId_personId: { organizationId: req.foodContext.organizationId, personId: courierUserId } },
        select: { id: true },
      });
      if (profile) {
        const snapshot = await courierSnapshot(prisma, req.foodContext, courierUserId);
        const sameActiveDelivery = snapshot.activeDelivery?.id === req.params.id;
        if (!sameActiveDelivery && snapshot.operationalStatus !== 'available') {
          throw domainError('O entregador não está disponível para uma nova atribuição.', 409, 'FOOD_COURIER_NOT_AVAILABLE');
        }
      }
    }
    const order = await executeDeliveryTransition(
      prisma,
      req.foodContext,
      req.params.id,
      nextState,
      req.body || {},
      { idempotencyKey: idempotencyKeyFromRequest(req) }
    );
    await recordFoodAudit(prisma, req, { branchId: order.branchId, action: `delivery.transition.${nextState}`, entityType: 'food_delivery', entityId: req.params.id, reason: req.body?.reason, payload: { orderId: order.id, courierUserId: req.body?.courierUserId || null } });
    res.json(order);
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao atualizar a entrega.');
  }
});

router.post('/:id/regenerate-pin', requireFoodPermission('delivery.dispatch'), async (req, res) => {
  try {
    const delivery = await prisma.foodDelivery.findFirst({
      where: { id: req.params.id, ...deliveryScope(req) },
      include: { order: { select: { paymentState: true } }, collection: { select: { id: true } } },
    });
    if (!delivery) throw domainError('Entrega não encontrada.', 404);
    if (delivery.state !== 'arrived') throw domainError('O PIN só pode ser gerado quando o entregador chegar ao destino.', 409, 'FOOD_DELIVERY_PIN_NOT_ARRIVED');
    if (delivery.collection) throw domainError('Pedidos com cobrança pelo entregador não utilizam PIN.', 409, 'FOOD_DELIVERY_PIN_PAYMENT_REQUIRED');
    if (delivery.order.paymentState !== 'paid') throw domainError('Pedidos com pagamento no local não utilizam PIN.', 409, 'FOOD_DELIVERY_PIN_PAYMENT_REQUIRED');
    const pin = String(crypto.randomInt(100000, 1000000));
    await prisma.foodDelivery.update({
      where: { id: delivery.id },
      data: { pinHash: await bcrypt.hash(pin, 8) },
    });
    await recordFoodAudit(prisma, req, { branchId: delivery.branchId, action: 'delivery.pin_regenerated', entityType: 'food_delivery', entityId: delivery.id, reason: req.body?.reason });
    res.json({ pin });
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao gerar o PIN da entrega.');
  }
});

router.post('/proof-media', requireFoodPermission('delivery.proof'), async (req, res) => {
  try {
    const storageUrl = String(req.body?.storageUrl || '').trim();
    const mimeType = String(req.body?.mimeType || '').trim().toLowerCase();
    let url;
    try { url = new URL(storageUrl); } catch { throw domainError('URL do comprovativo inválido.'); }
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.blob.vercel-storage.com')) {
      throw domainError('O comprovativo deve pertencer ao armazenamento privado configurado.');
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      throw domainError('Formato de comprovativo não permitido.');
    }
    const media = await prisma.foodPrivateMedia.create({
      data: {
        organizationId: req.foodContext.organizationId,
        uploadedByUserId: req.foodContext.personId,
        kind: 'delivery_proof',
        storageUrl,
        mimeType,
        sizeBytes: Number.isFinite(Number(req.body?.sizeBytes)) ? Number(req.body.sizeBytes) : null,
        checksum: String(req.body?.checksum || '').trim() || null,
      },
    });
    await recordFoodAudit(prisma, req, { action: 'delivery.proof_uploaded', entityType: 'food_private_media', entityId: media.id, payload: { kind: media.kind, mimeType: media.mimeType, sizeBytes: media.sizeBytes } });
    res.status(201).json({ id: media.id, kind: media.kind, mimeType: media.mimeType, createdAt: media.createdAt });
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao registar o comprovativo.');
  }
});

router.get('/proof-media/:id', requireAnyFoodPermission('delivery.view', 'delivery.view_own', 'delivery.proof'), async (req, res) => {
  try {
    const media = await prisma.foodPrivateMedia.findFirst({
      where: { id: req.params.id, organizationId: req.foodContext.organizationId, active: true },
    });
    if (!media) throw domainError('Comprovativo não encontrado.', 404);
    const delivery = await prisma.foodDelivery.findFirst({
      where: {
        proofMediaId: media.id,
        ...deliveryScope(req),
      },
      select: { id: true },
    });
    if (!delivery) {
      throw domainError('Não tem acesso a este comprovativo.', 403);
    }
    const upstream = await fetch(media.storageUrl, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN || ''}` },
    });
    if (!upstream.ok || !upstream.body) throw domainError('Ficheiro não encontrado.', upstream.status === 404 ? 404 : 502);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || media.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    if (res.headersSent) return res.end();
    handleFoodV1Error(res, error, 'Erro ao carregar o comprovativo.');
  }
});

module.exports = router;
