const express = require('express');
const prisma = require('../lib/prisma');
const { getPlanContext, hasPlanFeature, isPlanAtLeast } = require('../lib/plan-limits');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// ─── Step definitions ─────────────────────────────────────────────────────────

const SERVICOS_STEPS = [
  {
    id: 'add_contact',
    label: 'Adiciona o teu primeiro contacto',
    href: '/contacts',
    isPlanVisible: ({ plan, workspaceMode }) => hasPlanFeature(plan, 'clientes', workspaceMode),
  },
  {
    id: 'setup_pipeline',
    label: 'Cria uma etapa em Processos de Venda',
    href: '/pipeline',
    isPlanVisible: ({ plan, workspaceMode }) => hasPlanFeature(plan, 'processos', workspaceMode),
  },
  {
    id: 'create_task',
    label: 'Cria a tua primeira tarefa',
    href: '/tasks',
    isPlanVisible: ({ plan, workspaceMode }) => hasPlanFeature(plan, 'tarefas', workspaceMode),
  },
  {
    id: 'create_form',
    label: 'Cria um formulário de captura de leads',
    href: '/forms',
    isPlanVisible: ({ plan, workspaceMode }) => hasPlanFeature(plan, 'formularios', workspaceMode),
  },
  {
    id: 'setup_billing',
    label: 'Configura os dados da empresa',
    href: '/faturacao/configuracao',
    isPlanVisible: ({ plan, workspaceMode }) => hasPlanFeature(plan, 'vendas', workspaceMode),
    isViewerVisible: ({ canManageCompanySettings }) => canManageCompanySettings,
  },
  {
    id: 'create_invoice',
    label: 'Emite a tua primeira fatura',
    href: '/faturacao/nova',
    isPlanVisible: ({ plan, workspaceMode }) => hasPlanFeature(plan, 'vendas', workspaceMode),
  },
];

const COMERCIO_STEPS = [
  {
    id: 'setup_store',
    label: 'Configura empresa e ponto de venda',
    href: '/faturacao/configuracao',
    isPlanVisible: ({ plan, workspaceMode }) => hasPlanFeature(plan, 'vendas', workspaceMode),
    isViewerVisible: ({ canManageCompanySettings }) => canManageCompanySettings,
  },
  {
    id: 'add_product',
    label: 'Adiciona os teus primeiros produtos',
    href: '/produtos',
    isPlanVisible: ({ plan, workspaceMode }) => hasPlanFeature(plan, 'vendas', workspaceMode),
  },
  {
    id: 'add_contact',
    label: 'Adiciona o teu primeiro cliente',
    href: '/contacts',
    isPlanVisible: ({ plan, workspaceMode }) => hasPlanFeature(plan, 'clientes', workspaceMode),
  },
  {
    id: 'create_task',
    label: 'Cria a tua primeira tarefa',
    href: '/tasks',
    isPlanVisible: ({ plan, workspaceMode }) => hasPlanFeature(plan, 'tarefas', workspaceMode),
  },
  {
    id: 'open_cash',
    label: 'Abre a primeira sessão de caixa',
    href: '/caixa',
    isPlanVisible: ({ plan }) => isPlanAtLeast(plan, 'profissional'),
  },
  {
    id: 'first_sale',
    label: 'Faz a tua primeira venda',
    href: '/vendas-rapidas',
    isPlanVisible: ({ plan, workspaceMode }) =>
      hasPlanFeature(plan, 'vendas', workspaceMode) && isPlanAtLeast(plan, 'profissional'),
  },
  {
    id: 'invite_member',
    label: 'Convida um membro da equipa',
    href: '/configuracoes?tab=equipa',
    isPlanVisible: ({ plan }) => isPlanAtLeast(plan, 'profissional'),
    isViewerVisible: ({ canManageTeam }) => canManageTeam,
  },
];

// ─── Detection checks ─────────────────────────────────────────────────────────

