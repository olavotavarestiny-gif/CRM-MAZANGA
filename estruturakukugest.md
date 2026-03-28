# EstruturaKukuGest

Este documento descreve a estrutura técnica atual do KukuGest CRM, do backend ao frontend, no estado em que o projeto se encontra até aqui.

Objetivo:
- servir como mapa técnico do sistema
- acelerar onboarding
- ajudar manutenção, debugging e futuras expansões

Não é um guia funcional para utilizadores finais. Para isso, usa [kuku.md](/Users/mazangangunza/Desktop/mazanga-crm/kuku.md).

## 1. Visão Geral da Arquitetura

O projeto está dividido em duas aplicações principais:

- `backend/`
  API principal em Express + Prisma
- `frontend/`
  aplicação Next.js 14 com App Router

Padrão atual:
- o backend é a fonte de verdade para dados, permissões, limites e feature gating
- o frontend consome a API via `frontend/src/lib/api.ts`
- autenticação é baseada em Supabase Auth, com suporte adicional a impersonation no backend
- Prisma é a camada de acesso à base de dados

Fluxo alto nível:

1. utilizador autentica-se no Supabase
2. frontend obtém a sessão e envia o token nas chamadas API
3. backend valida o JWT em `middleware/auth.js`
4. backend resolve o utilizador interno, plano, permissões e conta efetiva
5. rotas aplicam RBAC, limites de plano e regras de negócio
6. frontend renderiza módulos, estados de loading/error/empty e ações

## 2. Estrutura de Pastas

### Raiz

- `backend/`
- `frontend/`
- `kuku.md`
- `estruturakukugest.md`

### Backend

- `backend/prisma/`
  schema, seed e utilitários de bootstrap
- `backend/src/`
  código principal da API
- `backend/src/routes/`
  módulos HTTP por domínio
- `backend/src/lib/`
  helpers centrais, Prisma, permissões, planos, faturação, email, WhatsApp
- `backend/src/middleware/`
  autenticação e guards
- `backend/src/services/`
  runners ou serviços de apoio
- `backend/scripts/`
  scripts auxiliares de migração

### Frontend

- `frontend/src/app/`
  páginas e routes do App Router
- `frontend/src/components/`
  componentes visuais e componentes por domínio
- `frontend/src/lib/`
  cliente API, tipos, permissões, helpers
- `frontend/src/hooks/`
  hooks específicos
- `frontend/src/middleware.ts`
  middleware de frontend
- `frontend/crmnewdesign/`
  referências visuais e inspiração de UX

## 3. Backend

### 3.1 Entrada principal

Ficheiro principal:
- [backend/src/index.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/index.js)

Responsabilidades:
- carregar variáveis de ambiente
- criar app Express
- configurar CORS
- aplicar headers de segurança
- configurar parsers JSON/urlencoded
- expor `/health`
- montar rotas públicas e protegidas
- ligar cron de faturação recorrente

Montagem de rotas atual:
- públicas
  - `/api/auth`
  - `/api/webhook`
  - `/api/forms`
  - `/api/setup`
- protegidas
  - `/api/contacts`
  - `/api/messages`
  - `/api/send`
  - `/api/automations`
  - `/api/whatsapp`
  - `/api/tasks`
  - `/api/inbox`
  - `/api/finances`
  - `/api/account`
  - `/api/pipeline-stages`
  - `/api/calendar`
  - `/api/faturacao/*`
  - `/api/chat`
  - `/api/notes`
- administração
  - `/api/admin`
  - `/api/superadmin`

### 3.2 Autenticação e autorização

Ficheiro principal:
- [backend/src/middleware/auth.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/middleware/auth.js)

O middleware faz:
- validação de JWT Supabase via JWKS
- fallback local para chaves conhecidas
- suporte a token de impersonation assinado com `JWT_SECRET`
- resolução do utilizador interno no Prisma
- preenchimento de `req.user` com:
  - `id`
  - `email`
  - `name`
  - `role`
  - `isSuperAdmin`
  - `accountOwnerId`
  - `effectiveUserId`
  - `isAccountOwner`
  - `permissionsJson`
  - `mustChangePassword`

