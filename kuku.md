# KukuGest - Guia Funcional

Este ficheiro descreve o produto do ponto de vista do utilizador final. Não é documentação técnica.

## Visão geral

O KukuGest organiza o trabalho em módulos acessíveis pela barra lateral. Cada módulo cobre uma parte da operação comercial, financeira ou administrativa.

## Módulos do sistema

### Painel

- resumo do negócio
- widgets configuráveis
- visão rápida de tarefas, pipeline e métricas

### Contactos

- criação e edição de contactos
- importação CSV
- filtros por pesquisa, tipo e fase
- notas e detalhe individual do contacto

### Pipeline

- Kanban por fases
- arrastar contactos entre colunas
- criação e ordenação de fases personalizadas

### Tarefas

- tarefas com prioridade e prazo
- ligação opcional a contactos
- estados pendente e concluído

### Chat

- canais internos da equipa
- mensagens e contagem de não lidas

### Calendário

- tarefas do CRM por dia
- integração opcional com Google Calendar

### Automações

- gatilhos por evento de contacto ou formulário
- ações como mudança de fase e envio de comunicação

### Formulários

- formulários públicos
- submissões convertidas em contactos

### Finanças

- receitas e despesas
- filtros e relatórios resumidos
- rentabilidade por cliente

### Faturação

- clientes de faturação
- produtos e serviços
- séries
- faturas
- recorrentes
- exportação SAF-T

### Configurações

- perfil
- empresa
- equipa
- permissões
- áreas administrativas

### Super Admin

- visão transversal das organizações
- gestão de planos
- ativação e desativação
- impersonation para suporte

## Perfis de acesso

| Perfil | Descrição |
|--------|-----------|
| `super admin` | controla a plataforma inteira |
| `account owner` | gere a própria organização |
| `team member` | opera apenas nos módulos permitidos |

As permissões por membro podem ser definidas por módulo com níveis equivalentes a sem acesso, leitura ou edição.

## Limites desta visão

Este guia não substitui:

- `README.md` para setup técnico
- `DEPLOYMENT.md` para deploy
- `agt.md` para faturação AGT
