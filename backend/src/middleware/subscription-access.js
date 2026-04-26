const { getSubscriptionState, STATUS_SUSPENDED } = require('../lib/subscription-access');

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isRenewalPath(path) {
  return (
    path.startsWith('/api/auth') ||
    path.startsWith('/api/onboarding') ||
    path.startsWith('/api/startup-templates') ||
    path.startsWith('/api/superadmin') ||
    path.startsWith('/api/admin')
  );
}

async function checkSubscriptionAccess(req, res, next) {
  try {
    if (!req.user || req.user.isSuperAdmin || isRenewalPath(req.originalUrl || req.path)) return next();

    const state = await getSubscriptionState(req.user.effectiveUserId);
    if (!state) return next();

    req.subscriptionAccess = state;
    res.setHeader('X-KukuGest-Account-Status', state.accountStatus);

    if (state.accountStatus === STATUS_SUSPENDED && WRITE_METHODS.has(req.method)) {
      return res.status(402).json({
        error: state.message || 'Acesso suspenso. Renove para continuar.',
        accountStatus: state.accountStatus,
        billingType: state.billingType,
        readOnly: true,
      });
    }

    return next();
  } catch (error) {
    console.error('[subscription-access] error:', error);
    return res.status(500).json({ error: 'Erro ao validar acesso da conta' });
  }
}

module.exports = {
  checkSubscriptionAccess,
};