Guards exportados:
- `requireAdmin`
- `requireAccountOwner`
- `requireAccountOwnerOrAdmin`
- `requireSuperAdmin`

### 3.3 Prisma e base de dados

Ficheiros principais:
- [backend/prisma/schema.prisma](/Users/mazangangunza/Desktop/mazanga-crm/backend/prisma/schema.prisma)
- [backend/src/lib/prisma.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/lib/prisma.js)

O Prisma modela as entidades principais do CRM:
- utilizadores
- contactos
- tarefas
- automações
- formulários
- finanças
- chat interno
- faturação
- configurações
- entidades administrativas e de plano

Scripts úteis:
- `npm run db:push`
- `npm run db:seed`
- `npm run db:studio`

### 3.4 Camada de permissões e planos

Ficheiros centrais:
- [backend/src/lib/permissions.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/lib/permissions.js)
- [backend/src/lib/plans.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/lib/plans.js)
- [backend/src/lib/plan-limits.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/lib/plan-limits.js)

Responsabilidades:
- resolver permissões por módulo
- centralizar planos suportados
- definir limites de:
  - utilizadores
  - contactos
  - tarefas
  - automações
- definir feature flags por plano:
  - painel
  - clientes
  - processos
  - tarefas
  - vendas
  - conversas
  - calendario
  - automacoes
  - formularios
  - financas
- serializar limites para JSON
- bloquear criação quando o plano é excedido
- bloquear acesso a módulos quando a feature não está disponível

Planos suportados atualmente:
- `essencial`
- `profissional`
- `enterprise`

### 3.5 Rotas por domínio

#### Auth

- [backend/src/routes/auth.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/auth.js)

Inclui:
- `/api/auth/me`
- retorno do utilizador atual
- plano atual
- detalhes do plano
- limits/features do plano
- catálogo disponível de planos

#### Contacts

- [backend/src/routes/contacts.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/contacts.js)

Cobre:
- CRUD de contactos
- importação CSV
- campos dinâmicos
- notas
- filtros
- detalhe do contacto
- enforcement de limite de contactos

#### Tasks

- [backend/src/routes/tasks.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/tasks.js)

Estado atual:
- tarefas com assignee único
- visibilidade por responsável
- admins/owners/superadmin veem tudo
- membros normais veem só tarefas atribuídas a eles
- notificação interna via chat ao atribuir tarefa

#### Chat

- [backend/src/routes/chat.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/chat.js)

Cobre:
- canais
- DMs
- membros
- mensagens
- contagem de não lidas
- gestão de canal:
  - renomear
  - gerir membros
  - apagar canal

#### Calendar

- [backend/src/routes/calendar.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/calendar.js)

Cobre:
- dados do calendário CRM
- integração Google Calendar
- renderização de tarefas e eventos por dia

#### Automations

- [backend/src/routes/automations.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/automations.js)
- [backend/src/services/automationRunner.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/services/automationRunner.js)

Cobre:
- CRUD de automações
- triggers e ações
- limite de automações por plano

#### Finances

- [backend/src/routes/finances.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/finances.js)

Cobre:
- entradas e saídas
- dashboard financeiro
- categorias
- análises

#### Forms

- [backend/src/routes/forms.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/forms.js)

Cobre:
- formulários públicos
- edição interna
- submissões
- criação de contactos a partir de formulário
- limite de contactos no auto-create

#### Faturação

Conjunto de rotas:
- [backend/src/routes/faturacao-config.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/faturacao-config.js)
- [backend/src/routes/faturacao-series.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/faturacao-series.js)
- [backend/src/routes/faturacao-clientes.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/faturacao-clientes.js)
- [backend/src/routes/faturacao-produtos.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/faturacao-produtos.js)
- [backend/src/routes/faturacao-facturas.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/faturacao-facturas.js)
- [backend/src/routes/faturacao-saft.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/faturacao-saft.js)
- [backend/src/routes/faturacao-recorrentes.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/faturacao-recorrentes.js)

