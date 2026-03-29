# KukuGest — Plano de Implementação: POS + Operações + Insights

> **Versão:** 1.0
> **Data:** 2026-03-29
> **Estado:** Fases 0–4 concluídas. Este documento cobre as Fases A–E.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Estado Actual do Sistema](#2-estado-actual-do-sistema)
3. [Arquitectura da Solução](#3-arquitectura-da-solução)
4. [Fase A — Fundação de Schema + Regras](#4-fase-a--fundação-de-schema--regras)
5. [Fase B — Painel Comercial Básico](#5-fase-b--painel-comercial-básico)
6. [Fase C — Página de Caixa + Sidebar](#6-fase-c--página-de-caixa--sidebar)
7. [Fase D — Produtos Melhorado](#7-fase-d--produtos-melhorado)
8. [Fase E — Permissões Granulares + Análise Avançada](#8-fase-e--permissões-granulares--análise-avançada)
9. [Schema Prisma Completo (após todas as fases)](#9-schema-prisma-completo-após-todas-as-fases)
10. [Endpoints Backend Completos](#10-endpoints-backend-completos)
11. [Estrutura de Permissões](#11-estrutura-de-permissões)
12. [Tipos TypeScript](#12-tipos-typescript)
13. [Funções API Frontend](#13-funções-api-frontend)
14. [Riscos e Mitigações](#14-riscos-e-mitigações)
15. [Checklist de Testes](#15-checklist-de-testes)

---

## 1. Visão Geral

### Objectivo

Transformar o KukuGest de **CRM + faturação** para **sistema completo de gestão de negócio** com:

- POS (Ponto de Venda) operacional
- Controlo de caixa por turnos
- Painel comercial com insights automáticos
- Gestão de stock e categorias de produtos
- Permissões granulares por função/perfil
- Experiência diferenciada por tipo de utilizador

### Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Express + Prisma (CommonJS) |
| Base de dados | PostgreSQL (Supabase / Render) |
| Frontend | Next.js App Router + TypeScript + React Query + Tailwind |
| Auth | Supabase (JWT) |
| ORM | Prisma 5.x |

### Princípios que não mudam

- Backend é a **única fonte de verdade** — permissões, regras, dados
- `effectiveUserId = accountOwnerId || user.id` — tudo scoped à conta
- Sem migrações Prisma — usar `npx prisma db push` directamente
- CommonJS no backend (`require` / `module.exports`)
- TypeScript/TSX no frontend com React Query para estado remoto
- Sem big-bang — cada fase é independente e não quebra o que existe

---

## 2. Estado Actual do Sistema

### O que já existe

| Funcionalidade | Estado | Notas |
|---|---|---|
| CRM (contactos, tarefas, pipeline) | ✅ Completo | |
| Faturação AGT (séries, faturas, PDF) | ✅ Completo | |
| Vendas Rápidas (quick sales) | ✅ Completo | |
| Finanças (transações, relatórios) | ✅ Completo | |
| CaixaSessao (abrir/fechar) | ✅ Completo | Regra errada — ver Fase A |
| Stock (campo + movimentos manuais) | ✅ Parcial | Falta decrement automático |
| Permissões por módulo | ✅ Parcial | none/view/edit — falta granularidade |
| Sidebar modo comercio | ✅ Parcial | Falta Caixa, Relatórios; sobram itens |

### O que falta

| Funcionalidade | Fase |
|---|---|
| Regra de 1 caixa por estabelecimento | A |
| Breakdown de pagamentos por sessão | A |
| Categorias de produtos (`ProdutoCategoria`) | A |
| Stock mínimo (`stockMinimo`) por produto | A |
| Stock auto-decrement na venda rápida | A |
| Painel comercial com dados de vendas | B |
| Insights automáticos ("vendas subiram X%") | B |
| Página `/caixa` (sessão + histórico) | C |
| Sidebar comercio reestruturada | C |
| Indicadores visuais de alerta de stock | D |
| Filtro por categoria na listagem de produtos | D |
| Permissões granulares (caixa.open, stock.edit, etc.) | E |
| Painel de análise com gráficos | E |

---

## 3. Arquitectura da Solução

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                      │
│                                                                 │
│  /                    → Painel Comercial (em modo comercio)     │
│  /caixa               → Sessão activa + histórico (NOVO)        │
│  /vendas-rapidas      → POS com gate de sessão                  │
│  /produtos            → CRUD + categorias + stock               │
│  /vendas              → Faturação                               │
│  /relatorios          → Relatórios (NOVO - sidebar)             │
│                                                                 │
│  lib/api.ts           → todas as chamadas à API                 │
│  lib/types.ts         → interfaces TypeScript                   │
│  lib/permissions.ts   → helpers de permissão frontend           │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP (Bearer JWT)
┌────────────────────────▼────────────────────────────────────────┐
│                        BACKEND (Express)                        │
│                                                                 │
│  /api/caixa/*             → caixa-sessoes.js                    │
│  /api/quick-sales/*       → quick-sales.js                      │
│  /api/produto-categorias  → produto-categorias.js (NOVO)        │
│  /api/comercial/*         → comercial-dashboard.js (NOVO)       │
│  /api/faturacao/produtos  → faturacao-produtos.js               │
│                                                                 │
│  middleware: requireAuth → requirePlanFeature → route handler   │
│                                                                 │
│  lib/permissions.js   → estrutura expandida                     │
│  lib/plan-limits.js   → feature gating                         │
└────────────────────────┬────────────────────────────────────────┘
                         │ Prisma Client
┌────────────────────────▼────────────────────────────────────────┐
│                    PostgreSQL (Render/Supabase)                  │
│                                                                 │
│  Produto          → + stockMinimo + categoriaId                 │
│  ProdutoCategoria → NOVO                                        │
│  CaixaSessao      → + totalCash + totalMulticaixa + totalTrans  │
│  Factura          → sem alterações                              │
│  StockMovement    → sem alterações                              │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de uma venda rápida (após todas as fases)

```
1. Utilizador abre /vendas-rapidas
2. Sistema verifica sessão de caixa aberta no estabelecimento
   → sem sessão: mostra gate "Abrir Caixa"
   → com sessão: mostra UI de venda
3. Utilizador adiciona produtos ao carrinho
4. Clica "Emitir Fatura"
5. Backend (quick-sales.js):
   a. Valida produtos (existência + activos)
   b. Busca sessão aberta no estabelecimento
   c. Resolve série e estabelecimento
   d. createFactura() → gera factura com hash AGT
   e. Decrementa stock para cada produto com controlo
   f. Cria StockMovement tipo "exit" por produto
   g. Actualiza totalSalesAmount + salesCount na sessão
   h. Liga factura à sessão (caixaSessaoId)
6. Frontend invalida query ['caixa-sessao-atual']
7. Banner de sessão actualiza em tempo real
```

---

## 4. Fase A — Fundação de Schema + Regras

> **Prioridade:** Alta — pré-requisito para todas as outras fases
> **Ficheiros afectados:** schema.prisma, caixa-sessoes.js, quick-sales.js, produto-categorias.js, index.js

### 4.1 Alterações ao Schema Prisma

**Ficheiro:** `backend/prisma/schema.prisma`

#### 4.1.1 Novo modelo `ProdutoCategoria`

Adicionar **antes** do modelo `Produto`:

```prisma
model ProdutoCategoria {
  id        String    @id @default(cuid())
  userId    Int
  nome      String
  cor       String?   @default("#6b7e9a")
  isDefault Boolean   @default(false)
  createdAt DateTime  @default(now())
  user      User      @relation("ProdutoCategoriaUser", fields: [userId], references: [id], onDelete: Cascade)
  produtos  Produto[]

  @@unique([userId, nome])
}
```

#### 4.1.2 Actualizar modelo `Produto`

Adicionar dois campos e a relação:

```prisma
model Produto {
  // ... campos existentes inalterados ...
  stock              Int?     @default(0)    // já existe
  stockMinimo        Int?     @default(0)    // NOVO
  categoriaId        String?                 // NOVO
  // ... relações existentes ...
  categoria          ProdutoCategoria? @relation(fields: [categoriaId], references: [id], onDelete: SetNull)
}
```

#### 4.1.3 Actualizar modelo `CaixaSessao`

Adicionar três campos de breakdown:

```prisma
model CaixaSessao {
  // ... campos existentes inalterados ...
  salesCount            Int             @default(0)   // já existe
  totalCash             Float           @default(0)   // NOVO
  totalMulticaixa       Float           @default(0)   // NOVO
  totalTransferencia    Float           @default(0)   // NOVO
  // ... relações existentes ...
}
```

#### 4.1.4 Actualizar modelo `User`

Adicionar a nova relação:

```prisma
model User {
  // ... campos e relações existentes ...
  produtoCategorias    ProdutoCategoria[] @relation("ProdutoCategoriaUser")  // NOVO
}
```

#### 4.1.5 Aplicar o schema

```bash
cd backend
npx prisma db push
npx prisma generate
```

> ⚠️ **Atenção:** Antes de fazer `db push`, fechar manualmente todas as sessões de caixa abertas. A mudança de regra (user → estabelecimento) pode causar conflito se existirem sessões abertas.

---

### 4.2 Corrigir regra de CaixaSessao

A regra actual é "1 sessão aberta por utilizador". A regra correcta é "1 sessão aberta por estabelecimento".

**Ficheiro:** `backend/src/routes/caixa-sessoes.js`

#### POST /sessoes (abrir) — alterar verificação de conflito

```javascript
// ANTES
const sessaoAberta = await prisma.caixaSessao.findFirst({
  where: { openedByUserId: req.user.id, status: 'open' },
  select: { id: true, estabelecimento: { select: { nome: true } } },
});
if (sessaoAberta) {
  return res.status(409).json({
    error: `Já existe uma sessão aberta em ${sessaoAberta.estabelecimento.nome}. Feche-a antes de abrir uma nova.`,
  });
}

// DEPOIS
const sessaoAberta = await prisma.caixaSessao.findFirst({
  where: { userId, estabelecimentoId, status: 'open' },
  select: { id: true, openedBy: { select: { name: true } } },
});
if (sessaoAberta) {
  return res.status(409).json({
    error: `Já existe um caixa aberto neste ponto de venda por ${sessaoAberta.openedBy?.name || 'outro utilizador'}.`,
  });
}
```

#### GET /sessoes/atual — actualizar para buscar por estabelecimento se fornecido

```javascript
// Aceitar query param ?estabelecimentoId para filtrar
router.get('/sessoes/atual', async (req, res) => {
  const { estabelecimentoId } = req.query;
  const where = { userId: req.user.effectiveUserId, status: 'open' };
  if (estabelecimentoId) where.estabelecimentoId = estabelecimentoId;
  else where.openedByUserId = req.user.id; // fallback: sessão do próprio user

  const sessao = await prisma.caixaSessao.findFirst({
    where, include: SESSION_INCLUDE, orderBy: { openedAt: 'desc' },
  });
  res.json(sessao || null);
});
```

---

### 4.3 Breakdown de pagamentos no fecho

**Ficheiro:** `backend/src/routes/caixa-sessoes.js`

No endpoint `PATCH /sessoes/:id/fechar`, calcular breakdown **antes** de actualizar:

```javascript
// Calcular breakdown por método de pagamento
const facturasDaSessao = await prisma.factura.findMany({
  where: { caixaSessaoId: sessao.id, documentStatus: 'N' },
  select: { grossTotal: true, paymentMethod: true },
});

const totalCash = facturasDaSessao
  .filter(f => f.paymentMethod === 'CASH')
  .reduce((sum, f) => sum + f.grossTotal, 0);

const totalMulticaixa = facturasDaSessao
  .filter(f => f.paymentMethod === 'MULTICAIXA')
  .reduce((sum, f) => sum + f.grossTotal, 0);

const totalTransferencia = facturasDaSessao
  .filter(f => !['CASH', 'MULTICAIXA'].includes(f.paymentMethod))
  .reduce((sum, f) => sum + f.grossTotal, 0);

// Incluir no update
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
    totalTransferencia,
    notes: notes || null,
  },
  include: SESSION_INCLUDE,
});
```

---

### 4.4 Nova rota: Categorias de Produtos

**Ficheiro novo:** `backend/src/routes/produto-categorias.js`

```javascript
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET /api/produto-categorias
router.get('/', async (req, res) => {
  const userId = req.user.effectiveUserId;
  const categorias = await prisma.produtoCategoria.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { nome: 'asc' }],
    include: { _count: { select: { produtos: true } } },
  });
  res.json(categorias);
});

// POST /api/produto-categorias
router.post('/', async (req, res) => {
  const userId = req.user.effectiveUserId;
  const { nome, cor } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
  const categoria = await prisma.produtoCategoria.create({
    data: { userId, nome: nome.trim(), cor: cor || null },
  });
  res.status(201).json(categoria);
});

// PATCH /api/produto-categorias/:id
router.patch('/:id', async (req, res) => {
  const userId = req.user.effectiveUserId;
  const cat = await prisma.produtoCategoria.findFirst({ where: { id: req.params.id, userId } });
  if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
  const { nome, cor } = req.body;
  const updated = await prisma.produtoCategoria.update({
    where: { id: req.params.id },
    data: { ...(nome && { nome: nome.trim() }), ...(cor !== undefined && { cor }) },
  });
  res.json(updated);
});

// DELETE /api/produto-categorias/:id
router.delete('/:id', async (req, res) => {
  const userId = req.user.effectiveUserId;
  const cat = await prisma.produtoCategoria.findFirst({
    where: { id: req.params.id, userId },
    include: { _count: { select: { produtos: true } } },
  });
  if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
  if (cat._count.produtos > 0) {
    return res.status(409).json({
      error: `Esta categoria tem ${cat._count.produtos} produto(s). Reassociar antes de eliminar.`,
    });
  }
  await prisma.produtoCategoria.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

module.exports = router;
```

---

### 4.5 Stock auto-decrement na venda rápida

**Ficheiro:** `backend/src/routes/quick-sales.js`

#### Step 1 — Ampliar select de produtos

```javascript
// ANTES
const produtos = await prisma.produto.findMany({
  where: { userId, productCode: { in: productCodes }, active: true },
  select: { productCode: true },
});

// DEPOIS
const produtos = await prisma.produto.findMany({
  where: { userId, productCode: { in: productCodes }, active: true },
  select: { id: true, productCode: true, stock: true, stockMinimo: true,
            productDescription: true, unitPrice: true },
});
// Criar map para acesso rápido por productCode
const produtosMap = new Map(produtos.map(p => [p.productCode, p]));
```

#### Após createFactura — decrementar stock

```javascript
const factura = await createFactura(userId, facturaBody, req);

// Decrementar stock para cada item com controlo de stock
for (const item of items) {
  const p = produtosMap.get(item.productCode);
  if (p && p.stock != null) {
    const newStock = Math.max(0, p.stock - item.quantity);
    await prisma.$transaction(async (tx) => {
      await tx.produto.update({
        where: { id: p.id },
        data: { stock: newStock },
      });
      await tx.stockMovement.create({
        data: {
          productId: p.id,
          userId,
          type: 'exit',
          quantity: item.quantity,
          previousStock: p.stock,
          newStock,
          reason: 'Venda rápida',
          referenceType: 'quick_sale',
          referenceId: factura.id,
          createdByUserId: req.user.id,
        },
      });
    });
  }
}
```

---

### 4.6 Registar rotas em index.js

**Ficheiro:** `backend/src/index.js`

```javascript
const produtoCategoriasRouter = require('./routes/produto-categorias');

// Registar (junto aos outros /api/faturacao routes)
app.use('/api/produto-categorias', requireAuth, requirePlanFeature('vendas'), produtoCategoriasRouter);
```

---

## 5. Fase B — Painel Comercial Básico

> **Pré-requisito:** Fase A concluída
> **Ficheiros afectados:** comercial-dashboard.js (novo), index.js, page.tsx, types.ts, api.ts

### 5.1 Nova rota: Painel Comercial Backend

**Ficheiro novo:** `backend/src/routes/comercial-dashboard.js`

```javascript
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
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
      // Totais de hoje
      prisma.factura.aggregate({
        where: { userId, documentDate: { gte: hoje, lt: amanha }, documentStatus: 'N' },
        _sum: { grossTotal: true }, _count: { id: true },
      }),
      // Totais de ontem
      prisma.factura.aggregate({
        where: { userId, documentDate: { gte: ontem, lt: hoje }, documentStatus: 'N' },
        _sum: { grossTotal: true }, _count: { id: true },
      }),
      // Facturas de hoje com lines para calcular top produto
      prisma.factura.findMany({
        where: { userId, documentDate: { gte: hoje, lt: amanha }, documentStatus: 'N' },
        select: { lines: true, grossTotal: true, estabelecimentoId: true },
      }),
      // Estabelecimentos para nome
      prisma.estabelecimento.findMany({
        where: { userId },
        select: { id: true, nome: true },
      }),
      // Produtos com stock em alerta
      prisma.produto.findMany({
        where: { userId, active: true, stockMinimo: { not: null } },
        select: { id: true, stock: true, stockMinimo: true },
      }),
    ]);

    // Calcular variação %
    const totalHoje = hojeAgg._sum.grossTotal || 0;
    const totalOntem = ontemAgg._sum.grossTotal || 0;
    const variacao = totalOntem > 0
      ? Number((((totalHoje - totalOntem) / totalOntem) * 100).toFixed(1))
      : 0;

    // Top produto por quantidade
    const produtoMap = {};
    for (const f of facturasHoje) {
      try {
        const lines = JSON.parse(f.lines);
        for (const line of lines) {
          const key = line.productCode;
          if (!produtoMap[key]) {
            produtoMap[key] = { productCode: key, productDescription: line.productDescription, quantidadeVendida: 0, facturacaoTotal: 0 };
          }
          produtoMap[key].quantidadeVendida += line.quantity;
          produtoMap[key].facturacaoTotal += line.quantity * line.unitPrice;
        }
      } catch {}
    }
    const topProduto = Object.values(produtoMap).sort((a, b) => b.quantidadeVendida - a.quantidadeVendida)[0] || null;

    // Estabelecimento destaque (mais vendas hoje)
    const estabMap = {};
    for (const f of facturasHoje) {
      if (!estabMap[f.estabelecimentoId]) estabMap[f.estabelecimentoId] = 0;
      estabMap[f.estabelecimentoId] += f.grossTotal;
    }
    const topEstabId = Object.entries(estabMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const topEstab = topEstabId
      ? { id: topEstabId, nome: estabelecimentos.find(e => e.id === topEstabId)?.nome || topEstabId, totalHoje: estabMap[topEstabId] }
      : null;

    // Stock em alerta
    const alertaCount = produtosAlerta.filter(p => (p.stock ?? 0) <= (p.stockMinimo ?? 0)).length;

    res.json({
      totalHoje, vendasHoje: hojeAgg._count.id,
      totalOntem, variacao,
      topProduto,
      estabelecimentoDestaque: topEstab,
      stockAlertaCount: alertaCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/comercial/insights
router.get('/insights', async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;

    // Reutilizar lógica do resumo
    const hoje = startOfDay(new Date());
    const amanha = startOfDay(new Date(hoje)); amanha.setDate(amanha.getDate() + 1);
    const ontem = startOfDay(new Date(hoje)); ontem.setDate(ontem.getDate() - 1);

    const [hojeAgg, ontemAgg, produtosAlerta, facturasHoje] = await Promise.all([
      prisma.factura.aggregate({
        where: { userId, documentDate: { gte: hoje, lt: amanha }, documentStatus: 'N' },
        _sum: { grossTotal: true }, _count: { id: true },
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

    const totalHoje = hojeAgg._sum.grossTotal || 0;
    const totalOntem = ontemAgg._sum.grossTotal || 0;
    const variacao = totalOntem > 0 ? ((totalHoje - totalOntem) / totalOntem) * 100 : 0;
    const alertaCount = produtosAlerta.filter(p => (p.stock ?? 0) <= (p.stockMinimo ?? 0)).length;

    // Top produto
    const produtoMap = {};
    for (const f of facturasHoje) {
      try {
        for (const line of JSON.parse(f.lines)) {
          if (!produtoMap[line.productCode]) produtoMap[line.productCode] = { desc: line.productDescription, qty: 0 };
          produtoMap[line.productCode].qty += line.quantity;
        }
      } catch {}
    }
    const topProduto = Object.values(produtoMap).sort((a, b) => b.qty - a.qty)[0] || null;

    const insights = [];
    if (totalHoje === 0) {
      insights.push('Ainda não há vendas registadas hoje.');
    } else {
      if (variacao > 0) insights.push(`As vendas subiram ${Math.abs(variacao).toFixed(0)}% em relação a ontem.`);
      else if (variacao < 0) insights.push(`As vendas desceram ${Math.abs(variacao).toFixed(0)}% em relação a ontem.`);
      else insights.push('As vendas estão ao mesmo nível de ontem.');
    }
    if (topProduto) insights.push(`"${topProduto.desc}" foi o produto mais vendido hoje (${topProduto.qty} un).`);
    if (alertaCount > 0) insights.push(`${alertaCount} produto(s) com stock baixo. Verifique o inventário.`);
    if (hojeAgg._count.id > 0) insights.push(`${hojeAgg._count.id} venda(s) emitida(s) hoje.`);

    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/comercial/analise  (Fase E — análise detalhada)
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
      ...(estabelecimentoId && { estabelecimentoId }),
    };

    const [facturas, estabelecimentos, produtosParadosCandidatos] = await Promise.all([
      prisma.factura.findMany({
        where: whereBase,
        select: { lines: true, grossTotal: true, netTotal: true, documentDate: true, estabelecimentoId: true },
      }),
      prisma.estabelecimento.findMany({ where: { userId }, select: { id: true, nome: true } }),
      prisma.produto.findMany({
        where: { userId, active: true },
        select: { id: true, productCode: true, productDescription: true, stock: true },
      }),
    ]);

    // Agregar por produto
    const produtoMap = {};
    const estabMap = {};
    const diaMap = {};

    for (const f of facturas) {
      // Por dia
      const dia = f.documentDate.toISOString().slice(0, 10);
      if (!diaMap[dia]) diaMap[dia] = { date: dia, total: 0, count: 0 };
      diaMap[dia].total += f.grossTotal;
      diaMap[dia].count += 1;

      // Por estabelecimento
      if (!estabMap[f.estabelecimentoId]) estabMap[f.estabelecimentoId] = { total: 0, count: 0 };
      estabMap[f.estabelecimentoId].total += f.grossTotal;
      estabMap[f.estabelecimentoId].count += 1;

      // Por produto
      try {
        for (const line of JSON.parse(f.lines)) {
          if (!produtoMap[line.productCode]) {
            produtoMap[line.productCode] = { productCode: line.productCode, productDescription: line.productDescription, quantidadeTotal: 0, facturacaoTotal: 0 };
          }
          produtoMap[line.productCode].quantidadeTotal += line.quantity;
          produtoMap[line.productCode].facturacaoTotal += line.quantity * line.unitPrice;
        }
      } catch {}
    }

    const totalVendas = facturas.reduce((s, f) => s + f.grossTotal, 0);
    const numVendas = facturas.length;
    const ticketMedio = numVendas > 0 ? totalVendas / numVendas : 0;

    const topPorQuantidade = Object.values(produtoMap).sort((a, b) => b.quantidadeTotal - a.quantidadeTotal).slice(0, 10);
    const topPorFacturacao = Object.values(produtoMap).sort((a, b) => b.facturacaoTotal - a.facturacaoTotal).slice(0, 10);

    // Produtos parados — sem vendas no período
    const codigosVendidos = new Set(Object.keys(produtoMap));
    const produtosParados = produtosParadosCandidatos.filter(p => !codigosVendidos.has(p.productCode));

    // Ranking estabelecimentos
    const rankingEstabelecimentos = Object.entries(estabMap)
      .map(([id, data]) => ({ id, nome: estabelecimentos.find(e => e.id === id)?.nome || id, ...data }))
      .sort((a, b) => b.total - a.total);

    // Vendas por dia (array ordenado)
    const vendasPorDia = Object.values(diaMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ totalVendas, numVendas, ticketMedio, topPorQuantidade, topPorFacturacao, produtosParados, rankingEstabelecimentos, vendasPorDia });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

### 5.2 Registar em index.js

```javascript
const comercialDashboardRouter = require('./routes/comercial-dashboard');
app.use('/api/comercial', requireAuth, requirePlanFeature('vendas'), comercialDashboardRouter);
```

### 5.3 Frontend — Painel Comercial

#### 5.3.1 Integrar em page.tsx

**Ficheiro:** `frontend/src/app/page.tsx`

```tsx
// No topo do componente principal
const { workspaceMode } = useUser(); // hook existente

if (isComercio(workspaceMode)) {
  return <PainelComercialPage />;
}
// ... resto do dashboard CRM existente inalterado
```

#### 5.3.2 Componente PainelComercial

**Ficheiro novo:** `frontend/src/components/comercial/painel-comercial.tsx`

**Estrutura do componente:**

```tsx
export default function PainelComercialPage() {
  const [modo, setModo] = useState<'resumo' | 'analise'>('resumo');
  const { user } = useUser();
  const podeAnalise = canComercialDashboardAnalysis(user);

  const { data: resumo, isLoading } = useQuery(['comercial-resumo'], getComercialResumo, { refetchInterval: 60_000 });
  const { data: insights } = useQuery(['comercial-insights'], getComercialInsights, { refetchInterval: 60_000 });

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-4">
      {/* Header com toggle */}
      <div className="flex items-center justify-between">
        <h1>Painel Comercial</h1>
        {podeAnalise && (
          <div className="flex rounded-lg border">
            <button onClick={() => setModo('resumo')} className={...}>Resumo</button>
            <button onClick={() => setModo('analise')} className={...}>Análise</button>
          </div>
        )}
      </div>

      {modo === 'resumo' ? <PainelResumo resumo={resumo} insights={insights} /> : <PainelAnalise />}
    </div>
  );
}
```

**Cards do modo RESUMO:**

```
┌──────────────────┐ ┌──────────────────┐
│ 💰 Total hoje    │ │ 🛒 Vendas hoje   │
│ 150.000 Kz       │ │ 12               │
│ ↑ 11.9% vs ontem │ │                  │
└──────────────────┘ └──────────────────┘
┌──────────────────┐ ┌──────────────────┐
│ 🏆 Top produto   │ │ ⚠️ Stock baixo   │
│ Água 1.5L        │ │ 3 produtos       │
│ 24 unidades      │ │ Ver produtos →   │
└──────────────────┘ └──────────────────┘

💬 "As vendas subiram 12% vs ontem"
💬 "Água 1.5L foi o produto mais vendido hoje"
```

---

## 6. Fase C — Página de Caixa + Sidebar

> **Pré-requisito:** Fase A concluída
> **Ficheiros afectados:** sidebar.tsx, caixa/page.tsx (novo), api.ts

### 6.1 Sidebar comercio — nova estrutura

**Ficheiro:** `frontend/src/components/layout/sidebar.tsx`

#### Alteração nos arrays de links

```tsx
// hrefToModule — adicionar
'/caixa': 'vendas',

// comercioUsoDiarioLinks — substituir array existente
const comercioUsoDiarioLinks = comercio ? [
  { href: '/', label: 'Painel', icon: BarChart3 },
  { href: '/caixa', label: 'Caixa', icon: CreditCard, module: 'vendas' as const },       // NOVO
  { href: '/vendas-rapidas', label: 'Venda Rápida', icon: ShoppingCart, module: 'vendas' as const },
  { href: '/contacts', label: 'Clientes', icon: Users, module: 'contacts' as const },
  { href: '/produtos', label: 'Produtos', icon: Package, module: 'vendas' as const },
].filter(l => isVisible(l.href)) : [];

// comercioGestaoLinks — substituir array existente (remover pipeline/chat/cal/auto/forms/finances)
const comercioGestaoLinks = comercio ? [
  { href: '/vendas', label: 'Faturação', icon: ShoppingBag, module: 'vendas' as const },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
].filter(l => isVisible(l.href)) : [];
```

> **Nota:** Importar `CreditCard` do lucide-react.

---

### 6.2 Nova página /caixa

**Ficheiro novo:** `frontend/src/app/caixa/page.tsx`

**Estrutura de tabs:**

```
┌──────────────────────────────────────────────────┐
│  Caixa                    [Fechar Caixa] [Abrir] │
└──────────────────────────────────────────────────┘

[Sessão Actual] [Histórico] [Auditoria*]
*só com permissão caixa.audit

─── Tab: Sessão Actual ───
Banner verde (caixa aberto) ou vermelho (fechado)
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│Total │ │Nº vend│ │Numer.│ │Multi.│
└──────┘ └──────┘ └──────┘ └──────┘

─── Tab: Histórico ───
Filtros: [data] [estabelecimento] [status]
Tabela: Data | Estabelecimento | Hora abertura | Hora fecho | Total | Diferença
```

**Queries React Query:**

```tsx
const { data: sessaoAtual } = useQuery(
  ['caixa-sessao-atual'],
  getCaixaSessaoAtual,
  { refetchInterval: 30_000 }
);

const { data: historico } = useQuery(
  ['caixa-sessoes', filtros],
  () => getCaixaSessoes(filtros)
);
```

---

## 7. Fase D — Produtos Melhorado

> **Pré-requisito:** Fase A concluída
> **Ficheiros afectados:** produtos/page.tsx, faturacao-produtos.js, types.ts, api.ts

### 7.1 Backend — actualizar rota de produtos

**Ficheiro:** `backend/src/routes/faturacao-produtos.js`

#### GET /produtos — incluir categoria

```javascript
// No select, adicionar categoria
include: {
  categoria: { select: { id: true, nome: true, cor: true } },
},
```

#### POST e PUT /produtos — aceitar novos campos

```javascript
const { ..., stockMinimo, categoriaId } = req.body;

// No create/update data:
data: {
  ...,
  stockMinimo: stockMinimo != null ? Number(stockMinimo) : null,
  categoriaId: categoriaId || null,
}
```

### 7.2 Frontend — página de produtos

**Ficheiro:** `frontend/src/app/produtos/page.tsx`

#### Indicador visual de stock

```tsx
function StockBadge({ stock, stockMinimo }: { stock?: number | null; stockMinimo?: number | null }) {
  if (stock == null) return <span className="text-slate-400 text-xs">sem controlo</span>;
  if (stock === 0) return (
    <span className="flex items-center gap-1 text-red-600 font-semibold">
      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
      {stock}
    </span>
  );
  if (stockMinimo != null && stock <= stockMinimo) return (
    <span className="flex items-center gap-1 text-amber-600 font-semibold">
      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
      {stock}
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-green-700">
      <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
      {stock}
    </span>
  );
}
```

#### Filtro por categoria

```tsx
// Estado
const [categoriaFiltro, setCategoriaFiltro] = useState('');

// Fetch de categorias
const { data: categorias } = useQuery(['categorias-produto'], getCategoriasProduto);

// Filtro no topo da tabela
<Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
  <SelectItem value="">Todas as categorias</SelectItem>
  {categorias?.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
</Select>

// No array de produtos exibidos
const produtosFiltrados = produtos.filter(p =>
  (!categoriaFiltro || p.categoriaId === categoriaFiltro)
);
```

#### Campo Categoria no form

```tsx
<div>
  <Label>Categoria</Label>
  <Select value={form.categoriaId || ''} onValueChange={v => setForm(f => ({ ...f, categoriaId: v || null }))}>
    <SelectItem value="">Sem categoria</SelectItem>
    {categorias?.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
  </Select>
</div>
<div>
  <Label>Stock mínimo</Label>
  <Input type="number" min="0"
    value={form.stockMinimo ?? ''}
    onChange={e => setForm(f => ({ ...f, stockMinimo: e.target.value === '' ? null : Number(e.target.value) }))}
    placeholder="0 (sem alerta)"
  />
</div>
```

---

## 8. Fase E — Permissões Granulares + Análise Avançada

> **Pré-requisito:** Fases A, B, C concluídas
> **Ficheiros afectados:** permissions.js, permissions.ts, comercial-dashboard.js, configuracoes/page.tsx

### 8.1 Expandir permissões backend

**Ficheiro:** `backend/src/lib/permissions.js`

A estrutura existente é:

```javascript
{
  contacts: "none" | "view" | "edit",
  pipeline: "none" | "view" | "edit",
  tasks: "none" | "view" | "edit",
  chat: "none" | "view" | "edit",
  calendario: "none" | "view" | "edit",
  automations: "none" | "view" | "edit",
  forms: "none" | "view" | "edit",
  finances: { transactions, view_invoices, emit_invoices, view_reports, saft }
}
```

Adicionar (retrocompatível — null = acesso total):

```javascript
{
  // ...existentes inalterados...
  comercial: {
    dashboard_basic: true,      // ver painel resumo
    dashboard_analysis: false,  // ver análise detalhada
    view_store_ranking: false,  // ranking de lojas
    view_product_performance: false, // performance de produtos
  },
  caixa: {
    view: true,    // ver estado do caixa
    open: false,   // abrir sessão
    close: false,  // fechar sessão
    audit: false,  // ver histórico e diferenças
  },
  stock: {
    view: true,    // ver níveis de stock
    edit: false,   // adicionar/ajustar stock manualmente
  },
}
```

**Novo helper e middleware:**

```javascript
function canComercial(permissionsJson, key) {
  const perms = parsePermissions(permissionsJson);
  if (perms === null) return true; // null = acesso total
  return perms?.comercial?.[key] === true;
}

function requireComercialPermission(key) {
  return (req, res, next) => {
    if (req.user.isAccountOwner || req.user.role === 'admin') return next();
    if (!canComercial(req.user.permissionsJson, key)) {
      return res.status(403).json({ error: 'Sem permissão para esta acção' });
    }
    next();
  };
}

module.exports = {
  // ...existentes...
  canComercial,
  requireComercialPermission,
};
```

### 8.2 Proteger endpoint /analise

**Ficheiro:** `backend/src/routes/comercial-dashboard.js`

```javascript
const { requireComercialPermission } = require('../lib/permissions');

router.get('/analise',
  requireComercialPermission('dashboard_analysis'),
  async (req, res) => { ... }
);
```

### 8.3 Expandir permissões frontend

**Ficheiro:** `frontend/src/lib/permissions.ts`

```typescript
export function canComercialDashboardBasic(user: User): boolean {
  if (!user || user.role === 'admin' || !user.accountOwnerId) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.comercial?.dashboard_basic !== false;
}

export function canComercialDashboardAnalysis(user: User): boolean {
  if (!user || user.role === 'admin' || !user.accountOwnerId) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.comercial?.dashboard_analysis === true;
}

export function canCaixaOpen(user: User): boolean {
  if (!user || user.role === 'admin' || !user.accountOwnerId) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.caixa?.open === true;
}

export function canCaixaClose(user: User): boolean {
  if (!user || user.role === 'admin' || !user.accountOwnerId) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.caixa?.close === true;
}

export function canCaixaAudit(user: User): boolean {
  if (!user || user.role === 'admin' || !user.accountOwnerId) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.caixa?.audit === true;
}

export function canStockEdit(user: User): boolean {
  if (!user || user.role === 'admin' || !user.accountOwnerId) return true;
  const perms = parsePermissions(user.permissions);
  if (perms === null) return true;
  return perms?.stock?.edit === true;
}
```

### 8.4 UI de configuração de membros

**Ficheiro:** `frontend/src/app/configuracoes/page.tsx`

Adicionar secção colapsável no form de edição de membro:

```tsx
<details className="mt-4">
  <summary className="text-sm font-semibold cursor-pointer">Permissões Comerciais</summary>
  <div className="mt-3 space-y-3">
    <PermToggle label="Ver painel resumo" value={perms.comercial?.dashboard_basic}
      onChange={v => setPerms(p => ({ ...p, comercial: { ...p.comercial, dashboard_basic: v } }))} />
    <PermToggle label="Ver análise detalhada" value={perms.comercial?.dashboard_analysis}
      onChange={v => setPerms(p => ({ ...p, comercial: { ...p.comercial, dashboard_analysis: v } }))} />
    <PermToggle label="Abrir caixa" value={perms.caixa?.open}
      onChange={v => setPerms(p => ({ ...p, caixa: { ...p.caixa, open: v } }))} />
    <PermToggle label="Fechar caixa" value={perms.caixa?.close}
      onChange={v => setPerms(p => ({ ...p, caixa: { ...p.caixa, close: v } }))} />
    <PermToggle label="Ver auditoria de caixa" value={perms.caixa?.audit}
      onChange={v => setPerms(p => ({ ...p, caixa: { ...p.caixa, audit: v } }))} />
    <PermToggle label="Editar stock manualmente" value={perms.stock?.edit}
      onChange={v => setPerms(p => ({ ...p, stock: { ...p.stock, edit: v } }))} />
  </div>
</details>
```

---

## 9. Schema Prisma Completo (após todas as fases)

Alterações ao `backend/prisma/schema.prisma`:

```prisma
// === ALTERAÇÃO 1: User — nova relação ===
model User {
  // ...campos existentes inalterados...
  produtoCategorias    ProdutoCategoria[] @relation("ProdutoCategoriaUser")  // NOVO
}

// === ALTERAÇÃO 2: Novo modelo ProdutoCategoria ===
// Inserir antes do modelo Produto
model ProdutoCategoria {
  id        String    @id @default(cuid())
  userId    Int
  nome      String
  cor       String?   @default("#6b7e9a")
  isDefault Boolean   @default(false)
  createdAt DateTime  @default(now())
  user      User      @relation("ProdutoCategoriaUser", fields: [userId], references: [id], onDelete: Cascade)
  produtos  Produto[]

  @@unique([userId, nome])
}

// === ALTERAÇÃO 3: Produto — novos campos ===
model Produto {
  // ...campos existentes inalterados...
  stock              Int?     @default(0)    // já existe
  stockMinimo        Int?     @default(0)    // NOVO
  categoriaId        String?                 // NOVO
  // ...relações existentes...
  categoria          ProdutoCategoria? @relation(fields: [categoriaId], references: [id], onDelete: SetNull)  // NOVO
}

// === ALTERAÇÃO 4: CaixaSessao — campos de breakdown ===
model CaixaSessao {
  // ...campos existentes inalterados...
  salesCount            Int             @default(0)   // já existe
  totalCash             Float           @default(0)   // NOVO
  totalMulticaixa       Float           @default(0)   // NOVO
  totalTransferencia    Float           @default(0)   // NOVO
  // ...relações existentes inalteradas...
}
```

---

## 10. Endpoints Backend Completos

### Novos endpoints (Fases A–E)

| Método | Endpoint | Descrição | Auth | Plan |
|---|---|---|---|---|
| GET | `/api/produto-categorias` | Listar categorias | ✅ | vendas |
| POST | `/api/produto-categorias` | Criar categoria | ✅ | vendas |
| PATCH | `/api/produto-categorias/:id` | Editar categoria | ✅ | vendas |
| DELETE | `/api/produto-categorias/:id` | Eliminar categoria | ✅ | vendas |
| GET | `/api/comercial/resumo` | Métricas simples de hoje | ✅ | vendas |
| GET | `/api/comercial/insights` | Frases geradas automaticamente | ✅ | vendas |
| GET | `/api/comercial/analise` | Métricas detalhadas 30 dias | ✅ + perm | vendas |

### Endpoints existentes modificados

| Método | Endpoint | Alteração |
|---|---|---|
| POST | `/api/caixa/sessoes` | Regra: 1 por estabelecimento (não por user) |
| GET | `/api/caixa/sessoes/atual` | Aceita `?estabelecimentoId` |
| PATCH | `/api/caixa/sessoes/:id/fechar` | Calcula e guarda breakdown por método |
| GET | `/api/faturacao/produtos` | Inclui `categoria` no select |
| POST | `/api/faturacao/produtos` | Aceita `stockMinimo` + `categoriaId` |
| PUT | `/api/faturacao/produtos/:id` | Aceita `stockMinimo` + `categoriaId` |
| POST | `/api/quick-sales/emit` | Decrementa stock + cria StockMovement |

---

## 11. Estrutura de Permissões

### Matriz de permissões por perfil

| Permissão | funcionário | operador | gerente | admin | owner |
|---|:---:|:---:|:---:|:---:|:---:|
| `comercial.dashboard_basic` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `comercial.dashboard_analysis` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `comercial.view_store_ranking` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `comercial.view_product_performance` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `caixa.view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `caixa.open` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `caixa.close` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `caixa.audit` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `stock.view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `stock.edit` | ❌ | ❌ | ✅ | ✅ | ✅ |

> **Nota:** Owners e admins sempre têm acesso total independente das permissões. Os perfis acima são presets sugeridos para a UI — o admin configura manualmente por utilizador.

### JSON de permissões completo (exemplo gerente)

```json
{
  "contacts": "edit",
  "pipeline": "edit",
  "tasks": "edit",
  "chat": "view",
  "calendario": "view",
  "automations": "none",
  "forms": "none",
  "finances": {
    "transactions": "view",
    "view_invoices": true,
    "emit_invoices": false,
    "view_reports": true,
    "saft": false
  },
  "comercial": {
    "dashboard_basic": true,
    "dashboard_analysis": true,
    "view_store_ranking": true,
    "view_product_performance": true
  },
  "caixa": {
    "view": true,
    "open": true,
    "close": true,
    "audit": true
  },
  "stock": {
    "view": true,
    "edit": true
  }
}
```

---

## 12. Tipos TypeScript

Adicionar/actualizar em `frontend/src/lib/types.ts`:

```typescript
// NOVO
export interface ProdutoCategoria {
  id: string;
  userId: number;
  nome: string;
  cor?: string | null;
  isDefault: boolean;
  createdAt: string;
  _count?: { produtos: number };
}

// ACTUALIZAR Produto — adicionar campos
export interface Produto {
  // ...campos existentes...
  stock?: number | null;         // já existe
  stockMinimo?: number | null;   // NOVO
  categoriaId?: string | null;   // NOVO
  categoria?: ProdutoCategoria | null; // NOVO
}

// ACTUALIZAR CaixaSessao — adicionar breakdown
export interface CaixaSessao {
  // ...campos existentes...
  totalCash: number;             // NOVO
  totalMulticaixa: number;       // NOVO
  totalTransferencia: number;    // NOVO
}

// NOVOS — Painel Comercial
export interface ComercialResumo {
  totalHoje: number;
  vendasHoje: number;
  totalOntem: number;
  variacao: number;
  topProduto: {
    productCode: string;
    productDescription: string;
    quantidadeVendida: number;
    facturacaoTotal: number;
  } | null;
  estabelecimentoDestaque: {
    id: string;
    nome: string;
    totalHoje: number;
  } | null;
  stockAlertaCount: number;
}

export interface ComercialTopProduto {
  productCode: string;
  productDescription: string;
  quantidadeTotal: number;
  facturacaoTotal: number;
}

export interface ComercialAnalise {
  totalVendas: number;
  numVendas: number;
  ticketMedio: number;
  topPorQuantidade: ComercialTopProduto[];
  topPorFacturacao: ComercialTopProduto[];
  produtosParados: Produto[];
  rankingEstabelecimentos: {
    id: string;
    nome: string;
    total: number;
    count: number;
  }[];
  vendasPorDia: {
    date: string;
    total: number;
    count: number;
  }[];
}
```

---

## 13. Funções API Frontend

Adicionar em `frontend/src/lib/api.ts`:

```typescript
import type { ProdutoCategoria, ComercialResumo, ComercialAnalise, CaixaSessao } from './types';

// ── Categorias de Produtos ────────────────────────────────────────
export async function getCategoriasProduto(): Promise<ProdutoCategoria[]> {
  const res = await api.get('/api/produto-categorias');
  return res.data;
}

export async function createCategoriaProduto(data: { nome: string; cor?: string }): Promise<ProdutoCategoria> {
  const res = await api.post('/api/produto-categorias', data);
  return res.data;
}

export async function updateCategoriaProduto(id: string, data: { nome?: string; cor?: string }): Promise<ProdutoCategoria> {
  const res = await api.patch(`/api/produto-categorias/${id}`, data);
  return res.data;
}

export async function deleteCategoriaProduto(id: string): Promise<void> {
  await api.delete(`/api/produto-categorias/${id}`);
}

// ── Painel Comercial ──────────────────────────────────────────────
export async function getComercialResumo(): Promise<ComercialResumo> {
  const res = await api.get('/api/comercial/resumo');
  return res.data;
}

export async function getComercialInsights(): Promise<string[]> {
  const res = await api.get('/api/comercial/insights');
  return res.data;
}

export async function getComercialAnalise(params?: {
  dias?: number;
  estabelecimentoId?: string;
}): Promise<ComercialAnalise> {
  const res = await api.get('/api/comercial/analise', { params });
  return res.data;
}

// ── Caixa — histórico ─────────────────────────────────────────────
export async function getCaixaSessoes(params?: {
  status?: 'open' | 'closed';
  estabelecimentoId?: string;
  page?: number;
  limit?: number;
}): Promise<{ sessoes: CaixaSessao[]; total: number; page: number; limit: number }> {
  const res = await api.get('/api/caixa/sessoes', { params });
  return res.data;
}
```

---

## 14. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Mudar regra sessão user→estabelecimento quebra sessões abertas | Baixa | Alto | Fechar todas as sessões abertas antes de `db push`. Verificar com `GET /api/caixa/sessoes?status=open`. |
| Parsear `lines` JSON para analytics é lento com muitas faturas | Média | Médio | MVP: Node.js parse OK até ~10k facturas. Fase futura: tabela `FacturaSaleItem` denormalizada. |
| `recharts` não instalado no frontend | Baixa | Baixo | Verificar com `grep recharts frontend/package.json`. Se ausente: `npm install recharts`. |
| Stock negativo em vendas concorrentes | Muito baixa | Médio | `$transaction` Prisma é atómico. `Math.max(0, stock - qty)` previne negativo. |
| Permissões novas com `null` quebram utilizadores existentes | Nenhuma | Nenhum | `null` = acesso total (retrocompatível). Novos campos ignorados se ausentes. |
| `db push` em produção (Render) bloqueia tabela | Baixa | Alto | Fazer fora de horas de pico. Os novos campos têm `@default` — sem bloqueio prolongado. |

---

## 15. Checklist de Testes

### Fase A

**Schema e base de dados:**
- [ ] `npx prisma db push` sem erros
- [ ] Tabela `ProdutoCategoria` criada
- [ ] Colunas `stockMinimo`, `categoriaId` em `Produto`
- [ ] Colunas `totalCash`, `totalMulticaixa`, `totalTransferencia` em `CaixaSessao`

**Regra de caixa:**
- [ ] Abrir caixa no Estabelecimento A → sessão aberta
- [ ] Tentar abrir outro caixa no Estabelecimento A → erro 409
- [ ] Abrir caixa no Estabelecimento B (diferente) → permitido
- [ ] User B abre caixa no Estabelecimento A (onde User A já abriu) → erro 409

**Breakdown de pagamentos:**
- [ ] Fazer 3 vendas: 1 CASH, 1 MULTICAIXA, 1 TRANSFERENCIA
- [ ] Fechar sessão → `totalCash`, `totalMulticaixa`, `totalTransferencia` correctos

**Categorias de produtos:**
- [ ] `POST /api/produto-categorias` → criar categoria
- [ ] `GET /api/produto-categorias` → listar
- [ ] `PATCH /api/produto-categorias/:id` → editar nome
- [ ] `DELETE /api/produto-categorias/:id` com produtos → erro 409
- [ ] `DELETE /api/produto-categorias/:id` sem produtos → 204

**Stock auto-decrement:**
- [ ] Produto com `stock = 10`
- [ ] Vender 3 unidades via Venda Rápida
- [ ] `stock` passa para 7
- [ ] `StockMovement` criado com `type='exit'`, `referenceType='quick_sale'`
- [ ] Produto com `stock = null` → sem decrement (ignorado)

---

### Fase B

**Painel comercial:**
- [ ] `GET /api/comercial/resumo` retorna dados correctos do dia
- [ ] `totalHoje` bate com soma de facturas `documentStatus='N'` do dia
- [ ] `variacao` correcto (comparação com ontem)
- [ ] `topProduto` correcto (produto com mais unidades vendidas)
- [ ] `stockAlertaCount` correcto (produtos com `stock <= stockMinimo`)
- [ ] `GET /api/comercial/insights` retorna array de frases
- [ ] Em modo `servicos`, dashboard CRM continua inalterado
- [ ] Em modo `comercio`, painel comercial aparece em `/`

---

### Fase C

**Sidebar:**
- [ ] Modo `comercio`: "Caixa" aparece em "Uso diário"
- [ ] Modo `comercio`: Automações, Formulários, Pipeline, Calendário, Finanças ausentes
- [ ] Modo `servicos`: sidebar completamente inalterada

**Página /caixa:**
- [ ] Com sessão aberta: banner verde + stats visíveis
- [ ] Sem sessão: banner cinzento/vermelho + botão "Abrir Caixa"
- [ ] Tab Histórico: lista paginada de sessões
- [ ] Filtro por status funciona
- [ ] Diferença com cor correcta (verde=0, azul=excesso, vermelho=falta)

---

### Fase D

**Produtos:**
- [ ] Campo "Categoria" visível no form de criação/edição
- [ ] Campo "Stock mínimo" visível no form
- [ ] Produto com `stock = 0`: indicador vermelho
- [ ] Produto com `stock <= stockMinimo`: indicador amarelo
- [ ] Produto com `stock > stockMinimo`: indicador verde
- [ ] Filtro por categoria filtra correctamente a tabela

---

### Fase E

**Permissões:**
- [ ] Membro com `comercial.dashboard_analysis: false` não vê toggle "Análise"
- [ ] Membro com `caixa.open: false` não vê botão "Abrir Caixa"
- [ ] Membro com `caixa.close: false` não vê botão "Fechar Caixa"
- [ ] `GET /api/comercial/analise` por membro sem permissão → 403
- [ ] Owner e admin sempre têm acesso total

**Configurações de equipa:**
- [ ] Secção "Permissões Comerciais" visível no form de edição de membro
- [ ] Toggles guardam e carregam correctamente
- [ ] Alteração de permissão reflecte-se no comportamento do utilizador afectado

---

*Fim do documento de implementação — KukuGest POS + Operações + Insights*
