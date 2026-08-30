import type { PlanFeatureName, PlanFeatures, User, UserPermissions } from './api';
import { hasOrgAdminAccess } from './roles';

export type ModuleKey =
  | 'contacts'
  | 'pipeline'
  | 'tasks'
  | 'chat'
  | 'calendario'
  | 'automations'
  | 'forms'
  | 'finances'
  | 'vendas'
  | 'food';

export type FoodPermissionKey = keyof NonNullable<UserPermissions['food']>;
export type FoodRole = NonNullable<User['foodAccess']>['roles'][number];

const MODULE_TO_FEATURE: Record<ModuleKey, PlanFeatureName> = {
  contacts: 'clientes',
  pipeline: 'processos',
  tasks: 'tarefas',
  chat: 'conversas',
  calendario: 'calendario',
  automations: 'automacoes',
  forms: 'formularios',
  finances: 'financas',
  vendas: 'vendas',
  food: 'food',
};

function parsePermissions(permissions?: UserPermissions | null): UserPermissions | null {
  if (!permissions) return null;
  return permissions;
}

function hasFullAccess(user?: User | null): boolean {
  return hasOrgAdminAccess(user);
}

type WorkspaceMode = User['workspaceMode'];
type CommerceRoute =
  | '/'
  | '/caixa'
  | '/vendas-rapidas'
  | '/contacts'
  | '/tasks'
  | '/produtos'
  | '/vendas'
  | '/faturacao'
  | '/finances'
  | '/configuracoes';
type FoodRoute =
  | '/food'
  | '/food/gestao'
  | '/food/caixa'
  | '/food/novo-pedido'
  | '/food/pedidos'
  | '/food/cozinha'
  | '/food/delivery'
  | '/food/entregador'
  | '/food/crm'
  | '/food/ajuda'
  | '/food/produtos'
  | '/food/configuracoes';

const GLOBAL_PRIVATE_ROUTE_PREFIXES = [
  '/admin',
  '/superadmin',
  '/profile',
  '/equipa',
  '/planos',
] as const;

const SERVICOS_ROUTE_TO_MODULE: Array<{ prefix: string; module: ModuleKey }> = [
  { prefix: '/contacts', module: 'contacts' },
  { prefix: '/pipeline', module: 'pipeline' },
  { prefix: '/tasks', module: 'tasks' },
  { prefix: '/caixa', module: 'vendas' },
  { prefix: '/vendas', module: 'vendas' },
  { prefix: '/vendas-rapidas', module: 'vendas' },
  { prefix: '/faturacao', module: 'vendas' },
  { prefix: '/calendario', module: 'calendario' },
  { prefix: '/chat', module: 'chat' },
  { prefix: '/automations', module: 'automations' },
  { prefix: '/forms', module: 'forms' },
  { prefix: '/finances', module: 'finances' },
  { prefix: '/produtos', module: 'vendas' },
];

const COMERCIO_FALLBACK_ROUTES: CommerceRoute[] = [
  '/',
  '/caixa',
  '/vendas-rapidas',
  '/contacts',
  '/tasks',
  '/produtos',
  '/vendas',
  '/finances',
  '/configuracoes',
];

const FOOD_FALLBACK_ROUTES: FoodRoute[] = [
  '/food',
  '/food/gestao',
  '/food/caixa',
  '/food/cozinha',
  '/food/delivery',
  '/food/entregador',
  '/food/crm',
  '/food/ajuda',
  '/food/novo-pedido',
  '/food/pedidos',
  '/food/produtos',
  '/food/configuracoes',
];

const PLAN_ORDER: Array<User['plan']> = ['essencial', 'profissional', 'enterprise'];

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function isCommerceWorkspace(user?: Pick<User, 'workspaceMode'> | null) {
  return user?.workspaceMode === 'comercio';
}

function isFoodWorkspace(user?: Pick<User, 'workspaceMode' | 'availableWorkspaces'> | null) {
  return user?.workspaceMode === 'food' || user?.availableWorkspaces?.includes('food') === true;
}

function isPlanAtLeast(user: Pick<User, 'plan'> | null | undefined, targetPlan: User['plan']) {
  const currentPlan = user?.plan || 'essencial';
  return PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(targetPlan);
}

export function hasFeature(
  userOrFeatures: Pick<User, 'planFeatures'> | PlanFeatures | null | undefined,
  featureName: PlanFeatureName
): boolean {
  if (!userOrFeatures) return true;
  const features = (
    'planFeatures' in userOrFeatures ? userOrFeatures.planFeatures : userOrFeatures
  ) as PlanFeatures | null | undefined;
  if (!features) return true;
  return features[featureName] === true;
}

