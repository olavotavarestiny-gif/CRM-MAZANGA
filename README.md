# KukuGest CRM

KukuGest é um CRM multiutilizador com autenticação Supabase, backend Express + Prisma e frontend Next.js. O repositório ainda se chama `mazanga-crm`, mas a aplicação e a documentação passam a tratar o produto como KukuGest.

## O que existe hoje

- CRM com contactos, pipeline, tarefas, calendário e automações
- Gestão de finanças e faturação
- Formulários públicos para captação de leads
- Gestão de equipa, permissões e impersonation para super admin
- Integrações opcionais com WhatsApp, Google Calendar, SMTP e AGT

## Stack atual

- Frontend: Next.js 14, React 18, TypeScript, Tailwind, shadcn/ui, React Query
- Backend: Node.js, Express, Prisma
- Autenticação: Supabase Auth
- Base de dados: PostgreSQL
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
- projeto Supabase configurado
- base de dados PostgreSQL acessível via `DATABASE_URL`

### 1. Configurar variáveis de ambiente

O ficheiro `.env.example` é a referência única das variáveis necessárias.

- criar `backend/.env`
- criar `frontend/.env.local`
- copiar apenas as variáveis relevantes para cada lado

### 2. Iniciar backend

```bash
cd backend
npm install
npm run db:push
npm run dev
```

Backend disponível em `http://localhost:3001`.

### 3. Iniciar frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend disponível em `http://localhost:3000`.

## Comandos úteis

### Backend

```bash
npm run dev
npm run start
npm run db:push
npm run db:studio
```

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

## Documentação mantida

- [DATABASE_SETUP.md](/Users/mazangangunza/Desktop/mazanga-crm/DATABASE_SETUP.md): como configurar PostgreSQL no projeto
- [DEPLOYMENT.md](/Users/mazangangunza/Desktop/mazanga-crm/DEPLOYMENT.md): deploy de backend e frontend
- [kuku.md](/Users/mazangangunza/Desktop/mazanga-crm/kuku.md): visão funcional do sistema
- [agt.md](/Users/mazangangunza/Desktop/mazanga-crm/agt.md): estado e requisitos do módulo AGT

## Notas de manutenção

- `backend/dev.db` é um artefacto antigo e não faz parte do fluxo atual. O schema Prisma está fixado em PostgreSQL.
- Alguns scripts antigos continuam no repositório. Antes de os usar, confirme se ainda batem com o schema atual.
- A documentação eliminada neste cleanup era redundante ou contraditória. Os ficheiros acima passam a ser a fonte de verdade.
