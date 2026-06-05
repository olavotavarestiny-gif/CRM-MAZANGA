# Design — Negociações B2B (vendas empresariais multi-stakeholder)

**Data:** 2026-06-05
**Estado:** Aprovado — pronto para plano de implementação
**Autor:** Olavo + Claude (brainstorming)

## 1. Contexto e problema

O pipeline atual do Mazanga CRM é **centrado no contacto**: o card do kanban É o próprio
`Contact`, e toda a lógica vive em três campos da tabela `Contact`:

- `stage` — em que coluna do kanban está
- `inPipeline` — se aparece no pipeline
- `dealValueKz` — valor do negócio

O drag-and-drop faz `updateContact({ stage })` (ver `frontend/src/components/pipeline/kanban-board.tsx`).
Pressuposto implícito: **1 pessoa = 1 card = 1 negócio**. O campo `company` do contacto é
apenas texto solto — não relaciona contactos da mesma empresa.

Um utilizador pediu suporte a **vendas empresariais (B2B)**, onde:

- O **negócio pertence à empresa**, não a uma pessoa.
- Várias pessoas entram e saem ao longo do tempo (ex.: técnico de T.I. em Dez → diretor →
  aprovação do financeiro), cada uma com um **papel** e **influência** diferentes.
- O que se move pelo funil é a **negociação**, não cada pessoa.
- É preciso controlar de forma acertiva cada deal: **velocidade**, **pessoas envolvidas**, valor.

Requisito explícito: **não trocar a lógica atual do CRM**. O pipeline individual de contactos
fica intocado; o B2B vive numa aba separada.

## 2. Decisões (validadas com o utilizador)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Unidade do pipeline | Empresa = container · **Negociação (Deal) = o card que se move**. Uma empresa pode ter vários deals (em série ou em paralelo). Feature genérica para todos os utilizadores. |
| 2 | Personagens / stakeholders | **Contactos reais** (tabela `Contact` existente), ligados ao deal com papel + influência. Selecionar existentes **+ criar na hora**. |
| 3 | Funil B2B | **Próprio e configurável**, separado do pipeline individual. Semeado com fases por defeito. |
| 4 | Fecho do negócio | **Leve** (Ganho/Perdido + valor + motivo de perda). Integração com finanças fica para fase 3. |
| 5 | Papéis / influência | Lista **fixa** na v1 (configurável é fase 2). |
| 6 | Criar negociação | Botão **"+ Nova negociação"** direto no kanban (escolhe/cria empresa inline). |
| 7 | Alertas | **Alerta "deal parado há mais de X dias"** reaproveitando `AutomationAlert`. |

## 3. Abordagem escolhida — Módulo paralelo

Entidades novas + aba nova *"Negociações"*. O pipeline individual fica **literalmente intocado**.
Isolamento total, zero risco de regressão.

Alternativas rejeitadas:
- **Estender o pipeline atual** (marcar tipo `individual`/`b2b` num só pipeline) — mistura as
  duas lógicas, qualquer bug afeta o que já funciona. Vai contra o requisito.
- **Negócios sem entidade Empresa** (empresa como string) — impossível agregar os vários deals
  de uma empresa (decisão 1) nem manter o histórico 360º da empresa.

## 4. Modelo de dados

Quatro tabelas novas. Tabelas existentes: apenas uma coluna **opcional** em `Contact`
(`companyId?`), sem efeito no comportamento atual.

```
Company (Empresa)
├─ id, userId
├─ name, nif?, sector?, website?, location?, sizeTier?
├─ createdAt, updatedAt
└─ 1 empresa → N deals, N contactos

Deal (Negociação)  ← o card que se move no kanban
├─ id, userId, companyId
├─ title
├─ stageId            → DealStage
├─ valueKz?
├─ status             "aberto" | "ganho" | "perdido"
├─ lossReason?
├─ ownerUserId?
├─ expectedCloseDate?
├─ stageEnteredAt     (medição de velocidade na fase atual)
├─ createdAt, updatedAt, closedAt?

DealStakeholder (a "personagem")  ← ligação Deal ⇄ Contact
├─ id, dealId, contactId   → Contact REAL existente
├─ role         "tecnico" | "decisor" | "financeiro" | "influenciador" | "outro"
├─ influence?   "alto" | "medio" | "baixo"
├─ isPrimary
├─ notes?
└─ addedAt

DealStage (fase do funil B2B) — espelha PipelineStage
├─ id, userId, name, color, order
└─ default seed: Qualificação → Reunião → Proposta → Aprovação → Fechado
```

