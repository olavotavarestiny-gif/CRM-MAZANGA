const test = require('node:test');
const assert = require('node:assert/strict');

const { canFood, intersectPermissions } = require('./permissions');
const {
  buildFoodSettingsUpdate,
  serializeFoodSettings,
} = require('./food-foundation');
const { getPlanCatalog, normalizeWorkspaceMode } = require('./plan-limits');

test('Food plan feature is only enabled for food workspace catalog', () => {
  assert.equal(normalizeWorkspaceMode('food'), 'food');
  assert.equal(getPlanCatalog('essencial', 'food').features.food, true);
  assert.equal(getPlanCatalog('enterprise', 'food').features.food, true);
  assert.equal(getPlanCatalog('enterprise', 'servicos').features.food, false);
  assert.equal(getPlanCatalog('enterprise', 'comercio').features.food, false);
});

test('Food permissions support overview defaults and privileged edit actions', () => {
  assert.equal(canFood(null, 'settings'), true);
  assert.equal(canFood({ food: { overview: true, settings: false } }, 'overview'), true);
  assert.equal(canFood({ food: { overview: true, settings: false } }, 'settings'), false);
  assert.equal(canFood(JSON.stringify({ food: { products_view: false, products_edit: true } }), 'products_view'), false);
  assert.equal(canFood(JSON.stringify({ food: { products_view: true, products_edit: true } }), 'products_edit'), true);
});

test('Food permissions intersect org and member permissions restrictively', () => {
  const orgPerms = {
    food: {
      overview: true,
      settings: false,
      products_view: true,
      products_edit: false,
    },
  };
  const memberPerms = {
    food: {
      overview: true,
      settings: true,
      products_view: true,
      products_edit: true,
    },
  };

  const result = intersectPermissions(orgPerms, memberPerms);

  assert.equal(result.food.overview, true);
  assert.equal(result.food.settings, false);
  assert.equal(result.food.products_view, true);
  assert.equal(result.food.products_edit, false);
});

test('Food settings serializes JSON list fields and normalizes updates', () => {
  const serialized = serializeFoodSettings({
    id: 'settings-1',
    userId: 1,
    isEnabled: true,
    orderTypes: '["delivery","pickup"]',
    paymentMethods: '["CASH"]',
  });

  assert.deepEqual(serialized.orderTypes, ['delivery', 'pickup']);
  assert.deepEqual(serialized.paymentMethods, ['CASH']);

  const update = buildFoodSettingsUpdate({
    currency: 'aoa',
    primaryColor: '#AA5500',
    secondaryColor: 'invalid',
    restaurantPhone: '  +244 923 000 000  ',
    defaultPreparationMinutes: '28',
    orderTypes: ['delivery', '', 'dine_in'],
    paymentMethods: ['CASH', 'TPA'],
  });

  assert.equal(update.currency, 'AOA');
  assert.equal(update.primaryColor, '#aa5500');
  assert.equal(update.secondaryColor, null);
  assert.equal(update.restaurantPhone, '+244 923 000 000');
  assert.equal(update.defaultPreparationMinutes, 28);
  assert.equal(update.orderTypes, '["delivery","dine_in"]');
  assert.equal(update.paymentMethods, '["CASH","TPA"]');
});
