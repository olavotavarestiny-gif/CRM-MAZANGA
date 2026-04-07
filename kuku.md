# KukuGest - Guia Completo da Estrutura Atual do Projeto

Este documento descreve o estado atual do KukuGest de forma completa, cobrindo:

- visão de produto
- lógica funcional
- arquitetura técnica
- principais entidades de dados
- fluxos operacionais críticos
- integrações
- permissões
- convenções de implementação

O objetivo deste ficheiro é servir como referência central para entender o sistema como produto e como código.

Este documento não substitui:

- documentação fiscal/legal externa
- configuração de deploy e infraestrutura
- credenciais, segredos e variáveis de ambiente
- procedimentos operacionais específicos do cliente

---

## Índice

1. Visão geral do produto
2. Modos de workspace
3. Perfis de utilizador e escopo de conta
4. Arquitetura técnica
5. Backend
6. Frontend
7. Modelo de dados principal
8. Lógica funcional por domínio
9. Fluxos críticos end-to-end
10. Sistemas transversais
11. Integrações externas
12. Permissões, planos e gating
13. Convenções de implementação
14. Riscos e pontos de atenção
15. Referências internas

---

## 1. Visão geral do produto

O KukuGest é uma aplicação de gestão orientada a pequenas e médias empresas, combinando CRM, operação comercial, faturação, finanças e colaboração interna.

Na prática, o produto hoje funciona como um sistema híbrido entre:

- CRM de relacionamento e acompanhamento comercial
- ERP operacional leve
- ponto de venda com sessão de caixa
- sistema de faturação com regras fiscais
- hub de tarefas, chat, formulários e automações

O produto está organizado em dois modos principais de workspace:

- `servicos`
- `comercio`

Ambos partilham a mesma base técnica, a mesma autenticação, a mesma conta e a mesma maioria das entidades nucleares, mas diferem em:

- navegação
- linguagem visível
- dashboard principal
- onboarding
- acentos visuais
- importância relativa de cada módulo

### Objetivo de negócio do modo `servicos`

O modo `servicos` é orientado a empresas que precisam de:

- captar leads
- acompanhar contactos
- gerir processos de venda
- transformar interessados em clientes
- ligar vendas, faturação e receita recorrente

### Objetivo de negócio do modo `comercio`

O modo `comercio` é orientado a operação diária e venda imediata, com foco em:

- produtos
- clientes
- vendas rápidas
- caixa
- faturação comercial
- tarefas operacionais
- dashboards de desempenho diário

---

## 2. Modos de workspace

O `workspaceMode` vive hoje no utilizador/conta e pode assumir:

- `servicos`
- `comercio`

### O que muda entre workspaces

#### Em `servicos`

- o dashboard principal é o `DashboardCrm`
- o módulo de `pipeline` é apresentado ao utilizador como `Processos de Venda`
- o acompanhamento comercial é central
- a receita mensal baseada em recorrência é relevante
- contactos podem ser `interessado` ou `cliente`

#### Em `comercio`

- o dashboard principal é o `PainelComercialPage`
- o foco vai para `produtos`, `vendas`, `caixa`, `clientes` e `tarefas`
- contactos são tratados como clientes
- `Processos de Venda` não é o fluxo principal do workspace
- operação diária pesa mais do que funil comercial

### O que não muda entre workspaces

- autenticação
- modelo de conta
- backend principal
- faturação fiscal
- finanças
- activity log
- tarefas
- chat
- calendário

---

## 3. Perfis de utilizador e escopo de conta

O sistema separa claramente autenticação externa de identidade interna do CRM.

### Autenticação

- a autenticação é feita por Supabase Auth
- o frontend obtém um access token
- o backend valida o JWT e resolve o utilizador interno

### Utilizador interno

No backend, `req.user` contém o contexto real do utilizador autenticado.

Campos centrais:

- `id`
- `email`
- `name`
- `role`
- `isSuperAdmin`
- `accountOwnerId`
- `effectiveUserId`
- `isAccountOwner`
- `permissionsJson`

