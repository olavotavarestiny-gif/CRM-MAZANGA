# Standards de Engenharia

Este documento consolida as regras de implementação, arquitetura, segurança e qualidade do KukuGest.

Stack de referência:

- Next.js App Router
- Express.js
- PostgreSQL
- Supabase Auth
- Prisma ORM
- TypeScript
- Tailwind CSS

Contexto do produto:

- CRM/ERP híbrido
- dois workspaces: `servicos` e `comercio`
- faturação AGT como área crítica
- multi-tenant com scoping rígido

---

## 1. IDENTIDADE DO PROJECTO

- Nome do produto: **KukuGest**
- Dois workspaces: `servicos` (azul) e `comercio` (laranja)
- Arquitectura: monorepo com `frontend/` (Next.js) e `backend/` (Express)
- Multi-tenant: tudo scoped por `organization_id` + `effectiveUserId`
- Faturação certificada AGT (Angola) — lógica fiscal é crítica, nunca simplificar
- Utilizadores em Angola — UI/mensagens em Português de Portugal

---

## 2. REGRAS DE ARQUITECTURA GERAL

### 2.1 Separação de responsabilidades
- **Frontend** (`frontend/src/`): UI, consumo de API, estado local
- **Backend** (`backend/src/`): lógica de negócio, validações, acesso à base de dados
- Nunca colocar lógica de negócio no frontend. Nunca aceder ao Prisma/DB directamente de componentes React.
- Toda a comunicação frontend ↔ backend passa por `frontend/src/lib/api.ts` — nunca criar fetch avulso em componentes.

### 2.2 Workspace mode
- O workspaceMode tem um valor predefinido por organização, definido pela Kukugest na criação da conta.
- Utilizadores, membros, admins e owners NÃO podem alterar o workspaceMode — não existe essa opção na UI deles.
- Apenas superadmins da plataforma (papel: superadmin) podem alterar o workspaceMode de uma organização.
- A alteração por superadmin é feita no painel de superadmin, nunca nas definições da organização cliente.
- No frontend, ler sempre o workspaceMode da organização autenticada — nunca de estado local ou URL param.
- Usar frontend/src/lib/business-modes.ts para toda a lógica de modo.
- Nunca hardcodar lógica específica de servicos ou comercio fora dos ficheiros de configuração de modo.

### 2.3 Scoping multi-tenant (CRÍTICO)
- **TODAS** as queries Prisma devem incluir `organization_id` no where. Sem excepções.
- Em rotas Express, extrair sempre `organizationId` do token autenticado — nunca do body do request.
- Ao criar qualquer nova rota, começar sempre com o middleware `requireAuth`.
- Ao criar qualquer nova query, verificar: "esta query pode vazar dados de outra organização?"

---

## 3. REGRAS DE BACKEND (Express + Prisma + PostgreSQL)

### 3.1 Estrutura de rotas
- Uma rota por módulo em `backend/src/routes/`
- Naming: `kebab-case.js` (ex: `faturacao-facturas.js`)
- Toda a rota nova segue este padrão:
  ```js
  router.get('/', requireAuth, checkPermission('modulo'), checkPlanLimit('feature'), async (req, res) => {
    try {
      const { organizationId, userId } = req.user;
      // lógica aqui
    } catch (error) {
      logger.error('context', error);
      res.status(500).json({ error: 'Erro interno' });
    }
  });
  ```

### 3.2 Prisma ORM
- Usar sempre transacções (`prisma.$transaction`) para operações que afectam múltiplas tabelas.
- Nunca usar `deleteMany` sem `where` explícito com `organization_id`.
- Ao adicionar campo a schema: criar migration com nome descritivo (`add_audit_log_to_contacts`).
- Campos de auditoria obrigatórios em todas as tabelas principais: `created_at`, `updated_at`, `created_by`.

### 3.3 Validação
- Validar input com Zod antes de qualquer operação na DB.
- Erros de validação retornam sempre `400` com mensagem legível em PT.
- Erros de autorização retornam sempre `403` — nunca `404` para esconder recursos.

### 3.4 Gating por plano
- Verificar limites de plano em `checkPlanLimit` middleware — nunca inline na rota.
- Ao criar feature nova, definir o limite no ficheiro de configuração de planos antes de implementar.

---

## 4. REGRAS DE FRONTEND (Next.js App Router + TypeScript + Tailwind)

