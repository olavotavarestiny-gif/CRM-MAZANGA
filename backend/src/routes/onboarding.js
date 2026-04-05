const express = require('express');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// ─── Step definitions ─────────────────────────────────────────────────────────

const SERVICOS_STEPS = [
  { id: 'add_contact',    label: 'Adiciona o teu primeiro contacto',      href: '/contacts' },
  { id: 'setup_pipeline', label: 'Cria uma etapa no pipeline',             href: '/pipeline' },
  { id: 'create_task',    label: 'Cria a tua primeira tarefa',             href: '/tasks' },
  { id: 'create_form',    label: 'Cria um formulário de captura de leads', href: '/forms' },
  { id: 'setup_billing',  label: 'Configura os dados da empresa',          href: '/faturacao/configuracao' },
  { id: 'create_invoice', label: 'Emite a tua primeira fatura',            href: '/faturacao/nova' },
];

const COMERCIO_STEPS = [
  { id: 'add_product',    label: 'Adiciona os teus primeiros produtos',    href: '/produtos' },
  { id: 'setup_billing',  label: 'Configura os dados da empresa',          href: '/faturacao/configuracao' },
  { id: 'open_cash',      label: 'Abre a primeira sessão de caixa',        href: '/caixa' },
  { id: 'first_sale',     label: 'Faz a tua primeira venda',               href: '/vendas-rapidas' },
  { id: 'invite_member',  label: 'Convida um membro da equipa',            href: '/configuracoes' },
];

// ─── Detection checks ─────────────────────────────────────────────────────────

const CHECKS = {
  add_contact: async (uid) => {
    const n = await prisma.contact.count({ where: { userId: uid } });
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

const cache = new Map(); // orgId → { data, expiresAt }
const CACHE_TTL = 60_000;

function getCached(orgId) {
  const entry = cache.get(orgId);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  return null;
}

function setCache(orgId, data) {
  cache.set(orgId, { data, expiresAt: Date.now() + CACHE_TTL });
}

// ─── Core logic ───────────────────────────────────────────────────────────────

async function computeOnboarding(orgId, workspaceMode) {
  const steps = workspaceMode === 'comercio' ? COMERCIO_STEPS : SERVICOS_STEPS;

  const results = await Promise.all(
    steps.map(async (step) => {
      const check = CHECKS[step.id];
      const completed = check ? await check(parseInt(orgId, 10)).catch(() => false) : false;
      return { ...step, completed };
    })
  );

  return results;
}

// ─── GET /api/onboarding ──────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const orgId = String(req.user.effectiveUserId);
    const workspaceMode = req.user.workspaceMode ?? 'servicos';

    // Ensure OnboardingProgress record exists
    let record = await prisma.onboardingProgress.findUnique({
      where: { organization_id: orgId },
    });

    if (!record) {
      record = await prisma.onboardingProgress.create({
        data: {
          organization_id: orgId,
          workspace_mode: workspaceMode,
        },
      });
    }

    if (record.dismissed) {
      const steps = workspaceMode === 'comercio' ? COMERCIO_STEPS : SERVICOS_STEPS;
      const cached = getCached(orgId);
      const completedCount = cached
        ? cached.steps.filter((s) => s.completed).length
        : 0;
      return res.json({
        show: false,
        dismissed: true,
        completedCount,
        totalCount: steps.length,
      });
    }

    // Use cache if fresh
    const cached = getCached(orgId);
    if (cached) return res.json(cached);

    // Compute step states
    const steps = await computeOnboarding(orgId, record.workspace_mode);
    const completedCount = steps.filter((s) => s.completed).length;
    const totalCount = steps.length;
    const allDone = completedCount === totalCount;

    // Persist completed_at when first fully complete
    if (allDone && !record.completed_at) {
      await prisma.onboardingProgress.update({
        where: { organization_id: orgId },
        data: {
          completed_at: new Date(),
          completed_steps: steps.map((s) => s.id),
        },
      });
    }

    const payload = {
      show: true,
      dismissed: false,
      completedCount,
      totalCount,
      allDone,
      steps,
    };

    setCache(orgId, payload);
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

    await prisma.onboardingProgress.upsert({
      where: { organization_id: orgId },
      create: {
        organization_id: orgId,
        workspace_mode: req.user.workspaceMode ?? 'servicos',
        dismissed: true,
        dismissed_at: new Date(),
      },
      update: {
        dismissed: true,
        dismissed_at: new Date(),
      },
    });

    // Invalidate cache so next GET reflects dismissed state
    cache.delete(orgId);

    return res.json({ success: true });
  } catch (err) {
    console.error('[onboarding] dismiss error:', err);
    return res.status(500).json({ error: 'Failed to dismiss onboarding' });
  }
});

module.exports = router;
