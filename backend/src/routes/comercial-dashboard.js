const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseLines(lines) {
  try {
    const parsed = typeof lines === 'string' ? JSON.parse(lines) : lines;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toNumber(value) {
  return Number(value || 0);
}

// GET /api/comercial/resumo
router.get('/resumo', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const hoje = startOfDay(new Date());
    const ontem = startOfDay(new Date(hoje));
    ontem.setDate(ontem.getDate() - 1);
    const amanha = startOfDay(new Date(hoje));
    amanha.setDate(amanha.getDate() + 1);

    const [hojeAgg, ontemAgg, facturasHoje, estabelecimentos, produtosAlerta] = await Promise.all([
      prisma.factura.aggregate({
        where: { userId, documentDate: { gte: hoje, lt: amanha }, documentStatus: 'N' },
        _sum: { grossTotal: true },
        _count: { id: true },
      }),
      prisma.factura.aggregate({
        where: { userId, documentDate: { gte: ontem, lt: hoje }, documentStatus: 'N' },
        _sum: { grossTotal: true },
        _count: { id: true },
      }),
      prisma.factura.findMany({
        where: { userId, documentDate: { gte: hoje, lt: amanha }, documentStatus: 'N' },
        select: { lines: true, grossTotal: true, estabelecimentoId: true },
      }),
      prisma.estabelecimento.findMany({
        where: { userId },
        select: { id: true, nome: true },
      }),
      prisma.produto.findMany({
        where: { userId, active: true, stockMinimo: { not: null } },
        select: { id: true, stock: true, stockMinimo: true },
      }),
    ]);

    const totalHoje = toNumber(hojeAgg._sum.grossTotal);
    const totalOntem = toNumber(ontemAgg._sum.grossTotal);
    const variacao = totalOntem > 0
      ? Number((((totalHoje - totalOntem) / totalOntem) * 100).toFixed(1))
      : 0;

    const produtoMap = {};
    const estabMap = {};

    for (const factura of facturasHoje) {
      for (const line of parseLines(factura.lines)) {
        const key = line.productCode;
        if (!produtoMap[key]) {
          produtoMap[key] = {
            productCode: key,
            productDescription: line.productDescription,
            quantidadeVendida: 0,
            facturacaoTotal: 0,
          };
        }
        produtoMap[key].quantidadeVendida += Number(line.quantity || 0);
        produtoMap[key].facturacaoTotal += Number(line.quantity || 0) * Number(line.unitPrice || 0);
      }

      if (!estabMap[factura.estabelecimentoId]) estabMap[factura.estabelecimentoId] = 0;
      estabMap[factura.estabelecimentoId] += toNumber(factura.grossTotal);
    }

    const topProduto = Object.values(produtoMap)
      .sort((a, b) => b.quantidadeVendida - a.quantidadeVendida)[0] || null;

    const topEstabId = Object.entries(estabMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const estabelecimentoDestaque = topEstabId
      ? {
          id: topEstabId,
          nome: estabelecimentos.find((e) => e.id === topEstabId)?.nome || topEstabId,
          totalHoje: estabMap[topEstabId],
        }
      : null;

    const stockAlertaCount = produtosAlerta.filter((p) => (p.stock ?? 0) <= (p.stockMinimo ?? 0)).length;

    res.json({
      totalHoje,
      vendasHoje: hojeAgg._count.id,
      totalOntem,
      variacao,
      topProduto,
      estabelecimentoDestaque,
      stockAlertaCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/comercial/insights
router.get('/insights', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const hoje = startOfDay(new Date());
    const amanha = startOfDay(new Date(hoje));
    amanha.setDate(amanha.getDate() + 1);
    const ontem = startOfDay(new Date(hoje));
    ontem.setDate(ontem.getDate() - 1);

    const [hojeAgg, ontemAgg, produtosAlerta, facturasHoje] = await Promise.all([
      prisma.factura.aggregate({
        where: { userId, documentDate: { gte: hoje, lt: amanha }, documentStatus: 'N' },
        _sum: { grossTotal: true },
        _count: { id: true },
      }),
      prisma.factura.aggregate({
        where: { userId, documentDate: { gte: ontem, lt: hoje }, documentStatus: 'N' },
        _sum: { grossTotal: true },
      }),
      prisma.produto.findMany({
        where: { userId, active: true, stockMinimo: { not: null } },
        select: { stock: true, stockMinimo: true },
      }),
      prisma.factura.findMany({
        where: { userId, documentDate: { gte: hoje, lt: amanha }, documentStatus: 'N' },
        select: { lines: true },
      }),
    ]);

    const totalHoje = toNumber(hojeAgg._sum.grossTotal);
    const totalOntem = toNumber(ontemAgg._sum.grossTotal);
    const variacao = totalOntem > 0 ? ((totalHoje - totalOntem) / totalOntem) * 100 : 0;
    const alertaCount = produtosAlerta.filter((p) => (p.stock ?? 0) <= (p.stockMinimo ?? 0)).length;

    const produtoMap = {};
    for (const factura of facturasHoje) {
      for (const line of parseLines(factura.lines)) {
        if (!produtoMap[line.productCode]) {
          produtoMap[line.productCode] = { desc: line.productDescription, qty: 0 };
        }
        produtoMap[line.productCode].qty += Number(line.quantity || 0);
      }
    }

    const topProduto = Object.values(produtoMap).sort((a, b) => b.qty - a.qty)[0] || null;
    const insights = [];

    if (totalHoje === 0) {
      insights.push('Ainda não há vendas registadas hoje.');
    } else if (variacao > 0) {
      insights.push(`As vendas subiram ${Math.abs(variacao).toFixed(0)}% em relação a ontem.`);
    } else if (variacao < 0) {
      insights.push(`As vendas desceram ${Math.abs(variacao).toFixed(0)}% em relação a ontem.`);
    } else {
      insights.push('As vendas estão ao mesmo nível de ontem.');
    }

    if (topProduto) insights.push(`"${topProduto.desc}" foi o produto mais vendido hoje (${topProduto.qty} un).`);
    if (alertaCount > 0) insights.push(`${alertaCount} produto(s) com stock baixo. Verifique o inventário.`);
    if (hojeAgg._count.id > 0) insights.push(`${hojeAgg._count.id} venda(s) emitida(s) hoje.`);

    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/comercial/analise
router.get('/analise', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const { dias = '30', estabelecimentoId } = req.query;
    const numDias = Math.min(Number(dias) || 30, 90);

    const desde = new Date();
    desde.setDate(desde.getDate() - numDias);
    desde.setHours(0, 0, 0, 0);

    const whereBase = {
      userId,
      documentDate: { gte: desde },
      documentStatus: 'N',
      ...(estabelecimentoId ? { estabelecimentoId } : {}),
    };

    const [facturas, estabelecimentos, produtosParadosCandidatos] = await Promise.all([
      prisma.factura.findMany({
        where: whereBase,
        select: { lines: true, grossTotal: true, documentDate: true, estabelecimentoId: true },
      }),
      prisma.estabelecimento.findMany({
        where: { userId },
        select: { id: true, nome: true },
      }),
      prisma.produto.findMany({
        where: { userId, active: true },
        select: {
          id: true,
          productCode: true,
          productDescription: true,
          stock: true,
          stockMinimo: true,
          categoriaId: true,
        },
      }),
    ]);

    const produtoMap = {};
    const estabMap = {};
    const diaMap = {};

    for (const factura of facturas) {
      const dia = factura.documentDate.toISOString().slice(0, 10);
      if (!diaMap[dia]) diaMap[dia] = { date: dia, total: 0, count: 0 };
      diaMap[dia].total += toNumber(factura.grossTotal);
      diaMap[dia].count += 1;

      if (!estabMap[factura.estabelecimentoId]) estabMap[factura.estabelecimentoId] = { total: 0, count: 0 };
      estabMap[factura.estabelecimentoId].total += toNumber(factura.grossTotal);
      estabMap[factura.estabelecimentoId].count += 1;

      for (const line of parseLines(factura.lines)) {
        if (!produtoMap[line.productCode]) {
          produtoMap[line.productCode] = {
            productCode: line.productCode,
            productDescription: line.productDescription,
            quantidadeTotal: 0,
            facturacaoTotal: 0,
          };
        }
        produtoMap[line.productCode].quantidadeTotal += Number(line.quantity || 0);
        produtoMap[line.productCode].facturacaoTotal += Number(line.quantity || 0) * Number(line.unitPrice || 0);
      }
    }

    const totalVendas = facturas.reduce((sum, factura) => sum + toNumber(factura.grossTotal), 0);
    const numVendas = facturas.length;
    const ticketMedio = numVendas > 0 ? totalVendas / numVendas : 0;
    const topPorQuantidade = Object.values(produtoMap).sort((a, b) => b.quantidadeTotal - a.quantidadeTotal).slice(0, 10);
    const topPorFacturacao = Object.values(produtoMap).sort((a, b) => b.facturacaoTotal - a.facturacaoTotal).slice(0, 10);

    const codigosVendidos = new Set(Object.keys(produtoMap));
    const produtosParados = produtosParadosCandidatos.filter((p) => !codigosVendidos.has(p.productCode));

    const rankingEstabelecimentos = Object.entries(estabMap)
      .map(([id, data]) => ({
        id,
        nome: estabelecimentos.find((e) => e.id === id)?.nome || id,
        ...data,
      }))
      .sort((a, b) => b.total - a.total);

    const vendasPorDia = Object.values(diaMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      totalVendas,
      numVendas,
      ticketMedio,
      topPorQuantidade,
      topPorFacturacao,
      produtosParados,
      rankingEstabelecimentos,
      vendasPorDia,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
