# Developer Evaluation Brief

Atualizado em: 2026-04-23

Este documento existe para ser enviado a um programador externo ou novo colaborador que precise de avaliar rapidamente o estado técnico do projecto, o risco operacional e a qualidade da implementação antes de propor mudanças.

## 1. Resumo executivo

KukuGest é um CRM web com backend Express + Prisma + PostgreSQL e frontend Next.js 14.

O sistema já cobre:
- CRM de contactos
- pipeline comercial
- tarefas
- chat interno
- calendário com integração Google
- automações
- finanças
- faturação
- formulários públicos
- permissões por módulo e plano

O backend continua a ser a fonte de verdade para:
- autenticação interna
- scoping da conta
- permissões
- limites de plano
- regras de negócio críticas

O projecto está activo, com funcionalidades reais em produção/staging. Não é um protótipo.

## 2. Stack e arquitetura

### Frontend

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Query

Código principal:
- `frontend/src/app`
- `frontend/src/components`
- `frontend/src/lib`

### Backend

- Node.js
- Express
- Prisma
- PostgreSQL

Código principal:
- `backend/src/routes`
- `backend/src/lib`
- `backend/src/services`
- `backend/prisma/schema.prisma`

### Autenticação

- Supabase Auth no frontend
- JWT Supabase validado no backend
- suporte a impersonation no backend com `JWT_SECRET`

### Infraestrutura atual

- frontend em Vercel
- backend em Render
- base de dados PostgreSQL em Render
- uploads via Vercel Blob

## 3. Fluxo de branches e ambientes

Fluxo oficial do repositório:

```text
feature/* -> dev -> beta -> main
```

Branches oficiais:
- `main`: produção pública
- `beta`: staging oficial
- `dev`: integração de desenvolvimento
- `feature/*`: funcionalidades isoladas

Regras importantes:
- novas funcionalidades não devem ser testadas pela primeira vez em `main`
- alterações com Prisma/schema/migrations exigem validação antes de promoção
- backend deve manter-se como fonte de verdade

## 4. Topologia de deploy atual

### Backend Render

Serviços identificados:
- produção: `CRM-MAZANGA`
  - branch: `main`
  - URL: `https://crm-mazanga.onrender.com`
- beta: `CRM-MAZANGA-beta`
  - branch: `beta`
  - URL: `https://crm-mazanga-beta.onrender.com`

Observação operacional:
- o serviço beta em Render está configurado com auto-deploy por commit no branch `beta`
- o start command usa `npx prisma db push --accept-data-loss && node src/index.js`

Isto reduz fricção de deploy, mas merece revisão técnica porque:
- aplica alterações de schema no arranque do serviço
- depende do estado real da base
- dificulta rollback previsível

### Frontend Vercel

Projetos relevantes encontrados:
- `frontend`
- `beta-kukugest`

Estado observado:
- o domínio `https://beta.app.kukugest.ao` estava apontado para um deployment do projecto `frontend`
- não para o projecto `beta-kukugest`

Isto é importante para avaliação porque o comportamento de beta pode depender:
- do alias configurado no Vercel
- das variáveis de ambiente do projecto exacto que serve o domínio
- da URL do backend definida em `NEXT_PUBLIC_API_URL`

## 5. Módulos mais relevantes para avaliação

### CRM / Contactos

Ficheiros principais:
- `backend/src/routes/contacts.js`
- `frontend/src/app/contacts/page.tsx`
- `frontend/src/app/contacts/[id]/page.tsx`
- `frontend/src/components/contacts/*`

Capacidades actuais:
- listagem e detalhe
- criação e edição
- importação CSV
- campos customizáveis
- notas
- filtros
- conversão `Interessado -> Cliente`

Alterações recentes:
- grupos de contactos dedicados
- filtro por grupo e estado “Sem grupo”
- renome de copy do módulo de `Clientes` para `Contactos`
- acções em massa com selecção múltipla

### Pipeline

Ficheiros principais:
- `backend/src/routes/pipeline-stages.js`
- `frontend/src/app/pipeline`

### Tarefas

Ficheiros principais:
- `backend/src/routes/tasks.js`
- `frontend/src/app/tasks`
- `frontend/src/components/tasks`

### Calendário / Google Calendar

Ficheiros principais:
- `backend/src/routes/calendar.js`
- `backend/src/lib/google-calendar.js`
- `frontend/src/app/calendario/page.tsx`

Área sensível:
- OAuth
- sincronização de tarefas
- watch channels
- CORS/redirects

### Faturação / AGT

Ficheiros principais:
- `backend/src/routes/faturacao-*`
- `backend/src/lib/faturacao/*`

