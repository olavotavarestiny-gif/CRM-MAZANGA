'use strict';

const SUPPORTED_PLANS = ['essencial', 'profissional', 'enterprise'];
const DEFAULT_PLAN = 'essencial';

function isSupportedPlan(plan) {
  return SUPPORTED_PLANS.includes(plan);
}

function normalizePlan(plan) {
  if (!plan) return DEFAULT_PLAN;
  if (isSupportedPlan(plan)) return plan;
  return DEFAULT_PLAN;
}

module.exports = {
  SUPPORTED_PLANS,
  DEFAULT_PLAN,
  isSupportedPlan,
  normalizePlan,
};
