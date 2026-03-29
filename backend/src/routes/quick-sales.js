const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { createFactura } = require('../lib/faturacao/create-factura');

// GET /api/quick-sales/defaults
// Returns the account's default serieId and estabelecimentoId for quick sale.
router.get('/defaults', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const config = await prisma.configuracaoFaturacao.findUnique({
      where: { userId },
      select: { defaultSerieId: true, defaultEstabelecimentoId: true },
    });

    let resolvedSerieId = config?.defaultSerieId || null;
    if (config?.defaultEstabelecimentoId) {
      const estabelecimento = await prisma.estabelecimento.findFirst({
        where: { id: config.defaultEstabelecimentoId, userId },
        select: { defaultSerieId: true },
      });
      resolvedSerieId = estabelecimento?.defaultSerieId || resolvedSerieId;
    }

    if (!resolvedSerieId || !config?.defaultEstabelecimentoId) {
      return res.status(200).json({
        ready: false,
        defaultSerieId: null,
        defaultEstabelecimentoId: null,
      });
    }

    res.json({
      ready: true,
      defaultSerieId: resolvedSerieId,
      defaultEstabelecimentoId: config.defaultEstabelecimentoId,
    });
  } catch (err) {
    console.error('Error fetching quick-sale defaults:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quick-sales/emit
// Emits a quick-sale invoice using the selected estabelecimento whenever provided.
// Reuses the same createFactura engine — identical fiscal rules, hash chain, AGT.
router.post('/emit', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const { items, customerTaxID, customerName, paymentMethod, estabelecimentoId } = req.body;

    if (!items?.length) {
      return res.status(400).json({ error: 'O carrinho está vazio.' });
    }

    // ── Step 1: Resolve and validate products ───────────────────────────────
    const productCodes = items.map((i) => i.productCode);
    const produtos = await prisma.produto.findMany({
      where: { userId, productCode: { in: productCodes }, active: true },
      select: {
        id: true,
        productCode: true,
        stock: true,
        stockMinimo: true,
        productDescription: true,
        unitPrice: true,
        productType: true,
      },
    });
    const produtosMap = new Map(produtos.map((p) => [p.productCode, p]));
    if (produtos.length !== productCodes.length) {
      const found = new Set(produtos.map((p) => p.productCode));
      const missing = productCodes.filter((c) => !found.has(c));
      return res.status(400).json({
        error: `Produto(s) não encontrado(s) ou inactivo(s): ${missing.join(', ')}`,
      });
    }

    // ── Step 3: Resolve open session — must happen before estabelecimento ───────
    const sessaoAberta = await prisma.caixaSessao.findFirst({
      where: {
        openedByUserId: req.user.id,
        status: 'open',
        ...(estabelecimentoId ? { estabelecimentoId } : {}),
      },
      select: { id: true, totalSalesAmount: true, salesCount: true, estabelecimentoId: true },
    });

    // Phase 4: when a session is open, the estabelecimento is locked to it.
    // If the caller passes a different estabelecimentoId, reject.
    if (sessaoAberta) {
      if (estabelecimentoId && estabelecimentoId !== sessaoAberta.estabelecimentoId) {
        return res.status(400).json({
          error: 'O ponto de venda da venda rápida deve coincidir com o ponto de venda da sessão de caixa aberta.',
        });
      }
    }

    const config = await prisma.configuracaoFaturacao.findUnique({
      where: { userId },
      select: { defaultSerieId: true, defaultEstabelecimentoId: true },
    });

    // Use session's estabelecimentoId when a session is active; fall back to request or config default.
    const targetEstabelecimentoId =
      sessaoAberta?.estabelecimentoId ||
      estabelecimentoId ||
      config?.defaultEstabelecimentoId ||
      null;

    if (!targetEstabelecimentoId) {
      return res.status(400).json({
        error: 'Selecione um ponto de venda configurado ou defina um ponto de venda padrão em Configurações → Empresa → Configuração Fiscal.',
      });
    }

    const estabelecimento = await prisma.estabelecimento.findFirst({
      where: { id: targetEstabelecimentoId, userId },
      select: { id: true, nome: true, defaultSerieId: true },
    });
    if (!estabelecimento) {
      return res.status(404).json({ error: 'O ponto de venda selecionado não foi encontrado.' });
    }

    const resolvedSerieId =
      estabelecimento.defaultSerieId ||
      (!estabelecimentoId && targetEstabelecimentoId === config?.defaultEstabelecimentoId
        ? config?.defaultSerieId
        : null);
    if (!resolvedSerieId) {
      return res.status(400).json({
        error: `O ponto de venda ${estabelecimento.nome} ainda não tem série padrão. Reabre a configuração fiscal e tenta novamente.`,
      });
    }

    const facturaBody = {
      documentType: 'FT',
      serieId: resolvedSerieId,
      estabelecimentoId: targetEstabelecimentoId,
      customerTaxID: customerTaxID || '000000000',
      customerName: customerName || 'Consumidor Final',
      paymentMethod: paymentMethod || 'CASH',
      lines: items.map((item, i) => ({
        lineNumber: i + 1,
        productCode: item.productCode,
        productDescription: item.productDescription,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitOfMeasure: item.unitOfMeasure || 'UN',
        settlementAmount: 0,
        taxes: [
          {
            taxType: 'IVA',
            taxCode: item.taxCode || 'NOR',
            taxPercentage: item.taxPercentage != null ? item.taxPercentage : 14,
          },
        ],
      })),
    };

    // ── Emitir factura ──────────────────────────────────────────────────────
    const factura = await createFactura(userId, facturaBody, req);

    const quantidadesPorProduto = items.reduce((acc, item) => {
      const current = acc.get(item.productCode) || 0;
      acc.set(item.productCode, current + Number(item.quantity || 0));
      return acc;
    }, new Map());

    for (const [productCode, quantity] of quantidadesPorProduto.entries()) {
      const produto = produtosMap.get(productCode);
      if (!produto || produto.stock == null || produto.productType !== 'P') continue;

      await prisma.$transaction(async (tx) => {
        const produtoAtual = await tx.produto.findUnique({
          where: { id: produto.id },
          select: { stock: true, productType: true },
        });

        if (!produtoAtual || produtoAtual.stock == null || produtoAtual.productType !== 'P') {
          return;
        }

        const newStock = Math.max(0, produtoAtual.stock - quantity);
        await tx.produto.update({
          where: { id: produto.id },
          data: { stock: newStock },
        });
        await tx.stockMovement.create({
          data: {
            productId: produto.id,
            userId,
            type: 'exit',
            quantity,
            previousStock: produtoAtual.stock,
            newStock,
            reason: 'Venda rápida',
            referenceType: 'quick_sale',
            referenceId: factura.id,
            createdByUserId: req.user.id,
          },
        });
      });
    }

    // Actualizar totais da sessão após emissão bem-sucedida
    if (sessaoAberta) {
      await prisma.caixaSessao.update({
        where: { id: sessaoAberta.id },
        data: {
          totalSalesAmount: sessaoAberta.totalSalesAmount + factura.grossTotal,
          salesCount: sessaoAberta.salesCount + 1,
        },
      });
      // Ligar a factura à sessão
      await prisma.factura.update({
        where: { id: factura.id },
        data: { caixaSessaoId: sessaoAberta.id },
      });
    }

    res.status(201).json({ ...factura, caixaSessaoId: sessaoAberta?.id || null });
  } catch (err) {
    console.error('Error emitting quick sale:', err);
    const msg = err.message || '';
    if (err.status === 400) return res.status(400).json({ error: msg });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Erro de numeração. Por favor tente novamente.' });
    if (msg.includes('Série')) return res.status(400).json({ error: msg });
    res.status(500).json({ error: 'Erro ao emitir a fatura. Verifique as configurações e tente novamente.' });
  }
});

module.exports = router;
