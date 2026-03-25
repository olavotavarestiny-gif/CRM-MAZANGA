# Kuku — O que dá para fazer no CRM

Este documento explica, de forma simples, tudo o que é possível fazer dentro do CRM. Sem linguagem técnica — apenas o que o utilizador pode fazer em cada secção.

---

## Visão Geral

O CRM está organizado em áreas acessíveis pela barra lateral esquerda. Cada área tem um propósito específico — desde gerir clientes e negócios, até automações, faturas e controlo da equipa.

---

## 1. Painel (Página Inicial)

É a primeira coisa que o utilizador vê ao entrar. Mostra um resumo do negócio em tempo real:

- Total de contactos e quantos foram adicionados este mês
- Número de negócios em curso no pipeline
- Negócios fechados
- Tarefas pendentes
- Receita, despesas, lucro e margem do mês
- MRR (receita recorrente mensal)
- Tarefas de hoje e snapshot do pipeline

O utilizador pode escolher quais os blocos de informação que quer ver e reorganizá-los.

---

## 2. Contactos

A base de dados de clientes e leads. O utilizador pode:

- Criar contactos com nome, empresa, telefone, sector, faturação e outros campos
- Pesquisar por nome, telefone ou empresa
- Filtrar por fase do pipeline ou bracket de faturação
- Importar contactos em massa via ficheiro CSV
- Personalizar os campos que aparecem na lista
- Editar ou apagar contactos (só o dono da conta pode apagar)

---

## 3. Negociações (Pipeline)

Um quadro Kanban visual para gerir o avanço dos negócios. O utilizador pode:

- Ver todos os contactos organizados por fases (ex: Lead → Proposta → Ganho)
- Arrastar e largar contactos entre fases
- Criar, editar e eliminar fases personalizadas
- Adicionar contactos directamente ao pipeline

---

## 4. Tarefas

Gestão de tarefas ligadas (ou não) a contactos. O utilizador pode:

- Criar tarefas com título, descrição, data limite, prioridade e contacto associado
- Marcar tarefas como concluídas
- Filtrar por: todas pendentes, só hoje, atrasadas, ou concluídas
- Ver um contador de tarefas por categoria (hoje, atrasadas, total pendente)

---

## 5. Conversas (Chat)

Canal de comunicação interna da equipa. O utilizador pode:

- Criar canais de conversa
- Enviar e receber mensagens em cada canal
- Ver o número de mensagens não lidas diretamente na barra lateral

---

## 6. Calendário

Vista mensal de todos os compromissos e tarefas. O utilizador pode:

- Ver tarefas do CRM organizadas por dia no calendário
- Ligar a conta Google e ver eventos do Google Calendar lado a lado com as tarefas do CRM
- Clicar num dia para ver o detalhe de todos os eventos
- Criar novas tarefas directamente a partir de um dia no calendário

---

## 7. Automações

Sistema de fluxos automáticos — o CRM faz acções sozinho com base em eventos. O utilizador pode:

- Criar automações com base em gatilhos como:
  - Novo contacto adicionado
  - Contacto recebe uma etiqueta
  - Contacto atinge um certo nível de faturação
  - Novo sector preenchido
  - Formulário submetido
- Definir acções automáticas como:
  - Mudar a fase do contacto no pipeline
  - Enviar um email
  - Enviar uma mensagem WhatsApp
  - Criar um contacto automaticamente
- Activar ou desactivar automações com um simples botão
- Eliminar automações (só o dono da conta)

---

## 8. Formulários

Formulários públicos para captura de leads. O utilizador pode:

- Criar formulários personalizados com vários campos (texto, email, escolha múltipla, etc.)
- Gerar um link público para partilhar (ex: no site, redes sociais ou WhatsApp)
- Quando alguém preenche o formulário, é criado automaticamente um contacto no CRM
- Ver quantas submissões cada formulário teve
- Editar e eliminar formulários

---

## 9. Finanças

Gestão financeira completa do negócio. O utilizador pode:

- Ver o resumo mensal: receita, despesas, lucro, margem e MRR
- Adicionar transações (receita ou despesa) com data, valor, cliente e categoria
- Filtrar transações por tipo, estado, intervalo de datas ou nome do cliente
- Marcar transações recorrentes como pagas
- Exportar transações para Excel/CSV
- Ver a rentabilidade por cliente (quanto cada cliente gerou vs. o que custou)

