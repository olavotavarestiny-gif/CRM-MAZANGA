# KukuGest CRM

KukuGest é um CRM multiutilizador com autenticação Supabase, backend Express + Prisma e frontend Next.js. O repositório ainda se chama `mazanga-crm`, mas a aplicação e a documentação passam a tratar o produto como KukuGest.

## O que existe hoje

- Workspaces Serviços, Comércio, Gestão e KPI e Food, activáveis em simultâneo por organização
- CRM com contactos, pipeline, tarefas, calendário e automações
- Gestão de finanças e faturação
- Gestão e KPI com clientes, marketing, comercial, operação, finanças, metas e relatórios
- Formulários públicos para captação de leads
- Gestão de equipa, permissões e impersonation para super admin
- Integrações opcionais com WhatsApp, Google Calendar, SMTP e AGT

## Stack atual

- Frontend: Next.js 14, React 18, TypeScript, Tailwind, shadcn/ui, React Query, React Hook Form, Zod e Recharts
- Backend: Node.js, Express, Prisma
- Autenticação: Supabase Auth
- Base de dados: PostgreSQL local em desenvolvimento e instâncias separadas em staging/produção
- Uploads: Vercel Blob

## Arquitetura

```text
frontend/   Next.js App Router
backend/    API REST, Prisma e integrações
```

O login acontece no frontend via Supabase. O backend recebe o `Bearer token`, valida o JWT do Supabase e carrega o utilizador interno. Não existe fluxo público de registo completo no estado atual do projeto; a criação de contas é feita por administração.

## Estrutura do repositório

```text
mazanga-crm/
├── backend/
│   ├── prisma/
│   └── src/
│       ├── lib/
│       ├── middleware/
│       ├── routes/
│       └── services/
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── hooks/
│       └── lib/
├── .env.example
├── DATABASE_SETUP.md
├── DEPLOYMENT.md
├── README.md
├── agt.md
└── kuku.md
```

## Arranque local

### Pré-requisitos

- Node.js 20+
- npm
- projeto Supabase configurado quando `BYPASS_AUTH=false`
- Docker Desktop com Docker Compose, ou PostgreSQL 16 configurado manualmente

### 1. Iniciar o PostgreSQL local

```bash
npm run db:local:up
```

`npm run dev` também executa este passo automaticamente quando o container não
está ligado. O serviço local usa `localhost:5433`, mantém os dados num volume e cria bases
separadas `kukugest_dev` e `kukugest_test`. Staging e produção devem usar bases
próprias e credenciais diferentes.

### 2. Configurar variáveis de ambiente

O ficheiro `.env.example` é a referência única das variáveis necessárias.

- criar `backend/.env` a partir de `backend/.env.local.example`
- criar `frontend/.env.local`
- copiar apenas as variáveis relevantes para cada lado

### 3. Iniciar o ambiente completo

```bash
cd "/caminho/para/mazanga-crm"
npm install
npm --prefix backend install
npm --prefix frontend install
npm run dev
```

Este é o comando recomendado para desenvolvimento. Antes de iniciar, o supervisor
garante o PostgreSQL local e aplica `prisma migrate deploy`; nunca reutiliza a URL
da Render. Depois fica em segundo
plano, mantém o frontend e o backend ligados, verifica a saúde dos dois processos e
reinicia automaticamente um servidor que deixe de responder. Fechar o Terminal não
interrompe a aplicação.

- Aplicacão: `http://localhost:3000`
- Backend: `http://localhost:3011`
- Diagnóstico: `npm run dev:status`
- Logs: `npm run dev:logs`
- Parar o ambiente: `npm run dev:stop`

O desenvolvimento usa `frontend/.next-dev`, separado do build de validação em
`frontend/.next`, para que `npm run build` não derrube o servidor local.

O deploy do backend deve executar `prisma migrate deploy`. Não use `db push` nem
`--accept-data-loss` em staging ou produção.

## Comandos úteis

### Backend

```bash
npm run dev
npm run start
npm run db:migrate:deploy
npm run db:seed:management
npm run db:studio
npm test
```

Os testes de isolamento que usam PostgreSQL devem ser executados a partir da raiz:

```bash
npm run test:backend:postgres
```

Este comando inicia a base local, aplica todas as migrations em `kukugest_test` e
executa os testes unitários e de integração com `TEST_DATABASE_URL`. Um teste
multi-tenant ignorado no `npm test` sem base não substitui esta verificação.

### Frontend

```bash
npm run dev
npm run build
npm run start
```

