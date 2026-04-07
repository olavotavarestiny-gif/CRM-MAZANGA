# KukuGest - Estrutura Atual do Projeto

Este documento resume o estado atual do KukuGest CRM em duas perspetivas:

- lógica de produto e operação
- estrutura técnica do sistema

Objetivo:

- servir como mapa rápido do produto
- ajudar onboarding técnico e funcional
- reduzir dúvidas sobre onde cada módulo vive e como se relaciona

Não substitui documentação de deploy, variáveis de ambiente ou procedimentos fiscais específicos.

## 1. Visão geral do produto

O KukuGest é um CRM/ERP operacional com dois modos principais de workspace:

- `servicos`
  foco em contactos, processos de venda, tarefas, automações, formulários, calendário, finanças e faturação
- `comercio`
  foco em operação comercial, produtos, vendas rápidas, caixa, clientes, tarefas, faturação e controlo diário

O sistema usa a mesma base técnica, mas muda:

- navegação
- onboarding
- identidade visual
- dashboard principal
- regras de acesso a módulos

### Princípios atuais do produto

- o backend é a fonte de verdade para permissões, limites, faturação e regras de negócio
- o frontend consome a API e adapta a interface ao `workspaceMode`
- autenticação é feita com Supabase Auth
- o utilizador interno do CRM é resolvido no backend e pode representar:
  - dono da conta
  - admin
  - membro da equipa
  - superadmin

## 2. Lógica funcional por domínio

### Painel

Existem dois dashboards distintos:

- `DashboardCrm` para `servicos`
- `PainelComercialPage` para `comercio`

Capacidades atuais:

- widgets configuráveis
- métricas mensais
- dica do dia segmentada por perfil e workspace
- onboarding contextual por workspace
- leitura de métricas financeiras e operacionais

### Contactos

O módulo de contactos suporta:

- criação, edição e eliminação
- importação CSV
- campos personalizados
- tags
- histórico de atividade
- notas
- documentos anexos

Regras importantes:

- em `servicos`, o contacto pode ser `interessado` ou `cliente`
- em `comercio`, o contacto é forçado para `cliente`
- contactos podem alimentar tarefas, finanças, automações, formulários e processos de venda

### Processos de Venda

O módulo continua tecnicamente ligado a `pipeline`, mas a linguagem visível no produto é `Processos de Venda`.

Capacidades atuais:

- Kanban por etapas
- etapas personalizadas por conta
- drag and drop
- analytics integrados dentro do módulo
- forecast com valor por negociação
- taxa de conversão e velocidade por etapa

Regras importantes:

- em `comercio`, o fluxo principal não depende de processos de venda
- analytics de processos são focados em workspaces de `servicos`

### Tarefas

O módulo de tarefas suporta:

- responsável por tarefa
- ligação opcional a contacto
- prioridade
- prazo
- conclusão
- reatribuição
- atividade registada em histórico

Atualmente existe em ambos os workspaces:

- `servicos`
- `comercio`

### Chat interno

O sistema inclui chat interno de equipa com:

- canais
- mensagens
- anexos
- DMs
- contagem de não lidas

Também é usado como canal técnico para notificações internas, como atribuição de tarefas.

### Calendário

O módulo calendário integra:

- tarefas por data
- agenda do CRM
- ligação individual à Google Calendar por utilizador

Cada utilizador pode conectar a sua própria conta Google.

### Automações

As automações suportam:

- triggers por contacto e formulário
- ações como atualizar etapa, criar tarefa ou comunicação
- logging de execução
- métricas de sucesso/falha

### Formulários

Os formulários públicos suportam:

- campos configuráveis
- submissões
- sincronização para contactos
- automações ligadas a submissões

### Finanças

O módulo de finanças inclui:

- transações de entrada e saída
- filtros por período, tipo e estado
- rentabilidade por cliente
- saldo financeiro acumulado
- saldo inicial herdado do mês anterior
- receita mensal baseada em faturação recorrente
- anexos em saídas, como faturas de fornecedores e comprovativos

Regras importantes:

- `Em caixa da empresa` em Finanças significa saldo financeiro acumulado, não caixa físico
- o caixa operacional do ponto de venda vive no módulo `Caixa`
- a pesquisa de cliente nas transações usa `Contact`, não `ClienteFaturacao`

### Faturação

A faturação está separada em módulo próprio e cobre:

- configuração fiscal
- séries
- estabelecimentos
- clientes de faturação
- produtos
- emissão de documentos
- recorrentes
- PDF
- SAF-T
- relatórios
- quick sales

Estado atual:

- PDF refatorizado com layout premium
- suporte multi-moeda de apresentação
- QR e lógica fiscal preservados
- recorrentes alimentam a `Receita Mensal`

### Caixa e vendas rápidas

O módulo `Caixa` cobre a operação física/comercial:

- abertura de sessão
- fecho
- apuramento por método de pagamento
- diferenças de caixa
- ligação a vendas rápidas

As `Vendas Rápidas` dependem de sessão de caixa aberta e alimentam faturação e reconciliação.

### Onboarding e Dica do Dia

O sistema tem:

- onboarding separado por workspace
- dica do dia segmentada por:
  - `servicos_owner`
  - `servicos_equipa`
  - `comercio_owner`
  - `comercio_equipa`

A dica vive no dashboard e pode ser dispensada por utilizador no dia atual.

### Activity / histórico

Existe histórico transversal com:

- feed organizacional
- histórico por entidade
- timeline no detalhe do contacto

Entidades cobertas atualmente:

- contactos
- tarefas
- faturas
- mudanças de etapa

### Administração e superadmin

Áreas administrativas atuais:

- gestão de membros da conta
- permissões por módulo
- planos
- uso e storage por organização
- histórico de logins
- impersonation

## 3. Arquitetura técnica

## 3.1 Aplicações principais

O repositório está dividido em:

- `backend/`
  API Express + Prisma
- `frontend/`
  app Next.js 14 App Router + TypeScript + Tailwind

Fluxo principal:

1. utilizador autentica-se no Supabase
2. frontend obtém a sessão
3. token é enviado nas chamadas API
4. backend valida JWT e resolve o utilizador interno
5. backend aplica permissões, limites e regras de negócio
6. frontend renderiza os módulos conforme `workspaceMode`, papel e permissões

## 3.2 Backend

### Entrada principal

Ficheiro principal:

- `backend/src/index.js`

Responsabilidades:

- bootstrap do Express
- CORS
- headers de segurança
- parsers JSON/urlencoded
- health check
- montagem de rotas públicas e protegidas
- cron de faturação recorrente

### Estrutura do backend

- `backend/prisma/`
  schema, migrations, seed
- `backend/src/routes/`
  rotas HTTP por domínio
- `backend/src/lib/`
  helpers e regras partilhadas
- `backend/src/services/`
  serviços com lógica transversal
- `backend/src/middleware/`
  autenticação e guards
- `backend/src/data/`
  catálogos estáticos

### Middleware de auth

Ficheiro principal:

- `backend/src/middleware/auth.js`

Faz:

- validação de JWT Supabase
- suporte a impersonation
- resolução de `req.user`
- cálculo de `effectiveUserId`

Campos relevantes em `req.user`:

- `id`
- `name`
- `email`
- `role`
- `isSuperAdmin`
- `accountOwnerId`
- `effectiveUserId`
- `isAccountOwner`
- `permissionsJson`
- `mustChangePassword`

### Rotas principais do backend

Rotas públicas:

- `/api/auth`
- `/api/webhook`
- `/api/forms`
- `/api/setup`

Rotas protegidas por domínio:

- `/api/contacts`
- `/api/tasks`
- `/api/messages`
- `/api/inbox`
- `/api/send`
- `/api/whatsapp`
- `/api/automations`
- `/api/finances`
- `/api/account`
- `/api/pipeline-stages`
- `/api/pipeline/analytics`
- `/api/calendar`
- `/api/faturacao/*`
- `/api/chat`
- `/api/quick-sales`
- `/api/caixa`
- `/api/activity`
- `/api/daily-tip`
- `/api/onboarding`
- `/api/uploads`
- `/api/notes`

Rotas administrativas:

- `/api/admin`
- `/api/superadmin`

### Serviços e helpers centrais

Serviços relevantes atuais:

- `automationRunner`
- `automation-logger.service`
- `activity-log.service`
- `reconciliation.service`

Helpers relevantes em `backend/src/lib/`:

- permissões
- planos e limites
- Prisma client
- helpers de faturação
- helpers de pipeline
- helpers de email
- helpers de WhatsApp

## 3.3 Prisma e entidades principais