### Regra de escopo principal

A regra operacional mais importante do sistema é:

- `effectiveUserId = accountOwnerId || user.id`

Isto significa que:

- o dono da conta trabalha sobre o seu próprio ID
- membros trabalham sempre scoped à conta do owner
- a maioria dos dados de negócio é agregada por `effectiveUserId`

### Perfis funcionais

Hoje existem, em termos práticos:

- `owner`
- `admin`
- `user`
- `superadmin`

#### Owner

- é o dono da conta
- define workspace
- controla equipa, módulos, planos e configuração estrutural

#### Admin

- administra a conta em nome do owner
- tem acesso a quase toda a operação da conta, sem ser necessariamente o titular

#### User

- membro da equipa
- trabalha segundo permissões atribuídas

#### Superadmin

- perfil de plataforma
- vê contas, métricas globais, logins, uso e pode fazer impersonation

---

## 4. Arquitetura técnica

O repositório está dividido em duas aplicações principais:

- `backend/`
- `frontend/`

### Stack atual

#### Backend

- Node.js
- Express
- Prisma
- PostgreSQL
- CommonJS

#### Frontend

- Next.js 14 com App Router
- React
- TypeScript
- Tailwind CSS
- React Query / TanStack Query
- Axios para API client

#### Infra de autenticação e dados

- Supabase Auth para sessão/JWT
- PostgreSQL como base de dados principal
- Supabase Storage para uploads atuais

### Filosofia arquitetural

O sistema segue estes princípios:

- o backend é a fonte de verdade para regras de negócio
- o frontend é a camada de composição visual e interação
- permissões e limites são aplicados no backend
- o frontend adapta a UI ao workspace e às permissões
- lógica fiscal deve permanecer isolada de refactors visuais
- dados críticos devem manter compatibilidade entre módulos

---

## 5. Backend

### 5.1 Entrada principal

Ficheiro:

- `backend/src/index.js`

Responsabilidades:

- bootstrap do Express
- configuração CORS
- headers de segurança
- parsers JSON e urlencoded
- `health check`
- montagem das rotas públicas e protegidas
- agendamento do scheduler de faturação recorrente

### 5.2 Estrutura do backend

Pastas principais:

- `backend/prisma/`
- `backend/src/routes/`
- `backend/src/lib/`
- `backend/src/services/`
- `backend/src/middleware/`
- `backend/src/data/`

#### `backend/prisma/`

Contém:

- `schema.prisma`
- migrations
- geração do Prisma Client

#### `backend/src/routes/`

Contém a superfície HTTP por domínio.

Rotas principais atualmente:

- `auth.js`
- `contacts.js`
- `tasks.js`
- `forms.js`
- `automations.js`
- `messages.js`
- `inbox.js`
- `calendar.js`
- `chat.js`
- `finances.js`
- `pipeline-stages.js`
- `pipeline-analytics.js`
- `faturacao-config.js`
- `faturacao-series.js`
- `faturacao-clientes.js`
- `faturacao-produtos.js`
- `faturacao-facturas.js`
- `faturacao-relatorios.js`
- `faturacao-saft.js`
- `faturacao-recorrentes.js`
- `produto-categorias.js`
- `comercial-dashboard.js`
- `quick-sales.js`
- `caixa-sessoes.js`
- `activity.js`
- `daily-tip.js`
- `onboarding.js`
- `uploads.js`
- `admin.js`
- `superadmin.js`
- `account.js`
- `setup.js`
- `webhook.js`
- `whatsapp.js`
- `send.js`
- `notes.js`

#### `backend/src/lib/`

Agrupa helpers e regras partilhadas, incluindo:

- `prisma.js`
- `permissions.js`
- `plan-limits.js`
- `plans.js`
- `pipeline-stages.js`
- `contact-nif.js`
- `activity-log.js`
- `email.js`
- `whatsapp.js`

#### `backend/src/services/`

Contém lógica transversal mais estruturada:

- `activity-log.service.js`
- `automation-logger.service.js`
- `automationRunner.js`
- `reconciliation.service.js`

#### `backend/src/middleware/`

Hoje o principal middleware é:

- `auth.js`

#### `backend/src/data/`

Hoje inclui o catálogo estático de:

- `daily-tip-catalog.js`

### 5.3 Middleware de autenticação

Ficheiro:

- `backend/src/middleware/auth.js`

Funções centrais:

- validar JWT do Supabase
- suportar impersonation com token próprio
- auto-link do `supabaseUid` por email quando necessário
- recusar utilizadores inativos
- popular `req.user`

O middleware também expõe guards adicionais:

- `requireAdmin`
- `requireAccountOwner`
- `requireAccountOwnerOrAdmin`
- `requireSuperAdmin`

### 5.4 Montagem de rotas

As rotas são montadas por grupos:

#### Públicas

- `/api/auth`
- `/api/webhook`
- `/api/forms`
- `/api/setup`

#### Protegidas com `requireAuth`

- `/api/contacts`
- `/api/messages`
- `/api/send`
- `/api/tasks`
- `/api/inbox`
- `/api/account`
- `/api/pipeline-stages`
- `/api/pipeline/analytics`
- `/api/calendar`
- `/api/chat`
- `/api/quick-sales`
- `/api/caixa`
- `/api/activity`
- `/api/daily-tip`
- `/api/onboarding`
- `/api`

#### Protegidas com `requireAuth` + `requirePlanFeature`

- `/api/automations`
- `/api/finances`
- `/api/faturacao/*`
- `/api/produto-categorias`
- `/api/comercial`

#### Administração

- `/api/admin`
- `/api/superadmin`

### 5.5 Scheduler backend

O backend agenda hoje o processamento diário das faturações recorrentes.

Responsabilidades do scheduler:

- detetar recorrentes elegíveis
- gerar a fatura real
- avançar `nextRunDate`
- ligar a emissão ao resto do ecossistema

Isto é importante porque a receita mensal e o histórico de faturação dependem desse fluxo.

---

## 6. Frontend

### 6.1 Estrutura base

O frontend vive em:

- `frontend/src/app/`
- `frontend/src/components/`
- `frontend/src/lib/`
- `frontend/src/hooks/`

### 6.2 `app/`

A pasta `app` contém as rotas principais do produto:

- `/`
- `/dashboard`
- `/contacts`
- `/tasks`
- `/pipeline`
- `/finances`
- `/faturacao`
- `/vendas`
- `/vendas-rapidas`
- `/caixa`
- `/produtos`
- `/chat`
- `/calendario`
- `/forms`
- `/automations`
- `/configuracoes`
- `/equipa`
- `/activity`
- `/superadmin`

Também inclui:

- páginas públicas de auth
- preview/demo
- middleware e layout global

### 6.3 `components/`

A pasta `components` organiza a UI por domínio:

- `dashboard/`
- `contacts/`
- `pipeline/`
- `tasks/`
- `finances/`
- `faturacao/`
- `comercial/`
- `chat/`
- `calendar/`
- `forms/`
- `onboarding/`
- `layout/`
- `ui/`

### 6.4 `lib/`

É a camada partilhada do frontend.

Ficheiros mais importantes:

- `api.ts`
- `types.ts`
- `auth.ts`
- `permissions.ts`
- `business-modes.ts`
- `activity-log.ts`
- `invoice-presentation.ts`
- `storage.ts`
- `commercial-customer-lookup.ts`
- `thermal-print.ts`
- `page-keys.ts`
- `plan-utils.ts`

### 6.5 Cliente API

Ficheiro:

- `frontend/src/lib/api.ts`

Responsabilidades:

- centralizar chamadas HTTP
- anexar access token Supabase
- dar prioridade a token de impersonation
- normalizar erros vindos do backend
- expor funções utilitárias por módulo

### 6.6 Layout autenticado

Ficheiros principais:

- `frontend/src/components/layout/layout-wrapper.tsx`
- `frontend/src/components/layout/sidebar.tsx`

