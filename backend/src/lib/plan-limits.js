'use strict';

const prisma = require('./prisma');
const { DEFAULT_PLAN, SUPPORTED_PLANS, normalizePlan } = require('./plans');
const { logRouteWarning } = require('./request-log');

const DEFAULT_WORKSPACE_MODE = 'servicos';
const PLAN_ORDER = ['essencial', 'profissional', 'enterprise'];
const PLAN_CONTEXT_CACHE_TTL_MS = Math.max(0, Number(process.env.PLAN_CONTEXT_CACHE_TTL_MS || 30_000));
const PLAN_CONTEXT_CACHE_MAX_ENTRIES = Math.max(10, Number(process.env.PLAN_CONTEXT_CACHE_MAX_ENTRIES || 500));
const planContextCache = new Map();
const planContextLoaders = new Map();

function normalizeWorkspaceMode(workspaceMode) {
  if (workspaceMode === 'gestao_kpi') return 'gestao_kpi';
  if (workspaceMode === 'food') return 'food';
  return workspaceMode === 'comercio' ? 'comercio' : DEFAULT_WORKSPACE_MODE;
}

const PLAN_CATALOG = {
  servicos: {
    essencial: {
      label: 'Inicial',
      description: 'Ideal para pequenas equipas a organizar operação e vendas.',
      limits: {
        users: 1,
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
        food: false,
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
        teamMembers: 1,
      },
    },
    profissional: {
      label: 'Crescimento',
      description: 'Ideal para equipas em crescimento com mais colaboração e automação.',
      limits: {
        users: 5,
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
        food: false,
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
        teamMembers: 5,
      },
    },
    enterprise: {
      label: 'Estabilidade',
      description: 'Plano personalizado para operações avançadas e maior escala.',
      limits: {
        users: 15,
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
        food: false,
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
        teamMembers: 15,
      },
    },
  },
  comercio: {
    essencial: {
      label: 'Inicial',
      description: 'Para pequenas lojas que precisam de vender com simplicidade.',
      limits: {
        users: 1,
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
        food: false,
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
        teamMembers: 1,
      },
    },
    profissional: {
      label: 'Crescimento',
      description: 'Para lojas em crescimento com mais movimento e mais controlo operacional.',
      limits: {
        users: 5,
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
        food: false,
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
        teamMembers: 5,
      },
    },
    enterprise: {
      label: 'Estabilidade',
      description: 'Para operações estruturadas com escala, multi-estabelecimento e controlo total.',
      limits: {
        users: 15,
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
        food: false,
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
        teamMembers: 15,
      },
    },
  },
  food: {
    essencial: {
      label: 'Inicial',
      description: 'Para restaurantes pequenos a digitalizar atendimento, cozinha e catálogo.',
      limits: {
        users: 1,
        contacts: 300,
        tasks: Infinity,
        automations: 0,
      },
      features: {
        painel: true,
        clientes: true,
        processos: false,
        tarefas: false,
        vendas: true,
        conversas: false,
        calendario: false,
        automacoes: false,
        formularios: false,
        financas: false,
        food: true,
      },
      operationalLimits: {
        channels: Infinity,
        messagesPerDay: Infinity,
        attachmentsPerDay: Infinity,
        mentionsPerMessage: Infinity,
        csvImportRows: Infinity,
        customFields: Infinity,
        activeDeals: 0,
        invoicesPerMonth: 500,
        products: 80,
        foodProducts: 80,
        activeForms: 0,
        formSubmissionsPerMonth: 0,
        storageGb: 5,
        maxFileSizeMb: Infinity,
        teamMembers: 1,
      },
    },
    profissional: {
      label: 'Crescimento',
      description: 'Para operações Food com equipa, caixa e catálogo mais completo.',
      limits: {
        users: 5,
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
        calendario: false,
        automacoes: false,
        formularios: false,
        financas: true,
        food: true,
      },
      operationalLimits: {
        channels: Infinity,
        messagesPerDay: Infinity,
        attachmentsPerDay: Infinity,
        mentionsPerMessage: Infinity,
        csvImportRows: 5000,
        customFields: 50,
        activeDeals: 0,
        invoicesPerMonth: Infinity,
        products: 500,
        foodProducts: 500,
        activeForms: 0,
        formSubmissionsPerMonth: 0,
        storageGb: 50,
        maxFileSizeMb: Infinity,
        teamMembers: 5,
      },
    },
    enterprise: {
      label: 'Estabilidade',
      description: 'Para restaurantes com equipa maior, delivery e gestão operacional avançada.',
      limits: {
        users: 15,
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
        calendario: false,
        automacoes: false,
        formularios: false,
        financas: true,
        food: true,
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
        foodProducts: Infinity,
        activeForms: 0,
        formSubmissionsPerMonth: 0,
        storageGb: Infinity,
        maxFileSizeMb: Infinity,
        teamMembers: 15,
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

function getCachedPlanContext(effectiveUserId) {
  if (!PLAN_CONTEXT_CACHE_TTL_MS) return null;
  const entry = planContextCache.get(effectiveUserId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    planContextCache.delete(effectiveUserId);
    return null;
  }
  return { ...entry.context };
}

function setCachedPlanContext(effectiveUserId, context) {
  if (!PLAN_CONTEXT_CACHE_TTL_MS) return;
  planContextCache.set(effectiveUserId, {
    context: { ...context },
    expiresAt: Date.now() + PLAN_CONTEXT_CACHE_TTL_MS,
  });

  while (planContextCache.size > PLAN_CONTEXT_CACHE_MAX_ENTRIES) {
    const oldestKey = planContextCache.keys().next().value;
    if (!oldestKey) break;
    planContextCache.delete(oldestKey);
  }
}

function getRequestPlanContext(req) {
  const context = req.user?.planContext;
  if (!context?.plan) return null;
  return {
    plan: normalizePlan(context.plan),
    workspaceMode: normalizeWorkspaceMode(context.workspaceMode),
  };
}

async function getPlanContext(effectiveUserId) {
  const cached = getCachedPlanContext(effectiveUserId);
  if (cached) return cached;

  const existingLoader = planContextLoaders.get(effectiveUserId);
  if (existingLoader) {
    return { ...(await existingLoader) };
  }

  const loader = prisma.user.findUnique({
    where: { id: effectiveUserId },
    select: { plan: true, workspaceMode: true },
  }).then((owner) => {
    const context = {
      plan: normalizePlan(owner?.plan || DEFAULT_PLAN),
      workspaceMode: normalizeWorkspaceMode(owner?.workspaceMode),
    };
    setCachedPlanContext(effectiveUserId, context);
    return context;
  }).finally(() => {
    planContextLoaders.delete(effectiveUserId);
  });

  planContextLoaders.set(effectiveUserId, loader);
  return { ...(await loader) };
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
    case 'users': {
      const [homeCount, guestCount] = await Promise.all([
        prisma.user.count({ where: { accountOwnerId: orgId, active: true } }),
        prisma.accountMembership.count({ where: { accountOwnerId: orgId, active: true } }),
      ]);
      return homeCount + guestCount + 1;
    }
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
    case 'foodProducts':
      return prisma.foodProduct.count({ where: { userId: orgId, active: true } });
    case 'customFields':
      return prisma.contactFieldDef.count({ where: { userId: orgId, active: true } });
    case 'teamMembers': {
      const [homeCount, guestCount] = await Promise.all([
        prisma.user.count({ where: { accountOwnerId: orgId, active: true } }),
        prisma.accountMembership.count({ where: { accountOwnerId: orgId, active: true } }),
      ]);
      return homeCount + guestCount + 1;
    }
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
      if (req.user?.isDevAuthBypass) {
        return next();
      }

      const context = getRequestPlanContext(req) || await getPlanContext(req.user.effectiveUserId);
      const state = {
        ...context,
        feature,
        allowed: hasPlanFeature(context.plan, feature, context.workspaceMode),
      };
      if (!state.allowed) {
        logRouteWarning('[plan-feature] denied', req, {
          status: 403,
          message: 'Funcionalidade não disponível no seu plano',
          feature,
          code: state.plan,
        });
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