O Prisma modela hoje os blocos principais do produto:

- `User`
- `LoginLog`
- `Contact`
- `Task`
- `Transaction`
- `PipelineStage`
- `Automation`
- `AutomationLog`
- `ActivityLog`
- `Form`, `FormSubmission`, `FormAnswer`
- `GoogleCalendarToken`
- `Estabelecimento`, `Serie`
- `ClienteFaturacao`
- `Produto`, `ProdutoCategoria`, `StockMovement`
- `Factura`, `FacturaRecorrente`, `ConfiguracaoFaturacao`, `SaftPeriodo`
- `CaixaSessao`
- `ChatChannel`, `ChatMessage`, `ChatChannelMember`
- `DailyTipDelivery`

Pontos lógicos importantes:

- `effectiveUserId` representa a organização/dono da conta
- vários módulos usam `userId = effectiveUserId` para scoping organizacional
- membros da conta continuam a ter `id` próprio para auditoria e atividade

## 3.4 Frontend

### Estrutura principal

- `frontend/src/app/`
  rotas e páginas
- `frontend/src/components/`
  componentes por domínio e UI partilhada
- `frontend/src/lib/`
  cliente API, tipos, permissões e helpers
- `frontend/src/hooks/`
  hooks utilitários

### Páginas principais

Páginas núcleo atuais:

- `/`
- `/contacts`
- `/contacts/[id]`
- `/pipeline`
- `/tasks`
- `/chat`
- `/calendario`
- `/automations`
- `/forms`
- `/finances`
- `/vendas`
- `/vendas-rapidas`
- `/caixa`
- `/configuracoes`
- `/activity`
- `/superadmin`

### Componentização por domínio

Grupos importantes:

- `components/dashboard`
- `components/contacts`
- `components/pipeline`
- `components/tasks`
- `components/chat`
- `components/finances`
- `components/faturacao`
- `components/comercial`
- `components/onboarding`
- `components/layout`
- `components/ui`

### Camada de cliente API

Ficheiro central:

- `frontend/src/lib/api.ts`

Responsabilidades:

- chamadas HTTP para a API
- attach automático do token Supabase ou token de impersonation
- normalização simples de respostas
- tipos consumidos nas páginas

### UI partilhada e padrões atuais

O frontend já usa padrões consolidados como:

- `FilterBar`
- `DataTable`
- `EmptyState`
- `ErrorState`
- `Modal`
- `AsyncSearchPicker`

## 4. Regras transversais atuais

### Permissões

O acesso é controlado por:

- papel do utilizador
- permissões por módulo
- plano activo
- contexto de conta efetiva

### Logging e auditoria

Hoje existem vários níveis de registo:

- `LoginLog`
  logins reais
- `AutomationLog`
  execuções de automações
- `ActivityLog`
  histórico funcional por entidade

### Uploads

O sistema suporta uploads em:

- documentos de contactos
- anexos de chat
- anexos financeiros em saídas
- ficheiros de faturação relevantes

O caminho atual de upload usa:

- proxy `/api/upload` no frontend
- gravação real no backend em `/api/uploads`
- storage em Supabase Storage

### Multi-moeda e faturação

O sistema separa:

- moeda interna/base
- moeda de apresentação no documento

Campos relevantes de documento:

- `baseCurrency`
- `displayCurrency`
- `exchangeRate`
- `exchangeRateDate`
- `displayMode`

### Receita Mensal

A `Receita Mensal` já não depende de transações recorrentes manuais.

Base atual:

- `FacturaRecorrente` activa
- valor mensalizado conforme frequência

## 5. Estado lógico atual por grandes decisões

Decisões de produto já incorporadas no código:

- `servicos` e `comercio` partilham base técnica, mas têm experiência diferente
- `Processos de Venda` é a nomenclatura visível do antigo `pipeline`
- o dashboard e onboarding são específicos por workspace
- a dica do dia é segmentada por perfil e workspace
- login analytics mede login real, não atividade genérica
- finanças e caixa são módulos distintos
- faturação é a base da receita recorrente do produto
- uploads já não dependem do Vercel Blob no fluxo activo

## 6. Ficheiros de referência

Se precisares de aprofundar:

- `README.md`
  setup geral
- `estruturakukugest.md`
  mapa técnico complementar mais detalhado

Este `kuku.md` deve ser tratado como o resumo principal do estado atual do sistema.
