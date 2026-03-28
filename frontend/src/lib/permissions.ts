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
  if (user.isSuperAdmin || user.role === 'admin') return true;
  // Account owner (no accountOwnerId) has full access
  if (!user.accountOwnerId) return true;
  // null permissions = no restrictions
  if (!user.permissions) return true;

  const perms = user.permissions as UserPermissions;

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
  if (user.isSuperAdmin || user.role === 'admin') return true;
  if (!user.accountOwnerId) return true;
  if (!user.permissions) return true;

  const perms = user.permissions as UserPermissions;

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
  return user.isSuperAdmin || !user.accountOwnerId || user.role === 'admin';
}

/** Returns true if user can view invoices */
export function canViewInvoices(user: User): boolean {
  if (user.isSuperAdmin || user.role === 'admin') return true;
  if (!user.accountOwnerId) return true;
  if (!user.permissions) return true;
  const f = (user.permissions as UserPermissions).finances;
  if (!f) return true;
  return !!f.view_invoices || !!f.emit_invoices;
}

/** Returns true if user can emit invoices */
export function canEmitInvoices(user: User): boolean {
  if (user.isSuperAdmin || user.role === 'admin') return true;
  if (!user.accountOwnerId) return true;
  if (!user.permissions) return true;
  const f = (user.permissions as UserPermissions).finances;
  if (!f) return true;
  return !!f.emit_invoices;
}

/** Returns the list of modules visible to the user */
export function getVisibleModules(user: User): ModuleKey[] {
  const all: ModuleKey[] = [
    'contacts', 'pipeline', 'tasks', 'chat', 'calendario',
    'automations', 'forms', 'finances', 'vendas',
  ];
  if (user.isSuperAdmin || user.role === 'admin' || !user.accountOwnerId) return all;
  return all.filter((m) => canView(user, m));
}
