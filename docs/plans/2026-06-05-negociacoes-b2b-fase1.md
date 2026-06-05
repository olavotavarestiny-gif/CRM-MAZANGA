# Negociações B2B — Fase 1 — Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Acrescentar um módulo paralelo de vendas empresariais (B2B) onde a Empresa é o container, a Negociação (Deal) é o card que se move num funil próprio, e várias pessoas (stakeholders = contactos reais) são associadas à negociação com papel e influência — sem tocar no pipeline individual existente.

**Architecture:** Módulo paralelo. Quatro tabelas Prisma novas (`Company`, `Deal`, `DealStakeholder`, `DealStage`) + uma coluna opcional `companyId` em `Contact`. Backend em Express/CommonJS espelhando o padrão de `routes/pipeline-stages.js`. Frontend Next.js numa aba nova `/negociacoes`, reaproveitando os componentes de kanban e de gestão de fases já existentes.

**Tech Stack:** Express 4 (CommonJS), Prisma 5 (PostgreSQL/Supabase), Next.js 14 (App Router), React Query, shadcn/ui, Tailwind, `@hello-pangea/dnd`.

---

## Convenções deste projeto (LER ANTES DE COMEÇAR)

- **Backend é JavaScript (CommonJS)**, não TypeScript. Rotas em `backend/src/routes/*.js`.
- **Não existe framework de testes.** A verificação é **manual**: arrancar o backend com `npm run dev` (nodemon, porta 3001), testar endpoints com `curl`/Prisma Studio, e verificar a UI no browser com `npm run dev` no frontend (porta 3000). Cada tarefa tem um passo de verificação manual explícito. **Não introduzir jest/vitest** — está fora do âmbito e contra as convenções.
- **Migrações:** o projeto usa `npm run db:push` (`prisma db push`), não `migrate dev`. Confirmado em `backend/package.json`.
- **Multi-tenant:** toda a query filtra por `req.user.effectiveUserId`. Toda a verificação de posse compara `existing.userId !== req.user.effectiveUserId`. Ver `routes/pipeline-stages.js`.
- **Permissões:** usar `requirePermission('pipeline', 'view'|'edit')` e `requireDeletePermission` de `../lib/permissions` — reaproveitamos o módulo `pipeline` (não criamos permissão nova na Fase 1).
- **Activity log:** `const { log: logActivity } = require('../services/activity-log.service.js')`.
- **Erros:** `logRouteError('[tag] msg', req, error)` de `../lib/request-log` e `res.status(500).json({ error: error.message })`.
- **Commits frequentes** — committar ao fim de cada tarefa (preferência do utilizador: commit + push após cada alteração).
- Design de referência: `docs/plans/2026-06-05-negociacoes-b2b-design.md`.

---

## Task 1: Modelo de dados (Prisma)

**Files:**
- Modify: `backend/prisma/schema.prisma` (acrescentar 1 campo a `Contact`, 1 relação inversa a `User`, e 4 models novos no fim)

**Step 1: Acrescentar `companyId` opcional e relação ao model `Contact`**

Em `model Contact`, junto aos outros campos opcionais (ex.: a seguir a `contactGroupId String?`), acrescentar:

```prisma
  companyId       String?
  company_rel     Company?         @relation(fields: [companyId], references: [id], onDelete: SetNull)
```

E nos índices do `Contact`, acrescentar:

```prisma
  @@index([companyId])
```

> Nota: mantemos o campo de texto `company` intocado. `companyId` fica `null` em todos os contactos atuais.

**Step 2: Acrescentar relações inversas ao model `User`**

Dentro de `model User`, junto às outras relações, acrescentar:

```prisma
  companies                 Company[]              @relation("CompanyUser")
  deals                     Deal[]                 @relation("DealUser")
  dealStages                DealStage[]            @relation("DealStageUser")
```

**Step 3: Acrescentar os 4 models novos no fim do ficheiro**

```prisma
model Company {
  id        String   @id @default(cuid())
  userId    Int
  name      String
  nif       String?
  sector    String?
  website   String?
  location  String?
  sizeTier  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User      @relation("CompanyUser", fields: [userId], references: [id], onDelete: Cascade)
  deals     Deal[]
  contacts  Contact[]

  @@index([userId])
  @@index([userId, createdAt])
}

model DealStage {
  id        String   @id @default(cuid())
  userId    Int
  name      String
  color     String   @default("#6b7e9a")
  order     Int      @default(0)
  createdAt DateTime @default(now())
  user      User     @relation("DealStageUser", fields: [userId], references: [id], onDelete: Cascade)
  deals     Deal[]

  @@unique([userId, name])
}

model Deal {
  id                String            @id @default(cuid())
  userId            Int
  companyId         String
  stageId           String
  title             String
  valueKz           Float?
  status            String            @default("aberto") // aberto | ganho | perdido
  lossReason        String?
  ownerUserId       Int?
  expectedCloseDate DateTime?
  stageEnteredAt    DateTime          @default(now())
  closedAt          DateTime?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  user              User              @relation("DealUser", fields: [userId], references: [id], onDelete: Cascade)
  company           Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  stage             DealStage         @relation(fields: [stageId], references: [id])
  stakeholders      DealStakeholder[]

  @@index([userId])
  @@index([userId, status])
  @@index([userId, stageId])
  @@index([companyId])
}

model DealStakeholder {
  id        String   @id @default(cuid())
  dealId    String
  contactId Int
  role      String   @default("outro") // tecnico | decisor | financeiro | influenciador | outro
  influence String?  // alto | medio | baixo
  isPrimary Boolean  @default(false)
  notes     String?
  addedAt   DateTime @default(now())
  deal      Deal     @relation(fields: [dealId], references: [id], onDelete: Cascade)
  contact   Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@unique([dealId, contactId])
  @@index([dealId])
  @@index([contactId])
}
```

