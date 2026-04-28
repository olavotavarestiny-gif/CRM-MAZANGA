# Developer Evaluation

## Objetivo

Este ficheiro existe para acelerar a avaliação técnica do KukuGest por outro programador, sem obrigar a ler documentação antiga, planos históricos ou notas internas.

## Resumo executivo

O KukuGest é uma aplicação web de gestão com duas camadas principais:

- `frontend/`: Next.js 14, React 18, TypeScript, Tailwind e React Query
- `backend/`: Express + Prisma + PostgreSQL

A autenticação é feita com Supabase Auth. O backend valida o token, resolve o utilizador interno e aplica permissões, plano e scoping da conta.

## Arquitetura de alto nível

```text
Frontend Next.js  ->  API Express  ->  PostgreSQL
        |                  |
        |                  -> Prisma
        |
        -> Supabase Auth
```

Princípios importantes do código:

- o backend é a fonte de verdade
- a maioria dos dados é scoped por `effectiveUserId = accountOwnerId || user.id`
- permissões e limites de plano são validados no backend
- integrações externas são opcionais por módulo

## Módulos principais

- CRM: contactos, pipeline, tarefas, notas e formulários
- Calendário: calendário interno e integração Google Calendar
- Automações: triggers internos por evento
- Finanças: transações, métricas e categorização
- Faturação: clientes fiscais, produtos, séries, faturas e recorrentes
- Operação comercial: quick sales, caixa e produtos
- Administração: equipa, permissões, impersonation e gestão da conta

## Branches e ambientes

- `main`: produção pública
- `beta`: staging oficial
- `dev`: integração principal
- `feature/*`: trabalho isolado por funcionalidade

Fluxo esperado:

`feature/* -> dev -> beta -> main`

## Deploy atual

- frontend em Vercel
- backend em Render
- base de dados em PostgreSQL
- autenticação em Supabase

Documentos operacionais relacionados:

- [../operations/deployment.md](../operations/deployment.md)
- [../setup/database.md](../setup/database.md)

## Pontos fortes

- separação clara entre frontend e backend
- Prisma como fonte de verdade do modelo de dados
- escopo multiutilizador já incorporado em grande parte das rotas
- produto relativamente amplo para CRM + operação + faturação

## Riscos e dívida técnica a rever

- parte da documentação antiga foi removida por estar contraditória ou desactualizada
- o repositório tem histórico de funcionalidades em evolução rápida, por isso convém validar fluxos críticos no código e não apenas pela UI
- AGT ainda tem limitações para cenário fiscal real e deve ser tratado com cautela
- algumas áreas antigas podem ainda carregar naming legacy como `cliente` vs `contacto`, dependendo do contexto de negócio
- integrações externas exigem revisão de env vars, callbacks e CORS no deploy real

## Incoerências remanescentes observáveis

- o repositório ainda se chama `mazanga-crm`, embora o produto e a documentação já usem `KukuGest`
- existem artefactos legados como `backend/dev.db`, que não representam o fluxo real baseado em PostgreSQL
- alguns nomes internos e descrições de pacote ainda reflectem fases anteriores do produto e devem ser lidos com contexto

## Checklist de avaliação recomendada

1. Ler [../../README.md](../../README.md) para setup e mapa do repositório.
2. Ler [../standards/engineering-standards.md](../standards/engineering-standards.md) para perceber as regras estruturais e expectativas de qualidade.
3. Ler [../product/kukugest.md](../product/kukugest.md) para perceber o produto e a lógica transversal.
4. Rever [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma) para entender o modelo real.
5. Rever [backend/src/index.js](../../backend/src/index.js) e [backend/src/middleware/auth.js](../../backend/src/middleware/auth.js).
6. Validar [frontend/src/lib/api.ts](../../frontend/src/lib/api.ts) e [frontend/src/lib/types.ts](../../frontend/src/lib/types.ts).
7. Confirmar deploy e envs com [../operations/deployment.md](../operations/deployment.md) e [../setup/database.md](../setup/database.md).
8. Rever [../integrations/README.md](../integrations/README.md) se a análise incluir serviços externos.
9. Se a avaliação incluir calendário Google, ler [../integrations/google-calendar-oauth.md](../integrations/google-calendar-oauth.md).

## Comandos úteis

### Backend

```bash
cd backend
npm install
npm run build
npm run db:push
npm run db:migrate:deploy
```

### Frontend

```bash
cd frontend
npm install
npm run build
```

## Fonte de verdade documental

O conjunto de documentação oficial do projeto ficou reduzido a:

- [../../README.md](../../README.md)
- [developer-evaluation.md](developer-evaluation.md)
- [../standards/engineering-standards.md](../standards/engineering-standards.md)
- [../setup/database.md](../setup/database.md)
- [../operations/deployment.md](../operations/deployment.md)
- [../product/kukugest.md](../product/kukugest.md)
- [../modules/agt.md](../modules/agt.md)
- [../integrations/README.md](../integrations/README.md)
- [../integrations/google-calendar-oauth.md](../integrations/google-calendar-oauth.md)