### 4.1 Estrutura de componentes
- Componentes por domínio: `frontend/src/components/{dominio}/`
- Páginas em: `frontend/src/app/{rota}/page.tsx`
- Componentes partilhados em: `frontend/src/components/ui/`
- Nunca criar componente > 200 linhas sem o dividir em sub-componentes.

### 4.2 Design system — consistência obrigatória
- **Não criar modal, drawer ou toast custom.** Usar sempre os componentes existentes em `components/ui/`.
- Paleta de cores do workspace:
  - `servicos`: primary = `blue-600`, accent = `blue-50`
  - `comercio`: primary = `orange-600`, accent = `orange-50`
- Tailwind apenas — sem CSS inline e sem styled-components.
- Espaçamento: usar escala de 4px (Tailwind padrão). Nunca valores arbitrários como `mt-[13px]`.
- Ícones: Lucide React apenas. Nunca misturar bibliotecas de ícones.

### 4.3 Formulários e estados
- Formulários com React Hook Form + Zod para validação no frontend.
- Loading states obrigatórios em todos os botões de submit.
- Error states obrigatórios em todos os campos de formulário.
- Mensagens de erro em PT, específicas (não genéricas como "Erro desconhecido").

### 4.4 Permissões no frontend
- Verificar permissões via `frontend/src/lib/permissions.ts` — nunca lógica de permissão inline.
- Componentes que requerem permissão usam wrapper `<PermissionGate module="x" action="y">`.
- Nunca esconder UI como substituto de validação no backend — ambos devem existir.

### 4.5 Server vs Client components
- Default: Server Component. Adicionar `"use client"` apenas quando necessário.
- Casos válidos para `"use client"`: interactividade (estado, eventos), hooks, browser APIs.
- Data fetching em Server Components sempre que possível.

---

## 5. REGRAS DE QUALIDADE E SEGURANÇA

### 5.1 TypeScript — sem atalhos
- `any` é proibido. Usar `unknown` + type guard se o tipo for incerto.
- Interfaces para objectos de domínio (Contact, Invoice, Task), types para unions e utilitários.
- Props de componentes React sempre tipadas com interface explícita.
- Retornos de funções async sempre tipados explicitamente.

### 5.2 Tratamento de erros (CRÍTICO)
- **Nunca silenciar erros com `catch(e) {}`** — sempre logar ou re-throw.
- Em rotas Express: logar com contexto (`logger.error('contacts.create', error)`).
- No frontend: erros de API mostram toast com mensagem legível, não apenas console.log.
- Erros de rede (fetch failed) tratados separadamente de erros de aplicação.

### 5.3 Logs de auditoria (gap a fechar)
- Toda a acção destrutiva (delete, update de campos críticos) deve criar entrada em tabela `audit_log`.
- Estrutura mínima do log: `{ entity_type, entity_id, action, old_value, new_value, user_id, organization_id, timestamp }`.
- Automações executadas devem criar log em `automation_log` com: `{ automation_id, trigger, action_taken, success, error?, contact_id?, timestamp }`.

### 5.4 Segurança
- Nunca logar dados sensíveis (passwords, tokens, NIF, dados bancários).
- Inputs do utilizador sempre sanitizados antes de inserir na DB.
- Rate limiting em rotas públicas (formulários `/f/:id`, auth).
- Headers de segurança configurados no Express (`helmet`).

---

## 6. REGRAS DE BASE DE DADOS

### 6.1 Migrations
- Nome obrigatório: `YYYYMMDD_descricao_curta` (ex: `20240615_add_automation_log_table`).
- Cada migration faz uma coisa — nunca agrupar alterações não relacionadas.
- Migrations são irreversíveis por defeito — incluir comentário se tiver rollback plan.
- Nunca alterar dados de produção directamente — sempre via migration ou script documentado.

### 6.2 Performance
- Índices obrigatórios em: `organization_id`, `created_at`, foreign keys usadas em filtros frequentes.
- Ao criar query com `JOIN` complexo, adicionar comentário explicando a lógica.
- `SELECT *` proibido em produção — listar sempre campos explicitamente.

### 6.3 Reconciliação financeira (gap a fechar)
- Transacções em `finances` que correspondem a faturas em `vendas` devem ter campo `invoice_id` nullable.
- Sessões de caixa fechadas devem reconciliar com `finances` automaticamente — nunca manualmente.
- Ao criar qualquer movimento financeiro, verificar se já existe entrada correspondente para evitar duplicados.