**Step 4: Acrescentar a relação inversa em `Contact`**

Em `model Contact`, junto às outras relações de lista (ex.: a seguir a `tasks Task[]`), acrescentar:

```prisma
  dealStakeholders DealStakeholder[]
```

**Step 5: Aplicar ao banco e gerar o cliente**

Run:
```bash
cd backend && npm run db:push && npx prisma generate
```
Expected: "Your database is now in sync with your Prisma schema" e "Generated Prisma Client". Sem erros de relação.

**Step 6: Verificar no Prisma Studio**

Run: `cd backend && npm run db:studio`
Expected: as tabelas `Company`, `Deal`, `DealStakeholder`, `DealStage` aparecem na lista. Fechar o Studio (Ctrl+C).

**Step 7: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(b2b): modelo de dados de negociações empresariais (Company, Deal, DealStakeholder, DealStage)"
```

---

## Task 2: Seed das fases B2B por defeito (`lib/deal-stages.js`)

Espelha `backend/src/lib/pipeline-stages.js` (`ensureDefaultStages`). Lê esse ficheiro primeiro para copiar o estilo exato.

**Files:**
- Read first: `backend/src/lib/pipeline-stages.js`
- Create: `backend/src/lib/deal-stages.js`

**Step 1: Criar o ficheiro**

```javascript
const prisma = require('./prisma');

const DEFAULT_DEAL_STAGES = [
  { name: 'Qualificação', color: '#6b7e9a' },
  { name: 'Reunião', color: '#8B5CF6' },
  { name: 'Proposta', color: '#F59E0B' },
  { name: 'Aprovação', color: '#3B82F6' },
  { name: 'Fechado', color: '#22C55E' },
];

// Garante que o utilizador tem o funil B2B semeado. Idempotente.
async function ensureDefaultDealStages(userId) {
  const count = await prisma.dealStage.count({ where: { userId } });
  if (count > 0) return;

  await prisma.dealStage.createMany({
    data: DEFAULT_DEAL_STAGES.map((s, i) => ({
      userId,
      name: s.name,
      color: s.color,
      order: i,
    })),
    skipDuplicates: true,
  });
}

module.exports = { ensureDefaultDealStages, DEFAULT_DEAL_STAGES };
```

**Step 2: Verificação** — sem passo isolado; será exercitada na Task 3 (o GET de stages chama esta função).

**Step 3: Commit**

```bash
git add backend/src/lib/deal-stages.js
git commit -m "feat(b2b): seed das fases por defeito do funil de negociações"
```

---

## Task 3: Rota de fases B2B (`routes/deal-stages.js`)

Espelha `routes/pipeline-stages.js` quase 1:1, trocando `pipelineStage`→`dealStage` e `contact.stage`→`deal.stageId`.

**Files:**
- Create: `backend/src/routes/deal-stages.js`
- Modify: `backend/src/index.js` (import + mount)

**Step 1: Criar a rota**

```javascript
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { ensureDefaultDealStages } = require('../lib/deal-stages');
const { requirePermission, requireDeletePermission } = require('../lib/permissions');
const { logRouteError } = require('../lib/request-log');

