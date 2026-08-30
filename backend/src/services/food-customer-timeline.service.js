const { domainError } = require('../lib/food-domain');
const { ORDER_STATUS_LABELS } = require('../lib/food-orders');
const { getFoodCustomer } = require('./food-customer.service');

const OCCURRENCE_TYPES = ['complaint', 'compliment', 'preference', 'incident', 'follow_up', 'other'];
const OCCURRENCE_SEVERITIES = ['low', 'medium', 'high'];

function text(value, max = 500) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, max) : null;
}

async function listFoodCustomerTimeline(prisma, organizationId, contactId, input = {}) {
  const customer = await getFoodCustomer(prisma, organizationId, contactId);
  const limit = Math.min(200, Math.max(10, Number(input.limit || 100)));
  const filter = ['all', 'order', 'coupon', 'occurrence', 'audit'].includes(String(input.type)) ? String(input.type) : 'all';
  const include = (type) => filter === 'all' || filter === type;
  const events = [];

  if (include('order')) {
    const orders = await prisma.foodOrder.findMany({
      where: { userId: organizationId, contactId: customer.id },
      select: { id: true, orderNumber: true, status: true, orderType: true, total: true, createdAt: true, branch: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    events.push(...orders.map((order) => ({
      id: `order:${order.id}`,
      type: 'order',
      occurredAt: order.createdAt,
      title: `Pedido #${String(order.orderNumber).padStart(4, '0')}`,
      description: ORDER_STATUS_LABELS[order.status] || order.status,
      status: order.status,
      branch: order.branch,
      metadata: { orderId: order.id, orderNumber: order.orderNumber, orderType: order.orderType, total: order.total },
    })));
  }

  if (include('coupon')) {
    const redemptions = await prisma.foodCouponRedemption.findMany({
      where: { organizationId, contactId: customer.id },
      include: { coupon: { include: { campaigns: { where: { organizationId }, select: { id: true, name: true, status: true } } } } },
      orderBy: { redeemedAt: 'desc' },
      take: limit,
    });
    events.push(...redemptions.map((redemption) => ({
      id: `coupon:${redemption.id}`,
      type: 'coupon',
      occurredAt: redemption.redeemedAt,
      title: `Cupão ${redemption.coupon.code}`,
      description: redemption.coupon.campaigns.length ? `Campanha: ${redemption.coupon.campaigns.map((campaign) => campaign.name).join(', ')}` : redemption.coupon.name,
      status: 'redeemed',
      metadata: { couponId: redemption.couponId, orderId: redemption.orderId, discountAmount: redemption.discountAmount, campaigns: redemption.coupon.campaigns },
    })));
  }

  if (include('occurrence')) {
    const occurrences = await prisma.foodCustomerOccurrence.findMany({
      where: { organizationId, contactId: customer.id },
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
    events.push(...occurrences.map((occurrence) => ({
      id: `occurrence:${occurrence.id}`,
      entityId: occurrence.id,
      type: 'occurrence',
      occurredAt: occurrence.occurredAt,
      title: occurrence.title,
      description: occurrence.description,
      status: occurrence.status,
      severity: occurrence.severity,
      occurrenceType: occurrence.type,
      resolutionNote: occurrence.resolutionNote,
      resolvedAt: occurrence.resolvedAt,
      branch: occurrence.branch,
      metadata: occurrence.payload,
    })));
  }

  if (include('audit')) {
    const audits = await prisma.foodAuditEvent.findMany({
      where: { organizationId, entityType: 'contact', entityId: String(customer.id) },
      select: { id: true, action: true, reason: true, actorRole: true, occurredAt: true, payload: true, branch: { select: { id: true, name: true } } },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
    events.push(...audits.map((audit) => ({
      id: `audit:${audit.id}`,
      type: 'audit',
      occurredAt: audit.occurredAt,
      title: audit.action,
      description: audit.reason,
      status: 'recorded',
      branch: audit.branch,
      metadata: {
        actorRole: audit.actorRole,
        ...(audit.payload && typeof audit.payload === 'object' && !Array.isArray(audit.payload) ? audit.payload : {}),
      },
    })));
  }

  return events.sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt)).slice(0, limit);
}

async function createFoodCustomerOccurrence(prisma, context, contactId, input = {}) {
  const customer = await getFoodCustomer(prisma, context.organizationId, contactId);
  const type = OCCURRENCE_TYPES.includes(input.type) ? input.type : 'other';
  const severity = OCCURRENCE_SEVERITIES.includes(input.severity) ? input.severity : 'medium';
  const title = text(input.title, 180);
  if (!title) throw domainError('Título da ocorrência é obrigatório.');
  const branchId = text(input.branchId, 80);
  if (branchId) {
    const branch = await prisma.foodBranch.findFirst({ where: { id: branchId, userId: context.organizationId, active: true }, select: { id: true } });
    if (!branch || !context.canAccessBranch(branch.id)) throw domainError('Unidade da ocorrência inválida.', 400, 'FOOD_BRANCH_INVALID');
  }
  let occurredAt = new Date();
  if (input.occurredAt) {
    occurredAt = new Date(input.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) throw domainError('Data da ocorrência inválida.');
  }
  return prisma.foodCustomerOccurrence.create({
    data: {
      organizationId: context.organizationId,
      contactId: customer.id,
      branchId,
      type,
      severity,
      title,
      description: text(input.description, 2000),
      payload: input.payload && typeof input.payload === 'object' ? input.payload : {},
      occurredAt,
      createdByUserId: context.personId,
    },
    include: { branch: { select: { id: true, name: true } } },
  });
}

async function resolveFoodCustomerOccurrence(prisma, context, contactId, occurrenceId, noteValue) {
  const customer = await getFoodCustomer(prisma, context.organizationId, contactId);
  const occurrence = await prisma.foodCustomerOccurrence.findFirst({
    where: { id: occurrenceId, organizationId: context.organizationId, contactId: customer.id },
  });
  if (!occurrence) throw domainError('Ocorrência não encontrada.', 404, 'FOOD_CUSTOMER_OCCURRENCE_NOT_FOUND');
  if (occurrence.status === 'resolved') throw domainError('A ocorrência já está resolvida.', 409, 'FOOD_CUSTOMER_OCCURRENCE_RESOLVED');
  const resolutionNote = text(noteValue, 1000);
  if (!resolutionNote || resolutionNote.length < 3) throw domainError('Indique como a ocorrência foi resolvida.');
  return prisma.foodCustomerOccurrence.update({
    where: { id: occurrence.id },
    data: { status: 'resolved', resolutionNote, resolvedAt: new Date(), resolvedByUserId: context.personId },
    include: { branch: { select: { id: true, name: true } } },
  });
}

module.exports = {
  OCCURRENCE_TYPES,
  OCCURRENCE_SEVERITIES,
  listFoodCustomerTimeline,
  createFoodCustomerOccurrence,
  resolveFoodCustomerOccurrence,
};
