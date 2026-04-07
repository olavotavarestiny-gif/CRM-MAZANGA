'use strict';

const prisma = require('./prisma');
const { DEFAULT_PLAN, SUPPORTED_PLANS, normalizePlan } = require('./plans');

const DEFAULT_WORKSPACE_MODE = 'servicos';
const PLAN_ORDER = ['essencial', 'profissional', 'enterprise'];

function normalizeWorkspaceMode(workspaceMode) {
  return workspaceMode === 'comercio' ? 'comercio' : DEFAULT_WORKSPACE_MODE;
}

const PLAN_CATALOG = {
  servicos: {
    essencial: {
      label: 'Inicial',
      description: 'Ideal para pequenas equipas a organizar operação e vendas.',
      limits: {
        users: 3,
        contacts: 500,
        tasks: 50,
        automations: 0,
      },
      features: {
        painel: true,
        clientes: true,
        processos: true,
        tarefas: true,
        vendas: false,
        conversas: false,
        calendario: true,
        automacoes: false,
        formularios: false,
        financas: false,
      },
      operationalLimits: {
        channels: 20,
        messagesPerDay: 1000,
        attachmentsPerDay: 50,
        mentionsPerMessage: 10,
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
    },
    profissional: {
      label: 'Crescimento',
      description: 'Ideal para equipas em crescimento com mais colaboração e automação.',
      limits: {
        users: 10,
        contacts: 5000,
        tasks: Infinity,
        automations: 10,
      },
      features: {
        painel: true,
        clientes: true,
        processos: true,
        tarefas: true,
        vendas: true,
        conversas: true,
        calendario: true,
        automacoes: true,
        formularios: true,
        financas: true,
      },
      operationalLimits: {
        channels: 50,
        messagesPerDay: 5000,
        attachmentsPerDay: 200,
        mentionsPerMessage: 20,
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
    },
    enterprise: {
      label: 'Estabilidade',
      description: 'Plano personalizado para operações avançadas e maior escala.',
      limits: {
        users: Infinity,
        contacts: Infinity,
        tasks: Infinity,
        automations: Infinity,
      },
      features: {
        painel: true,
        clientes: true,
        processos: true,
        tarefas: true,
        vendas: true,
        conversas: true,
        calendario: true,
        automacoes: true,
        formularios: true,
        financas: true,
      },
      operationalLimits: {
        channels: Infinity,
        messagesPerDay: Infinity,
        attachmentsPerDay: Infinity,
        mentionsPerMessage: Infinity,
        csvImportRows: Infinity,
        customFields: Infinity,
        activeDeals: Infinity,
        invoicesPerMonth: Infinity,
        products: Infinity,
        activeForms: Infinity,
        formSubmissionsPerMonth: Infinity,
        storageGb: Infinity,
        maxFileSizeMb: Infinity,
        teamMembers: Infinity,
      },
    },
  },
  comercio: {
    essencial: {
      label: 'Inicial',
      description: 'Para pequenas lojas que precisam de vender com simplicidade.',
      limits: {
        users: 0,
        contacts: 300,
        tasks: Infinity,
        automations: 0,
      },
      features: {
        painel: true,
        clientes: true,
        processos: false,
        tarefas: true,
        vendas: true,
        conversas: false,
        calendario: true,
        automacoes: false,
        formularios: false,
        financas: false,
      },
      operationalLimits: {
        channels: 20,
        messagesPerDay: 1000,
        attachmentsPerDay: 50,
        mentionsPerMessage: 10,
        csvImportRows: 500,
        customFields: 20,
        activeDeals: 0,
        invoicesPerMonth: Infinity,
        products: 100,
        activeForms: 0,
        formSubmissionsPerMonth: 0,
        storageGb: 5,
        maxFileSizeMb: 10,
        teamMembers: 0,
      },
    },
    profissional: {
      label: 'Crescimento',
      description: 'Para lojas em crescimento com mais movimento e mais controlo operacional.',
      limits: {
        users: 4,
        contacts: 3000,
        tasks: Infinity,
        automations: 0,
      },
      features: {
        painel: true,
        clientes: true,
        processos: false,
        tarefas: true,
        vendas: true,
        conversas: false,
        calendario: true,
        automacoes: false,
        formularios: false,
        financas: true,
      },
      operationalLimits: {
        channels: 50,
        messagesPerDay: 5000,
        attachmentsPerDay: 200,
        mentionsPerMessage: 20,
        csvImportRows: 5000,
        customFields: 50,
        activeDeals: 0,
        invoicesPerMonth: Infinity,
        products: 1000,
        activeForms: 0,
        formSubmissionsPerMonth: 0,
        storageGb: 50,
        maxFileSizeMb: 25,
        teamMembers: 4,
      },
    },
    enterprise: {
      label: 'Estabilidade',
      description: 'Para operações estruturadas com escala, multi-estabelecimento e controlo total.',
      limits: {
        users: Infinity,
        contacts: Infinity,
        tasks: Infinity,
        automations: 0,
      },
      features: {
        painel: true,
        clientes: true,
        processos: false,
        tarefas: true,
        vendas: true,
        conversas: false,
        calendario: true,
        automacoes: false,
        formularios: false,
        financas: true,
      },
      operationalLimits: {
        channels: Infinity,
        messagesPerDay: Infinity,
        attachmentsPerDay: Infinity,
        mentionsPerMessage: Infinity,
        csvImportRows: Infinity,
        customFields: Infinity,
        activeDeals: 0,
        invoicesPerMonth: Infinity,
        products: Infinity,
        activeForms: 0,
        formSubmissionsPerMonth: 0,
        storageGb: Infinity,
        maxFileSizeMb: Infinity,
        teamMembers: Infinity,
      },
    },
  },
};

const ACCOUNT_LIMIT_KEYS = ['users', 'contacts', 'tasks', 'automations'];

function serializeLimitValue(limit) {
  return Number.isFinite(limit) ? limit : null;
}

function serializePlanLimits(limits) {
  return Object.fromEntries(
    Object.entries(limits).map(([key, value]) => [key, serializeLimitValue(value)])
  );
}

function serializePlanFeatures(features) {
  return { ...features };
}

function getPlanCatalog(plan, workspaceMode = DEFAULT_WORKSPACE_MODE) {
  const resolvedWorkspaceMode = normalizeWorkspaceMode(workspaceMode);
  const workspaceCatalog = PLAN_CATALOG[resolvedWorkspaceMode] || PLAN_CATALOG[DEFAULT_WORKSPACE_MODE];
  return workspaceCatalog[normalizePlan(plan)] || workspaceCatalog[DEFAULT_PLAN];
}

function serializePlanCatalogEntry(entry) {
  return {
    label: entry.label,
    description: entry.description,
    limits: serializePlanLimits(entry.limits),
    features: serializePlanFeatures(entry.features),
  };
}

function getSerializedPlanCatalog(plan, workspaceMode = DEFAULT_WORKSPACE_MODE) {
  if (plan) {
    return serializePlanCatalogEntry(getPlanCatalog(plan, workspaceMode));
  }

  const resolvedWorkspaceMode = normalizeWorkspaceMode(workspaceMode);
  const workspaceCatalog = PLAN_CATALOG[resolvedWorkspaceMode] || PLAN_CATALOG[DEFAULT_WORKSPACE_MODE];

  return Object.fromEntries(
    SUPPORTED_PLANS.map((planName) => [planName, serializePlanCatalogEntry(workspaceCatalog[planName])])
  );
}

async function getPlan(effectiveUserId) {
  const owner = await prisma.user.findUnique({
    where: { id: effectiveUserId },
    select: { plan: true },
  });
  return normalizePlan(owner?.plan || DEFAULT_PLAN);
}

async function getPlanContext(effectiveUserId) {
  const owner = await prisma.user.findUnique({
    where: { id: effectiveUserId },
    select: { plan: true, workspaceMode: true },
  });

  return {
    plan: normalizePlan(owner?.plan || DEFAULT_PLAN),
    workspaceMode: normalizeWorkspaceMode(owner?.workspaceMode),
  };
}

async function getWorkspaceMode(effectiveUserId) {
  const context = await getPlanContext(effectiveUserId);
  return context.workspaceMode;
}

function getRawLimitForKey(plan, key, workspaceMode = DEFAULT_WORKSPACE_MODE) {
  const entry = getPlanCatalog(plan, workspaceMode);
  if (Object.prototype.hasOwnProperty.call(entry.limits, key)) {
    return entry.limits[key];
  }
  if (Object.prototype.hasOwnProperty.call(entry.operationalLimits, key)) {
    return entry.operationalLimits[key];
  }
  return Infinity;
}

async function getUsage(orgId, key) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  switch (key) {
    case 'users':
      return prisma.user.count({ where: { accountOwnerId: orgId, active: true } });
    case 'contacts':
      return prisma.contact.count({ where: { userId: orgId } });
    case 'tasks':
      return prisma.task.count({ where: { userId: orgId } });
    case 'automations':
      return prisma.automation.count({ where: { userId: orgId } });
    case 'channels':
      return prisma.chatChannel.count({ where: { orgId } });
    case 'messagesPerDay':
      return prisma.chatMessage.count({
        where: { channel: { orgId }, createdAt: { gte: todayStart } },
      });
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

async function getLimitState(orgId, key) {
  const { plan, workspaceMode } = await getPlanContext(orgId);
  const current = await getUsage(orgId, key);
  const rawLimit = getRawLimitForKey(plan, key, workspaceMode);

  return {
    allowed: current < rawLimit,
    current,
    limit: serializeLimitValue(rawLimit),
    plan,
    workspaceMode,
    feature: key,
    rawLimit,
  };
}

function buildLimitErrorPayload(state) {
  return {
    error: 'Limite do plano atingido. Faça upgrade.',
    plan: state.plan,
    feature: state.feature,
    current: state.current,
    limit: state.limit,
  };
}

async function assertPlanLimit(orgId, key) {
  const state = await getLimitState(orgId, key);
  if (!state.allowed) {
    const error = new Error('Limite do plano atingido. Faça upgrade.');
    error.statusCode = 403;
    error.payload = buildLimitErrorPayload(state);
    throw error;
  }
  return state;
}

async function canCreateUser(orgId) {
  return getLimitState(orgId, 'users');
}

async function canCreateContact(orgId) {
  return getLimitState(orgId, 'contacts');
}

async function canCreateTask(orgId) {
  return getLimitState(orgId, 'tasks');
}

async function canCreateAutomation(orgId) {
  return getLimitState(orgId, 'automations');
}

function hasPlanFeature(plan, feature, workspaceMode = DEFAULT_WORKSPACE_MODE) {
  const entry = getPlanCatalog(plan, workspaceMode);
  return entry.features[feature] === true;
}

async function getFeatureState(orgId, feature) {
  const { plan, workspaceMode } = await getPlanContext(orgId);
  return { plan, workspaceMode, feature, allowed: hasPlanFeature(plan, feature, workspaceMode) };
}

function requirePlanFeature(feature) {
  return async (req, res, next) => {
    try {
      const state = await getFeatureState(req.user.effectiveUserId, feature);
      if (!state.allowed) {
        return res.status(403).json({ error: 'Funcionalidade não disponível no seu plano' });
      }
      next();
    } catch (error) {
      console.error('Plan feature gate error:', error);
      res.status(500).json({ error: 'Erro ao validar plano' });
    }
  };
}

async function checkLimit(orgId, limitKey) {
  return getLimitState(orgId, limitKey);
}

async function getAllUsage(orgId) {
  const { plan, workspaceMode } = await getPlanContext(orgId);
  const entry = getPlanCatalog(plan, workspaceMode);
  const usageKeys = Object.keys(entry.operationalLimits);
  const usages = await Promise.all(usageKeys.map((key) => getUsage(orgId, key)));

  return {
    plan,
    workspaceMode,
    usage: Object.fromEntries(
      usageKeys.map((key, index) => [
        key,
        {
          current: usages[index],
          limit: serializeLimitValue(entry.operationalLimits[key]),
        },
      ])
    ),
    planDetails: {
      label: entry.label,
      description: entry.description,
    },
    planLimits: serializePlanLimits(entry.limits),
    planFeatures: serializePlanFeatures(entry.features),
  };
}

function comparePlans(plan, targetPlan) {
  return PLAN_ORDER.indexOf(normalizePlan(plan)) - PLAN_ORDER.indexOf(normalizePlan(targetPlan));
}

function isPlanAtLeast(plan, targetPlan) {
  return comparePlans(plan, targetPlan) >= 0;
}

module.exports = {
  PLAN_CATALOG,
  ACCOUNT_LIMIT_KEYS,
  DEFAULT_WORKSPACE_MODE,
  normalizeWorkspaceMode,
  getPlan,
  getPlanContext,
  getWorkspaceMode,
  getPlanCatalog,
  getSerializedPlanCatalog,
  serializePlanLimits,
  serializePlanFeatures,
  serializeLimitValue,
  comparePlans,
  isPlanAtLeast,
  hasPlanFeature,
  requirePlanFeature,
  assertPlanLimit,
  canCreateUser,
  canCreateContact,
  canCreateTask,
  canCreateAutomation,
  checkLimit,
  getAllUsage,
  getLimitState,
  buildLimitErrorPayload,
};