Biblioteca de apoio:
- [backend/src/lib/faturacao/](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/lib/faturacao)

Inclui:
- validações
- numeração de documentos
- QR code
- geração PDF
- geração SAF-T
- integração AGT
- auditoria
- scheduler de recorrentes

#### Administração

- [backend/src/routes/admin.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/admin.js)
- [backend/src/routes/superadmin.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/superadmin.js)
- [backend/src/routes/account.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/account.js)

Funções:
- gestão de utilizadores
- gestão de organizações
- alteração manual de planos
- ativação/desativação
- gestão de equipa
- impersonation

### 3.6 Integrações externas no backend

Dependências e integrações principais:
- Supabase Auth
- Prisma
- Google APIs
- WhatsApp
- Nodemailer
- PDFKit
- QRCode
- cron diário para recorrentes

## 4. Frontend

### 4.1 Estrutura base

Tecnologia:
- Next.js 14
- App Router
- React Query
- Axios
- Tailwind

Ficheiros centrais:
- [frontend/src/app/layout.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/layout.tsx)
- [frontend/src/components/providers.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/providers.tsx)
- [frontend/src/components/layout/layout-wrapper.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/layout/layout-wrapper.tsx)
- [frontend/src/components/layout/sidebar.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/layout/sidebar.tsx)

Papéis:
- `layout.tsx`
  layout raiz da app
- `providers.tsx`
  React Query + ToastProvider
- `layout-wrapper.tsx`
  shell, proteções de rota, barra superior de progresso, mensagens de bloqueio
- `sidebar.tsx`
  navegação, badges e gating visual por plano/permissão

### 4.2 Camada de API e tipos

Ficheiros principais:
- [frontend/src/lib/api.ts](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/lib/api.ts)
- [frontend/src/lib/types.ts](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/lib/types.ts)
- [frontend/src/lib/permissions.ts](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/lib/permissions.ts)
- [frontend/src/lib/plan-utils.ts](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/lib/plan-utils.ts)

Responsabilidades:
- cliente Axios global
- injeção automática de token
- tratamento de 401
- wrappers de endpoints
- tipagem de entidades
- helpers de plano e permissões

### 4.3 App Router

A pasta `frontend/src/app/` organiza páginas por módulo:

- `page.tsx`
  dashboard principal
- `contacts/`
  lista e detalhe de contactos
- `pipeline/`
  processos/kanban
- `tasks/`
  tarefas
- `chat/`
  chat interno
- `calendario/`
  calendário
- `automations/`
  automações
- `forms/`
  formulários
- `finances/`
  finanças
- `faturacao/`
  faturação
- `configuracoes/`
  configurações
- `planos/`
  página pública/interna de planos
- `superadmin/`
  superfície administrativa global

Outras rotas:
- login
- forgot/reset password
- auth callback
- rotas API do frontend
- preview pages
- páginas legais

### 4.4 Componentes por domínio

A pasta `frontend/src/components/` está separada por domínio funcional:

- `dashboard/`
- `contacts/`
- `pipeline/`
- `tasks/`
- `chat/`
- `calendar/`
- `automations/`
- `finances/`
- `faturacao/`
- `configuracoes/`
- `plans/`
- `layout/`
- `help/`
- `ui/`
- `search/`

#### UI partilhada

Pasta:
- [frontend/src/components/ui/](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/ui)

Inclui:
- `button.tsx`
- `input.tsx`
- `dialog.tsx`
- `card.tsx`
- `table.tsx`
- `badge.tsx`
- `label.tsx`
- `textarea.tsx`
- `checkbox.tsx`
- `select.tsx`
- `switch.tsx`
- `loading-button.tsx`
- `error-state.tsx`
- `toast-provider.tsx`

Estes componentes suportam a camada de feedback transversal:
- loading
- erro
- confirmação
- toasts
- retry

#### Search partilhado

Pasta:
- [frontend/src/components/search/](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/search)

Atualmente inclui:
- `async-search-picker.tsx`

Uso atual:
- seleção de clientes em faturação
- base reutilizável para futuros seletores

### 4.5 Layout e experiência