Responsabilidades:

- shell autenticado
- sidebar
- top bar
- onboarding
- resolução visual por workspace
- gating de navegação

---

## 7. Modelo de dados principal

Esta secção resume as entidades mais importantes e como se relacionam.

### 7.1 Utilizador e conta

Modelo principal:

- `User`

Campos importantes:

- `role`
- `isSuperAdmin`
- `accountOwnerId`
- `workspaceMode`
- `permissions`
- `assignedEstabelecimentoId`

Relações relevantes:

- contactos
- tarefas
- transações
- automações
- formulários
- faturação
- chat
- caixa
- login logs
- dicas diárias

### 7.2 CRM

#### `Contact`

Representa interessado ou cliente.

Campos importantes:

- `name`
- `email`
- `phone`
- `company`
- `nif`
- `dealValueKz`
- `revenue`
- `sector`
- `stage`
- `inPipeline`
- `tags`
- `customFields`
- `contactType`
- `status`

Relações:

- `Task`
- `Transaction`
- `ContactNote`
- `FormSubmission`
- `Message`

#### `PipelineStage`

Etapas personalizadas por conta para o funil/processos de venda.

#### `Task`

Tarefa com:

- dono
- responsável
- contacto opcional
- prioridade
- data limite
- estado concluída/não concluída

### 7.3 Formulários e automações

Modelos:

- `Form`
- `FormField`
- `FormSubmission`
- `FormAnswer`
- `Automation`
- `AutomationLog`

### 7.4 Finanças

#### `Transaction`

É a entidade financeira principal.

Campos importantes:

- `type`
- `revenueType`
- `amountKz`
- `currencyOrigin`
- `exchangeRate`
- `status`
- `category`
- `subcategory`
- `clientId`
- `invoiceId`
- `cashSessionId`
- `attachments`
- `reconciled`

Regras atuais:

- entradas e saídas vivem no mesmo modelo
- finanças consolida em Kz
- anexos são hoje relevantes sobretudo em saídas
- ligação a `Contact` é a base da rentabilidade por cliente

### 7.5 Faturação

#### `ConfiguracaoFaturacao`

Configuração fiscal e institucional da conta.

Inclui:

- NIF
- nome da empresa
- morada
- telefone
- email
- website
- IBAN
- logo
- série e estabelecimento por defeito

#### `Estabelecimento`

Representa a entidade operacional onde a faturação e o caixa podem ocorrer.

#### `Serie`

Controla séries documentais por:

- estabelecimento
- tipo documental
- ano

#### `ClienteFaturacao`

Cliente específico para faturação formal.

#### `Produto`

Produto ou serviço faturável.

Campos importantes:

- `productCode`
- `productDescription`
- `unitPrice`
- `cost`
- `productType`
- `unitOfMeasure`
- `taxPercentage`
- `stock`
- `stockMinimo`
- `categoriaId`

#### `Factura`

Documento fiscal emitido.

Campos críticos:

- `documentNo`
- `documentType`
- `documentStatus`
- `documentDate`
- `serieId`
- `estabelecimentoId`
- `lines`
- `netTotal`
- `taxPayable`
- `grossTotal`
- `qrCodeImage`
- `hashCode`
- `agtValidationStatus`
- `baseCurrency`
- `displayCurrency`
- `exchangeRate`
- `displayMode`
- `paymentMethod`

#### `FacturaRecorrente`

Template recorrente que gera faturas reais.

Hoje é a base da `Receita Mensal`.

### 7.6 Caixa e operação comercial

#### `CaixaSessao`

Representa uma sessão de caixa aberta num estabelecimento.

Campos importantes:

- `openedAt`
- `closedAt`
- `openingBalance`
- `totalSalesAmount`
- `salesCount`
- `totalCash`
- `totalMulticaixa`
- `totalTpa`
- `totalTransferencia`
- `status`

### 7.7 Colaboração

#### `ChatChannel`

Canal ou DM interno.

#### `ChatMessage`

Mensagem com texto, anexos e mentions.

