'use strict';

/**
 * Billing de subscrição: liga o gateway E+ Kwanza (ekwanza-payment.service)
 * ao sistema de subscrição do CRM (User.plan / billingType / expiresAt / accountStatus).
 *
 * Fluxo:
 *  - createSubscriptionCharge: resolve o preço no servidor, regista o pagamento,
 *    cobra via gateway. GPO confirma de imediato -> ativa a conta.
 *  - handleCallbackConfirmation: confirmação assíncrona (sobretudo REF) -> ativa.
 *  - activateSubscription: estende o acesso e reativa a conta.
 */

const prisma = require('../lib/prisma');
const ekwanza = require('./ekwanza-payment.service');
const { normalizePlan } = require('../lib/plans');
const {
  normalizeWorkspaceMode,
  invalidatePlanContextCache,
} = require('../lib/plan-limits');
const {
  getSubscriptionPrice,
  getCycleDurationDays,
  normalizeCycle,
} = require('../lib/subscription-pricing');
const { invalidateAuthUserCacheByUserId } = require('../middleware/auth');

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Estende o acesso da conta e reativa-a após pagamento confirmado.
 */
async function activateSubscription(ownerUserId, plan, cycle) {
  const normalizedPlan = normalizePlan(plan);
  const durationDays = getCycleDurationDays(cycle);
  const now = new Date();

  await prisma.user.update({
    where: { id: ownerUserId },
    data: {
      plan: normalizedPlan,
      billingType: 'paid',
      expiresAt: addDays(now, durationDays),
      trialEndsAt: null,
      graceEndsAt: null,
      accountStatus: 'active',
    },
  });

  // Garantir que o novo estado é lido de imediato (sem esperar pelo TTL dos caches).
  invalidatePlanContextCache(ownerUserId);
  invalidateAuthUserCacheByUserId(ownerUserId);
}

/**
 * Cria uma cobrança de subscrição e, se confirmada de imediato (GPO), ativa a conta.
 *
 * @param {Object} params
 * @param {number} params.ownerUserId   Dono da conta (req.user.effectiveUserId)
 * @param {string} params.workspaceMode Workspace da conta (servicos|comercio)
 * @param {string} params.plan          essencial|profissional|enterprise
 * @param {string} params.cycle         monthly|annual
 * @param {'GPO'|'REF'} params.method
 * @param {string} [params.phoneNumber] Obrigatório para GPO
 */
async function createSubscriptionCharge({
  ownerUserId,
  workspaceMode,
  plan,
  cycle,
  method,
  phoneNumber,
}) {
  const normalizedPlan = normalizePlan(plan);
  const normalizedWorkspace = normalizeWorkspaceMode(workspaceMode);
  const normalizedCycle = normalizeCycle(cycle);
  const amount = getSubscriptionPrice(normalizedWorkspace, normalizedPlan, normalizedCycle);

  const merchantTransactionId = ekwanza.generateMerchantTransactionId('SUB');
  const description = `Subscricao ${normalizedPlan} ${normalizedCycle}`.slice(0, 50);

  // Regista o pagamento como pendente antes de chamar o gateway.
  await prisma.subscriptionPayment.create({
    data: {
      userId: ownerUserId,
      plan: normalizedPlan,
      workspaceMode: normalizedWorkspace,
      cycle: normalizedCycle,
      amount,
      method,
      merchantTransactionId,
      status: 'pending',
    },
  });

  let result;
  try {
    result = await ekwanza.createCharge({
      amount,
      method,
      description,
      phoneNumber,
      merchantTransactionId,
    });
  } catch (error) {
    await prisma.subscriptionPayment.update({
      where: { merchantTransactionId },
      data: {
        status: 'failed',
        gatewayCode: error.gatewayCode != null ? String(error.gatewayCode) : error.code || null,
        gatewayMessage: error.message || null,
        raw: safeJson(error.data),
      },
    });
    throw error;
  }

  // GPO devolve o resultado final de imediato; REF fica pendente até ao callback.
  const isPaid = method === 'GPO' && result.successful;
  await prisma.subscriptionPayment.update({
    where: { merchantTransactionId },
    data: {
      status: isPaid ? 'paid' : method === 'GPO' ? 'failed' : 'pending',
      providerTransactionId: result.providerTransactionId || null,
      reference: result.reference || null,
      gatewayCode: result.gatewayCode != null ? String(result.gatewayCode) : null,
      gatewayMessage: result.message || null,
      raw: safeJson(result.raw),
      paidAt: isPaid ? new Date() : null,
    },
  });

  if (isPaid) {
    await activateSubscription(ownerUserId, normalizedPlan, normalizedCycle);
  }

  return {
    merchantTransactionId,
    amount,
    method,
    plan: normalizedPlan,
    cycle: normalizedCycle,
    status: isPaid ? 'paid' : method === 'GPO' ? 'failed' : 'pending',
    successful: result.successful,
    providerTransactionId: result.providerTransactionId || null,
    reference: result.reference || null,
    message: result.message || null,
    gatewayCode: result.gatewayCode ?? null,
  };
}

/**
 * Confirmação assíncrona via callback do gateway (AppyPay GPO/REF).
 * operationStatus: 1=pago, 3=cancelado/expirado, 4=falhado, 5=erro.
 */
async function handleCallbackConfirmation({ merchantTransactionId, operationStatus }) {
  if (!merchantTransactionId) return { handled: false };

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { merchantTransactionId },
  });
  if (!payment) return { handled: false };

  // Já processado (idempotência).
  if (payment.status === 'paid') return { handled: true, alreadyPaid: true };

  const status = Number(operationStatus);
  if (status === 1) {
    await prisma.subscriptionPayment.update({
      where: { merchantTransactionId },
      data: { status: 'paid', paidAt: new Date() },
    });
    await activateSubscription(payment.userId, payment.plan, payment.cycle);
    return { handled: true, activated: true };
  }

  const newStatus = status === 3 ? 'expired' : 'failed';
  await prisma.subscriptionPayment.update({
    where: { merchantTransactionId },
    data: { status: newStatus },
  });
  return { handled: true, activated: false };
}

async function getPaymentStatus(ownerUserId, merchantTransactionId) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { merchantTransactionId },
    select: {
      userId: true,
      status: true,
      plan: true,
      cycle: true,
      amount: true,
      method: true,
      reference: true,
      merchantTransactionId: true,
      gatewayMessage: true,
    },
  });
  if (!payment || payment.userId !== ownerUserId) return null;
  return payment;
}

function safeJson(value) {
  if (value == null) return null;
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return null;
  }
}

module.exports = {
  activateSubscription,
  createSubscriptionCharge,
  handleCallbackConfirmation,
  getPaymentStatus,
};
