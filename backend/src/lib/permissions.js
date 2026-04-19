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
 *   vendas:      "none" | "view" | "edit",
 *   finances: {
 *     transactions:  "none" | "view" | "edit",
 *     view_invoices: true | false,
 *     emit_invoices: true | false,
 *     view_reports:  true | false,
 *     saft:          true | false,  // admin only
 *   },
 *   comercial: {
 *     dashboard_basic: true | false,
 *     dashboard_analysis: true | false,
 *     view_store_ranking: true | false,
 *     view_product_performance: true | false,
 *   },
 *   caixa: {
 *     view: true | false,
 *     open: true | false,
 *     close: true | false,
 *     audit: true | false,
 *   },
 *   stock: {
 *     view: true | false,
 *     edit: true | false,
 *   },
 *   taskAssignment: {
 *     assign_admin_owner: true | false,
 *   }
 * }
 *
 * null permissions = full access (no restriction) — for owners and admins
 */

const PERMISSION_LEVEL = { none: 0, view: 1, edit: 2 };
const BOOLEAN_SCOPE_RULES = {
  comercial: {
    dashboard_basic: 'allow_unless_false',
    dashboard_analysis: 'allow_only_true',
    view_store_ranking: 'allow_only_true',
    view_product_performance: 'allow_only_true',
  },
  caixa: {
    view: 'allow_unless_false',
    open: 'allow_only_true',
    close: 'allow_only_true',
    audit: 'allow_only_true',
  },
  stock: {
    view: 'allow_unless_false',
    edit: 'allow_only_true',
  },
  taskAssignment: {
    assign_admin_owner: 'allow_only_true',
  },
};

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
  const SIMPLE_MODULES = ['contacts', 'pipeline', 'tasks', 'chat', 'calendario', 'automations', 'forms', 'vendas'];

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

  for (const [scope, rules] of Object.entries(BOOLEAN_SCOPE_RULES)) {
    const orgScope = orgPerms[scope] || {};
    const memberScope = memberPerms[scope] || {};

    result[scope] = {};
    for (const [key, strategy] of Object.entries(rules)) {
      const orgValue = orgScope[key];
      const memberValue = memberScope[key];

      if (strategy === 'allow_unless_false') {
        if (orgValue === false || memberValue === false) {
          result[scope][key] = false;
        } else if (orgValue === true || memberValue === true) {
          result[scope][key] = true;
        }
      } else {
        if (orgValue === false || memberValue === false) {
          result[scope][key] = false;
        } else if (orgValue === undefined) {
          if (memberValue !== undefined) result[scope][key] = memberValue;
        } else if (memberValue === undefined) {
          result[scope][key] = orgValue;
        } else {
          result[scope][key] = orgValue === true && memberValue === true;
        }
      }
    }

    if (Object.keys(result[scope]).length === 0) {
      delete result[scope];
    }
  }

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

function canScopedBooleanPermission(permissionsJson, scope, key) {
  const perms = parsePermissions(permissionsJson);
  if (!perms) return true;

  const strategy = BOOLEAN_SCOPE_RULES[scope]?.[key];
  if (!strategy) return false;

  const value = perms?.[scope]?.[key];
  if (strategy === 'allow_unless_false') return value !== false;
  return value === true;
}

function canComercial(permissionsJson, key) {
  return canScopedBooleanPermission(permissionsJson, 'comercial', key);
}

function canCaixa(permissionsJson, key) {
  return canScopedBooleanPermission(permissionsJson, 'caixa', key);
}

function canStock(permissionsJson, key) {
  return canScopedBooleanPermission(permissionsJson, 'stock', key);
}

function canTaskAssignment(permissionsJson, key) {
  return canScopedBooleanPermission(permissionsJson, 'taskAssignment', key);
}

function hasFullAccess(req) {
  return req.user.isSuperAdmin || req.user.isAccountOwner || req.user.role === 'admin';
}

/**
 * Express middleware factory: requires a specific permission.
 * SuperAdmin and account owners always pass.
 */
function requirePermission(module, action) {
  return (req, res, next) => {
    if (hasFullAccess(req)) return next();
    if (!canPerform(req.user.permissionsJson, module, action)) {
      return res.status(403).json({ error: 'Sem permissão para esta acção' });
    }
    next();
  };
}

function requireComercialPermission(key) {
  return (req, res, next) => {
    if (hasFullAccess(req)) return next();
    if (!canComercial(req.user.permissionsJson, key)) {
      return res.status(403).json({ error: 'Sem permissão para esta acção' });
    }
    next();
  };
}

function requireCaixaPermission(key) {
  return (req, res, next) => {
    if (hasFullAccess(req)) return next();
    if (!canCaixa(req.user.permissionsJson, key)) {
      return res.status(403).json({ error: 'Sem permissão para esta acção' });
    }
    next();
  };
}

function requireStockPermission(key) {
  return (req, res, next) => {
    if (hasFullAccess(req)) return next();
    if (!canStock(req.user.permissionsJson, key)) {
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
  if (hasFullAccess(req)) return next();
  return res.status(403).json({ error: 'Sem permissão para eliminar' });
}

module.exports = {
  parsePermissions,
  intersectPermissions,
  canPerform,
  canComercial,
  canCaixa,
  canStock,
  canTaskAssignment,
  requirePermission,
  requireComercialPermission,
  requireCaixaPermission,
  requireStockPermission,
  requireDeletePermission,
};
