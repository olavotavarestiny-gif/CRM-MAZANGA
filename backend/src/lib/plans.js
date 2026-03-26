'use strict';

const SUPPORTED_PLANS = ['essencial', 'profissional'];
const DEFAULT_PLAN = 'essencial';
const LEGACY_PLAN_FALLBACKS = {
  enterprise: 'profissional',
};

function isSupportedPlan(plan) {
  return SUPPORTED_PLANS.includes(plan);
}

function normalizePlan(plan) {
  if (!plan) return DEFAULT_PLAN;
  if (isSupportedPlan(plan)) return plan;
  if (plan in LEGACY_PLAN_FALLBACKS) return LEGACY_PLAN_FALLBACKS[plan];
  return DEFAULT_PLAN;
}

module.exports = {
  SUPPORTED_PLANS,
  DEFAULT_PLAN,
  isSupportedPlan,
  normalizePlan,
};
