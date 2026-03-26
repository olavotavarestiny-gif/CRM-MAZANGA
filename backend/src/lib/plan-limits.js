'use strict';
const prisma = require('./prisma');
const { DEFAULT_PLAN, normalizePlan } = require('./plans');

const PLAN_LIMITS = {
  essencial: {
    channels: 20,
    messagesPerDay: 1000,
    attachmentsPerDay: 50,
    mentionsPerMessage: 10,
    contacts: 1000,
    csvImportRows: 500,
    customFields: 20,
    activeDeals: 500,
    invoicesPerMonth: 200,
    products: 100,
    activeForms: 5,
    formSubmissionsPerMonth: 500,
    storageGb: 5,
    maxFileSizeMb: 10,
    teamMembers: 5,
  },
  profissional: {
    channels: 50,
    messagesPerDay: 5000,
    attachmentsPerDay: 200,
    mentionsPerMessage: 20,
    contacts: 10000,
    csvImportRows: 5000,
    customFields: 50,
    activeDeals: 2000,
    invoicesPerMonth: Infinity,
    products: 1000,
    activeForms: 20,
    formSubmissionsPerMonth: 5000,
    storageGb: 50,
    maxFileSizeMb: 25,
    teamMembers: 25,
  },
};

async function getPlan(effectiveUserId) {
  const owner = await prisma.user.findUnique({
    where: { id: effectiveUserId },
    select: { plan: true },
  });
  return normalizePlan(owner?.plan || DEFAULT_PLAN);
}

async function getUsage(orgId, key) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  switch (key) {
    case 'channels':
      return prisma.chatChannel.count({ where: { orgId } });
    case 'messagesPerDay':
      return prisma.chatMessage.count({
        where: { channel: { orgId }, createdAt: { gte: todayStart } },
      });
    case 'contacts':
      return prisma.contact.count({ where: { userId: orgId } });
    case 'activeForms':
      return prisma.form.count({ where: { userId: orgId } });
    case 'formSubmissionsPerMonth':
      return prisma.formSubmission.count({
        where: { form: { userId: orgId }, submittedAt: { gte: monthStart } },
      });
    case 'invoicesPerMonth':
      return prisma.factura.count({
        where: { userId: orgId, documentDate: { gte: monthStart }, documentStatus: 'N' },
      });
    case 'products':
      return prisma.produto.count({ where: { userId: orgId, active: true } });
    case 'customFields':
      return prisma.contactFieldDef.count({ where: { userId: orgId, active: true } });
    case 'teamMembers':
      return prisma.user.count({ where: { accountOwnerId: orgId, active: true } });
    default:
      return 0;
  }
}

async function checkLimit(effectiveUserId, limitKey) {
  const plan = await getPlan(effectiveUserId);
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS[DEFAULT_PLAN];
  const limit = limits[limitKey] ?? PLAN_LIMITS[DEFAULT_PLAN][limitKey] ?? Infinity;
  const current = await getUsage(effectiveUserId, limitKey);
  return { allowed: current < limit, current, limit, plan };
}

async function getAllUsage(orgId) {
  const plan = await getPlan(orgId);
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS[DEFAULT_PLAN];
  const keys = Object.keys(limits);
  const usages = await Promise.all(keys.map((k) => getUsage(orgId, k)));
  return {
    plan,
    usage: Object.fromEntries(keys.map((k, i) => [k, { current: usages[i], limit: limits[k] }])),
  };
}

module.exports = { PLAN_LIMITS, getPlan, checkLimit, getAllUsage };