### 7.8 Histórico, onboarding e login

#### `ActivityLog`

Histórico transversal por entidade e organização.

#### `LoginLog`

Registos de login real, alimentando painéis de contas e superadmin.

#### `OnboardingProgress`

Estado do onboarding por:

- organização
- workspace

#### `DailyTipDelivery`

Controlo por utilizador e dia para a dica do dia.

---

## 8. Lógica funcional por domínio

### 8.1 Dashboard

Existem dois dashboards principais.

#### `servicos`

O dashboard de serviços mostra métricas como:

- contactos em processos de venda
- tarefas em atraso
- receita do mês
- faturas por cobrar
- widgets configuráveis
- dica do dia
- onboarding contextual

#### `comercio`

O dashboard de comércio mostra:

- vendas do dia
- receita semanal
- top produtos
- estado da sessão de caixa
- alertas de stock
- onboarding específico de comércio
- dica do dia contextual

### 8.2 Contactos

O módulo de contactos é um dos centros do sistema.

Capacidades:

- CRUD
- importação CSV
- campos personalizados
- tags
- documentos
- notas
- histórico de atividade
- resumo financeiro/comercial do contacto

Regras:

- em `servicos`, há distinção entre `interessado` e `cliente`
- em `comercio`, o ecrã trabalha como clientes
- contactos podem ligar com transações, tarefas e processos de venda

### 8.3 Processos de Venda

Embora a base técnica use `pipeline`, a linguagem exposta ao utilizador é `Processos de Venda`.

Capacidades:

- Kanban por etapa
- etapas customizáveis
- drag and drop
- mudança de etapa com activity log
- analytics embutidos no próprio módulo
- forecast
- conversão
- velocidade por etapa

Regras:

- o módulo é central em `servicos`
- existe no código como `pipeline`
- em `comercio`, não é o fluxo dominante da operação

### 8.4 Tarefas

O módulo de tarefas existe nos dois workspaces.

Capacidades:

- criar tarefa
- editar
- concluir
- reatribuir
- ligar a contacto
- filtrar por estado e prioridade

Regras:

- criação, conclusão, reatribuição e eliminação alimentam o activity log
- tarefas podem surgir de automações
- tarefas também aparecem no calendário

### 8.5 Chat interno

O chat interno serve para colaboração operacional.

Capacidades:

- canais
- DMs
- anexos
- mentions
- leitura/não lidas

Uso prático:

- comunicação entre equipa
- notificações operacionais
- contexto de execução diária

### 8.6 Calendário

O calendário agrega:

- tarefas do CRM
- eventos da Google Calendar

Regra importante:

- a ligação à Google Calendar é individual por utilizador
- não é uma integração partilhada pelo owner

### 8.7 Formulários

Os formulários públicos permitem:

- captar leads
- recolher respostas
- mapear dados para `Contact`
- disparar automações

Capacidades:

- campos configuráveis
- marca visual do formulário
- tracking básico
- submissões

### 8.8 Automações

As automações ligam eventos a ações.

Triggers frequentes:

- novo contacto
- submissão de formulário
- contacto com tag
- sector
- revenue range

Ações frequentes:

- atualizar etapa
- criar tarefa
- envio de comunicação

Observabilidade:

- logs por execução
- sucesso/falha
- métricas agregadas

### 8.9 Finanças

O módulo de finanças agrega a leitura financeira interna da empresa.

Capacidades:

- entradas e saídas
- estados `pago`, `pendente`, `atrasado`
- filtros por categoria
- saldo acumulado da empresa
- saldo inicial herdado do mês anterior
- lucro mensal
- receita mensal baseada em recorrentes
- rentabilidade por cliente
- anexos de fornecedores/comprovativos

Regras de negócio importantes:

- `Em caixa da empresa` significa saldo financeiro consolidado, não caixa físico
- `Saldo inicial do mês` corresponde ao fecho acumulado do mês anterior
- `Lucro` continua a ser o resultado do mês selecionado
- pesquisa de cliente usa `Contact`
- rentabilidade por cliente depende da ligação `Transaction -> Contact`

