const express = require('express');
const prisma = require('../lib/prisma');
const { getPlanContext } = require('../lib/plan-limits');
const requireAuth = require('../middleware/auth');

const router = express.Router();
const FLOW_KEY = 'onboarding_v2';
const WELCOME_FLOW_KEY = 'welcome_v1';
const GLOBAL_WORKSPACE_MODE = 'global';
const AUTO_SHOW_WINDOW_MS = 5 * 60_000;

const SERVICOS_STEPS = [
  { id: 'setup_company', label: 'Complete os dados da empresa', href: '/faturacao/configuracao' },
  { id: 'add_contact', label: 'Crie o primeiro contacto', href: '/contacts' },
  { id: 'setup_pipeline', label: 'Configure o primeiro Processo de Venda', href: '/pipeline' },
  { id: 'create_task', label: 'Crie uma tarefa', href: '/tasks' },
  { id: 'create_invoice', label: 'Emita a primeira fatura', href: '/faturacao/nova' },
];

const COMERCIO_STEPS = [
  { id: 'setup_company', label: 'Complete os dados da empresa', href: '/faturacao/configuracao' },
  { id: 'add_product', label: 'Adicione o primeiro produto', href: '/produtos' },
  { id: 'open_cash', label: 'Abra o caixa', href: '/caixa' },
  { id: 'first_sale', label: 'Faça a primeira venda', href: '/vendas-rapidas' },
  { id: 'invite_member', label: 'Convide a equipa', href: '/configuracoes?tab=equipa' },
];

const FINAL_MESSAGES = {
  servicos: 'Conta configurada com sucesso.',
  comercio: 'Operação pronta para uso.',
};

const CHECKS = {
  setup_company: async (uid) => {
    const cfg = await prisma.configuracaoFaturacao.findUnique({
      where: { userId: uid },
      select: { nifEmpresa: true, nomeEmpresa: true },
    });
    return !!(cfg && (cfg.nifEmpresa?.trim() || cfg.nomeEmpresa?.trim()));
  },
  add_contact: async (uid, workspaceMode) => {
    const count = await prisma.contact.count({
      where: {
        userId: uid,
        ...(workspaceMode === 'comercio' ? { contactType: 'cliente' } : {}),
      },
    });
    return count > 0;
  },
  setup_pipeline: async (uid) => {
    const count = await prisma.pipelineStage.count({ where: { userId: uid } });
    return count > 0;
  },
  create_task: async (uid) => {
    const count = await prisma.task.count({ where: { userId: uid } });
    return count > 0;
  },
  create_invoice: async (uid) => {
    const count = await prisma.factura.count({ where: { userId: uid } });
    return count > 0;
  },
  add_product: async (uid) => {
    const count = await prisma.produto.count({ where: { userId: uid, active: true } });
    return count > 0;
  },
  open_cash: async (uid) => {
    const count = await prisma.caixaSessao.count({ where: { userId: uid } });
    return count > 0;
  },
  first_sale: async (uid) => {
    const count = await prisma.factura.count({ where: { userId: uid } });
    return count > 0;
  },
  invite_member: async (uid) => {
    const count = await prisma.user.count({ where: { accountOwnerId: uid, active: true } });
    return count > 0;
  },
};

const cache = new Map();
const CACHE_TTL = 60_000;

function getViewerScope(user) {
  if (user?.isSuperAdmin) return 'superadmin';
  if (user?.isAccountOwner) return 'owner';
  if (user?.role === 'admin') return 'admin';
  return 'member';
}

function getCacheKey(orgId, workspaceMode, viewerScope) {
  return `${FLOW_KEY}:${orgId}:${workspaceMode}:${viewerScope}`;
}

function getWelcomeCacheKey(orgId, viewerScope) {
  return `${WELCOME_FLOW_KEY}:${orgId}:${viewerScope}`;
}

function getStepDefinitions(workspaceMode) {
  return workspaceMode === 'comercio' ? COMERCIO_STEPS : SERVICOS_STEPS;
}

function wasCreatedRecently(record) {
  const createdAt = record?.created_at instanceof Date
    ? record.created_at.getTime()
    : new Date(record?.created_at || 0).getTime();

  return Number.isFinite(createdAt) && Date.now() - createdAt <= AUTO_SHOW_WINDOW_MS;
}

async function getWorkspaceMode(orgId) {
  const planContext = await getPlanContext(orgId);
  return planContext.workspaceMode === 'comercio' ? 'comercio' : 'servicos';
}

