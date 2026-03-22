'use strict';

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { processRecorrentes } = require('../lib/faturacao/scheduler');

const prisma = new PrismaClient();

const INCLUDE = {
  serie:            { select: { seriesCode: true, seriesYear: true, documentType: true } },
  estabelecimento:  { select: { nome: true, nif: true } },
  clienteFaturacao: { select: { customerName: true, customerTaxID: true } },
};

// GET /api/faturacao/recorrentes
router.get('/recorrentes', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const items = await prisma.facturaRecorrente.findMany({
      where: { userId },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/faturacao/recorrentes
router.post('/recorrentes', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const {
      serieId, estabelecimentoId, clienteFaturacaoId,
      customerTaxID, customerName, customerAddress,
      documentType = 'FT', lines, currencyCode = 'AOA',
      exchangeRate, paymentMethod = 'Transferência Bancária',
      frequency, startDate, maxOccurrences, notes,
    } = req.body;

    if (!serieId || !estabelecimentoId || !customerTaxID || !customerName || !lines || !frequency || !startDate) {
      return res.status(400).json({ error: 'Campos obrigatórios em falta' });
    }

    const validFreqs = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];
    if (!validFreqs.includes(frequency)) {
      return res.status(400).json({ error: 'Frequência inválida' });
    }

    // Verify ownership of serie and estabelecimento
    const [serie, estab] = await Promise.all([
      prisma.serie.findFirst({ where: { id: serieId, userId } }),
      prisma.estabelecimento.findFirst({ where: { id: estabelecimentoId, userId } }),
    ]);
    if (!serie) return res.status(400).json({ error: 'Série não encontrada' });
    if (!estab) return res.status(400).json({ error: 'Estabelecimento não encontrado' });

    const startDateObj = new Date(startDate);

    const rec = await prisma.facturaRecorrente.create({
      data: {
        userId, serieId, estabelecimentoId,
        clienteFaturacaoId: clienteFaturacaoId || null,
        customerTaxID, customerName, customerAddress: customerAddress || null,
        documentType,
        lines: typeof lines === 'string' ? lines : JSON.stringify(lines),
        currencyCode,
        exchangeRate: exchangeRate ? parseFloat(exchangeRate) : null,
        paymentMethod, frequency,
        startDate:   startDateObj,
        nextRunDate: startDateObj,
        maxOccurrences: maxOccurrences ? parseInt(maxOccurrences) : null,
        notes: notes || null,
      },
      include: INCLUDE,
    });

    res.status(201).json(rec);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/faturacao/recorrentes/:id
router.put('/recorrentes/:id', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const existing = await prisma.facturaRecorrente.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });

    const { isActive, notes, maxOccurrences, paymentMethod, nextRunDate } = req.body;

    const updated = await prisma.facturaRecorrente.update({
      where: { id: req.params.id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(notes !== undefined && { notes }),
        ...(maxOccurrences !== undefined && { maxOccurrences: maxOccurrences ? parseInt(maxOccurrences) : null }),
        ...(paymentMethod && { paymentMethod }),
        ...(nextRunDate && { nextRunDate: new Date(nextRunDate) }),
      },
      include: INCLUDE,
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/faturacao/recorrentes/:id  — soft delete (deactivate)
router.delete('/recorrentes/:id', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const existing = await prisma.facturaRecorrente.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });

    await prisma.facturaRecorrente.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/faturacao/recorrentes/:id/trigger  — emit now
router.post('/recorrentes/:id/trigger', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const existing = await prisma.facturaRecorrente.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) return res.status(404).json({ error: 'Não encontrado' });

    const count = await processRecorrentes(req.params.id);
    if (count === 0) {
      return res.status(400).json({ error: 'Fatura recorrente não encontrada ou inativa' });
    }

    // Return updated record
    const updated = await prisma.facturaRecorrente.findUnique({
      where: { id: req.params.id },
      include: INCLUDE,
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Erro ao emitir fatura' });
  }
});

module.exports = router;