### 8.10 Faturação

Este é um dos módulos mais críticos do sistema.

Capacidades:

- configuração fiscal
- estabelecimentos
- séries
- clientes de faturação
- produtos
- emissão de faturas e documentos relacionados
- faturação recorrente
- PDF
- QR
- SAF-T
- relatórios
- integração com quick sales

Regras de negócio importantes:

- criação de fatura não deve ser quebrada por refactors visuais
- numeração, hash e QR são preservados
- AGT-related logic continua no backend
- a moeda interna e a moeda de apresentação podem divergir
- o PDF em `pdfkit` é a fonte de verdade do documento emitido

### 8.11 Caixa

O módulo `Caixa` é a visão operacional do ponto de venda.

Capacidades:

- abrir sessão
- fechar sessão
- controlar valores esperados vs contados
- acompanhar totais por método de pagamento
- ver vendas ligadas à sessão

Regras:

- quick sales depende de sessão aberta
- caixa é por estabelecimento
- não deve ser confundido com finanças consolidada

### 8.12 Vendas rápidas

Fluxo orientado a POS.

Capacidades:

- carrinho
- seleção de produtos
- emissão rápida
- ligação à sessão de caixa
- atualização de stock
- geração de fatura

### 8.13 Produtos e stock

O módulo de produtos suporta:

- CRUD de produtos
- categorias
- stock
- stock mínimo
- custo e preço de venda
- movimentos de stock

Regras:

- quick sales pode gerar saída de stock
- o módulo é mais central em `comercio`
- produtos também são usados em faturação clássica

### 8.14 Onboarding

O onboarding já está separado por workspace.

Características:

- progresso por organização e workspace
- pode ser dispensado
- desaparece automaticamente quando completo

#### Onboarding de `servicos`

Foca-se em:

- contactos
- processos de venda
- tarefas
- finanças
- faturação

#### Onboarding de `comercio`

Foca-se em:

- configuração de empresa e ponto de venda
- produtos
- clientes
- tarefas
- abertura de caixa
- primeira venda
- convite de equipa

### 8.15 Dica do Dia

A dica do dia é:

- segmentada por workspace
- segmentada por bucket `owner` ou `equipa`
- visível no dashboard
- dispensável pelo utilizador no dia atual

Hoje já não usa toast global como mecanismo principal.

### 8.16 Activity / histórico

Existe histórico transversal com leitura por entidade e feed organizacional.

Eventos cobertos:

- contacto criado/alterado/eliminado
- mudança de etapa
- tarefa criada/concluída/reatribuída/apagada
- fatura criada ou com mudança de estado

Superfícies:

- timeline no detalhe do contacto
- página `/activity`

### 8.17 Administração de conta

Capacidades:

- gestão da equipa
- permissões por módulo
- páginas disponíveis
- leitura de plano e uso
- histórico de logins

### 8.18 Superadmin

Capacidades:

- visão multi-conta
- métricas de utilização
- logins
- impersonation
- leitura operacional da plataforma

---

## 9. Fluxos críticos end-to-end

### 9.1 Login

Fluxo atual:

1. utilizador autentica-se no frontend via Supabase
2. frontend obtém `access_token`
3. frontend chama `/api/auth/me`
4. backend valida JWT e resolve o utilizador interno
5. frontend carrega `currentUser`
6. após login real, o sistema grava `LoginLog`

### 9.2 Carregamento da aplicação autenticada

1. layout autenticado resolve utilizador atual
2. frontend decide tema, sidebar e navegação com base em:
   - `workspaceMode`
   - permissões
   - papel do utilizador
3. módulos passam a carregar por página/feature

### 9.3 Criação de contacto

1. frontend envia contacto
2. backend valida
3. backend cria `Contact`
4. activity log regista `created`
5. contacto fica disponível para tarefas, finanças e processos

### 9.4 Mudança de etapa

