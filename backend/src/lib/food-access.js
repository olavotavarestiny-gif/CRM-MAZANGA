const { hasOrgAdminAccess } = require('./roles');
const { parsePermissions } = require('./permissions');
const { logRouteWarning } = require('./request-log');

const FOOD_ROLES = Object.freeze([
  'manager',
  'cashier',
  'kitchen',
  'delivery_manager',
  'courier',
  'crm_marketing',
]);

const FOOD_ROLE_LABELS = Object.freeze({
  manager: 'Gestor',
  cashier: 'Caixa',
  kitchen: 'Cozinha',
  delivery_manager: 'Gestor de Delivery',
  courier: 'Entregador',
  crm_marketing: 'CRM & Marketing',
});

const FOOD_ROLE_PERMISSIONS = Object.freeze({
  manager: ['*'],
  cashier: [
    'context.view', 'overview.view', 'customers.view', 'customers.edit',
    'catalog.view', 'orders.create', 'orders.view', 'orders.discount',
    'orders.cancel', 'payments.view', 'payments.create', 'fiscal.emit',
    'shifts.view_own', 'shifts.manage_own',
  ],
  kitchen: [
    'context.view', 'orders.view', 'kitchen.view', 'kitchen.manage',
    'shifts.view_own', 'shifts.manage_own',
  ],
  delivery_manager: [
    'context.view', 'overview.view', 'orders.view', 'delivery.view',
    'delivery.dispatch', 'delivery.manage',
    'shifts.view_own', 'shifts.manage_own',
  ],
  courier: [
    'context.view', 'delivery.view_own', 'delivery.update_own', 'delivery.proof',
    'shifts.view_own', 'shifts.manage_own',
  ],
  crm_marketing: [
    'context.view', 'customers.view', 'customers.edit', 'crm.view', 'crm.edit',
    'campaigns.view', 'campaigns.edit', 'reports.view',
    'shifts.view_own', 'shifts.manage_own',
  ],
});

const LEGACY_PERMISSION_MAP = Object.freeze({
  'overview.view': 'overview',
  'settings.view': 'settings',
  'settings.edit': 'settings',
  'team.view': 'settings',
  'team.edit': 'settings',
  'catalog.view': 'products_view',
  'catalog.edit': 'products_edit',
  'customers.view': 'orders_create',
  'customers.edit': 'orders_create',
  'orders.create': 'orders_create',
  'orders.view': 'orders_view_all',
  'orders.discount': 'discounts',
  'orders.cancel': 'cancel_orders',
  'kitchen.view': 'kitchen',
  'kitchen.manage': 'kitchen',
  'delivery.view': 'delivery',
  'delivery.dispatch': 'delivery',
  'delivery.manage': 'delivery',
  'reports.view': 'reports',
});

const LEGACY_PERMISSION_ALIASES = Object.freeze({
  overview: 'overview.view',
  settings: 'settings.edit',
  products_view: 'catalog.view',
  products_edit: 'catalog.edit',
  orders_create: 'orders.create',
  orders_view_all: 'orders.view',
  kitchen: 'kitchen.manage',
  delivery: 'delivery.manage',
  reports: 'reports.view',
  discounts: 'orders.discount',
  cancel_orders: 'orders.cancel',
});

function normalizeFoodPermission(permission) {
  return LEGACY_PERMISSION_ALIASES[permission] || permission;
}

function isMissingFoodArchitecture(error) {
  return error?.code === 'P2021' || error?.code === 'P2022';
}

function normalizeModuleName(value) {
  const module = String(value || '').trim().toLowerCase();
  return ['servicos', 'comercio', 'gestao_kpi', 'food'].includes(module) ? module : null;
}

