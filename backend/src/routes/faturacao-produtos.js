const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { getTaxCode, isValidRate } = require('../lib/fiscal/iva-rates');

/**
 * Calcula margem a partir de custo e preço de venda.
 * Retorna null se custo não estiver definido.
 */
function calcMargin(cost, salePrice) {
  if (cost == null || cost <= 0 || salePrice <= 0) return null;
  return Math.round(((salePrice - cost) / salePrice) * 10000) / 100; // 2 casas decimais
}

// GET /api/faturacao/produtos
router.get('/produtos', async (req, res) => {
  try {
    const { search, active } = req.query;
    const where = {
      userId: req.user.effectiveUserId,
      ...(active !== undefined && { active: active === 'true' }),
      ...(search && {
        OR: [
          { barcode: { equals: search } },                                      // barcode exact (highest priority — sorted client-side)
          { productCode: { contains: search, mode: 'insensitive' } },
          { productDescription: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const produtos = await prisma.produto.findMany({
      where,
      orderBy: { productDescription: 'asc' },
      include: {
        categoria: {
          select: { id: true, nome: true, cor: true, isDefault: true },
        },
      },
    });
    // Append computed margin
    const result = produtos.map((p) => ({ ...p, margin: calcMargin(p.cost, p.unitPrice) }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faturacao/produtos
router.post('/produtos', async (req, res) => {
  try {
    const {
      productCode,
      productDescription,
      unitPrice,
      cost,
      productType,
      sku,
      unitOfMeasure,
      taxPercentage,
      stockMinimo,
      categoriaId,
    } = req.body;
    if (!productCode || !productDescription) return res.status(400).json({ error: 'Código e descrição obrigatórios' });
    const pct = Number(taxPercentage) ?? 14;
    if (!isValidRate(pct)) return res.status(400).json({ error: `Taxa IVA inválida: ${pct}%. Use 0%, 5% ou 14%.` });
    const salePrice = Number(unitPrice) || 0;
    const costVal = cost != null ? Number(cost) : null;
    const userId = req.user.effectiveUserId;

    if (categoriaId) {
      const categoria = await prisma.produtoCategoria.findFirst({
        where: { id: categoriaId, userId },
        select: { id: true },
      });
      if (!categoria) return res.status(400).json({ error: 'Categoria inválida' });
    }

    const produto = await prisma.produto.create({
      data: {
        userId,
        productCode,
        productDescription,
        unitPrice: salePrice,
        cost: costVal,
        productType: productType || 'S',
        sku: sku || null,
        unitOfMeasure: unitOfMeasure || 'UN',
        taxPercentage: pct,
        taxCode: getTaxCode(pct),
        stockMinimo: stockMinimo != null ? Number(stockMinimo) : null,
        categoriaId: categoriaId || null,
      },
      include: {
        categoria: {
          select: { id: true, nome: true, cor: true, isDefault: true },
        },
      },
    });
    res.status(201).json({ ...produto, margin: calcMargin(costVal, salePrice) });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Código de produto já existe' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/faturacao/produtos/:id
router.put('/produtos/:id', async (req, res) => {
  try {
    const existing = await prisma.produto.findUnique({ where: { id: req.params.id }, select: { userId: true, unitPrice: true, cost: true } });
    if (!existing || existing.userId !== req.user.effectiveUserId) return res.status(404).json({ error: 'Produto não encontrado' });
    const { productDescription, unitPrice, cost, productType, sku, unitOfMeasure, taxPercentage, active, stockMinimo, categoriaId } = req.body;
    const pct = taxPercentage !== undefined ? Number(taxPercentage) : undefined;
    if (pct !== undefined && !isValidRate(pct)) return res.status(400).json({ error: `Taxa IVA inválida: ${pct}%. Use 0%, 5% ou 14%.` });

    if (categoriaId) {
      const categoria = await prisma.produtoCategoria.findFirst({
        where: { id: categoriaId, userId: req.user.effectiveUserId },
        select: { id: true },
      });
      if (!categoria) return res.status(400).json({ error: 'Categoria inválida' });
    }

    const updated = await prisma.produto.update({
      where: { id: req.params.id },
      data: {
        ...(productDescription !== undefined && { productDescription }),
        ...(unitPrice !== undefined && { unitPrice: Number(unitPrice) }),
        ...(cost !== undefined && { cost: cost === null ? null : Number(cost) }),
        ...(productType !== undefined && { productType }),
        ...(sku !== undefined && { sku: sku || null }),
        ...(unitOfMeasure !== undefined && { unitOfMeasure }),
        ...(pct !== undefined && { taxPercentage: pct, taxCode: getTaxCode(pct) }),
        ...(stockMinimo !== undefined && { stockMinimo: stockMinimo === null ? null : Number(stockMinimo) }),
        ...(categoriaId !== undefined && { categoriaId: categoriaId || null }),
        ...(active !== undefined && { active }),
      },
      include: {
        categoria: {
          select: { id: true, nome: true, cor: true, isDefault: true },
        },
      },
    });
    const salePrice = unitPrice !== undefined ? Number(unitPrice) : existing.unitPrice;
    const costFinal = cost !== undefined ? (cost === null ? null : Number(cost)) : existing.cost;
    res.json({ ...updated, margin: calcMargin(costFinal, salePrice) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/faturacao/produtos/:id — soft delete
router.delete('/produtos/:id', async (req, res) => {
  try {
    const existing = await prisma.produto.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!existing || existing.userId !== req.user.effectiveUserId) return res.status(404).json({ error: 'Produto não encontrado' });
    await prisma.produto.update({ where: { id: req.params.id }, data: { active: false } });
    res.json({ message: 'Produto desativado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faturacao/produtos/:id/stock — entrada manual de stock
router.post('/produtos/:id/stock', async (req, res) => {
  try {
    const produto = await prisma.produto.findUnique({
      where: { id: req.params.id },
      select: { userId: true, stock: true, cost: true, unitPrice: true, productDescription: true, productCode: true },
    });
    if (!produto || produto.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const { quantity, reason, notes } = req.body;
    const qty = Number(quantity);
    if (!qty || qty <= 0 || !Number.isInteger(qty)) {
      return res.status(400).json({ error: 'Quantidade deve ser um número inteiro positivo' });
    }

    const previousStock = produto.stock ?? 0;
    const newStock = previousStock + qty;

    const { movement, updatedProduto } = await prisma.$transaction(async (tx) => {
      const mov = await tx.stockMovement.create({
        data: {
          productId: req.params.id,
          userId: req.user.effectiveUserId,
          createdByUserId: req.user.id,
          type: 'entry',
          quantity: qty,
          previousStock,
          newStock,
          reason: reason || null,
          notes: notes || null,
          referenceType: 'manual',
        },
      });

      const updated = await tx.produto.update({
        where: { id: req.params.id },
        data: { stock: newStock },
      });

      // ── Saída financeira automática (compra de stock) ──────────────────────
      // Só cria se o produto tiver custo definido e maior que zero
      if (produto.cost != null && produto.cost > 0) {
        const amountKz = produto.cost * qty;
        await tx.transaction.create({
          data: {
            userId: req.user.effectiveUserId,
            date: new Date(),
            type: 'saida',
            category: 'Compras de Mercadoria',
            subcategory: produto.productDescription,
            description: `Compra de stock: ${qty}x ${produto.productDescription}`,
            amountKz,
            currencyOrigin: 'KZ',
            exchangeRate: 1,
            status: 'pago',
            notes: `Entrada de stock registada: ${qty} un. de ${produto.productCode}. Custo unitário: ${produto.cost.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz.${reason ? ` Motivo: ${reason}` : ''}`,
          },
        });
      }

      return { movement: mov, updatedProduto: updated };
    });

    res.status(201).json({
      produto: { ...updatedProduto, margin: calcMargin(updatedProduto.cost, updatedProduto.unitPrice) },
      movement,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/faturacao/produtos/:id/stock-movements — histórico de movimentos
router.get('/produtos/:id/stock-movements', async (req, res) => {
  try {
    const produto = await prisma.produto.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!produto || produto.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const movements = await prisma.stockMovement.findMany({
      where: { productId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(movements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