1. utilizador move contacto no kanban
2. backend persiste nova etapa
3. activity log regista `stage_changed`
4. analytics passam a refletir a nova distribuição

### 9.5 Criação de tarefa

1. utilizador cria tarefa manualmente ou automação cria tarefa
2. backend persiste `Task`
3. task pode ficar associada a contacto e responsável
4. activity log regista evento

### 9.6 Emissão de fatura

1. frontend monta documento
2. backend valida dados fiscais
3. backend resolve estabelecimento e série
4. backend calcula totais
5. backend cria `Factura`
6. backend gera QR/hash/payload fiscal
7. PDF é disponibilizado a partir do documento real
8. activity log regista emissão

### 9.7 Faturação recorrente

1. utilizador cria template recorrente
2. recorrente guarda moeda, frequência, série, cliente e linhas
3. scheduler processa quando chega `nextRunDate`
4. backend gera `Factura` real
5. recorrente atualiza contadores e próxima execução
6. a recorrência alimenta `Receita Mensal`

### 9.8 Venda rápida

1. utilizador abre `Vendas Rápidas`
2. sistema verifica sessão de caixa aberta
3. utilizador adiciona produtos
4. backend emite a fatura
5. stock é ajustado
6. totais da sessão de caixa são atualizados
7. operação alimenta faturação e reconciliação

### 9.9 Uploads

1. frontend envia ficheiro para rota local de upload
2. a rota faz proxy autenticado para o backend
3. backend usa Supabase Storage
4. ficheiro fica guardado por pasta/conta
5. a URL guardada passa a alimentar anexos, logos ou documentos

---

## 10. Sistemas transversais

### 10.1 Permissões

Existem dois níveis principais:

- gating por plano
- permissões por módulo/ação

#### Gating por plano

Aplicado por `requirePlanFeature`.

Exemplos:

- automações
- finanças
- vendas
- conversas
- processos

#### Permissões por utilizador

Usadas para:

- mostrar ou esconder itens da sidebar
- limitar ações no frontend
- reforçar autorização no backend

### 10.2 Multi-moeda

Hoje a faturação suporta a separação entre:

- `baseCurrency`
- `displayCurrency`
- `exchangeRate`
- `exchangeRateDate`
- `displayMode`

Isto permite:

- consolidar internamente em base estável
- apresentar o documento ao cliente numa moeda comercial diferente

### 10.3 PDF de faturas

O sistema de faturas foi evoluído para:

- layout mais premium
- template mais estruturado
- robustez A4
- paginação melhor
- coerência com detalhe web

Regra essencial:

- o motor de PDF backend continua a ser a fonte de verdade

### 10.4 Activity log

O histórico transversal existe para:

- auditoria funcional
- timelines por entidade
- feed organizacional

Importante:

- o log nunca deve bloquear a operação principal

### 10.5 Login tracking

Os painéis administrativos usam `LoginLog`.

O sistema foi ajustado para:

- gravar login real após autenticação bem-sucedida
- não confundir refresh com login
- alimentar `lastLogin`, `logins7d` e `logins30d`

### 10.6 Onboarding e Dica do Dia

São dois sistemas separados:

- onboarding mede estado estrutural do setup
- dica do dia é conteúdo contextual diário

Ambos já respeitam:

- workspace
- utilizador
- contexto do produto

### 10.7 Uploads

O caminho atual de upload usa:

- rota frontend de proxy
- backend `/api/uploads`
- Supabase Storage

Isto vale para:

- anexos
- logos
- ficheiros auxiliares do sistema

---

## 11. Integrações externas

### 11.1 Supabase

Usado para:

- autenticação
- JWT
- storage

### 11.2 Google Calendar

Usado para:

- sincronização de calendário por utilizador

### 11.3 WhatsApp / canais de comunicação

O sistema já tem estrutura backend para:

- webhook
- envio
- integração de mensagens

### 11.4 AGT e contexto fiscal

A faturação foi desenhada para preservar:

- numeração
- hash
- QR
- séries
- estabelecimentos
- estados de submissão/validação

### 11.5 Email