---

## 7. REGRAS DE MÓDULOS ESPECÍFICOS

### 7.1 Faturação AGT (CRÍTICO — nunca simplificar)
- Séries de faturação são imutáveis após criação.
- Numeração de documentos é sequencial e sem gaps — qualquer anulação cria nota de crédito, não deleta.
- SAF-T export deve sempre validar schema antes de disponibilizar download.
- Campos obrigatórios AGT: `nif_cliente`, `serie`, `numero`, `data_emissao`, `linha_items` com `codigo_produto`.

### 7.2 Pipeline e contactos
- Mover contacto de etapa deve sempre criar entrada no histórico do contacto.
- `inPipeline` flag alterada apenas via endpoint dedicado, nunca como side-effect de outro update.
- Ao criar contacto via formulário público, verificar duplicado por email antes de criar novo.

### 7.3 Automações
- Automações falham silenciosamente por defeito — logging obrigatório de cada execução (sucesso e falha).
- Trigger `form_submission` deve sempre ter fallback se contacto não for encontrado/criado.
- Nunca executar automação em loop — verificar se acção já foi executada para o mesmo trigger recentemente.

### 7.4 Caixa e Venda Rápida
- Sessão de caixa fechada é imutável — nunca permitir edição retroactiva.
- Venda Rápida só disponível com sessão de caixa aberta — validar no backend, não só no frontend.
- Diferença de caixa (esperado vs real) deve ser registada sempre, mesmo que seja zero.

---

## 8. CONVENÇÕES DE CÓDIGO

### 8.1 Naming
- Ficheiros: `kebab-case` para rotas e utilitários, `PascalCase` para componentes React.
- Variáveis/funções: `camelCase`.
- Constantes: `SCREAMING_SNAKE_CASE`.
- Tabelas Prisma: `snake_case`, singular (ex: `contact`, `invoice`, `audit_log`).
- Endpoints API: `kebab-case`, plural para colecções (ex: `/api/contacts`, `/api/invoices`).

### 8.2 Comentários
- Comentários em código em **Português** (idioma do produto e da equipa).
- Comentários obrigatórios em: lógica fiscal AGT, queries complexas, workarounds conhecidos.
- TODO com owner: `// TODO(olavo): descrever o que falta`.
- Nunca deixar código comentado no main branch — usar git para histórico.

### 8.3 Git
- Commits em Português, formato: `tipo(módulo): descrição curta`
  - Exemplos: `feat(pipeline): adicionar log de mudança de etapa`, `fix(caixa): corrigir reconciliação ao fechar sessão`
- Tipos válidos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`
- Nunca fazer commit de `.env`, `node_modules`, ou ficheiros de build.

---

## 9. O QUE NUNCA FAZER

- ❌ Nunca apagar registos fiscais (faturas, notas de crédito, SAF-T) — apenas anular.
- ❌ Nunca fazer query sem `organization_id` em tabelas multi-tenant.
- ❌ Nunca expor stack traces ao utilizador final — apenas em logs de servidor.
- ❌ Nunca usar `console.log` em produção — usar o logger configurado.
- ❌ Nunca criar componente de UI novo sem verificar se já existe um equivalente em `components/ui/`.
- ❌ Nunca implementar lógica de permissões fora de `permissions.ts` e `requireAuth`.
- ❌ Nunca fazer `prisma.table.deleteMany({})` sem where clause — risco de apagar todos os dados da org.
- ❌ Nunca hardcodar IDs, URLs ou secrets — usar variáveis de ambiente.
- ❌ Nunca assumir que `workspaceMode` é sempre `servicos` — testar sempre os dois modos.

---

## 10. CHECKLIST ANTES DE QUALQUER FEATURE NOVA

Antes de implementar qualquer funcionalidade, verificar:

- [ ] Está scoped por `organization_id`?
- [ ] Tem validação de permissão no backend (`requireAuth` + `checkPermission`)?
- [ ] Tem gating por plano se aplicável (`checkPlanLimit`)?
- [ ] Funciona nos dois workspaces (`servicos` e `comercio`)?
- [ ] Tem tratamento de erro com mensagem legível em PT?
- [ ] Acções destrutivas têm entrada em `audit_log`?
- [ ] Se afecta finanças/faturação: tem reconciliação com módulos adjacentes?
- [ ] TypeScript sem `any`?
- [ ] Loading e error states no frontend?