O frontend já tem uma shell consolidada com:
- sidebar
- progress bar superior
- toasts globais
- gating visual por plano
- error states padronizados
- loading buttons e skeletons em áreas críticas

## 5. Módulos Principais no Frontend

### 5.1 Dashboard

Pastas:
- [frontend/src/app/page.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/page.tsx)
- [frontend/src/components/dashboard/](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/dashboard)

Responsabilidades:
- widgets
- métricas principais
- tarefas pendentes
- insight semanal
- customização de dashboard

### 5.2 Contactos

Pastas:
- [frontend/src/app/contacts/page.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/contacts/page.tsx)
- [frontend/src/app/contacts/[id]/page.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/contacts/[id]/page.tsx)
- [frontend/src/components/contacts/](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/contacts)

Inclui:
- listagem
- filtros
- pesquisa otimizada
- importação CSV
- personalização de campos
- detalhe do contacto

### 5.3 Pipeline

Pastas:
- [frontend/src/app/pipeline/page.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/pipeline/page.tsx)
- [frontend/src/components/pipeline/](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/pipeline)

Inclui:
- kanban
- estágios
- reorder
- movimento de contactos

### 5.4 Tasks

Pastas:
- [frontend/src/app/tasks/page.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/tasks/page.tsx)
- [frontend/src/components/tasks/task-item.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/tasks/task-item.tsx)
- [frontend/src/components/tasks/task-form-modal.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/tasks/task-form-modal.tsx)

Estado atual:
- tarefas concluídas não desaparecem
- filtros incluem concluídas quando relevante
- ordenação: pendentes primeiro, concluídas abaixo
- estado visual forte para concluídas
- loading por item em toggle/delete
- assignee único

### 5.5 Chat

Pastas:
- [frontend/src/app/chat/page.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/chat/page.tsx)
- [frontend/src/components/chat/](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/chat)

Inclui:
- lista de canais
- mensagens
- composer
- manage channel
- empty/loading/error states
- unread counts
- realtime via Supabase client

### 5.6 Calendar

Pastas:
- [frontend/src/app/calendario/page.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/calendario/page.tsx)
- [frontend/src/components/calendar/](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/calendar)

Inclui:
- grelha mensal
- seleção de dia
- painel lateral
- tarefas CRM
- integração Google Calendar

### 5.7 Automações

Pastas:
- [frontend/src/app/automations/page.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/automations/page.tsx)
- [frontend/src/components/automations/](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/automations)

### 5.8 Finanças

Pastas:
- [frontend/src/app/finances/page.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/finances/page.tsx)
- [frontend/src/components/finances/](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/finances)

### 5.9 Faturação

Pastas:
- [frontend/src/app/faturacao/](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/faturacao)
- [frontend/src/components/faturacao/](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/faturacao)

Inclui:
- emissão de fatura
- clientes de faturação
- produtos e serviços
- recorrentes
- detalhe de fatura
- séries
- SAFT

Estado atual relevante:
- pesquisa unificada CRM + faturação na emissão
- criação inline de série no formulário da fatura
- gestão avançada de séries continua acessível em áreas próprias

### 5.10 Configurações

Pasta:
- [frontend/src/app/configuracoes/page.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/configuracoes/page.tsx)

Áreas principais:
- perfil
- empresa
- equipa
- plano

### 5.11 Planos

Pasta:
- [frontend/src/app/planos/page.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/planos/page.tsx)

Inclui:
- comparação dos 3 planos
- limites
- features
- CTA WhatsApp

### 5.12 Super Admin

Pasta:
- [frontend/src/app/superadmin/page.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/superadmin/page.tsx)

Inclui:
- contas cliente
- planos
- organizações
- utilização
- storage
- impersonation

## 6. Fluxos Técnicos Relevantes

### 6.1 Login

1. frontend autentica via Supabase
2. token fica na sessão
3. `frontend/src/lib/api.ts` injeta token nas requests
4. backend valida token e resolve utilizador interno

### 6.2 Proteção de módulos

Acesso final cruza:
- permissões do utilizador
- plano da conta

