const { getSubscriptionState, STATUS_SUSPENDED } = require('../lib/subscription-access');
const { logRouteWarning } = require('../lib/request-log');

function isRenewalPath(path) {
  return (
    path.startsWith('/api/auth') ||
    path.startsWith('/api/account') ||
    path.startsWith('/api/payments') ||
    path.startsWith('/api/onboarding') ||
    path.startsWith('/api/startup-templates') ||
    path.startsWith('/api/superadmin') ||
    path.startsWith('/api/admin')
  );
}

async function checkSubscriptionAccess(req, res, next) {
  try {
    if (
      !req.user ||
      req.user.isDevAuthBypass ||
      req.user.isSuperAdmin ||
      isRenewalPath(req.originalUrl || req.path)
    ) return next();

    const state = await getSubscriptionState(req.user.effectiveUserId, req.user.subscriptionAccount);
    if (!state) return next();

    req.subscriptionAccess = state;
    res.setHeader('X-KukuGest-Account-Status', state.accountStatus);

    // Bloqueio total: conta suspensa não acede a nada (exceto a allowlist acima),
    // incluindo leituras. O cliente só avança depois de pagar.
    if (state.accountStatus === STATUS_SUSPENDED) {
      logRouteWarning('[subscription-access] access denied (locked)', req, {
        status: 402,
        message: state.message || 'Acesso suspenso. Renove para continuar.',
        code: state.accountStatus,
      });
      return res.status(402).json({
        error: state.message || 'Acesso suspenso. Renove para continuar.',
        accountStatus: state.accountStatus,
        billingType: state.billingType,
        locked: true,
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