async function getOrganizationModules(prisma, organizationId, fallbackWorkspaceMode = 'servicos') {
  try {
    const modules = await prisma.organizationModule.findMany({
      where: { organizationId, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
    const names = modules.map((item) => normalizeModuleName(item.module)).filter(Boolean);
    const fallback = normalizeModuleName(fallbackWorkspaceMode) || 'servicos';
    return [...new Set(names.length ? names : [fallback])];
  } catch (error) {
    if (!isMissingFoodArchitecture(error)) throw error;
    return [normalizeModuleName(fallbackWorkspaceMode) || 'servicos'];
  }
}

async function getFoodModuleState(prisma, organizationId, fallbackWorkspaceMode = 'servicos') {
  try {
    const [module, settings] = await Promise.all([
      prisma.organizationModule.findUnique({
        where: { organizationId_module: { organizationId, module: 'food' } },
      }),
      prisma.foodSettings.findUnique({ where: { userId: organizationId } }),
    ]);
    return {
      entitled: Boolean(module?.enabled),
      enabled: Boolean(module?.enabled && settings?.isEnabled),
      module,
      settings,
    };
  } catch (error) {
    if (!isMissingFoodArchitecture(error)) throw error;
    const settings = await prisma.foodSettings.findUnique({ where: { userId: organizationId } });
    const legacyEntitled = fallbackWorkspaceMode === 'food' || Boolean(settings);
    return {
      entitled: legacyEntitled,
      enabled: Boolean(legacyEntitled && settings?.isEnabled),
      module: null,
      settings,
    };
  }
}

function permissionsForRoles(roles) {
  const permissions = new Set();
  for (const role of roles) {
    for (const permission of FOOD_ROLE_PERMISSIONS[role] || []) permissions.add(permission);
  }
  return permissions;
}

function legacyAllows(requestUser, permission) {
  if (hasOrgAdminAccess(requestUser)) return true;
  const permissions = parsePermissions(requestUser?.permissionsJson);
  if (!permissions) return true;
  const key = LEGACY_PERMISSION_MAP[permission];
  if (!key) return true;
  const value = permissions.food?.[key];
  return value !== false;
}

async function resolveFoodAccess(prisma, requestUser) {
  const organizationId = Number(requestUser?.effectiveUserId);
  const personId = Number(requestUser?.id);
  const fallbackWorkspaceMode = requestUser?.planContext?.workspaceMode || 'servicos';
  const moduleState = await getFoodModuleState(prisma, organizationId, fallbackWorkspaceMode);
  const ownerAccess = hasOrgAdminAccess(requestUser);

  let assignments = [];
  let organizationBranches = [];
  if (!ownerAccess && moduleState.entitled) {
    try {
      assignments = await prisma.foodStaffRoleAssignment.findMany({
        where: { organizationId, personId, active: true },
        include: { branch: { select: { id: true, name: true, active: true } } },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      });
    } catch (error) {
      if (!isMissingFoodArchitecture(error)) throw error;
    }
  }

  const hasGlobalBranchAccess = ownerAccess || assignments.some((item) => item.branchId === null);
  if (hasGlobalBranchAccess && moduleState.entitled) {
    try {
      organizationBranches = await prisma.foodBranch.findMany({
        where: { userId: organizationId, active: true },
        select: { id: true, name: true, isMain: true, active: true, address: true, neighborhood: true },
        orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
      });
    } catch (error) {
      if (!isMissingFoodArchitecture(error)) throw error;
    }
  }

  const roles = ownerAccess
    ? ['manager']
    : [...new Set(assignments.map((item) => item.role).filter((role) => FOOD_ROLES.includes(role)))];
  const rolePermissions = permissionsForRoles(roles);
  const branchIds = hasGlobalBranchAccess
    ? null
    : [...new Set(assignments.map((item) => item.branchId).filter(Boolean))];

  return {
    organizationId,
    personId,
    entitled: moduleState.entitled,
    enabled: moduleState.enabled,
    roles,
    primaryRole: ownerAccess
      ? 'manager'
      : assignments.find((item) => item.isPrimary)?.role || roles[0] || null,
    branchIds,
    branches: hasGlobalBranchAccess
      ? organizationBranches
      : assignments
        .filter((item) => item.branch)
        .map((item) => item.branch)
        .filter((branch, index, all) => all.findIndex((item) => item.id === branch.id) === index),
    permissions: rolePermissions.has('*') ? ['*'] : [...rolePermissions],
    can(permission) {
      const normalized = normalizeFoodPermission(permission);
      const roleAllows = rolePermissions.has('*') || rolePermissions.has(normalized);
      return roleAllows && legacyAllows(requestUser, normalized);
    },
    canAccessBranch(branchId) {
      if (!branchId) return true;
      return branchIds === null || branchIds.includes(branchId);
    },
  };
}

function serializeFoodAccess(access) {
  return {
    entitled: access.entitled,
    enabled: access.enabled,
    roles: access.roles,
    primaryRole: access.primaryRole,
    branchIds: access.branchIds,
    branches: access.branches,
    permissions: access.permissions,
    roleLabels: FOOD_ROLE_LABELS,
  };
}

function requireFoodModule(prisma, { allowDisabled = false } = {}) {
  return async (req, res, next) => {
    try {
      const access = await resolveFoodAccess(prisma, req.user);
      req.foodContext = access;
      if (!access.entitled) {
        return res.status(403).json({
          error: 'O módulo KukuGest Food não está incluído nesta organização.',
          code: 'FOOD_MODULE_NOT_ENTITLED',
        });
      }
      if (!allowDisabled && !access.enabled) {
        return res.status(403).json({
          error: 'O módulo KukuGest Food está desactivado para esta organização.',
          code: 'FOOD_NOT_ENABLED',
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireFoodPermission(permission) {
  return (req, res, next) => {
    if (req.foodContext?.can(permission)) return next();
    logRouteWarning('[food-access] permission denied', req, {
      status: 403,
      module: 'food',
      action: permission,
    });
    return res.status(403).json({
      error: 'Não tem permissão para executar esta acção no KukuGest Food.',
      code: 'FOOD_PERMISSION_DENIED',
    });
  };
}

function requireAnyFoodPermission(...permissions) {
  return (req, res, next) => {
    if (permissions.some((permission) => req.foodContext?.can(permission))) return next();
    return res.status(403).json({
      error: 'Não tem permissão para aceder a esta área do KukuGest Food.',
      code: 'FOOD_PERMISSION_DENIED',
    });
  };
}

function requireFoodBranchAccess(getBranchId = (req) => req.params.branchId || req.body?.branchId || req.query?.branchId) {
  return (req, res, next) => {
    const branchId = getBranchId(req);
    if (!branchId || req.foodContext?.canAccessBranch(branchId)) return next();
    return res.status(403).json({
      error: 'Não tem acesso a esta unidade Food.',
      code: 'FOOD_BRANCH_ACCESS_DENIED',
    });
  };
}

module.exports = {
  FOOD_ROLES,
  FOOD_ROLE_LABELS,
  FOOD_ROLE_PERMISSIONS,
  normalizeFoodPermission,
  getOrganizationModules,
  getFoodModuleState,
  resolveFoodAccess,
  serializeFoodAccess,
  requireFoodModule,
  requireFoodPermission,
  requireAnyFoodPermission,
  requireFoodBranchAccess,
};