---

## 10. Faturação

Módulo de faturação fiscal completo (compatível com AGT / requisitos angolanos). O utilizador pode:

### Faturas
- Criar e gerir faturas para clientes
- Gerar PDF profissional com o logo da empresa
- Controlar o estado de cada fatura (paga, pendente, cancelada)

### Produtos e Serviços
- Criar um catálogo de produtos/serviços com código, descrição, preço e IVA
- Usar os produtos directamente na emissão de faturas

### Clientes de Faturação
- Gerir uma base de dados de clientes para faturação, com NIF e morada

### Séries de Documentos
- Configurar séries de numeração por tipo de documento e ano
- Gerir o número sequencial de cada série

### Recorrentes
- Criar faturas recorrentes (mensais, anuais, etc.) que são geradas automaticamente

### SAF-T
- Exportar o ficheiro SAF-T para entrega às autoridades fiscais

---

## 11. Configurações

Área de gestão da conta e da equipa. Organizada em abas:

### Perfil
- Ver nome e email da conta
- Alterar a password

### Empresa
- Fazer upload do logótipo da empresa
- Configurar nome, NIF, morada e IBAN
- Gerir estabelecimentos (localizações físicas)
- Configurar dados de faturação

### Equipa
- Ver todos os membros da equipa
- Adicionar novos membros (por email)
- Definir permissões por membro — quais as secções que cada um pode ver e o que pode fazer
- Remover membros

### Admin *(só para administradores)*
- Ver todos os utilizadores do sistema
- Criar novos utilizadores e definir as suas funções
- Ativar ou desativar contas
- Ver o histórico de logins com data, hora e endereço IP

---

## 12. Super Admin *(acesso exclusivo ao super-administrador)*

Painel de controlo de todas as organizações clientes. O super admin pode:

- Ver a lista de todas as organizações registadas no sistema
- Ver os membros de cada organização (expandindo a linha)
- Mudar o plano de cada organização (Essencial, Profissional, Enterprise)
- Activar ou desactivar organizações
- Eliminar uma organização e todos os seus dados
- **Fazer login como qualquer utilizador** (impersonação) para prestar suporte sem precisar da password
- Criar novas contas cliente directamente a partir deste painel
- Pesquisar organizações e utilizadores por nome ou email
- Ver o total de utilizadores em todos os sistemas

---

## Níveis de Acesso

O sistema tem 3 tipos de utilizador:

| Tipo | Quem é | O que pode fazer |
|------|--------|-----------------|
| **Super Admin** | O dono da plataforma (olavo@mazanga.digital) | Tudo — gere todas as organizações |
| **Dono de Conta** | O cliente que criou a conta | Gere a sua organização e equipa |
| **Membro de Equipa** | Utilizadores adicionados pelo dono | Acede às secções que o dono permitiu |

O dono de conta pode controlar, módulo a módulo, o que cada membro da equipa vê e faz:
- **Nenhum acesso** — o membro não vê a secção
- **Ver** — o membro pode ver mas não editar
- **Editar** — o membro pode criar, editar e apagar

---

## Planos Disponíveis

As contas cliente podem ter um de três planos, atribuídos pelo Super Admin:

- **Essencial** — funcionalidades base
- **Profissional** — funcionalidades avançadas
- **Enterprise** — acesso completo

---

## Resumo das Funcionalidades

| Secção | O que faz |
|--------|-----------|
| Painel | Visão geral do negócio em tempo real |
| Contactos | Base de dados de clientes e leads |
| Negociações | Kanban de avanço de negócios |
| Tarefas | Gestão de to-dos e follow-ups |
| Conversas | Chat interno da equipa |
| Calendário | Vista de eventos + integração Google Calendar |
| Automações | Fluxos automáticos baseados em eventos |
| Formulários | Captura de leads com link público |
| Finanças | Controlo de receitas, despesas e lucro |
| Faturação | Emissão de faturas fiscais + SAF-T |
| Configurações | Gestão de perfil, empresa e equipa |
| Super Admin | Gestão de todas as organizações clientes |