**Ligações não destrutivas:**
- `Contact` ganha `companyId?` opcional (null em todos os contactos atuais). O campo `company`
  (texto) continua a existir e a funcionar.
- Histórico de movimentação de fase (para velocidade) reaproveita `ActivityLog`, que já regista
  mudanças de stage com timestamp. Sem tabela nova.

**Isolamento:**
- Um contacto pode ser stakeholder de um deal sem entrar no pipeline individual
  (`inPipeline` intocado).
- A mesma pessoa pode ser stakeholder de vários deals.

## 5. Navegação e ecrãs

Aba nova *"Negociações"*, separada de *"Pipeline"* (individual). Três vistas:

**Vista 1 — Kanban de Negociações** (principal)
- Reaproveita `kanban-board` e `pipeline-stage-manager`; o card agora é um **Deal**.
- Card mostra: empresa + título · valor · nº de pessoas (avatares) · dias na fase atual ·
  responsável.
- Drag-and-drop → `updateDeal({ stageId })` (mesma mecânica otimista com rollback do atual).
- Botão **"+ Nova negociação"** → diálogo: escolhe/cria empresa inline, título, valor → nasce
  na primeira fase.

**Vista 2 — Detalhe da Negociação**
- Cabeçalho: empresa, título, valor, fase, estado.
- **Painel de Stakeholders**: lista com papel + influência + principal. Botão "+ Adicionar
  pessoa" → procura contacto existente **ou** cria na hora.
- **Linha do tempo**: reaproveita `contact-history-timeline` (mudanças de fase, entrada de
  pessoas, notas).
- Botões **Ganho** / **Perdido** (com motivo).

**Vista 3 — Ficha da Empresa**
- Dados da empresa + todos os deals (abertos e históricos) + todas as pessoas conhecidas lá.
- Permite abrir novo deal para a mesma empresa.

## 6. Métricas

Leituras sobre o modelo da secção 4, reaproveitando `pipeline-analytics-view` e
`pipeline-funnel-chart`. Sem tabelas extra.

**Velocidade:**
- Tempo na fase atual (de `stageEnteredAt`) — número visível no card.
- Ciclo total (`closedAt − createdAt`) para deals fechados.
- Tempo médio por fase (lido de `ActivityLog`) — mostra onde os deals encravam.

**Pessoas:**
- Nº de stakeholders por deal.
- Destaque para deals com financeiro já envolvido.

**Funil e valor:**
- Deals e valor total por fase; conversão fase-a-fase; win-rate; valor em pipeline vs. ganho.

**Alertas:**
- Job verifica `stageEnteredAt`; passado o limite configurável (ex.: 14 dias) cria um
  `AutomationAlert` ("deal parado há X dias") no sino existente.

## 7. Regras, casos-limite, erros

- Apagar Empresa com deals → bloqueado/arquivar.
- Apagar Contacto stakeholder → deal mantém-se; cai só a ligação `DealStakeholder`
  (`onDelete: Cascade` na ligação, nunca no deal).
- Ganho/Perdido → grava `closedAt`, congela `stageEnteredAt`, exige motivo se perdido. Sai do
  kanban ativo, fica na ficha da empresa e nas métricas.
- Reabrir deal → volta a `aberto`, limpa `closedAt`.
- Ser stakeholder nunca mete o contacto no pipeline individual.
- Toda a escrita valida `userId` (multi-tenant), seguindo os fixes de segurança já aplicados.
- `role`, `influence`, `status` validados por enum.
- Stakeholder com contacto já ligado → atualiza, não duplica.
- Mutations no kanban otimistas com rollback (padrão do `kanban-board` atual).

## 8. Testes

- Backend: criar deal; mover fase (regista `ActivityLog` + atualiza `stageEnteredAt`);
  add/remove stakeholder; fecho ganho/perdido; isolamento por `userId`.
- Cálculo de velocidade (tempo na fase, ciclo total) com datas conhecidas.
- Frontend: card mostra pessoas e dias na fase; diálogo de nova negociação cria/seleciona
  empresa; fluxo de adicionar stakeholder (existente + criar na hora).

## 9. Faseamento

1. **Fase 1:** modelo + kanban de negociações + stakeholders + detalhe + fases configuráveis.
2. **Fase 2:** métricas/velocidade + ficha da empresa + alerta de deal parado.
3. **Fase 3 (futuro):** integração com finanças no fecho (Ganho → cria `Transaction`).
