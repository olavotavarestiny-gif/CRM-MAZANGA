const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET /api/produto-categorias
router.get('/', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const categorias = await prisma.produtoCategoria.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { nome: 'asc' }],
      include: { _count: { select: { produtos: true } } },
    });
    res.json(categorias);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/produto-categorias
router.post('/', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const { nome, cor } = req.body || {};
    if (!nome?.trim()) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const categoria = await prisma.produtoCategoria.create({
      data: {
        userId,
        nome: nome.trim(),
        cor: cor || null,
      },
    });

    res.status(201).json(categoria);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Já existe uma categoria com este nome' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/produto-categorias/:id
router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const categoria = await prisma.produtoCategoria.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true },
    });

    if (!categoria) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    const { nome, cor } = req.body || {};
    const updated = await prisma.produtoCategoria.update({
      where: { id: req.params.id },
      data: {
        ...(nome !== undefined && { nome: nome.trim() }),
        ...(cor !== undefined && { cor: cor || null }),
      },
    });

    res.json(updated);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Já existe uma categoria com este nome' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/produto-categorias/:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const categoria = await prisma.produtoCategoria.findFirst({
      where: { id: req.params.id, userId },
      include: { _count: { select: { produtos: true } } },
    });

    if (!categoria) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    if (categoria._count.produtos > 0) {
      return res.status(409).json({
        error: `Esta categoria tem ${categoria._count.produtos} produto(s). Reassociar antes de eliminar.`,
      });
    }

    await prisma.produtoCategoria.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
