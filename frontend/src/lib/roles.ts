export const ACCESS_ROLES = {
  SUPERADMIN: 'Superadmin',
  ORG_ADMIN: 'OrgAdmin',
  TEAM_USER: 'TeamUser',
} as const;

export type AccessRole = typeof ACCESS_ROLES[keyof typeof ACCESS_ROLES];

type RoleLikeUser = {
  accessRole?: AccessRole | string | null;
  role?: string | null;
  accountOwnerId?: number | null;
  isSuperAdmin?: boolean | null;
};

export function getAccessRole(user?: RoleLikeUser | null): AccessRole | null {
  if (!user) return null;
  if (user.accessRole && Object.values(ACCESS_ROLES).includes(user.accessRole as AccessRole)) {
    return user.accessRole as AccessRole;
  }
  if (user.isSuperAdmin) return ACCESS_ROLES.SUPERADMIN;
  if (!user.accountOwnerId || user.role === 'admin' || user.role === ACCESS_ROLES.ORG_ADMIN) {
    return ACCESS_ROLES.ORG_ADMIN;
  }
  return ACCESS_ROLES.TEAM_USER;
}

export function hasOrgAdminAccess(user?: RoleLikeUser | null): boolean {
  const accessRole = getAccessRole(user);
  return accessRole === ACCESS_ROLES.SUPERADMIN || accessRole === ACCESS_ROLES.ORG_ADMIN;
}

export function hasSuperAdminAccess(user?: RoleLikeUser | null): boolean {
  return getAccessRole(user) === ACCESS_ROLES.SUPERADMIN;
}

export function getAccessRoleLabel(user?: RoleLikeUser | null): string {
  const accessRole = getAccessRole(user);
  if (accessRole === ACCESS_ROLES.SUPERADMIN) return 'Super Admin';
  if (accessRole === ACCESS_ROLES.ORG_ADMIN) return 'Administrador';
  return 'Utilizador';
}