function canSeeOnboarding(user) {
  return !!(user?.isSuperAdmin || user?.isAccountOwner || user?.role === 'admin');
}

async function ensureRecord(orgId, workspaceMode) {
  return prisma.onboardingProgress.upsert({
    where: {
      organization_id_workspace_mode_flow_key: {
        organization_id: String(orgId),
        workspace_mode: workspaceMode,
        flow_key: FLOW_KEY,
      },
    },
    create: {
      organization_id: String(orgId),
      workspace_mode: workspaceMode,
      flow_key: FLOW_KEY,
    },
    update: {},
  });
}

async function hasAccountDismissedOnboarding(orgId) {
  const dismissedRecord = await prisma.onboardingProgress.findFirst({
    where: {
      organization_id: String(orgId),
      flow_key: FLOW_KEY,
      dismissed: true,
    },
    select: { id: true },
  });
  return Boolean(dismissedRecord);
}

async function ensureWelcomeRecord(orgId) {
  return prisma.onboardingProgress.upsert({
    where: {
      organization_id_workspace_mode_flow_key: {
        organization_id: String(orgId),
        workspace_mode: GLOBAL_WORKSPACE_MODE,
        flow_key: WELCOME_FLOW_KEY,
      },
    },
    create: {
      organization_id: String(orgId),
      workspace_mode: GLOBAL_WORKSPACE_MODE,
      flow_key: WELCOME_FLOW_KEY,
    },
    update: {},
  });
}

async function computeOnboarding(orgId, workspaceMode) {
  const steps = await Promise.all(
    getStepDefinitions(workspaceMode).map(async (step) => {
      const check = CHECKS[step.id];
      const completed = check ? await check(orgId, workspaceMode).catch(() => false) : false;
      return { ...step, completed };
    })
  );
  return steps;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    if (!canSeeOnboarding(req.user)) {
      return res.json({ show: false, dismissed: false, completedCount: 0, totalCount: 0, steps: [] });
    }

    const orgId = req.user.effectiveUserId;
    const workspaceMode = await getWorkspaceMode(orgId);
    const viewerScope = getViewerScope(req.user);
    const cacheKey = getCacheKey(orgId, workspaceMode, viewerScope);
    const welcomeCacheKey = getWelcomeCacheKey(orgId, viewerScope);
    const cached = cache.get(cacheKey);
    const cachedWelcome = cache.get(welcomeCacheKey);
    if (cached && cached.expiresAt > Date.now() && cachedWelcome && cachedWelcome.expiresAt > Date.now()) {
      return res.json({ ...cached.data, welcome: cachedWelcome.data });
    }

    const record = await ensureRecord(orgId, workspaceMode);
    const welcomeRecord = await ensureWelcomeRecord(orgId);
    const accountDismissed = record.dismissed || await hasAccountDismissedOnboarding(orgId);
    const steps = await computeOnboarding(orgId, workspaceMode);
    const completedSteps = steps.filter((step) => step.completed).map((step) => step.id);
    const completedCount = completedSteps.length;
    const totalCount = steps.length;
    const allDone = totalCount > 0 && completedCount === totalCount;
    const shouldShowOnboarding = !accountDismissed && !allDone && (
      Boolean(record.reopened_at) || wasCreatedRecently(record)
    );
    const shouldAutoDismissOnboarding = shouldShowOnboarding && !record.reopened_at;
    const shouldShowWelcome = !welcomeRecord.dismissed && wasCreatedRecently(welcomeRecord);

    await Promise.all([
      prisma.onboardingProgress.update({
        where: {
          organization_id_workspace_mode_flow_key: {
            organization_id: String(orgId),
            workspace_mode: workspaceMode,
            flow_key: FLOW_KEY,
          },
        },
        data: {
          completed_steps: completedSteps,
          completed_at: allDone ? record.completed_at ?? new Date() : null,
          ...(shouldAutoDismissOnboarding ? {
            dismissed: true,
            dismissed_at: record.dismissed_at ?? new Date(),
          } : {}),
        },
      }),
      shouldShowWelcome
        ? prisma.onboardingProgress.update({
          where: {
            organization_id_workspace_mode_flow_key: {
              organization_id: String(orgId),
              workspace_mode: GLOBAL_WORKSPACE_MODE,
              flow_key: WELCOME_FLOW_KEY,
            },
          },
          data: {
            dismissed: true,
            dismissed_at: welcomeRecord.dismissed_at ?? new Date(),
          },
        })
        : Promise.resolve(),
    ]);

    const payload = {
      show: shouldShowOnboarding,
      dismissed: accountDismissed,
      completedCount,
      totalCount,
      allDone,
      finalMessage: FINAL_MESSAGES[workspaceMode],
      workspaceMode,
      flowKey: FLOW_KEY,
      welcome: {
        show: shouldShowWelcome,
        dismissed: welcomeRecord.dismissed,
        flowKey: WELCOME_FLOW_KEY,
      },
      steps,
    };

    const cachedPayload = {
      ...payload,
      show: shouldAutoDismissOnboarding ? false : payload.show,
      dismissed: shouldAutoDismissOnboarding ? true : payload.dismissed,
      welcome: {
        ...payload.welcome,
        show: shouldShowWelcome ? false : payload.welcome.show,
        dismissed: shouldShowWelcome ? true : payload.welcome.dismissed,
      },
    };

    cache.set(cacheKey, { data: cachedPayload, expiresAt: Date.now() + CACHE_TTL });
    cache.set(welcomeCacheKey, { data: cachedPayload.welcome, expiresAt: Date.now() + CACHE_TTL });
    return res.json(payload);
  } catch (err) {
    console.error('[onboarding] GET error:', err);
    return res.json({ show: false, dismissed: false, completedCount: 0, totalCount: 0, steps: [] });
  }
});

