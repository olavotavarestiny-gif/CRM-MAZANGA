import type { PlanFeatureName, PlanFeatures, User, UserPermissions } from './api';

export type ModuleKey =
  | 'contacts'
  | 'pipeline'
  | 'tasks'
  | 'chat'
  | 'calendario'
  | 'automations'
  | 'forms'
  | 'finances'
  | 'vendas';

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
};

function parsePermissions(permissions?: UserPermissions | null): UserPermissions | null {
  if (!permissions) return null;
  return permissions;
}

function hasFullAccess(user?: User | null): boolean {
  if (!user) return false;
  return !!(user.isSuperAdmin || user.role === 'admin' || !user.accountOwnerId);
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

export function canComercialDashboardBasic(user: User): boolean {
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.comercial?.dashboard_basic !== false;
}

export function canComercialDashboardAnalysis(user: User): boolean {
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.comercial?.dashboard_analysis === true;
}

export function canCaixaView(user: User): boolean {
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.caixa?.view !== false;
}

export function canCaixaOpen(user: User): boolean {
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.caixa?.open === true;
}

export function canCaixaClose(user: User): boolean {
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.caixa?.close === true;
}

export function canCaixaAudit(user: User): boolean {
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.caixa?.audit === true;
}

export function canStockEdit(user: User): boolean {
  if (hasFullAccess(user)) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.stock?.edit === true;
}

/** Returns the list of modules visible to the user */
export function getVisibleModules(user: User): ModuleKey[] {
  const all: ModuleKey[] = [
    'contacts', 'pipeline', 'tasks', 'chat', 'calendario',
    'automations', 'forms', 'finances', 'vendas',
  ];
  if (hasFullAccess(user)) return all;
  return all.filter((m) => canView(user, m));
}
