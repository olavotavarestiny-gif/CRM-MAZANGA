const express = require('express');
const prisma = require('../../lib/prisma');
const { requireAnyFoodPermission, requireFoodPermission } = require('../../lib/food-access');
const { serializeFoodSettings } = require('../../lib/food-foundation');
const {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
} = require('../../lib/food-orders');
const { handleFoodV1Error } = require('./errors');

const router = express.Router();

function branchFilter(access, field = 'branchId') {
  return access.branchIds === null ? {} : { [field]: { in: access.branchIds } };
}

router.get('/overview', requireFoodPermission('overview.view'), async (req, res) => {
  try {
    const access = req.foodContext;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const productBranchFilter = access.branchIds === null
      ? {}
      : { OR: [{ branchId: null }, { branchId: { in: access.branchIds } }] };
    const [settings, branches, categories, products, modifiers, activeOrders, todaysOrders] = await Promise.all([
      prisma.foodSettings.findUnique({ where: { userId: access.organizationId } }),
      prisma.foodBranch.count({
        where: {
          userId: access.organizationId,
          active: true,
          ...(access.branchIds === null ? {} : { id: { in: access.branchIds } }),
        },
      }),
      prisma.foodCategory.count({ where: { userId: access.organizationId, active: true } }),
      prisma.foodProduct.count({ where: { userId: access.organizationId, active: true, ...productBranchFilter } }),
      prisma.foodModifierGroup.count({ where: { userId: access.organizationId, active: true } }),
      prisma.foodOrder.count({
        where: { userId: access.organizationId, status: { notIn: ['completed', 'cancelled'] }, ...branchFilter(access) },
      }),
      prisma.foodOrder.count({
        where: { userId: access.organizationId, createdAt: { gte: today }, ...branchFilter(access) },
      }),
    ]);
    res.json({
      settings: serializeFoodSettings(settings),
      counts: { branches, categories, products, modifierGroups: modifiers, activeOrders, todaysOrders },
    });
  } catch (error) {
    handleFoodV1Error(res, error, 'Erro ao carregar visão geral Food.');
  }
});

router.get(
  '/order-statuses',
  requireAnyFoodPermission('orders.create', 'orders.view', 'kitchen.view', 'delivery.view', 'delivery.view_own'),
  (_req, res) => {
    res.json({
      statuses: ORDER_STATUSES.map((value) => ({ value, label: ORDER_STATUS_LABELS[value] || value })),
      orderTypes: Object.entries(ORDER_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      paymentStatuses: Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    });
  }
);

module.exports = router;