// GET /api/deal-stages
router.get('/', requirePermission('pipeline', 'view'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    await ensureDefaultDealStages(userId);
    const stages = await prisma.dealStage.findMany({ where: { userId }, orderBy: { order: 'asc' } });
    res.json(stages);
  } catch (error) {
    logRouteError('[deal-stages.list] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/deal-stages
router.post('/', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const userId = req.user.effectiveUserId;
    const max = await prisma.dealStage.aggregate({ where: { userId }, _max: { order: true } });
    const stage = await prisma.dealStage.create({
      data: { userId, name: name.trim(), color: color || '#6b7e9a', order: (max._max.order ?? -1) + 1 },
    });
    res.status(201).json(stage);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Stage name already exists' });
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/deal-stages/reorder — antes de /:id
router.put('/reorder', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order array' });
    const userId = req.user.effectiveUserId;
    await Promise.all(order.map(({ id, order: o }) =>
      prisma.dealStage.updateMany({ where: { id, userId }, data: { order: o } })
    ));
    const stages = await prisma.dealStage.findMany({ where: { userId }, orderBy: { order: 'asc' } });
    res.json(stages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/deal-stages/:id
router.put('/:id', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const { name, color } = req.body;
    const existing = await prisma.dealStage.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (color !== undefined) data.color = color;
    const stage = await prisma.dealStage.update({ where: { id: req.params.id }, data });
    res.json(stage);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Stage name already exists' });
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/deal-stages/:id — move deals da fase apagada para a primeira fase restante
router.delete('/:id', requireDeletePermission, async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const existing = await prisma.dealStage.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Stage not found' });

    const total = await prisma.dealStage.count({ where: { userId } });
    if (total <= 1) return res.status(400).json({ error: 'Cannot delete the last stage' });

    const firstOther = await prisma.dealStage.findFirst({
      where: { userId, id: { not: req.params.id } },
      orderBy: { order: 'asc' },
    });
    if (firstOther) {
      await prisma.deal.updateMany({
        where: { userId, stageId: req.params.id },
        data: { stageId: firstOther.id, stageEnteredAt: new Date() },
      });
    }
    await prisma.dealStage.delete({ where: { id: req.params.id } });
    res.json({ message: 'Stage deleted', movedTo: firstOther?.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

**Step 2: Montar em `index.js`**

Junto aos outros imports de rotas (a seguir a `const pipelineStagesRouter = ...`):
```javascript
const dealStagesRouter = require('./routes/deal-stages');
const companiesRouter = require('./routes/companies');
const dealsRouter = require('./routes/deals');
```
Junto aos outros `app.use` protegidos (a seguir à linha de `pipeline-stages`):
```javascript
app.use('/api/deal-stages', requireAuth, checkSubscriptionAccess, requirePlanFeature('processos'), dealStagesRouter);
app.use('/api/companies', requireAuth, checkSubscriptionAccess, requirePlanFeature('processos'), companiesRouter);
app.use('/api/deals', requireAuth, checkSubscriptionAccess, requirePlanFeature('processos'), dealsRouter);
```
> Nota: `companies` e `deals` só existem após as Tasks 4 e 5. Acrescenta os 3 imports/mounts agora; o servidor só arranca sem erro depois da Task 5. Se quiseres arrancar já para testar a Task 3, comenta temporariamente as linhas de companies/deals.

**Step 3: Verificação manual (após Task 5, quando o servidor arranca)** — `GET /api/deal-stages` devolve 5 fases por defeito.

**Step 4: Commit**

```bash
git add backend/src/routes/deal-stages.js backend/src/index.js
git commit -m "feat(b2b): endpoint CRUD das fases do funil de negociações"
```

---

## Task 4: Rota de empresas (`routes/companies.js`)

**Files:**
- Create: `backend/src/routes/companies.js`

**Step 1: Criar a rota**

```javascript
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requirePermission, requireDeletePermission } = require('../lib/permissions');
const { logRouteError } = require('../lib/request-log');

// GET /api/companies — lista com contagem de deals
router.get('/', requirePermission('pipeline', 'view'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const companies = await prisma.company.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { deals: true } } },
    });
    res.json(companies);
  } catch (error) {
    logRouteError('[companies.list] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/companies/:id — empresa + todos os deals + contactos conhecidos
router.get('/:id', requirePermission('pipeline', 'view'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        deals: { include: { stage: true, _count: { select: { stakeholders: true } } }, orderBy: { createdAt: 'desc' } },
        contacts: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!company || company.userId !== userId) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (error) {
    logRouteError('[companies.get] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/companies
router.post('/', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const { name, nif, sector, website, location, sizeTier } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const company = await prisma.company.create({
      data: {
        userId: req.user.effectiveUserId,
        name: name.trim(),
        nif: nif || null, sector: sector || null, website: website || null,
        location: location || null, sizeTier: sizeTier || null,
      },
    });
    res.status(201).json(company);
  } catch (error) {
    logRouteError('[companies.create] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/companies/:id
router.put('/:id', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const existing = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Company not found' });
    const { name, nif, sector, website, location, sizeTier } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (nif !== undefined) data.nif = nif || null;
    if (sector !== undefined) data.sector = sector || null;
    if (website !== undefined) data.website = website || null;
    if (location !== undefined) data.location = location || null;
    if (sizeTier !== undefined) data.sizeTier = sizeTier || null;
    const company = await prisma.company.update({ where: { id: req.params.id }, data });
    res.json(company);
  } catch (error) {
    logRouteError('[companies.update] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/companies/:id — bloqueado se tiver deals
router.delete('/:id', requireDeletePermission, async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const existing = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { deals: true } } },
    });
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Company not found' });
    if (existing._count.deals > 0) {
      return res.status(400).json({ error: 'Não é possível apagar uma empresa com negociações. Apague ou mova as negociações primeiro.' });
    }
    await prisma.company.delete({ where: { id: req.params.id } });
    res.json({ message: 'Company deleted' });
  } catch (error) {
    logRouteError('[companies.delete] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

**Step 2: Commit**

```bash
git add backend/src/routes/companies.js
git commit -m "feat(b2b): endpoint CRUD de empresas"
```

---

## Task 5: Rota de negociações + stakeholders (`routes/deals.js`)

**Files:**
- Create: `backend/src/routes/deals.js`

**Step 1: Criar a rota**

```javascript
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { log: logActivity } = require('../services/activity-log.service.js');
const { requirePermission, requireDeletePermission } = require('../lib/permissions');
const { logRouteError } = require('../lib/request-log');

const VALID_ROLES = ['tecnico', 'decisor', 'financeiro', 'influenciador', 'outro'];
const VALID_INFLUENCE = ['alto', 'medio', 'baixo'];
const VALID_STATUS = ['aberto', 'ganho', 'perdido'];

const dealInclude = {
  company: true,
  stage: true,
  stakeholders: {
    include: { contact: { select: { id: true, name: true, email: true, phone: true } } },
    orderBy: { addedAt: 'asc' },
  },
};

async function loadOwnedDeal(id, userId) {
  const deal = await prisma.deal.findUnique({ where: { id } });
  if (!deal || deal.userId !== userId) return null;
  return deal;
}

// GET /api/deals — todos os deals (para o kanban), com empresa, fase e contagem de pessoas
router.get('/', requirePermission('pipeline', 'view'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const where = { userId };
    if (req.query.status) where.status = req.query.status;
    const deals = await prisma.deal.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { company: true, stage: true, _count: { select: { stakeholders: true } } },
    });
    res.json(deals);
  } catch (error) {
    logRouteError('[deals.list] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/deals/:id — detalhe completo
router.get('/:id', requirePermission('pipeline', 'view'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await prisma.deal.findUnique({ where: { id: req.params.id }, include: dealInclude });
    if (!deal || deal.userId !== userId) return res.status(404).json({ error: 'Deal not found' });
    res.json(deal);
  } catch (error) {
    logRouteError('[deals.get] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/deals — cria negociação; aceita companyId OU newCompanyName
router.post('/', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const { title, companyId, newCompanyName, valueKz, stageId } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

    // Resolver empresa
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && newCompanyName && newCompanyName.trim()) {
      const company = await prisma.company.create({ data: { userId, name: newCompanyName.trim() } });
      resolvedCompanyId = company.id;
    }
    if (!resolvedCompanyId) return res.status(400).json({ error: 'Empresa é obrigatória (companyId ou newCompanyName)' });
    const company = await prisma.company.findUnique({ where: { id: resolvedCompanyId } });
    if (!company || company.userId !== userId) return res.status(404).json({ error: 'Company not found' });

    // Resolver fase (default: primeira)
    let resolvedStageId = stageId;
    if (!resolvedStageId) {
      const first = await prisma.dealStage.findFirst({ where: { userId }, orderBy: { order: 'asc' } });
      if (!first) return res.status(400).json({ error: 'Nenhuma fase configurada' });
      resolvedStageId = first.id;
    }

    const deal = await prisma.deal.create({
      data: {
        userId, companyId: resolvedCompanyId, stageId: resolvedStageId,
        title: title.trim(),
        valueKz: valueKz != null ? Number(valueKz) : null,
        ownerUserId: req.user.id,
        stageEnteredAt: new Date(),
      },
      include: dealInclude,
    });
    res.status(201).json(deal);
  } catch (error) {
    logRouteError('[deals.create] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/deals/:id — atualizar título/valor/fase. Mudança de fase regista no ActivityLog + reset stageEnteredAt
router.put('/:id', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await loadOwnedDeal(req.params.id, userId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const { title, valueKz, stageId, expectedCloseDate } = req.body;
    const data = {};
    if (title !== undefined) data.title = title.trim();
    if (valueKz !== undefined) data.valueKz = valueKz != null ? Number(valueKz) : null;
    if (expectedCloseDate !== undefined) data.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;

    let stageChanged = false;
    let oldStageName, newStageName;
    if (stageId !== undefined && stageId !== deal.stageId) {
      const newStage = await prisma.dealStage.findUnique({ where: { id: stageId } });
      if (!newStage || newStage.userId !== userId) return res.status(400).json({ error: 'Invalid stage' });
      const oldStage = await prisma.dealStage.findUnique({ where: { id: deal.stageId } });
      data.stageId = stageId;
      data.stageEnteredAt = new Date();
      stageChanged = true;
      oldStageName = oldStage?.name;
      newStageName = newStage.name;
    }

    const updated = await prisma.deal.update({ where: { id: deal.id }, data, include: dealInclude });

    if (stageChanged) {
      await logActivity({
        organization_id: userId,
        entity_type: 'deal',
        entity_id: deal.id,
        entity_label: updated.title,
        action: 'stage_changed',
        field_changed: 'stage',
        old_value: oldStageName,
        new_value: newStageName,
        user_id: req.user.id,
        user_name: req.user.name,
        metadata: { old_stage_name: oldStageName, new_stage_name: newStageName },
      });
    }
    res.json(updated);
  } catch (error) {
    logRouteError('[deals.update] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/deals/:id/close — { status: 'ganho'|'perdido', lossReason? }
router.post('/:id/close', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await loadOwnedDeal(req.params.id, userId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const { status, lossReason } = req.body;
    if (!['ganho', 'perdido'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (status === 'perdido' && (!lossReason || !lossReason.trim())) {
      return res.status(400).json({ error: 'Motivo de perda é obrigatório' });
    }
    const updated = await prisma.deal.update({
      where: { id: deal.id },
      data: { status, lossReason: status === 'perdido' ? lossReason.trim() : null, closedAt: new Date() },
      include: dealInclude,
    });
    await logActivity({
      organization_id: userId, entity_type: 'deal', entity_id: deal.id, entity_label: updated.title,
      action: status === 'ganho' ? 'deal_won' : 'deal_lost', field_changed: 'status',
      old_value: deal.status, new_value: status, user_id: req.user.id, user_name: req.user.name,
      metadata: { lossReason: updated.lossReason },
    });
    res.json(updated);
  } catch (error) {
    logRouteError('[deals.close] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/deals/:id/reopen
router.post('/:id/reopen', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await loadOwnedDeal(req.params.id, userId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const updated = await prisma.deal.update({
      where: { id: deal.id },
      data: { status: 'aberto', lossReason: null, closedAt: null },
      include: dealInclude,
    });
    res.json(updated);
  } catch (error) {
    logRouteError('[deals.reopen] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/deals/:id
router.delete('/:id', requireDeletePermission, async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await loadOwnedDeal(req.params.id, userId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    await prisma.deal.delete({ where: { id: deal.id } });
    res.json({ message: 'Deal deleted' });
  } catch (error) {
    logRouteError('[deals.delete] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// ---- Stakeholders ----

// POST /api/deals/:id/stakeholders — { contactId? , newContact?{name,phone,email}, role, influence?, isPrimary?, notes? }
router.post('/:id/stakeholders', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await loadOwnedDeal(req.params.id, userId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    let { contactId, newContact, role, influence, isPrimary, notes } = req.body;
    if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (influence && !VALID_INFLUENCE.includes(influence)) return res.status(400).json({ error: 'Invalid influence' });

    // Criar contacto na hora, se preciso (associa logo à empresa do deal)
    if (!contactId && newContact && newContact.name && newContact.name.trim()) {
      const created = await prisma.contact.create({
        data: {
          userId,
          name: newContact.name.trim(),
          email: newContact.email || '',
          phone: newContact.phone || '',
          company: '',
          companyId: deal.companyId,
        },
      });
      contactId = created.id;
    }
    if (!contactId) return res.status(400).json({ error: 'contactId ou newContact é obrigatório' });
    contactId = Number(contactId);

    // Validar posse do contacto
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact || contact.userId !== userId) return res.status(404).json({ error: 'Contact not found' });

    // Upsert (não duplica): unique [dealId, contactId]
    const stakeholder = await prisma.dealStakeholder.upsert({
      where: { dealId_contactId: { dealId: deal.id, contactId } },
      update: { role: role || 'outro', influence: influence || null, isPrimary: !!isPrimary, notes: notes || null },
      create: { dealId: deal.id, contactId, role: role || 'outro', influence: influence || null, isPrimary: !!isPrimary, notes: notes || null },
      include: { contact: { select: { id: true, name: true, email: true, phone: true } } },
    });
    res.status(201).json(stakeholder);
  } catch (error) {
    logRouteError('[deals.addStakeholder] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/deals/:id/stakeholders/:stakeholderId
router.put('/:id/stakeholders/:stakeholderId', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await loadOwnedDeal(req.params.id, userId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const sh = await prisma.dealStakeholder.findUnique({ where: { id: req.params.stakeholderId } });
    if (!sh || sh.dealId !== deal.id) return res.status(404).json({ error: 'Stakeholder not found' });

    const { role, influence, isPrimary, notes } = req.body;
    if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (influence && !VALID_INFLUENCE.includes(influence)) return res.status(400).json({ error: 'Invalid influence' });
    const data = {};
    if (role !== undefined) data.role = role;
    if (influence !== undefined) data.influence = influence || null;
    if (isPrimary !== undefined) data.isPrimary = !!isPrimary;
    if (notes !== undefined) data.notes = notes || null;
    const updated = await prisma.dealStakeholder.update({
      where: { id: sh.id }, data,
      include: { contact: { select: { id: true, name: true, email: true, phone: true } } },
    });
    res.json(updated);
  } catch (error) {
    logRouteError('[deals.updateStakeholder] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/deals/:id/stakeholders/:stakeholderId
router.delete('/:id/stakeholders/:stakeholderId', requirePermission('pipeline', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const deal = await loadOwnedDeal(req.params.id, userId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    const sh = await prisma.dealStakeholder.findUnique({ where: { id: req.params.stakeholderId } });
    if (!sh || sh.dealId !== deal.id) return res.status(404).json({ error: 'Stakeholder not found' });
    await prisma.dealStakeholder.delete({ where: { id: sh.id } });
    res.json({ message: 'Stakeholder removed' });
  } catch (error) {
    logRouteError('[deals.removeStakeholder] error', req, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

> Nota sobre `requireDeletePermission` no DELETE de stakeholder: usei `requirePermission('pipeline','edit')` porque remover uma pessoa do deal é uma edição do deal, não a eliminação de um registo de topo. Mantém coerência com o resto.

**Step 2: Verificação manual do backend (arranca o servidor)**

Run: `cd backend && npm run dev`
Expected: arranca sem erros (porta 3001). Com um token válido (copia do browser, DevTools → pedido autenticado → header `Authorization`), testar:
```bash
TOKEN="<cola-o-jwt-aqui>"
curl -s localhost:3001/api/deal-stages -H "Authorization: Bearer $TOKEN" | head
curl -s -X POST localhost:3001/api/deals -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Projeto Teste","newCompanyName":"TechCorp"}' | head
curl -s localhost:3001/api/deals -H "Authorization: Bearer $TOKEN" | head
```
Expected: 5 fases; o POST cria deal + empresa "TechCorp" na 1ª fase; o GET lista o deal com `company` e `stage`.

**Step 3: Commit**

```bash
git add backend/src/routes/deals.js
git commit -m "feat(b2b): endpoints de negociações e stakeholders"
```

---

## Task 6: Tipos do frontend (`lib/types.ts`)

**Files:**
- Modify: `frontend/src/lib/types.ts`

**Step 1: Acrescentar os tipos** (no fim do ficheiro)

```typescript
export interface Company {
  id: string;
  userId: number;
  name: string;
  nif?: string | null;
  sector?: string | null;
  website?: string | null;
  location?: string | null;
  sizeTier?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { deals: number };
}

export interface DealStage {
  id: string;
  userId: number;
  name: string;
  color: string;
  order: number;
}

export type DealStatus = 'aberto' | 'ganho' | 'perdido';
export type StakeholderRole = 'tecnico' | 'decisor' | 'financeiro' | 'influenciador' | 'outro';
export type StakeholderInfluence = 'alto' | 'medio' | 'baixo';

export interface DealStakeholder {
  id: string;
  dealId: string;
  contactId: number;
  role: StakeholderRole;
  influence?: StakeholderInfluence | null;
  isPrimary: boolean;
  notes?: string | null;
  addedAt: string;
  contact?: { id: number; name: string; email: string; phone: string };
}

export interface Deal {
  id: string;
  userId: number;
  companyId: string;
  stageId: string;
  title: string;
  valueKz?: number | null;
  status: DealStatus;
  lossReason?: string | null;
  ownerUserId?: number | null;
  expectedCloseDate?: string | null;
  stageEnteredAt: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: Company;
  stage?: DealStage;
  stakeholders?: DealStakeholder[];
  _count?: { stakeholders: number };
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/types.ts
git commit -m "feat(b2b): tipos de Company, Deal, DealStakeholder, DealStage"
```

---

## Task 7: Camada de API do frontend (`lib/api.ts`)

Espelha o estilo das funções `getPipelineStages`/`createPipelineStage` (ver `lib/api.ts:529`). Importar os tipos novos no topo do ficheiro junto aos outros imports de `./types`.

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Acrescentar as funções** (a seguir ao bloco de pipeline stages)

```typescript
// ---- Negociações B2B ----
export async function getDealStages() {
  const response = await api.get<DealStage[]>('/api/deal-stages');
  return asArray<DealStage>(response.data);
}
export async function createDealStage(data: { name: string; color: string }) {
  const response = await api.post<DealStage>('/api/deal-stages', data);
  return response.data;
}
export async function updateDealStage(id: string, data: { name?: string; color?: string }) {
  const response = await api.put<DealStage>(`/api/deal-stages/${id}`, data);
  return response.data;
}
export async function deleteDealStage(id: string) {
  await api.delete(`/api/deal-stages/${id}`);
}
export async function reorderDealStages(order: { id: string; order: number }[]) {
  const response = await api.put<DealStage[]>('/api/deal-stages/reorder', { order });
  return asArray<DealStage>(response.data);
}

export async function getCompanies() {
  const response = await api.get<Company[]>('/api/companies');
  return asArray<Company>(response.data);
}
export async function getCompany(id: string) {
  const response = await api.get<Company & { deals: Deal[]; contacts: { id: number; name: string; email: string; phone: string }[] }>(`/api/companies/${id}`);
  return response.data;
}
export async function createCompany(data: Partial<Company>) {
  const response = await api.post<Company>('/api/companies', data);
  return response.data;
}

export async function getDeals(status?: DealStatus) {
  const response = await api.get<Deal[]>('/api/deals', { params: status ? { status } : undefined });
  return asArray<Deal>(response.data);
}
export async function getDeal(id: string) {
  const response = await api.get<Deal>(`/api/deals/${id}`);
  return response.data;
}
export async function createDeal(data: { title: string; companyId?: string; newCompanyName?: string; valueKz?: number | null; stageId?: string }) {
  const response = await api.post<Deal>('/api/deals', data);
  return response.data;
}
export async function updateDeal(id: string, data: { title?: string; valueKz?: number | null; stageId?: string; expectedCloseDate?: string | null }) {
  const response = await api.put<Deal>(`/api/deals/${id}`, data);
  return response.data;
}
export async function closeDeal(id: string, data: { status: 'ganho' | 'perdido'; lossReason?: string }) {
  const response = await api.post<Deal>(`/api/deals/${id}/close`, data);
  return response.data;
}
export async function reopenDeal(id: string) {
  const response = await api.post<Deal>(`/api/deals/${id}/reopen`, {});
  return response.data;
}
export async function deleteDeal(id: string) {
  await api.delete(`/api/deals/${id}`);
}

export async function addStakeholder(dealId: string, data: {
  contactId?: number;
  newContact?: { name: string; phone?: string; email?: string };
  role: StakeholderRole;
  influence?: StakeholderInfluence | null;
  isPrimary?: boolean;
  notes?: string | null;
}) {
  const response = await api.post<DealStakeholder>(`/api/deals/${dealId}/stakeholders`, data);
  return response.data;
}
export async function updateStakeholder(dealId: string, stakeholderId: string, data: Partial<Pick<DealStakeholder, 'role' | 'influence' | 'isPrimary' | 'notes'>>) {
  const response = await api.put<DealStakeholder>(`/api/deals/${dealId}/stakeholders/${stakeholderId}`, data);
  return response.data;
}
export async function removeStakeholder(dealId: string, stakeholderId: string) {
  await api.delete(`/api/deals/${dealId}/stakeholders/${stakeholderId}`);
}
```

**Step 2: Atualizar o import de tipos** no topo de `lib/api.ts` para incluir `Company, Deal, DealStage, DealStakeholder, DealStatus, StakeholderRole, StakeholderInfluence`.

**Step 3: Verificação** — `cd frontend && npx tsc --noEmit` não deve dar erros novos nestes símbolos.

**Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(b2b): funções de API para empresas, negociações e stakeholders"
```

---

## Task 8: Link na navegação (`sidebar.tsx`)

**Files:**
- Modify: `frontend/src/components/layout/sidebar.tsx`

**Step 1:** No array `mainLinks` (ver `sidebar.tsx:130`), acrescentar **a seguir** à linha de `/pipeline`:

```tsx
    { href: '/negociacoes', label: 'Negociações', icon: Building2, module: 'pipeline' as const },
```
Importar `Building2` de `lucide-react` (junto aos outros ícones no topo).

> Reutilizamos `module: 'pipeline'` para a visibilidade — quem vê o pipeline vê as negociações. O mapa de visibilidade em `sidebar.tsx:102` já cobre `/pipeline`; acrescentar também `'/negociacoes': 'pipeline',` nesse mapa se a função `isVisible` exigir entrada explícita por href (confirmar lendo `isVisible` em `sidebar.tsx:111`).

**Step 2: Verificação** — no browser, a sidebar mostra "Negociações" abaixo de "Processos de Venda".

**Step 3: Commit**

```bash
git add frontend/src/components/layout/sidebar.tsx
git commit -m "feat(b2b): link de Negociações na navegação"
```

---

## Task 9: Kanban de negociações (componente)

**Files:**
- Read first: `frontend/src/components/pipeline/kanban-board.tsx` (copiar a mecânica de drag, optimistic update e rollback)
- Create: `frontend/src/components/pipeline/deals-kanban-board.tsx`

**Step 1: Criar o componente** `DealsKanbanBoard({ deals, stages }: { deals: Deal[]; stages: DealStage[] })`:

- Estrutura igual ao `kanban-board.tsx`: `DragDropContext` → `Droppable` por fase → `Draggable` por deal.
- Agrupar deals por `stageId`. Mostrar só `status === 'aberto'` no quadro ativo.
- Mutation de mover: `updateDeal(dealId, { stageId })` com `onMutate` otimista sobre a queryKey `['deals']` e rollback no `onError` (copiar o padrão exato de `kanban-board.tsx:48-65`).
- **Conteúdo do card:**
  - Linha 1: `deal.company?.name` (a bold) + `deal.title`.
  - Linha 2: valor via helper `formatKz` (copiar de `kanban-board.tsx:27`).
  - Linha 3: badge com `deal._count?.stakeholders ?? deal.stakeholders?.length ?? 0` pessoas + "há N dias nesta fase" calculado de `stageEnteredAt` (helper `daysSince(date)` → `Math.floor((Date.now() - new Date(date)) / 86400000)`).
  - Card clicável → `router.push('/negociacoes/' + deal.id)`.

**Step 2: Verificação** — adiado para a Task 10 (página que renderiza este componente).

**Step 3: Commit**

```bash
git add frontend/src/components/pipeline/deals-kanban-board.tsx
git commit -m "feat(b2b): componente de kanban de negociações"
```

---

## Task 10: Página de negociações (`/negociacoes`)

**Files:**
- Read first: `frontend/src/app/pipeline/page.tsx` (estrutura de página, gating por `workspaceMode`, uso do `PipelineStageManager`)
- Create: `frontend/src/app/negociacoes/page.tsx`

**Step 1: Criar a página** (Client Component):

- `useQuery(['deals'], () => getDeals('aberto'))` e `useQuery(['dealStages'], getDealStages)`.
- Gating igual ao pipeline: `currentUser.workspaceMode !== 'comercio'` (copiar de `pipeline/page.tsx`).
- Render `<DealsKanbanBoard deals={deals} stages={stages} />`.
- Botão **"Gerir fases"** que abre `PipelineStageManager` — **mas** este componente está acoplado às funções de `pipelineStage`. Para a Fase 1: passar as funções de deal-stage por props **ou** duplicar para um `DealStageManager`. Decisão: **duplicar** num componente `deal-stage-manager.tsx` que importa `createDealStage/updateDealStage/deleteDealStage/reorderDealStages` (cópia direta do `pipeline-stage-manager.tsx` com os imports trocados). Criar esse ficheiro nesta tarefa.
- Botão **"+ Nova negociação"** que abre um `Dialog` (Task 11).
- `EmptyState` quando não há deals (reutilizar `@/components/ui/empty-state`).

**Step 2: Verificação manual** — `cd frontend && npm run dev`, abrir `/negociacoes`: aparecem as 5 colunas; arrastar um deal entre colunas persiste (recarregar confirma); "Gerir fases" abre o gestor.

**Step 3: Commit**

```bash
git add frontend/src/app/negociacoes/page.tsx frontend/src/components/pipeline/deal-stage-manager.tsx
git commit -m "feat(b2b): página de negociações com kanban e gestão de fases"
```

---

## Task 11: Diálogo "+ Nova negociação"

**Files:**
- Create: `frontend/src/components/pipeline/new-deal-dialog.tsx`
- Modify: `frontend/src/app/negociacoes/page.tsx` (ligar o botão)

**Step 1: Criar o diálogo** com `Dialog` do shadcn:
- Campo **Empresa**: um `Select`/combobox alimentado por `useQuery(['companies'], getCompanies)` com uma opção "+ Criar nova empresa" que revela um `Input` de texto (→ envia `newCompanyName`).
- Campo **Título** (obrigatório), **Valor (Kz)** (opcional, numérico).
- Submit → `createDeal({ title, companyId?|newCompanyName?, valueKz? })`; `onSuccess` invalida `['deals']` e `['companies']`, fecha o diálogo, e opcionalmente `router.push('/negociacoes/' + created.id)`.

**Step 2: Verificação manual** — criar uma negociação escolhendo empresa existente e outra criando empresa nova; ambas aparecem no kanban na 1ª fase.

**Step 3: Commit**

```bash
git add frontend/src/components/pipeline/new-deal-dialog.tsx frontend/src/app/negociacoes/page.tsx
git commit -m "feat(b2b): diálogo de criação de negociação com empresa inline"
```

---

## Task 12: Detalhe da negociação + painel de stakeholders

**Files:**
- Read first: `frontend/src/components/contacts/contact-history-timeline.tsx` (para a linha do tempo, opcional na Fase 1)
- Create: `frontend/src/app/negociacoes/[id]/page.tsx`
- Create: `frontend/src/components/pipeline/deal-stakeholders-panel.tsx`

**Step 1: Página de detalhe** (`[id]/page.tsx`):
- `useQuery(['deal', id], () => getDeal(id))`.
- Cabeçalho: empresa, título, valor, fase atual, estado (badge). Botões **Ganho** / **Perdido** (Perdido abre prompt de motivo) → `closeDeal`. Se já fechado, botão **Reabrir** → `reopenDeal`.
- Render `<DealStakeholdersPanel deal={deal} />`.

**Step 2: Painel de stakeholders** (`deal-stakeholders-panel.tsx`):
- Lista os `deal.stakeholders` com nome do contacto, **papel** (badge), **influência**, e marca de **principal**.
- Cada linha: editar papel/influência (`updateStakeholder`) e remover (`removeStakeholder`).
- Botão **"+ Adicionar pessoa"** → mini-form:
  - Modo 1 — **Selecionar contacto existente**: combobox alimentado por `searchContacts` (já existe em `lib/api.ts:348`).
  - Modo 2 — **Criar na hora**: inputs nome (obrigatório) + telefone/email → envia `newContact`.
  - Em ambos: escolher `role` (Select com os 5 papéis) e `influence` (opcional).
  - Submit → `addStakeholder(dealId, {...})`; `onSuccess` invalida `['deal', id]`.
- Todas as mutations invalidam `['deal', id]` (e `['deals']` para refrescar a contagem no card).

**Step 3: Verificação manual** — abrir um deal; adicionar o "técnico" (contacto existente), depois o "diretor" como decisor (criar na hora), depois o "financeiro"; mudar a influência; remover um; marcar Ganho e confirmar que sai do kanban ativo mas continua acessível pela empresa.

**Step 4: Commit**

```bash
git add frontend/src/app/negociacoes/[id]/page.tsx frontend/src/components/pipeline/deal-stakeholders-panel.tsx
git commit -m "feat(b2b): detalhe da negociação com painel de stakeholders e fecho"
```

---

## Checklist final de verificação (manual, ponta-a-ponta)

1. Sidebar mostra "Negociações"; abre `/negociacoes` com 5 fases por defeito.
2. "+ Nova negociação" cria deal com empresa existente **e** com empresa nova.
3. Drag-and-drop move o deal de fase e persiste após reload; o card mostra "há N dias na fase".
4. Detalhe do deal: adicionar stakeholders (existente + criar na hora), com papel e influência; editar e remover.
5. Card mostra a contagem de pessoas correta.
6. Marcar Ganho/Perdido: sai do kanban ativo; Perdido exige motivo; Reabrir devolve ao quadro.
7. Apagar empresa com deals é bloqueado com mensagem clara.
8. Pipeline individual (`/pipeline`) continua **exatamente** como antes — nenhum contacto novo entrou nele (`inPipeline` intocado).
9. `cd frontend && npx tsc --noEmit` sem erros novos.

## Notas de âmbito (o que NÃO entra na Fase 1)

- Métricas/velocidade agregadas, ficha 360º da empresa, alerta "deal parado há X dias" → **Fase 2**.
- Integração com finanças no fecho (Ganho → `Transaction`) → **Fase 3**.
- Papéis/influência configuráveis (são lista fixa na v1).