const CHECKS = {
  add_contact: async (uid, workspaceMode) => {
    const n = await prisma.contact.count({
      where: {
        userId: uid,
        ...(workspaceMode === 'comercio' ? { contactType: 'cliente' } : {}),
      },
    });
    return n > 0;
  },
  setup_pipeline: async (uid) => {
    const n = await prisma.pipelineStage.count({ where: { userId: uid } });
    return n > 0;
  },
  create_task: async (uid) => {
    const n = await prisma.task.count({ where: { userId: uid } });
    return n > 0;
  },
  create_form: async (uid) => {
    const n = await prisma.form.count({ where: { userId: uid } });
    return n > 0;
  },
  setup_store: async (uid) => {
    const [cfg, estabelecimentos] = await Promise.all([
      prisma.configuracaoFaturacao.findUnique({
        where: { userId: uid },
        select: { nifEmpresa: true },
      }),
      prisma.estabelecimento.count({ where: { userId: uid } }),
    ]);
    return !!(cfg && cfg.nifEmpresa && cfg.nifEmpresa.trim() !== '' && estabelecimentos > 0);
  },
  setup_billing: async (uid) => {
    const cfg = await prisma.configuracaoFaturacao.findUnique({
      where: { userId: uid },
      select: { nifEmpresa: true },
    });
    return !!(cfg && cfg.nifEmpresa && cfg.nifEmpresa.trim() !== '');
  },
  create_invoice: async (uid) => {
    const n = await prisma.factura.count({ where: { userId: uid } });
    return n > 0;
  },
  add_product: async (uid) => {
    const n = await prisma.produto.count({ where: { userId: uid } });
    return n > 0;
  },
  open_cash: async (uid) => {
    const n = await prisma.caixaSessao.count({ where: { userId: uid } });
    return n > 0;
  },
  first_sale: async (uid) => {
    const n = await prisma.factura.count({ where: { userId: uid } });
    return n > 0;
  },
  invite_member: async (uid) => {
    const n = await prisma.user.count({ where: { accountOwnerId: uid } });
    return n > 0;
  },
};

// ─── 60s in-memory cache ──────────────────────────────────────────────────────

const cache = new Map();
const CACHE_TTL = 60_000;

function getViewerScope(user) {
  if (user?.isSuperAdmin) return 'superadmin';
  if (user?.isAccountOwner) return 'owner';
  if (user?.role === 'admin') return 'admin';
  return 'member';
}

function getCacheKey(orgId, workspaceMode, plan, viewerScope) {
  return `${orgId}:${workspaceMode}:${plan}:${viewerScope}`;
}

function getCached(orgId, workspaceMode, plan, viewerScope) {
  const entry = cache.get(getCacheKey(orgId, workspaceMode, plan, viewerScope));
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  return null;
}

function setCache(orgId, workspaceMode, plan, viewerScope, data) {
  cache.set(getCacheKey(orgId, workspaceMode, plan, viewerScope), {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });
}

function buildOnboardingContext(user, planContext) {
  const workspaceMode = planContext.workspaceMode === 'comercio' ? 'comercio' : 'servicos';

  return {
    ...planContext,
    workspaceMode,
    viewerScope: getViewerScope(user),
    canManageCompanySettings: !!(user?.isSuperAdmin || user?.isAccountOwner),
    canManageTeam: !!(
      user?.isSuperAdmin ||
      (
        user?.isAccountOwner &&
        (workspaceMode !== 'comercio' || planContext.plan !== 'essencial')
      )
    ),
  };
}

function getStepDefinitions(workspaceMode) {
  return workspaceMode === 'comercio' ? COMERCIO_STEPS : SERVICOS_STEPS;
}

function isPlanVisible(step, context) {
  return typeof step.isPlanVisible === 'function' ? step.isPlanVisible(context) : true;
}

function isViewerVisible(step, context) {
  return typeof step.isViewerVisible === 'function' ? step.isViewerVisible(context) : true;
}

