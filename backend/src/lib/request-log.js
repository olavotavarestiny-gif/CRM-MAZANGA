'use strict';

function buildSafeRequestContext(req, extra = {}) {
  return {
    route: req.originalUrl || req.url,
    method: req.method,
    userId: req.user?.id || null,
    effectiveUserId: req.user?.effectiveUserId || null,
    accessRole: req.user?.accessRole || null,
    status: extra.status,
    message: extra.message,
    code: extra.code,
    module: extra.module,
    action: extra.action,
    feature: extra.feature,
  };
}

function logRouteError(label, req, error, status = 500) {
  console.error(label, buildSafeRequestContext(req, {
    status,
    message: error?.message || String(error),
    code: error?.code || error?.name || 'ERROR',
  }));
}

function logRouteWarning(label, req, extra = {}) {
  console.warn(label, buildSafeRequestContext(req, extra));
}

module.exports = {
  logRouteError,
  logRouteWarning,
};
