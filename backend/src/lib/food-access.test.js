const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveFoodAccess, serializeFoodAccess } = require('./food-access');

function createPrismaMock({ assignments = [], branches = [] } = {}) {
  return {
    organizationModule: {
      findUnique: async () => ({ id: 'module-food', organizationId: 10, module: 'food', enabled: true }),
    },
    foodSettings: {
      findUnique: async () => ({ userId: 10, isEnabled: true }),
    },
    foodStaffRoleAssignment: {
      findMany: async () => assignments,
    },
    foodBranch: {
      findMany: async () => branches,
    },
  };
}

test('Food owner receives manager access and all active branches', async () => {
  const branches = [
    { id: 'branch-main', name: 'Principal', isMain: true, active: true, address: 'Luanda', neighborhood: null },
    { id: 'branch-two', name: 'Talatona', isMain: false, active: true, address: null, neighborhood: 'Talatona' },
  ];
  const access = await resolveFoodAccess(createPrismaMock({ branches }), {
    id: 10,
    effectiveUserId: 10,
    accountOwnerId: null,
    role: 'owner',
    planContext: { workspaceMode: 'servicos' },
  });

  assert.equal(access.entitled, true);
  assert.equal(access.enabled, true);
  assert.deepEqual(access.roles, ['manager']);
  assert.equal(access.branchIds, null);
  assert.deepEqual(access.branches, branches);
  assert.equal(access.can('stock.edit'), true);
  assert.equal(access.canAccessBranch('any-branch'), true);
  assert.deepEqual(serializeFoodAccess(access).permissions, ['*']);
});

test('Food roles accumulate while branch access remains restricted', async () => {
  const branch = { id: 'branch-main', name: 'Principal', active: true };
  const assignments = [
    { id: 'a1', role: 'cashier', branchId: branch.id, isPrimary: true, branch },
    { id: 'a2', role: 'kitchen', branchId: branch.id, isPrimary: false, branch },
  ];
  const access = await resolveFoodAccess(createPrismaMock({ assignments }), {
    id: 22,
    effectiveUserId: 10,
    accountOwnerId: 10,
    role: 'user',
    permissionsJson: { food: { orders_create: true, kitchen: true, cancel_orders: false } },
    planContext: { workspaceMode: 'servicos' },
  });

  assert.deepEqual(access.roles, ['cashier', 'kitchen']);
  assert.equal(access.primaryRole, 'cashier');
  assert.deepEqual(access.branchIds, [branch.id]);
  assert.equal(access.can('orders.create'), true);
  assert.equal(access.can('kitchen.manage'), true);
  assert.equal(access.can('orders.cancel'), false);
  assert.equal(access.can('delivery.view'), false);
  assert.equal(access.canAccessBranch(branch.id), true);
  assert.equal(access.canAccessBranch('branch-other'), false);
});

test('Food role with global scope receives every active organization branch', async () => {
  const branches = [
    { id: 'branch-main', name: 'Principal', isMain: true, active: true },
    { id: 'branch-two', name: 'Segunda', isMain: false, active: true },
  ];
  const access = await resolveFoodAccess(createPrismaMock({
    assignments: [{ id: 'courier-global', role: 'courier', branchId: null, isPrimary: true, branch: null }],
    branches,
  }), {
    id: 22,
    effectiveUserId: 10,
    accountOwnerId: 10,
    role: 'user',
    planContext: { workspaceMode: 'food' },
  });

  assert.deepEqual(access.roles, ['courier']);
  assert.equal(access.branchIds, null);
  assert.deepEqual(access.branches, branches);
  assert.equal(access.canAccessBranch('branch-two'), true);
});

test('Food user without an active assignment receives no operational access', async () => {
  const access = await resolveFoodAccess(createPrismaMock(), {
    id: 30,
    effectiveUserId: 10,
    accountOwnerId: 10,
    role: 'user',
    planContext: { workspaceMode: 'food' },
  });

  assert.deepEqual(access.roles, []);
  assert.deepEqual(access.branchIds, []);
  assert.equal(access.can('context.view'), false);
  assert.equal(access.canAccessBranch('branch-main'), false);
});

test('Food role matrix denies permissions outside each operational environment', async () => {
  const cases = [
    { role: 'cashier', allows: ['orders.create', 'payments.create', 'shifts.manage_own'], denies: ['team.edit', 'kitchen.manage', 'delivery.dispatch', 'campaigns.edit'] },
    { role: 'kitchen', allows: ['orders.view', 'kitchen.manage', 'shifts.manage_own'], denies: ['team.edit', 'orders.create', 'payments.create', 'delivery.dispatch'] },
    { role: 'delivery_manager', allows: ['orders.view', 'delivery.dispatch', 'shifts.manage_own'], denies: ['team.edit', 'orders.create', 'kitchen.manage', 'delivery.update_own'] },
    { role: 'courier', allows: ['delivery.view_own', 'delivery.update_own', 'shifts.manage_own'], denies: ['team.edit', 'orders.view', 'delivery.dispatch', 'payments.create'] },
    { role: 'crm_marketing', allows: ['customers.edit', 'campaigns.edit', 'reports.view', 'shifts.manage_own'], denies: ['team.edit', 'orders.create', 'kitchen.manage', 'delivery.dispatch', 'reports.close', 'reports.reopen'] },
  ];

  for (const [index, candidate] of cases.entries()) {
    const branch = { id: `branch-${index}`, name: 'Unidade', active: true };
    const access = await resolveFoodAccess(createPrismaMock({
      assignments: [{ id: `assignment-${index}`, role: candidate.role, branchId: branch.id, isPrimary: true, branch }],
    }), {
      id: 100 + index,
      effectiveUserId: 10,
      accountOwnerId: 10,
      role: 'user',
      planContext: { workspaceMode: 'food' },
    });

    for (const permission of candidate.allows) assert.equal(access.can(permission), true, `${candidate.role} should allow ${permission}`);
    for (const permission of candidate.denies) assert.equal(access.can(permission), false, `${candidate.role} should deny ${permission}`);
    assert.equal(access.canAccessBranch(branch.id), true);
    assert.equal(access.canAccessBranch('another-branch'), false);
  }
});