// ─── Core logic ───────────────────────────────────────────────────────────────

async function computeOnboarding(orgId, context) {
  const workspaceMode = context.workspaceMode;
  const planScopedSteps = getStepDefinitions(workspaceMode).filter((step) => isPlanVisible(step, context));

  const results = await Promise.all(
    planScopedSteps.map(async (step) => {
      const check = CHECKS[step.id];
      const completed = check ? await check(parseInt(orgId, 10), workspaceMode).catch(() => false) : false;
      return { ...step, completed };
    })
  );

  return {
    allSteps: results,
    steps: results.filter((step) => isViewerVisible(step, context)),
  };
}

// ─── GET /api/onboarding ──────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const orgId = String(req.user.effectiveUserId);
    const planContext = await getPlanContext(req.user.effectiveUserId);
    const context = buildOnboardingContext(req.user, planContext);
    const { workspaceMode, plan, viewerScope } = context;

    let record = await prisma.onboardingProgress.findUnique({
      where: {
        organization_id_workspace_mode: {
          organization_id: orgId,
          workspace_mode: workspaceMode,
        },
      },
    });

    if (!record) {
      record = await prisma.onboardingProgress.create({
        data: {
          organization_id: orgId,
          workspace_mode: workspaceMode,
        },
      });
    }

    const cached = getCached(orgId, workspaceMode, plan, viewerScope);

    if (record.dismissed) {
      const { steps } = cached || await computeOnboarding(orgId, context);
      return res.json({
        show: false,
        dismissed: true,
        completedCount: steps.filter((step) => step.completed).length,
        totalCount: steps.length,
      });
    }

    if (cached) return res.json(cached);

    const { allSteps, steps } = await computeOnboarding(orgId, context);
    const completedCount = steps.filter((step) => step.completed).length;
    const totalCount = steps.length;
    const allDone = totalCount > 0 && completedCount === totalCount;
    const completedPlanSteps = allSteps.filter((step) => step.completed).map((step) => step.id);
    const allPlanStepsDone = allSteps.length > 0 && completedPlanSteps.length === allSteps.length;

    await prisma.onboardingProgress.update({
      where: {
        organization_id_workspace_mode: {
          organization_id: orgId,
          workspace_mode: workspaceMode,
        },
      },
      data: {
        completed_steps: completedPlanSteps,
        completed_at: allPlanStepsDone ? record.completed_at ?? new Date() : null,
      },
    });

    const payload = {
      show: totalCount > 0 && !allDone,
      dismissed: false,
      completedCount,
      totalCount,
      allDone,
      steps,
    };

    setCache(orgId, workspaceMode, plan, viewerScope, payload);
    return res.json(payload);
  } catch (err) {
    console.error('[onboarding] GET error:', err);
    return res.json({ show: false, dismissed: false, completedCount: 0, totalCount: 0, steps: [] });
  }
});

// ─── POST /api/onboarding/dismiss ─────────────────────────────────────────────

router.post('/dismiss', requireAuth, async (req, res) => {
  try {
    const orgId = String(req.user.effectiveUserId);
    const planContext = await getPlanContext(req.user.effectiveUserId);
    const context = buildOnboardingContext(req.user, planContext);

    await prisma.onboardingProgress.upsert({
      where: {
        organization_id_workspace_mode: {
          organization_id: orgId,
          workspace_mode: context.workspaceMode,
        },
      },
      create: {
        organization_id: orgId,
        workspace_mode: context.workspaceMode,
        dismissed: true,
        dismissed_at: new Date(),
      },
      update: {
        dismissed: true,
        dismissed_at: new Date(),
      },
    });

    cache.delete(getCacheKey(orgId, context.workspaceMode, context.plan, context.viewerScope));

    return res.json({ success: true });
  } catch (err) {
    console.error('[onboarding] dismiss error:', err);
    return res.status(500).json({ error: 'Failed to dismiss onboarding' });
  }
});

module.exports = router;