`npm run lint` no frontend ainda depende de configuração de ESLint e não deve ser tratado como verificação automática confiável neste estado do repositório.

## Módulos principais

- `contacts`: base de dados de contactos, notas e importação CSV
- `pipeline`: Kanban por fases
- `tasks`: tarefas ligadas ou não a contactos
- `chat`: conversas internas por canal
- `calendario`: tarefas do CRM e Google Calendar
- `automations`: regras automáticas por evento
- `forms`: formulários públicos
- `finances`: transações e métricas
- `faturacao`: clientes, produtos, séries, faturas, recorrentes e SAF-T
- `configuracoes`: perfil, equipa, permissões e administração
- `gestao`: dashboard executivo da área Gestão e KPI
- `gestao/clientes`: clientes, contratos, responsáveis e rentabilidade
- `gestao/marketing`: campanhas manuais e KPIs de aquisição
- `gestao/comercial`: CRM e pipeline Kanban com histórico de etapas
- `gestao/operacional`: trabalhos, prazos, horas e revisões
- `gestao/financas`: receitas, despesas e rentabilidade
- `gestao/metas`: metas mensais e cumprimento automático
- `gestao/relatorios`: relatórios filtráveis, CSV e impressão

## Workspace Gestão e KPI

O workspace `gestao_kpi` utiliza a autenticação existente do Supabase, mas mantém todos os dados funcionais no PostgreSQL da Render. O browser nunca acede diretamente às tabelas: o frontend comunica com a API Express, e o Prisma executa cada operação dentro de uma transação com contexto de organização, perfil e função.

As tabelas da área usam UUID, índices por organização e Row Level Security nativo do PostgreSQL com `FORCE ROW LEVEL SECURITY`. A migration principal está em:

```text
backend/prisma/migrations/20260723120000_add_management_kpi_workspace/migration.sql
```

### Aplicar a migration

Em desenvolvimento ou no processo de deploy do backend:

```bash
cd backend
npm install
npm run db:migrate:deploy
```

Não use `prisma db push` para publicar esta área em produção, porque as funções, políticas RLS e triggers são definidos pela migration SQL.

### Criar os dados de demonstração

Depois da migration, configure `DEMO_SEED_PASSWORD` no ambiente do backend. O seed também requer `DATABASE_URL`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

```bash
cd backend
DEMO_SEED_PASSWORD='uma-password-segura' npm run db:seed:management
```

O seed é idempotente e cria ou atualiza:

- 5 utilizadores funcionais: Administrador, Marketing, Comercial, Designer e Editor;
- 5 clientes e 5 campanhas;
- 15 oportunidades com histórico de etapa;
- 20 trabalhos operacionais e 20 movimentos financeiros;
- 10 metas mensais.

O login administrativo criado pelo seed é `admin.gestao@demo.kukugest.com`; os restantes endereços são apresentados no ficheiro [backend/scripts/seed-management-demo.js](./backend/scripts/seed-management-demo.js). A palavra-passe nunca é guardada no repositório.

### Matriz de permissões

| Função | Acesso |
|---|---|
| Administrador | Todos os módulos, utilizadores, configurações, metas e relatórios |
| Marketing | Campanhas e dashboard/KPIs de marketing |
| Comercial | Clientes, oportunidades e pipeline comercial |
| Designer | Apenas trabalhos operacionais atribuídos |
| Editor | Apenas trabalhos operacionais atribuídos |

As rotas internas ficam em `/gestao` e são filtradas na sidebar e nos guardas do frontend. A API volta a validar a função, e as políticas RLS constituem a camada final de isolamento.

### Validação local

```bash
cd backend
npx prisma validate
npm test
npm run build

cd ../frontend
npm run typecheck
npm run build
```

## Documentação mantida

- [DEVELOPER_EVALUATION.md](./DEVELOPER_EVALUATION.md): briefing técnico para um programador avaliar rapidamente o projecto
- [DATABASE_SETUP.md](./DATABASE_SETUP.md): como configurar PostgreSQL no projeto
- [DEPLOYMENT.md](./DEPLOYMENT.md): deploy de backend e frontend
- [kuku.md](./kuku.md): visão funcional do sistema
- [agt.md](./agt.md): estado e requisitos do módulo AGT

## Notas de manutenção

- `backend/dev.db` é um artefacto antigo e não faz parte do fluxo atual. O schema Prisma está fixado em PostgreSQL.
- Alguns scripts antigos continuam no repositório. Antes de os usar, confirme se ainda batem com o schema atual.
- A documentação eliminada neste cleanup era redundante ou contraditória. Os ficheiros acima passam a ser a fonte de verdade.
