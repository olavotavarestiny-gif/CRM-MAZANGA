const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET /api/faturacao/produtos
router.get('/produtos', async (req, res) => {
  try {
    const { search, active } = req.query;
    const where = {
      userId: req.user.effectiveUserId,
      ...(active !== undefined && { active: active === 'true' }),
      ...(search && {
        OR: [
          { productCode: { contains: search, mode: 'insensitive' } },
          { productDescription: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const produtos = await prisma.produto.findMany({ where, orderBy: { productDescription: 'asc' } });
    res.json(produtos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faturacao/produtos
router.post('/produtos', async (req, res) => {
  try {
    const { productCode, productDescription, unitPrice, unitOfMeasure, taxPercentage, taxCode } = req.body;
    if (!productCode || !productDescription) return res.status(400).json({ error: 'Código e descrição obrigatórios' });
    const produto = await prisma.produto.create({
      data: {
        userId: req.user.effectiveUserId,
        productCode,
        productDescription,
        unitPrice: Number(unitPrice) || 0,
        unitOfMeasure: unitOfMeasure || 'UN',
        taxPercentage: Number(taxPercentage) ?? 14,
        taxCode: taxCode || 'NOR',
      },
    });
    res.status(201).json(produto);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Código de produto já existe' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/faturacao/produtos/:id
router.put('/produtos/:id', async (req, res) => {
  try {
    const existing = await prisma.produto.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!existing || existing.userId !== req.user.effectiveUserId) return res.status(404).json({ error: 'Produto não encontrado' });
    const { productDescription, unitPrice, unitOfMeasure, taxPercentage, taxCode, active } = req.body;
    const updated = await prisma.produto.update({
      where: { id: req.params.id },
      data: {
        ...(productDescription !== undefined && { productDescription }),
        ...(unitPrice !== undefined && { unitPrice: Number(unitPrice) }),
        ...(unitOfMeasure !== undefined && { unitOfMeasure }),
        ...(taxPercentage !== undefined && { taxPercentage: Number(taxPercentage) }),
        ...(taxCode !== undefined && { taxCode }),
        ...(active !== undefined && { active }),
      },
    });
    res.json(updated);
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

module.exports = router;