Esta zona é crítica e deve ser avaliada com mais cuidado do que o CRM puro.

## 6. Funcionalidades CRM recentes a rever

### 6.1 Grupos de contactos

Implementado:
- modelo `ContactGroup`
- relação opcional `Contact.contactGroupId`
- CRUD `/api/contacts/groups`
- filtro por grupo
- campo `Grupo` em lista, formulário e detalhe

Decisão funcional:
- cada contacto pertence a `0..1` grupo
- grupos são separados de tags
- apagar grupo deixa contactos como `Sem grupo`

### 6.2 Ações em massa de contactos

Implementado:
- selecção múltipla na lista de contactos
- selecção de todos os contactos visíveis
- modal de ações em massa
- endpoint `POST /api/contacts/bulk-update`

Campos suportados nesta primeira versão:
- grupo
- estado
- etapa
- tipo de contacto

Validações aplicadas:
- permissão `contacts.edit`
- scoping por `effectiveUserId`
- validação de grupo
- validação de etapa
- restrição de `contactType` conforme workspace

## 7. Pontos fortes do projecto

- separação razoável entre frontend e backend
- backend centraliza permissões, conta efectiva e regras de plano
- Prisma dá rastreabilidade suficiente do modelo de dados
- App já cobre processos reais, não só CRUD básico
- deploy e staging existem de facto
- há preocupação prática com CORS, limites, impersonation e multiutilizador

## 8. Dívida técnica e riscos conhecidos

### 8.1 Deploy e schema

- uso de `prisma db push` no arranque do backend beta/produção
- isto não substitui um fluxo disciplinado de migrations revistas

### 8.2 Ambiente frontend

- `next lint` ainda não é uma verificação automática confiável neste repositório
- o build de frontend é a validação principal disponível hoje

### 8.3 Configuração Vercel / aliases

- existe risco de confusão entre projecto Vercel, alias e domínio servido
- o domínio beta pode não corresponder ao projecto que se espera

### 8.4 CORS e múltiplos domínios

- já houve falha operacional por domínio de beta não estar incluído nas regras de CORS do backend
- a configuração deve ser revista sempre que mudar alias/domínio

### 8.5 Conhecimento distribuído

- parte do conhecimento operacional ainda está implícita em branches, serviços e aliases
- nem tudo está centralizado num runbook único

## 9. Como um programador deve avaliar o projecto

Sugestão de ordem:

1. Ler `README.md`, `DEPLOYMENT.md` e este documento.
2. Rever `backend/src/index.js`, `middleware/auth.js`, `lib/permissions.js` e `lib/plan-limits.js`.
3. Rever `backend/prisma/schema.prisma`.
4. Mapear as rotas principais:
   - `contacts`
   - `tasks`
   - `calendar`
   - `faturacao`
5. Rever `frontend/src/lib/api.ts` e `frontend/src/lib/types.ts`.
6. Validar um fluxo completo em beta:
   - login
   - `/contacts`
   - detalhe de contacto
   - criação/edição
   - grupos
   - ações em massa
7. Identificar riscos em:
   - migrations
   - faturação
   - permissões
   - scoping por conta
   - deploy/staging

## 10. Checklist mínima de avaliação

- O backend garante correctamente `effectiveUserId` em todas as rotas críticas?
- Há alguma rota que confie demasiado no frontend?
- O schema Prisma está coerente com as regras de negócio actuais?
- O fluxo de deploy é seguro para alterações de base de dados?
- O staging está realmente isolado da produção?
- As permissões por módulo estão consistentes entre UI e backend?
- Há endpoints sensíveis a faltar cobertura de erro/logs?
- O módulo de faturação está suficientemente isolado das mudanças do CRM?

## 11. Comandos úteis para revisão

### Backend

```bash
cd backend
npm install
npx prisma validate --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
node -c src/index.js
node -c src/routes/contacts.js
```

### Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy \
NEXT_PUBLIC_API_URL=http://localhost:3001 \
npm run build
```

## 12. Documentos de apoio

- `README.md`
- `DEPLOYMENT.md`
- `DATABASE_SETUP.md`
- `estruturakukugest.md`
- `kuku.md`
- `agt.md`

## 13. Conclusão curta

O projecto já tem valor operacional real, mas ainda merece uma avaliação sénior principalmente em:
- disciplina de deploy e migrations
- clareza de ambientes beta/prod
- robustez das integrações críticas
- consistência de permissões e scoping

Para CRM puro, a base está suficientemente evoluída para continuação incremental.
Para faturação, auth, Google Calendar e deploy, convém revisão mais rigorosa antes de refactors maiores.