Camadas:
- backend bloqueia rotas
- frontend esconde módulos e redireciona com mensagem amigável

### 6.3 Tarefas atribuídas

1. tarefa criada/editada com `assignedToUserId`
2. backend filtra visibilidade por role
3. ao atribuir a outro membro, backend cria notificação interna via chat
4. frontend mostra a tarefa conforme o utilizador autenticado

### 6.4 Emissão de fatura

1. utilizador escolhe tipo, série e estabelecimento
2. pesquisa cliente em CRM + faturação
3. ajusta dados fiscais se necessário
4. adiciona artigos/serviços
5. backend valida documento
6. backend gera número sequencial
7. backend gera QR
8. backend tenta submissão AGT quando aplicável
9. backend persiste fatura e devolve detalhe

### 6.5 Planos

1. backend resolve plano efetivo
2. `/api/auth/me` devolve:
   - plano
   - detalhes
   - limits
   - features
3. frontend usa isso para:
   - badge no sidebar
   - gating visual
   - comparação em `/planos`
   - secção `Configurações > Plano`

## 7. Estado Atual de UX e Produto

Melhorias já incorporadas na base atual:
- sistema partilhado de toast
- progress bar superior
- `LoadingButton`
- `ErrorState` com retry
- tasks concluídas visíveis
- chat com gestão de canais
- calendar e chat refinados visualmente
- plano com gating frontend + backend
- CTA de upgrade por WhatsApp
- pesquisa de contactos mais suave
- faturação com pesquisa unificada e criação inline de série

## 8. Convenções Implícitas do Projeto

- backend em CommonJS
- frontend em TypeScript/TSX
- React Query como camada de dados no cliente
- Prisma como ORM central
- backend mantém a verdade de negócio
- frontend evita inventar regras paralelas
- módulos estão organizados por domínio, não por tipo técnico puro

## 9. Onde mexer quando houver mudanças

### Se mexer em permissões

Verificar:
- [backend/src/lib/permissions.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/lib/permissions.js)
- [frontend/src/lib/permissions.ts](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/lib/permissions.ts)
- [backend/src/middleware/auth.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/middleware/auth.js)

### Se mexer em planos

Verificar:
- [backend/src/lib/plans.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/lib/plans.js)
- [backend/src/lib/plan-limits.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/lib/plan-limits.js)
- [backend/src/routes/auth.js](/Users/mazangangunza/Desktop/mazanga-crm/backend/src/routes/auth.js)
- [frontend/src/app/planos/page.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/planos/page.tsx)
- [frontend/src/app/configuracoes/page.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/app/configuracoes/page.tsx)

### Se mexer em faturação

Verificar:
- rotas `backend/src/routes/faturacao-*`
- `backend/src/lib/faturacao/`
- `frontend/src/components/faturacao/`
- `frontend/src/app/faturacao/`

### Se mexer em UX global

Verificar:
- [frontend/src/components/providers.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/providers.tsx)
- [frontend/src/components/ui/toast-provider.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/ui/toast-provider.tsx)
- [frontend/src/components/ui/error-state.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/ui/error-state.tsx)
- [frontend/src/components/ui/loading-button.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/ui/loading-button.tsx)
- [frontend/src/components/layout/layout-wrapper.tsx](/Users/mazangangunza/Desktop/mazanga-crm/frontend/src/components/layout/layout-wrapper.tsx)

## 10. Resumo Executivo

Hoje o KukuGest está estruturado como:

- um backend Express + Prisma responsável por autenticação, regras, planos, limites e dados
- um frontend Next.js modular por domínio funcional
- uma shell UX já consolidada com feedback visual, gating por plano e estados consistentes
- módulos principais de CRM, tarefas, chat, calendário, finanças, faturação e administração

Em termos de organização, o sistema já não é só um CRM simples:
- tem camada administrativa
- tem planos
- tem integração fiscal
- tem colaboração interna
- tem automação

Ou seja, a estrutura atual já é de um produto SaaS operacional com múltiplos domínios, onde o backend protege as regras e o frontend organiza a experiência.
