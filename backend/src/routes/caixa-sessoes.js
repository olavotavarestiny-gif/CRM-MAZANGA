const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_INCLUDE = {
  estabelecimento: { select: { id: true, nome: true, nif: true } },
  openedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/caixa/sessoes — Abrir sessão de caixa
// ─────────────────────────────────────────────────────────────────────────────
router.post('/sessoes', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const { estabelecimentoId, openingBalance, notes } = req.body;

    if (!estabelecimentoId) {
      return res.status(400).json({ error: 'Ponto de venda obrigatório' });
    }

    // Validar que o estabelecimento pertence ao utilizador
    const estab = await prisma.estabelecimento.findFirst({
      where: { id: estabelecimentoId, userId },
      select: { id: true, nome: true },
    });
    if (!estab) {
      return res.status(404).json({ error: 'Ponto de venda não encontrado' });
    }

    // Regra: não pode existir sessão aberta para este utilizador
    const sessaoAberta = await prisma.caixaSessao.findFirst({
      where: { openedByUserId: req.user.id, status: 'open' },
      select: { id: true, estabelecimento: { select: { nome: true } } },
    });
    if (sessaoAberta) {
      return res.status(409).json({
        error: `Já existe uma sessão aberta em ${sessaoAberta.estabelecimento.nome}. Feche-a antes de abrir uma nova.`,
      });
    }

    const sessao = await prisma.caixaSessao.create({
      data: {
        userId,
        estabelecimentoId,
        openedByUserId: req.user.id,
        openingBalance: Number(openingBalance) || 0,
        notes: notes || null,
        status: 'open',
      },
      include: SESSION_INCLUDE,
    });

    res.status(201).json(sessao);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/caixa/sessoes/atual — Sessão aberta do utilizador actual
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sessoes/atual', async (req, res) => {
  try {
    const sessao = await prisma.caixaSessao.findFirst({
      where: { openedByUserId: req.user.id, status: 'open' },
      include: SESSION_INCLUDE,
      orderBy: { openedAt: 'desc' },
    });

    res.json(sessao || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/caixa/sessoes/:id/fechar — Fechar sessão
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/sessoes/:id/fechar', async (req, res) => {
  try {
    const sessao = await prisma.caixaSessao.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        openedByUserId: true,
        userId: true,
        openingBalance: true,
        totalSalesAmount: true,
        status: true,
      },
    });

    if (!sessao) return res.status(404).json({ error: 'Sessão não encontrada' });

    // Só quem abriu ou o dono da conta pode fechar
    const isOwner = req.user.isAccountOwner && sessao.userId === req.user.effectiveUserId;
    const isOpener = sessao.openedByUserId === req.user.id;
    if (!isOpener && !isOwner) {
      return res.status(403).json({ error: 'Sem permissão para fechar esta sessão' });
    }

    if (sessao.status === 'closed') {
      return res.status(409).json({ error: 'Sessão já está fechada' });
    }

    const { closingCountedAmount, notes } = req.body;
    const counted = closingCountedAmount != null ? Number(closingCountedAmount) : null;
    const expected = sessao.openingBalance + sessao.totalSalesAmount;
    const difference = counted != null ? counted - expected : null;

    const updated = await prisma.caixaSessao.update({
      where: { id: req.params.id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedByUserId: req.user.id,
        expectedClosingAmount: expected,
        closingCountedAmount: counted,
        differenceAmount: difference,
        notes: notes || null,
      },
      include: SESSION_INCLUDE,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/caixa/sessoes — Listar sessões (admin/owner vê todas, user vê as suas)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sessoes', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const { status, estabelecimentoId, page = '1', limit = '20' } = req.query;

    const where = {
      userId,
      ...(status && { status }),
      ...(estabelecimentoId && { estabelecimentoId }),
      // Não-owners só vêem as suas próprias sessões
      ...(!req.user.isAccountOwner && { openedByUserId: req.user.id }),
    };

    const [sessoes, total] = await Promise.all([
      prisma.caixaSessao.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: { openedAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.caixaSessao.count({ where }),
    ]);

    res.json({ sessoes, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
