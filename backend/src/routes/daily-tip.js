const express = require('express');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// ─── Static fallback suggestions (1 sentence each) ────────────────────────────

const STATIC_SERVICOS = [
  { title: 'Pipeline', message: 'Os negócios em "Proposta" precisam de seguimento esta semana.' },
  { title: 'Tarefas', message: 'Complete as tarefas atrasadas primeiro — a consistência fecha negócios.' },
  { title: 'Contactos', message: 'Adicione 5 novos contactos esta semana para manter o pipeline saudável.' },
  { title: 'Reuniões', message: 'Agende um check-in com os seus 3 principais clientes este mês.' },
  { title: 'Conversão', message: 'Analise os negócios perdidos para identificar padrões de objecção.' },
  { title: 'Seguimento', message: 'Negócios em negociação há mais de 14 dias precisam de atenção urgente.' },
  { title: 'Crescimento', message: 'Partilhe conteúdo de valor com a sua lista — leads nutridos convertem mais.' },
];

const STATIC_COMERCIO = [
  { title: 'Stock', message: 'Verifique os níveis de stock dos produtos mais vendidos esta semana.' },
  { title: 'Vendas', message: 'Analise os produtos sem venda este mês e considere promoções.' },
  { title: 'Caixa', message: 'Feche sempre a sessão de caixa no fim do dia para evitar divergências.' },
  { title: 'Clientes', message: 'Identifique os 3 clientes com maior volume e mantenha-os activos.' },
  { title: 'Inventário', message: 'Reveja os produtos com maior rotação e reponha o stock antecipadamente.' },
  { title: 'Margens', message: 'Verifique se os produtos mais vendidos têm as margens correctas configuradas.' },
  { title: 'Tendências', message: 'Compare as vendas desta semana com a anterior para identificar padrões.' },
];

// ─── Suggestion catalogues ─────────────────────────────────────────────────────

const SERVICOS_SUGGESTIONS = [
  {
    id: 'srv_overdue_tasks',
    priority: 10,
    type: 'action',
    audience: 'all',
    title: 'Tarefas em atraso',
    check: async (uid) => {
      const n = await prisma.task.count({
        where: { userId: uid, done: false, dueDate: { lt: new Date() } },
      });
      if (n === 0) return null;
      return {
        message: `Tem ${n} ${n === 1 ? 'tarefa' : 'tarefas'} em atraso.`,
        ctaLabel: 'Ver',
        ctaAction: '/tasks?filter=atrasadas',
      };
    },
  },
  {
    id: 'srv_pipeline_stale',
    priority: 9,
    type: 'action',
    audience: 'owner',
    title: 'Pipeline parado',
    check: async (uid) => {
      const total = await prisma.contact.count({ where: { userId: uid, inPipeline: true } });
      if (total === 0) return null;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const active = await prisma.contact.count({
        where: { userId: uid, inPipeline: true, updatedAt: { gte: sevenDaysAgo } },
      });
      if (active > 0) return null;
      return { message: 'Pipeline sem movimento há 7 dias.', ctaLabel: 'Ver', ctaAction: '/pipeline' };
    },
  },
  {
    id: 'srv_receivables',
    priority: 8,
    type: 'insight',
    audience: 'owner',
    title: 'Faturas por cobrar',
    check: async (uid) => {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const n = await prisma.factura.count({
        where: {
          userId: uid,
          documentStatus: 'N',
          documentDate: { gte: startOfMonth },
          caixaSessaoId: null,
        },
      });
      if (n === 0) return null;
      return {
        message: `${n} ${n === 1 ? 'fatura' : 'faturas'} por cobrar este mês.`,
        ctaLabel: 'Ver',
        ctaAction: '/financas',
      };
    },
  },
  {
    id: 'srv_no_tasks_today',
    priority: 7,
    type: 'action',
    audience: 'all',
    title: 'Sem tarefas hoje',
    check: async (uid) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const n = await prisma.task.count({
        where: { userId: uid, done: false, dueDate: { gte: start, lte: end } },
      });
      if (n > 0) return null;
      return { message: 'Sem tarefas para hoje.', ctaLabel: 'Criar', ctaAction: '/tasks' };
    },
  },
];

