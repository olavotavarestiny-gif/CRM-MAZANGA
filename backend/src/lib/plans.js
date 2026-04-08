'use strict';

const SUPPORTED_PLANS = ['essencial', 'profissional', 'enterprise'];
const DEFAULT_PLAN = 'essencial';
const PLAN_ALIASES = {
  inicial: 'essencial',
  crescimento: 'profissional',
  estabilidade: 'enterprise',
};

function isSupportedPlan(plan) {
  if (!plan) return false;
  const normalized = String(plan).trim().toLowerCase();
  return SUPPORTED_PLANS.includes(normalized) || Object.prototype.hasOwnProperty.call(PLAN_ALIASES, normalized);
}

function normalizePlan(plan) {
  if (!plan) return DEFAULT_PLAN;
  const normalized = String(plan).trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(PLAN_ALIASES, normalized)) {
    return PLAN_ALIASES[normalized];
  }
  if (SUPPORTED_PLANS.includes(normalized)) return normalized;
  return DEFAULT_PLAN;
}

module.exports = {
  SUPPORTED_PLANS,
  DEFAULT_PLAN,
  isSupportedPlan,
  normalizePlan,
};