/** Returns true if user can view the given module */
export function canView(user: User, module: ModuleKey): boolean {
  if (module === 'food') return canFood(user, 'overview');
  if (!hasFeature(user, MODULE_TO_FEATURE[module])) return false;
  // SuperAdmin and platform admin see everything
  if (hasFullAccess(user)) return true;
  // null permissions = no restrictions
  if (!user.permissions) return true;

  const perms = parsePermissions(user.permissions) as UserPermissions;

  if (module === 'finances') {
    const f = perms.finances;
    if (!f) return true;
    return (
      f.transactions === 'view' ||
      f.transactions === 'edit' ||
      !!f.view_invoices ||
      !!f.emit_invoices
    );
  }

  const perm = perms[module as keyof Omit<UserPermissions, 'finances'>];
  if (perm === undefined) return true; // not configured = allow
  return perm === 'view' || perm === 'edit';
}

/** Returns true if user can create/edit records in the given module */
export function canEdit(user: User, module: ModuleKey): boolean {
  if (module === 'food') return canFood(user, 'settings') || canFood(user, 'products_edit');
  if (!hasFeature(user, MODULE_TO_FEATURE[module])) return false;
  if (hasFullAccess(user)) return true;
  if (!user.permissions) return true;

  const perms = parsePermissions(user.permissions) as UserPermissions;

  if (module === 'finances') {
    const f = perms.finances;
    if (!f) return true;
    return f.transactions === 'edit' || !!f.emit_invoices;
  }

  const perm = perms[module as keyof Omit<UserPermissions, 'finances'>];
  if (perm === undefined) return true;
  return perm === 'edit';
}

export function isPrivilegedTaskAssignee(user: Pick<User, 'role' | 'accountOwnerId' | 'isSuperAdmin'>): boolean {
  return !!(user.isSuperAdmin || user.role === 'admin' || !user.accountOwnerId);
}

export function canAssignTasksToAnyOrgMember(user: User): boolean {
  if (!hasFeature(user, 'tarefas')) return false;
  return hasFullAccess(user);
}

export function canAssignTasksToAdminOwner(user: User): boolean {
  if (!hasFeature(user, 'tarefas')) return false;
  if (hasFullAccess(user)) return true;
  if (!canEdit(user, 'tasks')) return false;
  if (!user.permissions) return true;

  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;

  return perms?.taskAssignment?.assign_admin_owner === true;
}

/** Returns true if user can delete records (only owners/admins) */
export function canDelete(user: User): boolean {
  return hasFullAccess(user);
}

/** Returns true if user can view invoices */
export function canViewInvoices(user: User): boolean {
  if (hasFullAccess(user)) return true;
  if (!user.permissions) return true;
  const f = (parsePermissions(user.permissions) as UserPermissions).finances;
  if (!f) return true;
  return !!f.view_invoices || !!f.emit_invoices;
}

/** Returns true if user can emit invoices */
export function canEmitInvoices(user: User): boolean {
  if (hasFullAccess(user)) return true;
  if (!user.permissions) return true;
  const f = (parsePermissions(user.permissions) as UserPermissions).finances;
  if (!f) return true;
  return !!f.emit_invoices;
}

export function canAccessBilling(user: User): boolean {
  if (!hasFeature(user, 'vendas')) return false;
  return canViewInvoices(user);
}

export function canAccessQuickSales(user: User): boolean {
  if (!hasFeature(user, 'vendas')) return false;
  return canCaixaView(user) && canEmitInvoices(user);
}

export function canComercialDashboardBasic(user: User): boolean {
  if (!hasFeature(user, 'vendas')) return false;
  if (isCommerceWorkspace(user) && !isPlanAtLeast(user, 'profissional')) return false;
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.comercial?.dashboard_basic !== false;
}

export function canComercialDashboardAnalysis(user: User): boolean {
  if (!hasFeature(user, 'vendas')) return false;
  if (isCommerceWorkspace(user) && !isPlanAtLeast(user, 'enterprise')) return false;
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.comercial?.dashboard_analysis === true;
}

export function canCaixaView(user: User): boolean {
  if (!hasFeature(user, 'vendas')) return false;
  if (isCommerceWorkspace(user) && !isPlanAtLeast(user, 'profissional')) return false;
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.caixa?.view !== false;
}

export function canCaixaOpen(user: User): boolean {
  if (!hasFeature(user, 'vendas')) return false;
  if (isCommerceWorkspace(user) && !isPlanAtLeast(user, 'profissional')) return false;
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.caixa?.open === true;
}

export function canCaixaClose(user: User): boolean {
  if (!hasFeature(user, 'vendas')) return false;
  if (isCommerceWorkspace(user) && !isPlanAtLeast(user, 'profissional')) return false;
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.caixa?.close === true;
}