router.post('/welcome/dismiss', requireAuth, async (req, res) => {
  try {
    const orgId = req.user.effectiveUserId;
    await prisma.onboardingProgress.upsert({
      where: {
        organization_id_workspace_mode_flow_key: {
          organization_id: String(orgId),
          workspace_mode: GLOBAL_WORKSPACE_MODE,
          flow_key: WELCOME_FLOW_KEY,
        },
      },
      create: {
        organization_id: String(orgId),
        workspace_mode: GLOBAL_WORKSPACE_MODE,
        flow_key: WELCOME_FLOW_KEY,
        dismissed: true,
        dismissed_at: new Date(),
      },
      update: {
        dismissed: true,
        dismissed_at: new Date(),
      },
    });
    cache.clear();
    return res.json({ success: true });
  } catch (err) {
    console.error('[onboarding] welcome dismiss error:', err);
    return res.status(500).json({ error: 'Failed to dismiss welcome onboarding' });
  }
});

router.post('/dismiss', requireAuth, async (req, res) => {
  try {
    const orgId = req.user.effectiveUserId;
    const workspaceMode = await getWorkspaceMode(orgId);
    await prisma.$transaction([
      prisma.onboardingProgress.updateMany({
        where: {
          organization_id: String(orgId),
          flow_key: FLOW_KEY,
        },
        data: {
          dismissed: true,
          dismissed_at: new Date(),
        },
      }),
      prisma.onboardingProgress.upsert({
        where: {
          organization_id_workspace_mode_flow_key: {
            organization_id: String(orgId),
            workspace_mode: workspaceMode,
            flow_key: FLOW_KEY,
          },
        },
        create: {
          organization_id: String(orgId),
          workspace_mode: workspaceMode,
          flow_key: FLOW_KEY,
          dismissed: true,
          dismissed_at: new Date(),
        },
        update: {
          dismissed: true,
          dismissed_at: new Date(),
        },
      }),
    ]);
    cache.clear();
    return res.json({ success: true });
  } catch (err) {
    console.error('[onboarding] dismiss error:', err);
    return res.status(500).json({ error: 'Failed to dismiss onboarding' });
  }
});

router.post('/reopen', requireAuth, async (req, res) => {
  try {
    const orgId = req.user.effectiveUserId;
    const workspaceMode = await getWorkspaceMode(orgId);
    await prisma.$transaction([
      prisma.onboardingProgress.updateMany({
        where: {
          organization_id: String(orgId),
          flow_key: FLOW_KEY,
        },
        data: {
          dismissed: false,
          reopened_at: new Date(),
        },
      }),
      prisma.onboardingProgress.upsert({
        where: {
          organization_id_workspace_mode_flow_key: {
            organization_id: String(orgId),
            workspace_mode: workspaceMode,
            flow_key: FLOW_KEY,
          },
        },
        create: {
          organization_id: String(orgId),
          workspace_mode: workspaceMode,
          flow_key: FLOW_KEY,
          reopened_at: new Date(),
        },
        update: {
          dismissed: false,
          reopened_at: new Date(),
        },
      }),
    ]);
    cache.clear();
    return res.json({ success: true });
  } catch (err) {
    console.error('[onboarding] reopen error:', err);
    return res.status(500).json({ error: 'Failed to reopen onboarding' });
  }
});

module.exports = router;
