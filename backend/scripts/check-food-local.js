'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const prisma = require('../src/lib/prisma');

const REQUIRED_TABLES = [
  'food_settings',
  'food_branches',
  'food_categories',
  'food_products',
  'food_modifier_groups',
  'food_modifier_options',
  'food_product_modifier_groups',
  'food_orders',
  'food_order_items',
  'food_order_item_modifiers',
  'food_order_status_history',
  'organization_modules',
  'food_staff_role_assignments',
  'food_order_events',
  'food_kitchen_tickets',
  'food_kitchen_ticket_items',
  'food_deliveries',
  'food_payments',
  'food_cash_sessions',
  'food_ingredients',
  'food_stock_movements',
];

async function tableExists(tableName) {
  const result = await prisma.$queryRaw`
    SELECT to_regclass(${`public.${tableName}`})::text AS name
  `;
  return Boolean(result?.[0]?.name);
}

async function main() {
  const missingTables = [];
  for (const table of REQUIRED_TABLES) {
    if (!(await tableExists(table))) missingTables.push(table);
  }

  const devUser = await prisma.user.findUnique({
    where: { email: 'dev@local.test' },
    select: { id: true, email: true, workspaceMode: true },
  });

  const ownerId = devUser?.id ?? null;
  const [settings, productsCount, ordersCount] = ownerId
    ? await Promise.all([
        prisma.foodSettings.findUnique({ where: { userId: ownerId }, select: { isEnabled: true, restaurantName: true } }).catch(() => null),
        prisma.foodProduct.count({ where: { userId: ownerId, active: true } }).catch(() => 0),
        prisma.foodOrder.count({ where: { userId: ownerId } }).catch(() => 0),
      ])
    : [null, 0, 0];

  console.log(JSON.stringify({
    ok: missingTables.length === 0,
    missingTables,
    devUser,
    foodSettings: settings,
    productsCount,
    ordersCount,
    nextStep: missingTables.length > 0
      ? 'Execute: npm run db:local:migrate'
      : 'Schema Food pronto para testar pedidos.',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[check-food-local] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
