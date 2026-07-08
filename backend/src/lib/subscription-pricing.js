'use strict';

/**
 * Catálogo de preços das subscrições (fonte de verdade no servidor).
 *
 * Espelha REGISTER_PRICING de frontend/src/lib/plan-utils.ts.
 * O valor a cobrar é SEMPRE resolvido aqui — nunca confiar no valor
 * enviado pelo cliente.
 *
 * Preços em Kwanzas (AOA). `monthly` = valor por mês.
 * `annual` = valor total cobrado de uma vez por 12 meses (com desconto).
 */

const { normalizePlan, DEFAULT_PLAN } = require('./plans');
const { normalizeWorkspaceMode, DEFAULT_WORKSPACE_MODE } = require('./plan-limits');

const CYCLES = ['monthly', 'annual'];
const DEFAULT_CYCLE = 'monthly';

const PRICING = {
  servicos: {
    essencial: { monthly: 14999, annual: 115000 },
    profissional: { monthly: 34999, annual: 270000 },
    enterprise: { monthly: 64999, annual: 500000 },
  },
  comercio: {
    essencial: { monthly: 9999, annual: 75000 },
    profissional: { monthly: 22999, annual: 175000 },
    enterprise: { monthly: 44999, annual: 340000 },
  },
};

function normalizeCycle(cycle) {
  return CYCLES.includes(cycle) ? cycle : DEFAULT_CYCLE;
}

/**
 * Devolve o valor (Kz) para um plano/ciclo/workspace.
 */
function getSubscriptionPrice(workspaceMode, plan, cycle) {
  const wm = normalizeWorkspaceMode(workspaceMode);
  const p = normalizePlan(plan);
  const c = normalizeCycle(cycle);
  const workspacePricing = PRICING[wm] || PRICING[DEFAULT_WORKSPACE_MODE];
  const planPricing = workspacePricing[p] || workspacePricing[DEFAULT_PLAN];
  return planPricing[c];
}

/**
 * Duração (dias) que cada ciclo adiciona ao expiresAt.
 */
function getCycleDurationDays(cycle) {
  return normalizeCycle(cycle) === 'annual' ? 365 : 30;
}

/**
 * Catálogo serializado para o frontend (preços do workspace pedido).
 */
function getPricingCatalog(workspaceMode) {
  const wm = normalizeWorkspaceMode(workspaceMode);
  const workspacePricing = PRICING[wm] || PRICING[DEFAULT_WORKSPACE_MODE];
  return {
    workspaceMode: wm,
    currency: 'AOA',
    plans: Object.fromEntries(
      Object.entries(workspacePricing).map(([plan, prices]) => [plan, { ...prices }])
    ),
  };
}

module.exports = {
  CYCLES,
  DEFAULT_CYCLE,
  normalizeCycle,
  getSubscriptionPrice,
  getCycleDurationDays,
  getPricingCatalog,
};