const COMERCIO_SUGGESTIONS = [
  {
    id: 'com_stock_alerts',
    priority: 10,
    type: 'action',
    audience: 'owner',
    title: 'Stock baixo',
    check: async (uid) => {
      const prods = await prisma.produto.findMany({
        where: { userId: uid, active: true, stockMinimo: { not: null } },
        select: { stock: true, stockMinimo: true },
      });
      const n = prods.filter((p) => (p.stock ?? 0) <= (p.stockMinimo ?? 0)).length;
      if (n === 0) return null;
      return {
        message: `${n} ${n === 1 ? 'produto' : 'produtos'} abaixo do stock mínimo.`,
        ctaLabel: 'Ver',
        ctaAction: '/inventario',
      };
    },
  },
  {
    id: 'com_no_sales_today',
    priority: 8,
    type: 'insight',
    audience: 'all',
    title: 'Vendas hoje',
    check: async (uid) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const r = await prisma.factura.aggregate({
        where: { userId: uid, documentDate: { gte: start }, documentStatus: 'N' },
        _count: { id: true },
      });
      if (r._count.id > 0) return null;
      return { message: 'Nenhuma venda registada hoje.' };
    },
  },
  {
    id: 'com_sales_up',
    priority: 7,
    type: 'insight',
    audience: 'owner',
    title: 'Bom desempenho',
    check: async (uid) => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const yestStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const [todayR, yestR] = await Promise.all([
        prisma.factura.aggregate({
          where: { userId: uid, documentDate: { gte: todayStart }, documentStatus: 'N' },
          _sum: { grossTotal: true },
        }),
        prisma.factura.aggregate({
          where: { userId: uid, documentDate: { gte: yestStart, lt: todayStart }, documentStatus: 'N' },
          _sum: { grossTotal: true },
        }),
      ]);
      const t = todayR._sum.grossTotal ?? 0;
      const y = yestR._sum.grossTotal ?? 0;
      if (t <= 0 || y <= 0 || t < y * 1.2) return null;
      const pct = Math.round(((t - y) / y) * 100);
      return { message: `Vendas subiram ${pct}% em relação a ontem.` };
    },
  },
];

// ─── Relevance engine ──────────────────────────────────────────────────────────

async function pickSuggestion(userId, workspace, audience) {
  const catalogue = workspace === 'comercio' ? COMERCIO_SUGGESTIONS : SERVICOS_SUGGESTIONS;
  const eligible = catalogue.filter((s) => s.audience === 'all' || s.audience === audience);

  // Run all checks in parallel
  const results = await Promise.all(
    eligible.map(async (s) => {
      try {
        const data = await s.check(userId);
        if (!data) return null;
        return {
          id: s.id,
          type: s.type,
          title: data.title ?? s.title,
          message: data.message,
          ctaLabel: data.ctaLabel,
          ctaAction: data.ctaAction,
          priority: s.priority,
        };
      } catch {
        return null;
      }
    })
  );

  // Pick highest priority match
  const match = results
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority)[0];

  if (match) return match;

  // Static fallback: deterministic by day
  const statics = workspace === 'comercio' ? STATIC_COMERCIO : STATIC_SERVICOS;
  const idx = Math.abs(new Date().getDate() + new Date().getMonth()) % statics.length;
  const tip = statics[idx];
  return {
    id: `static_${workspace}_fallback`,
    type: 'insight',
    title: tip.title,
    message: tip.message,
    priority: 1,
  };
}

// ─── POST /api/daily-tip/deliver ───────────────────────────────────────────────

router.post('/deliver', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const workspace = req.user.workspaceMode ?? 'servicos';
    const audience = req.user.accountOwnerId ? 'equipa' : 'owner';
    const effectiveUserId = req.user.effectiveUserId ?? req.user.id;

    // Check if already delivered today — return stored payload for consistency
    const existing = await prisma.suggestionDelivery.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    if (existing && existing.payload) {
      return res.json({ show: true, suggestion: JSON.parse(existing.payload) });
    }

    const suggestion = await pickSuggestion(effectiveUserId, workspace, audience);

    // Upsert (handles rare race condition on first load)
    await prisma.suggestionDelivery.upsert({
      where: { userId_date: { userId, date: today } },
      create: { userId, date: today, suggestionId: suggestion.id, payload: JSON.stringify(suggestion) },
      update: { suggestionId: suggestion.id, payload: JSON.stringify(suggestion) },
    });

    return res.json({ show: true, suggestion });
  } catch (err) {
    console.error('[daily-tip] error:', err);
    // Fail gracefully — never break the dashboard
    return res.json({ show: false });
  }
});

module.exports = router;
