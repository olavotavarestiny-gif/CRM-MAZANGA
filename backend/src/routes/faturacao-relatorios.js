/**
 * Relatórios Fiscais — KukuGest
 * GET /api/faturacao/relatorios/iva?periodo=YYYY-MM
 * GET /api/faturacao/relatorios/vendas?year=YYYY
 * GET /api/faturacao/relatorios/iva/export?periodo=YYYY-MM   → CSV
 * GET /api/faturacao/relatorios/vendas/export?year=YYYY       → CSV
 */

'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// ── Helpers ──────────────────────────────────────────────────────────────────

function periodBounds(periodo) {
  const [year, month] = periodo.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59);
  return { start, end };
}

function yearBounds(year) {
  const y = Number(year);
  return {
    start: new Date(y, 0, 1),
    end:   new Date(y, 11, 31, 23, 59, 59),
  };
}

/** Gera string CSV a partir de um array de objectos */
function toCSV(rows, columns) {
  const header = columns.map(c => c.label).join(';');
  const lines = rows.map(row =>
    columns.map(c => {
      const v = row[c.key] ?? '';
      // Escape semicolons and quotes
      const str = String(v).replace(/"/g, '""');
      return str.includes(';') || str.includes('\n') ? `"${str}"` : str;
    }).join(';')
  );
  return [header, ...lines].join('\n');
}

// ── IVA por período ───────────────────────────────────────────────────────────

/**
 * GET /api/faturacao/relatorios/iva?periodo=2026-03
 * Devolve:
 *  - totais por taxa (0%, 5%, 14%)
 *  - total IVA liquidado
 *  - total base tributável
 *  - lista de facturas com breakdown de IVA
 */
router.get('/relatorios/iva', async (req, res) => {
  try {
    const { periodo } = req.query;
    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
      return res.status(400).json({ error: 'Período inválido. Formato: YYYY-MM' });
    }
    const userId = req.user.effectiveUserId;
    const { start, end } = periodBounds(periodo);

    const facturas = await prisma.factura.findMany({
      where: {
        userId,
        documentDate: { gte: start, lte: end },
        documentStatus: 'N',
        documentType: { notIn: ['PF'] }, // proformas não contam
      },
      select: {
        id: true, documentNo: true, documentDate: true,
        customerName: true, customerTaxID: true,
        netTotal: true, taxPayable: true, grossTotal: true,
        lines: true, documentType: true,
      },
      orderBy: { documentDate: 'asc' },
    });

    // Agregar por taxa
    const byRate = { 0: { base: 0, iva: 0, count: 0 }, 5: { base: 0, iva: 0, count: 0 }, 14: { base: 0, iva: 0, count: 0 } };
    let totalBase = 0;
    let totalIva  = 0;

    const rows = facturas.map((f) => {
      const lines = typeof f.lines === 'string' ? JSON.parse(f.lines) : f.lines;
      const lineBreakdown = [];
      let docBase = 0, docIva = 0;

      (lines || []).forEach((line) => {
        if (line.isIncluded) return;
        const base = line.settlementAmount ?? (line.quantity * line.unitPrice) ?? 0;
        const taxes = line.taxes || [];
        taxes.forEach((t) => {
          const pct = Number(t.taxPercentage) || 0;
          const iva = base * (pct / 100);
          docBase += base;
          docIva  += iva;
          const key = pct in byRate ? pct : 0;
          byRate[key].base  += base;
          byRate[key].iva   += iva;
          byRate[key].count += 1;
          lineBreakdown.push({ description: line.productDescription, base, pct, iva });
        });
      });

      totalBase += docBase;
      totalIva  += docIva;

      return {
        documentNo: f.documentNo,
        documentDate: f.documentDate,
        documentType: f.documentType,
        customerName: f.customerName,
        customerTaxID: f.customerTaxID,
        netTotal: f.netTotal,
        taxPayable: f.taxPayable,
        grossTotal: f.grossTotal,
        lineBreakdown,
      };
    });

    res.json({
      periodo,
      totalBase: Math.round(totalBase * 100) / 100,
      totalIva:  Math.round(totalIva  * 100) / 100,
      totalGross: Math.round((totalBase + totalIva) * 100) / 100,
      byRate: {
        rate0:  { ...byRate[0],  base: Math.round(byRate[0].base  * 100) / 100, iva: Math.round(byRate[0].iva  * 100) / 100 },
        rate5:  { ...byRate[5],  base: Math.round(byRate[5].base  * 100) / 100, iva: Math.round(byRate[5].iva  * 100) / 100 },
        rate14: { ...byRate[14], base: Math.round(byRate[14].base * 100) / 100, iva: Math.round(byRate[14].iva * 100) / 100 },
      },
      facturas: rows,
    });
  } catch (err) {
    console.error('IVA report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── IVA CSV export ────────────────────────────────────────────────────────────

router.get('/relatorios/iva/export', async (req, res) => {
  try {
    const { periodo } = req.query;
    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
      return res.status(400).json({ error: 'Período inválido.' });
    }
    const userId = req.user.effectiveUserId;
    const { start, end } = periodBounds(periodo);

    const facturas = await prisma.factura.findMany({
      where: { userId, documentDate: { gte: start, lte: end }, documentStatus: 'N', documentType: { notIn: ['PF'] } },
      select: { documentNo: true, documentDate: true, documentType: true, customerName: true, customerTaxID: true, netTotal: true, taxPayable: true, grossTotal: true },
      orderBy: { documentDate: 'asc' },
    });

    const rows = facturas.map((f) => ({
      documentNo:   f.documentNo,
      documentDate: new Date(f.documentDate).toLocaleDateString('pt-PT'),
      documentType: f.documentType,
      customerName: f.customerName,
      customerTaxID:f.customerTaxID,
      netTotal:     f.netTotal.toFixed(2),
      taxPayable:   f.taxPayable.toFixed(2),
      grossTotal:   f.grossTotal.toFixed(2),
    }));

    const csv = toCSV(rows, [
      { key: 'documentNo',    label: 'Nº Documento' },
      { key: 'documentDate',  label: 'Data' },
      { key: 'documentType',  label: 'Tipo' },
      { key: 'customerName',  label: 'Cliente' },
      { key: 'customerTaxID', label: 'NIF Cliente' },
      { key: 'netTotal',      label: 'Base Tributável (Kz)' },
      { key: 'taxPayable',    label: 'IVA (Kz)' },
      { key: 'grossTotal',    label: 'Total c/IVA (Kz)' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-iva-${periodo}.csv"`);
    res.send('\uFEFF' + csv); // BOM para Excel abrir correctamente
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Vendas por ano ────────────────────────────────────────────────────────────

/**
 * GET /api/faturacao/relatorios/vendas?year=2026
 * Devolve volume mensal de vendas (grossTotal, netTotal, taxPayable, count)
 */
router.get('/relatorios/vendas', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const userId = req.user.effectiveUserId;
    const { start, end } = yearBounds(year);

    const facturas = await prisma.factura.findMany({
      where: { userId, documentDate: { gte: start, lte: end }, documentStatus: 'N', documentType: { notIn: ['PF'] } },
      select: { documentDate: true, netTotal: true, taxPayable: true, grossTotal: true },
    });

    // Agregar por mês (1-12)
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(2000, i, 1).toLocaleString('pt-PT', { month: 'short' }),
      count: 0, netTotal: 0, taxPayable: 0, grossTotal: 0,
    }));

    facturas.forEach((f) => {
      const m = new Date(f.documentDate).getMonth(); // 0-indexed
      months[m].count++;
      months[m].netTotal   += f.netTotal;
      months[m].taxPayable += f.taxPayable;
      months[m].grossTotal += f.grossTotal;
    });

    months.forEach((m) => {
      m.netTotal   = Math.round(m.netTotal   * 100) / 100;
      m.taxPayable = Math.round(m.taxPayable * 100) / 100;
      m.grossTotal = Math.round(m.grossTotal * 100) / 100;
    });

    const totals = months.reduce((acc, m) => ({
      count:     acc.count     + m.count,
      netTotal:  acc.netTotal  + m.netTotal,
      taxPayable:acc.taxPayable + m.taxPayable,
      grossTotal:acc.grossTotal + m.grossTotal,
    }), { count: 0, netTotal: 0, taxPayable: 0, grossTotal: 0 });

    res.json({ year: Number(year), months, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Vendas CSV export ─────────────────────────────────────────────────────────

router.get('/relatorios/vendas/export', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const userId = req.user.effectiveUserId;
    const { start, end } = yearBounds(year);

    const facturas = await prisma.factura.findMany({
      where: { userId, documentDate: { gte: start, lte: end }, documentStatus: 'N', documentType: { notIn: ['PF'] } },
      select: { documentNo: true, documentDate: true, documentType: true, customerName: true, netTotal: true, taxPayable: true, grossTotal: true },
      orderBy: { documentDate: 'asc' },
    });

    const rows = facturas.map((f) => ({
      documentNo:   f.documentNo,
      documentDate: new Date(f.documentDate).toLocaleDateString('pt-PT'),
      documentType: f.documentType,
      customerName: f.customerName,
      netTotal:     f.netTotal.toFixed(2),
      taxPayable:   f.taxPayable.toFixed(2),
      grossTotal:   f.grossTotal.toFixed(2),
    }));

    const csv = toCSV(rows, [
      { key: 'documentNo',   label: 'Nº Documento' },
      { key: 'documentDate', label: 'Data' },
      { key: 'documentType', label: 'Tipo' },
      { key: 'customerName', label: 'Cliente' },
      { key: 'netTotal',     label: 'Base (Kz)' },
      { key: 'taxPayable',   label: 'IVA (Kz)' },
      { key: 'grossTotal',   label: 'Total c/IVA (Kz)' },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-vendas-${year}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