export function canCaixaAudit(user: User): boolean {
  if (!hasFeature(user, 'vendas')) return false;
  if (isCommerceWorkspace(user) && !isPlanAtLeast(user, 'profissional')) return false;
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.caixa?.audit === true;
}

export function canStockView(user: User): boolean {
  if (!hasFeature(user, 'vendas')) return false;
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.stock?.view !== false;
}

export function canStockEdit(user: User): boolean {
  if (!hasFeature(user, 'vendas')) return false;
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.stock?.edit === true;
}

export function canFinanceTransactionsView(user: User): boolean {
  if (!hasFeature(user, 'financas')) return false;
  if (hasFullAccess(user)) return true;
  if (!user.permissions) return true;
  const finances = (parsePermissions(user.permissions) as UserPermissions).finances;
  if (!finances) return true;
  return finances.transactions === 'view' || finances.transactions === 'edit';
}

export function canFinanceTransactionsEdit(user: User): boolean {
  if (!hasFeature(user, 'financas')) return false;
  if (hasFullAccess(user)) return true;
  if (!user.permissions) return true;
  const finances = (parsePermissions(user.permissions) as UserPermissions).finances;
  if (!finances) return true;
  return finances.transactions === 'edit';
}

export function canViewReports(user: User): boolean {
  if (!hasFeature(user, 'financas')) return false;
  if (isCommerceWorkspace(user) && !isPlanAtLeast(user, 'enterprise')) return false;
  if (hasFullAccess(user)) return true;
  if (!user.permissions) return true;
  const finances = (parsePermissions(user.permissions) as UserPermissions).finances;
  if (!finances) return true;
  return finances.view_reports === true;
}

export function canFood(user: User, key: FoodPermissionKey): boolean {
  if (!isFoodWorkspace(user) || user.foodAccess?.entitled === false) return false;
  const granularByLegacyKey: Record<FoodPermissionKey, string> = {
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
  };
  if (user.foodAccess) {
    return user.foodAccess.permissions.includes('*') || user.foodAccess.permissions.includes(granularByLegacyKey[key]);
  }
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  const value = perms?.food?.[key];
  if (key === 'overview' || key === 'products_view') return value !== false;
  return value === true;
}

export function hasFoodPermission(user: User, permission: string): boolean {
  if (!isFoodWorkspace(user) || user.foodAccess?.entitled === false) return false;
  if (hasFullAccess(user) && !user.foodAccess) return true;
  if (user.foodAccess) {
    return user.foodAccess.permissions.includes('*') || user.foodAccess.permissions.includes(permission);
  }
  const fallbackByPermission: Record<string, FoodPermissionKey> = {
    'overview.view': 'overview',
    'settings.edit': 'settings',
    'team.view': 'settings',
    'team.edit': 'settings',
    'catalog.view': 'products_view',
    'catalog.edit': 'products_edit',
    'orders.create': 'orders_create',
    'orders.view': 'orders_view_all',
    'kitchen.view': 'kitchen',
    'kitchen.manage': 'kitchen',
    'delivery.view': 'delivery',
    'delivery.dispatch': 'delivery',
    'delivery.view_own': 'delivery',
    'reports.view': 'reports',
  };
  const fallback = fallbackByPermission[permission];
  return fallback ? canFood(user, fallback) : false;
}

export function hasFoodRole(user: User, role: FoodRole): boolean {
  return user.foodAccess?.roles.includes(role) === true;
}

export function canAccessCommerceRoute(user: User, pathname: string): boolean {
  const path = normalizePath(pathname);

  if (path === '/' || path.startsWith('/dashboard')) return true;
  if (path.startsWith('/caixa')) return canCaixaView(user);
  if (path.startsWith('/vendas-rapidas')) return canAccessQuickSales(user);
  if (path.startsWith('/contacts')) return canView(user, 'contacts');
  if (path.startsWith('/tasks')) return canView(user, 'tasks');
  if (path.startsWith('/produtos')) return canStockView(user);
  if (path.startsWith('/vendas')) return canAccessBilling(user);
  if (path.startsWith('/faturacao')) return canAccessBilling(user);
  if (path.startsWith('/finances')) return canFinanceTransactionsView(user);
  if (path === '/relatorios' || path.startsWith('/relatorios/')) {
    return canViewReports(user) && (path === '/relatorios' || path.startsWith('/relatorios/comercio'));
  }
  if (path.startsWith('/configuracoes')) return true;

  return false;
}

