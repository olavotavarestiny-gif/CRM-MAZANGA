'use strict';

const prisma = require('./prisma');

const GRACE_DAYS = 5;
const WARNING_DAYS = 7;
const STATUS_ACTIVE = 'active';
const STATUS_GRACE = 'grace_period';
const STATUS_SUSPENDED = 'suspended';

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function differenceInCalendarDays(target, now = new Date()) {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.ceil((end - start) / 86_400_000);
}

function getAccessEndDate(account) {
  if (account.billingType === 'trial') return account.trialEndsAt || account.expiresAt || null;
  return account.expiresAt || account.trialEndsAt || null;
}

function buildSubscriptionState(account, now = new Date()) {
  const accessEndsAt = getAccessEndDate(account);
  let status = account.accountStatus || STATUS_ACTIVE;
  let graceEndsAt = account.graceEndsAt || null;

  if (accessEndsAt && now > accessEndsAt) {
    graceEndsAt = graceEndsAt || addDays(accessEndsAt, GRACE_DAYS);
    status = now > graceEndsAt ? STATUS_SUSPENDED : STATUS_GRACE;
  }

  const daysUntilExpiry = accessEndsAt ? differenceInCalendarDays(accessEndsAt, now) : null;
  const showExpiryWarning =
    status === STATUS_ACTIVE &&
    daysUntilExpiry !== null &&
    daysUntilExpiry >= 0 &&
    daysUntilExpiry <= WARNING_DAYS;

  return {
    billingType: account.billingType || 'trial',
    accountStatus: status,
    planId: account.plan,
    trialEndsAt: account.trialEndsAt,
    expiresAt: account.expiresAt,
    graceEndsAt,
    accessEndsAt,
    daysUntilExpiry,
    showExpiryWarning,
    readOnly: status === STATUS_SUSPENDED,
    message:
      status === STATUS_SUSPENDED
        ? account.billingType === 'trial'
          ? 'Seu período de teste terminou. Escolha um pacote para continuar.'
          : 'Seu pacote expirou. Renove para continuar.'
        : status === STATUS_GRACE
        ? account.billingType === 'trial'
          ? 'Seu período de teste terminou. Escolha um pacote para continuar.'
          : 'Seu pacote expirou. Renove para continuar.'
        : showExpiryWarning
        ? `Seu acesso expira em ${daysUntilExpiry} dias. Renove para evitar interrupção.`
        : null,
  };
}

async function getSubscriptionState(orgId) {
  const account = await prisma.user.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      plan: true,
      billingType: true,
      trialEndsAt: true,
      expiresAt: true,
      graceEndsAt: true,
      accountStatus: true,
    },
  });

  if (!account) return null;

  const state = buildSubscriptionState(account);
  const updates = {};
  if (state.accountStatus !== account.accountStatus) updates.accountStatus = state.accountStatus;
  if (state.graceEndsAt && (!account.graceEndsAt || account.graceEndsAt.getTime() !== state.graceEndsAt.getTime())) {
    updates.graceEndsAt = state.graceEndsAt;
  }

  if (Object.keys(updates).length > 0) {
    await prisma.user.update({ where: { id: orgId }, data: updates });
  }

  return state;
}

module.exports = {
  GRACE_DAYS,
  WARNING_DAYS,
  STATUS_ACTIVE,
  STATUS_GRACE,
  STATUS_SUSPENDED,
  getSubscriptionState,
  buildSubscriptionState,
};
