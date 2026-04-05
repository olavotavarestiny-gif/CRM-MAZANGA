const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireCaixaPermission } = require('../lib/permissions');
const { reconcileCashSession } = require('../services/reconciliation.service');

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
router.post('/sessoes', requireCaixaPermission('open'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const { estabelecimentoId, openingBalance, notes } = req.body;

    if (!estabelecimentoId) {
      return res.status(400).json({ error: 'Ponto de venda obrigatório' });
    }

    if (!req.user.isAccountOwner && req.user.role !== 'admin' && !req.user.isSuperAdmin) {
      const member = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { assignedEstabelecimentoId: true },
      });

      if (!member?.assignedEstabelecimentoId) {
        return res.status(403).json({
          error: 'Este membro da equipa precisa de um ponto de venda atribuído para abrir caixa.',
        });
      }

      if (member.assignedEstabelecimentoId !== estabelecimentoId) {
        return res.status(403).json({
          error: 'Este membro da equipa só pode abrir caixa no ponto de venda que lhe foi atribuído.',
        });
      }
    }

    // Validar que o estabelecimento pertence ao utilizador
    const estab = await prisma.estabelecimento.findFirst({
      where: { id: estabelecimentoId, userId },
      select: { id: true, nome: true },
    });
    if (!estab) {
      return res.status(404).json({ error: 'Ponto de venda não encontrado' });
    }

    // Regra: só pode existir 1 sessão aberta por estabelecimento
    const sessaoAberta = await prisma.caixaSessao.findFirst({
      where: { userId, estabelecimentoId, status: 'open' },
      select: { id: true, openedBy: { select: { name: true } } },
    });
    if (sessaoAberta) {
      return res.status(409).json({
        error: `Já existe um caixa aberto neste ponto de venda por ${sessaoAberta.openedBy?.name || 'outro utilizador'}.`,
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
router.get('/sessoes/atual', requireCaixaPermission('view'), async (req, res) => {
  try {
    const { estabelecimentoId } = req.query;
    const where = {
      userId: req.user.effectiveUserId,
      status: 'open',
      ...(estabelecimentoId ? { estabelecimentoId } : { openedByUserId: req.user.id }),
    };

    const sessao = await prisma.caixaSessao.findFirst({
      where,
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
router.patch('/sessoes/:id/fechar', requireCaixaPermission('close'), async (req, res) => {
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
    const facturasDaSessao = await prisma.factura.findMany({
      where: { caixaSessaoId: sessao.id, documentStatus: 'N' },
      select: { grossTotal: true, paymentMethod: true },
    });
    const totalCash = facturasDaSessao
      .filter((f) => f.paymentMethod === 'CASH')
      .reduce((sum, f) => sum + f.grossTotal, 0);
    const totalMulticaixa = facturasDaSessao
      .filter((f) => f.paymentMethod === 'MULTICAIXA')
      .reduce((sum, f) => sum + f.grossTotal, 0);
    const totalTpa = facturasDaSessao
      .filter((f) => f.paymentMethod === 'TPA')
      .reduce((sum, f) => sum + f.grossTotal, 0);
    const totalTransferencia = facturasDaSessao
      .filter((f) => !['CASH', 'MULTICAIXA', 'TPA'].includes(f.paymentMethod))
      .reduce((sum, f) => sum + f.grossTotal, 0);

    const updated = await prisma.caixaSessao.update({
      where: { id: req.params.id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedByUserId: req.user.id,
        expectedClosingAmount: expected,
        closingCountedAmount: counted,
        differenceAmount: difference,
        totalCash,
        totalMulticaixa,
        totalTpa,
        totalTransferencia,
        notes: notes || null,
      },
      include: SESSION_INCLUDE,
    });

    try {
      await reconcileCashSession(updated.id, req.user.effectiveUserId);
    } catch (reconciliationError) {
      console.error('Cash session reconciliation error:', reconciliationError);
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/caixa/sessoes — Listar sessões (admin/owner vê todas, user vê as suas)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sessoes', requireCaixaPermission('audit'), async (req, res) => {
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