export function canAccessFoodRoute(user: User, pathname: string): boolean {
  const path = normalizePath(pathname);

  if (!isFoodWorkspace(user)) return false;
  if (path === '/food') return hasFoodPermission(user, 'context.view') || canFood(user, 'overview');
  if (path.startsWith('/food/ajuda')) return hasFoodPermission(user, 'context.view');
  if (path.startsWith('/food/gestao')) return hasFoodPermission(user, 'overview.view');
  if (path.startsWith('/food/caixa')) return hasFoodPermission(user, 'orders.create');
  if (path.startsWith('/food/novo-pedido')) return canFood(user, 'orders_create');
  if (path.startsWith('/food/pedidos')) return canFood(user, 'orders_view_all') || canFood(user, 'orders_create') || canFood(user, 'kitchen') || canFood(user, 'delivery');
  if (path.startsWith('/food/cozinha')) return canFood(user, 'kitchen');
  if (path.startsWith('/food/delivery')) return hasFoodPermission(user, 'delivery.view') || hasFoodPermission(user, 'delivery.dispatch');
  if (path.startsWith('/food/entregador')) {
    return hasFoodRole(user, 'courier') && hasFoodPermission(user, 'delivery.view_own');
  }
  if (path.startsWith('/food/crm')) return hasFoodPermission(user, 'crm.view');
  if (path.startsWith('/food/produtos')) return canFood(user, 'products_view');
  if (path.startsWith('/food/configuracoes')) return canFood(user, 'settings');

  return false;
}

export function canAccessWorkspaceRoute(
  user: User,
  pathname: string,
  workspaceMode?: WorkspaceMode | null
): boolean {
  const path = normalizePath(pathname);

  if (GLOBAL_PRIVATE_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/'))) {
    return true;
  }

  if (path === '/food' || path.startsWith('/food/')) {
    return canAccessFoodRoute(user, path);
  }

  if (workspaceMode === 'gestao_kpi') {
    if (path === '/') return true;
    if (!path.startsWith('/gestao')) return false;
    const role = !user.accountOwnerId || user.role === 'admin' ? 'admin' : user.role;
    if (role === 'admin') return true;
    if (path === '/gestao' || path.startsWith('/gestao/configuracoes')) return true;
    if (role === 'marketing') return path.startsWith('/gestao/marketing');
    if (role === 'commercial') return path.startsWith('/gestao/clientes') || path.startsWith('/gestao/comercial');
    if (role === 'designer' || role === 'editor') return path.startsWith('/gestao/operacional');
    return false;
  }

  if (workspaceMode === 'food') {
    return canAccessFoodRoute(user, path);
  }

  if (path === '/relatorios' || path.startsWith('/relatorios/')) {
    if (!canViewReports(user)) return false;

    if (workspaceMode === 'comercio') {
      return path === '/relatorios' || path.startsWith('/relatorios/comercio');
    }

    return path === '/relatorios' || path.startsWith('/relatorios/servicos');
  }

  if (workspaceMode === 'comercio') {
    return canAccessCommerceRoute(user, path);
  }

  if (path === '/' || path.startsWith('/dashboard') || path.startsWith('/configuracoes')) {
    return true;
  }

  const route = SERVICOS_ROUTE_TO_MODULE.find(({ prefix }) => path === prefix || path.startsWith(prefix + '/'));
  if (!route) return true;

  return canView(user, route.module);
}

export function getWorkspaceFallbackRoute(user: User, workspaceMode?: WorkspaceMode | null): string {
  if (workspaceMode === 'gestao_kpi') return '/gestao';
  if (workspaceMode === 'food') {
    return FOOD_FALLBACK_ROUTES.find((route) => canAccessFoodRoute(user, route)) ?? '/food';
  }
  if (workspaceMode === 'comercio') {
    return COMERCIO_FALLBACK_ROUTES.find((route) => canAccessCommerceRoute(user, route)) ?? '/';
  }

  const moduleToPath: Record<ModuleKey, string> = {
    contacts: '/contacts',
    pipeline: '/pipeline',
    tasks: '/tasks',
    chat: '/chat',
    calendario: '/calendario',
    automations: '/automations',
    forms: '/forms',
    finances: '/finances',
    vendas: '/vendas',
    food: '/food',
  };

  return getVisibleModules(user).map((module) => moduleToPath[module]).find(Boolean) ?? '/';
}

/** Returns the list of modules visible to the user */
export function getVisibleModules(user: User): ModuleKey[] {
  const all: ModuleKey[] = [
    'contacts', 'pipeline', 'tasks', 'chat', 'calendario',
    'automations', 'forms', 'finances', 'vendas', 'food',
  ];
  if (hasFullAccess(user)) return all;
  return all.filter((m) => canView(user, m));
}
