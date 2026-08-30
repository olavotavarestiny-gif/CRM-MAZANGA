const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertOrderTransition,
  buildOrderItemSnapshots,
  calculateOrderTotals,
} = require('./food-orders');

function makeProduct(overrides = {}) {
  return {
    id: 'prod-1',
    userId: 1,
    internalCode: 'BUR-1',
    name: 'Hambúrguer',
    imageUrl: null,
    price: 2500,
    preparationMinutes: 18,
    active: true,
    available: true,
    category: { name: 'Sandes' },
    modifierGroups: [],
    ...overrides,
  };
}

test('Food orders calculate backend totals with modifiers, delivery and discount', () => {
  const product = makeProduct({
    modifierGroups: [{
      group: {
        id: 'grp-1',
        name: 'Extras',
        required: false,
        minSelection: 0,
        maxSelection: 2,
        options: [{ id: 'opt-1', name: 'Queijo', priceDelta: 300, active: true }],
      },
    }],
  });

  const itemSnapshots = buildOrderItemSnapshots({
    requestedItems: [{ productId: 'prod-1', quantity: 2, modifierOptionIds: ['opt-1'] }],
    productsById: new Map([[product.id, product]]),
  });

  const totals = calculateOrderTotals({
    itemSnapshots,
    orderType: 'delivery',
    discountAmount: 500,
    deliveryFee: 1000,
    taxAmount: 0,
  });

  assert.equal(itemSnapshots[0].subtotal, 5600);
  assert.equal(itemSnapshots[0].modifiers[0].total, 600);
  assert.deepEqual(totals, {
    subtotal: 5600,
    discountAmount: 500,
    deliveryFee: 1000,
    taxAmount: 0,
    total: 6100,
    estimatedPreparationMinutes: 18,
  });
});

test('Food orders reject unavailable products and incoherent transitions', () => {
  assert.throws(
    () => buildOrderItemSnapshots({
      requestedItems: [{ productId: 'prod-1', quantity: 1 }],
      productsById: new Map([['prod-1', makeProduct({ available: false })]]),
    }),
    /Produto indisponível/
  );

  assert.throws(
    () => assertOrderTransition('completed', 'preparing'),
    /Transição inválida/
  );

  assert.throws(
    () => assertOrderTransition('preparing', 'cancelled'),
    /Cancelamentos exigem motivo/
  );
});

test('Kitchen flow accepts controlled transitions and same-state occurrences', () => {
  assert.deepEqual(assertOrderTransition('sent_to_kitchen', 'kitchen_accepted'), {
    current: 'sent_to_kitchen',
    next: 'kitchen_accepted',
  });
  assert.deepEqual(assertOrderTransition('kitchen_accepted', 'preparing'), {
    current: 'kitchen_accepted',
    next: 'preparing',
  });
  assert.deepEqual(assertOrderTransition('preparing', 'ready'), {
    current: 'preparing',
    next: 'ready',
  });
  assert.deepEqual(assertOrderTransition('preparing', 'preparing'), {
    current: 'preparing',
    next: 'preparing',
  });
});