Existe infraestrutura utilitária para envio de email em:

- `backend/src/lib/email.js`

---

## 12. Permissões, planos e gating

### 12.1 Regra geral

O frontend pode adaptar a interface, mas a segurança real está no backend.

### 12.2 O que o frontend faz

- esconde rotas e elementos sem permissão
- adapta navegação
- muda a experiência conforme workspace

### 12.3 O que o backend faz

- valida autenticação
- valida papel do utilizador
- valida plano
- aplica escopo por conta

### 12.4 Resultado

Mesmo que a UI tente expor algo indevido:

- a API continua a ser a barreira real de proteção

---

## 13. Convenções de implementação

### 13.1 Backend

- CommonJS
- regras de negócio nas rotas e serviços
- Prisma como ORM oficial
- middleware de auth obrigatório nas rotas protegidas
- `effectiveUserId` como regra de scoping

### 13.2 Frontend

- App Router
- TypeScript
- chamadas centralizadas em `lib/api.ts`
- tipos centrais em `lib/types.ts`
- UI modular por domínio
- wrappers de loading/erro/empty state nas superfícies principais

### 13.3 Produto

- evitar duplicar regras fiscais no frontend
- não acoplar visual com lógica crítica
- manter consistência entre dashboard, detalhe e documento emitido
- preferir linguagem visível de produto, mesmo que o nome técnico interno seja outro

Exemplo:

- internamente: `pipeline`
- visível no produto: `Processos de Venda`

### 13.4 Convenção de documentação

Hoje o projeto tem pelo menos três camadas documentais úteis:

- `README.md` para visão de arranque
- `IMPLEMENTACAO.md` para planos/entregas relevantes
- `kuku.md` como guia estrutural e lógico do sistema

---

## 14. Riscos e pontos de atenção

### 14.1 Misturar caixa com finanças

É um erro frequente de leitura do sistema.

Regra correta:

- `Caixa` = operação de ponto de venda/sessão
- `Finanças` = consolidação financeira interna

### 14.2 Misturar `Contact` com `ClienteFaturacao`

São entidades relacionadas, mas não idênticas.

- `Contact` serve CRM, tarefas, rentabilidade e operação
- `ClienteFaturacao` serve faturação formal

### 14.3 Confundir workspace com produto separado

Os workspaces mudam a experiência, mas não são duas aplicações independentes.

O produto continua a ser um só sistema, com:

- mesma base de dados
- mesmo auth
- mesmos módulos nucleares

### 14.4 Alterações visuais em faturação

Devem preservar sempre:

- emissão
- numeração
- QR
- hash
- séries
- regras fiscais

### 14.5 Funcionalidades cross-cutting

Qualquer mudança em:

- auth
- permissions
- uploads
- activity log
- account scoping

tem impacto transversal e deve ser tratada com cuidado.

---

## 15. Referências internas

Documentos relacionados:

- `README.md`
- `IMPLEMENTACAO.md`
- `estruturakukugest.md`

Ficheiros nucleares do projeto:

- `backend/src/index.js`
- `backend/src/middleware/auth.js`
- `backend/prisma/schema.prisma`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/types.ts`
- `frontend/src/components/layout/layout-wrapper.tsx`
- `frontend/src/components/layout/sidebar.tsx`
- `frontend/src/app/page.tsx`

---

## Conclusão

O KukuGest atual já não é apenas um CRM simples. Ele combina:

- CRM relacional
- processos de venda
- tarefas
- automações
- formulários
- chat
- calendário
- finanças
- faturação
- operação comercial com caixa e vendas rápidas

Toda a estrutura do projeto gira em torno de alguns princípios centrais:

- backend como fonte de verdade
- conta organizada por `effectiveUserId`
- experiência adaptada por `workspaceMode`
- lógica fiscal preservada
- módulos reutilizados entre CRM e comércio

Este ficheiro deve ser mantido sempre que houver alterações relevantes em:

- arquitetura
- fluxos de negócio
- entidades principais
- organização dos módulos
- regras de workspace
