const ACCESS_ROLES = Object.freeze({
  SUPERADMIN: 'Superadmin',
  ORG_ADMIN: 'OrgAdmin',
  TEAM_USER: 'TeamUser',
});

function getAccessRole(user) {
  if (!user) return null;
  if (user.isSuperAdmin) return ACCESS_ROLES.SUPERADMIN;
  if (!user.accountOwnerId || user.isAccountOwner || user.role === 'admin' || user.role === ACCESS_ROLES.ORG_ADMIN) {
    return ACCESS_ROLES.ORG_ADMIN;
  }
  return ACCESS_ROLES.TEAM_USER;
}

function hasOrgAdminAccess(user) {
  const accessRole = user?.accessRole || getAccessRole(user);
  return accessRole === ACCESS_ROLES.SUPERADMIN || accessRole === ACCESS_ROLES.ORG_ADMIN;
}

function hasSuperAdminAccess(user) {
  const accessRole = user?.accessRole || getAccessRole(user);
  return accessRole === ACCESS_ROLES.SUPERADMIN;
}

module.exports = {
  ACCESS_ROLES,
  getAccessRole,
  hasOrgAdminAccess,
  hasSuperAdminAccess,
};
