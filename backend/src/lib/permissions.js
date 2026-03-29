/**
 * Permissions helper for RBAC v2
 *
 * permissions JSON structure:
 * {
 *   contacts:    "none" | "view" | "edit",
 *   pipeline:    "none" | "view" | "edit",
 *   tasks:       "none" | "view" | "edit",
 *   chat:        "none" | "view" | "edit",  // always at least "edit"
 *   calendario:  "none" | "view" | "edit",
 *   automations: "none" | "view" | "edit",
 *   forms:       "none" | "view" | "edit",
 *   finances: {
 *     transactions:  "none" | "view" | "edit",
 *     view_invoices: true | false,
 *     emit_invoices: true | false,
 *     view_reports:  true | false,
 *     saft:          true | false,  // admin only
 *   }
 * }
 *
 * null permissions = full access (no restriction) — for owners and admins
 */

const PERMISSION_LEVEL = { none: 0, view: 1, edit: 2 };

/**
 * Parse permissions from a JSON string or object.
 * Returns null if null/undefined (= full access).
 */
function parsePermissions(permissionsJson) {
  if (!permissionsJson) return null;
  if (typeof permissionsJson === 'object') return permissionsJson;
  try { return JSON.parse(permissionsJson); } catch { return null; }
}

/**
 * Compute the effective permissions for a team member:
 * intersection of org permissions and member permissions
 * (takes the more restrictive of the two at each module).
 */
function intersectPermissions(orgPerms, memberPerms) {
  // If either level is null (= no restriction), the other wins
  if (!orgPerms) return memberPerms;
  if (!memberPerms) return orgPerms;

  const result = {};
  const SIMPLE_MODULES = ['contacts', 'pipeline', 'tasks', 'chat', 'calendario', 'automations', 'forms'];

  for (const mod of SIMPLE_MODULES) {
    const orgLevel = PERMISSION_LEVEL[orgPerms[mod]] ?? 2;   // default edit if not set
    const memberLevel = PERMISSION_LEVEL[memberPerms[mod]] ?? 2;
    const keys = Object.keys(PERMISSION_LEVEL);
    result[mod] = keys[Math.min(orgLevel, memberLevel)];
  }

  // Finance sub-permissions
  const of = orgPerms.finances || {};
  const mf = memberPerms.finances || {};
  const orgTxLevel = PERMISSION_LEVEL[of.transactions] ?? 2;
  const memberTxLevel = PERMISSION_LEVEL[mf.transactions] ?? 2;
  const txKeys = Object.keys(PERMISSION_LEVEL);
  result.finances = {
    transactions:  txKeys[Math.min(orgTxLevel, memberTxLevel)],
    view_invoices: !!(of.view_invoices !== false && mf.view_invoices !== false),
    emit_invoices: !!(of.emit_invoices  !== false && mf.emit_invoices  !== false),
    view_reports:  !!(of.view_reports  !== false && mf.view_reports  !== false),
    saft:          false, // never allowed for team members
  };

  return result;
}

/**
 * Check if a given permissions object allows a specific action on a module.
 * null permissions = full access.
 */
function canPerform(permissionsJson, module, action) {
  const perms = parsePermissions(permissionsJson);
  if (!perms) return true; // null = full access

  if (module === 'finances') {
    const f = perms.finances || {};
    if (action === 'transactions_view') return (PERMISSION_LEVEL[f.transactions] ?? 0) >= PERMISSION_LEVEL.view;
    if (action === 'transactions_edit') return (PERMISSION_LEVEL[f.transactions] ?? 0) >= PERMISSION_LEVEL.edit;
    // boolean sub-permissions
    return f[action] === true;
  }

  const level = PERMISSION_LEVEL[perms[module]] ?? 0;
  if (action === 'view') return level >= PERMISSION_LEVEL.view;
  if (action === 'edit') return level >= PERMISSION_LEVEL.edit;
  return false;
}

/**
 * Express middleware factory: requires a specific permission.
 * SuperAdmin and account owners always pass.
 */
function requirePermission(module, action) {
  return (req, res, next) => {
    if (req.user.isSuperAdmin || req.user.isAccountOwner) return next();
    if (!canPerform(req.user.permissionsJson, module, action)) {
      return res.status(403).json({ error: 'Sem permissão para esta acção' });
    }
    next();
  };
}

/**
 * Express middleware: only account owners and superadmin can delete.
 * Regular team members cannot delete anything.
 */
function requireDeletePermission(req, res, next) {
  if (req.user.isSuperAdmin || req.user.isAccountOwner) return next();
  return res.status(403).json({ error: 'Sem permissão para eliminar' });
}

module.exports = {
  parsePermissions,
  intersectPermissions,
  canPerform,
  requirePermission,
  requireDeletePermission,
};
