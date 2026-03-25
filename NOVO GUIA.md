# CucoGest — Documento de Reestruturação UX e Lógica do Sistema

## 🎯 Objetivo

Reestruturar o CRM para torná-lo mais simples, intuitivo e funcional para o cliente final, mantendo todas as funcionalidades avançadas disponíveis para o Super Admin.

O foco principal é:

* Reduzir complexidade
* Melhorar uso diário
* Aumentar valor percebido
* Organizar funcionalidades de forma lógica

---

# 🧠 PRINCÍPIOS DO SISTEMA

1. Tudo deve ser executado em poucos cliques
2. O utilizador deve entender a plataforma sem explicação
3. O sistema deve substituir ferramentas externas (Excel, WhatsApp, etc.)
4. Simplicidade na interface, poder no backend

---

# 🏗️ ESTRUTURA DO SISTEMA

## 🔵 CLIENTE FINAL (CRM SIMPLIFICADO)

Menu lateral:

* Painel
* Clientes
* Processos
* Tarefas
* Vendas
* Finanças
* Configurações

---

## 🟣 SUPER ADMIN

Mantém acesso a:

* Todas as funcionalidades
* Automações
* Formulários
* Conversas
* Calendário
* Gestão de organizações
* Controlo de permissões

---

## 🟢 SISTEMA DE PERMISSÕES

Cada conta pode:

* Ver ou não módulos
* Ter acesso:

  * Nenhum
  * Ver
  * Editar

Funcionalidades avançadas devem estar ocultas por padrão.

---

# 👥 CLIENTES (CONTACTOS)

## Separação obrigatória:

* Interessados (leads)
* Clientes (ativos)

Campo:

* contactType: interessado | cliente

---

## Nova lógica:

* Possibilidade de converter interessado → cliente
* Filtros por tipo

---

## Página de detalhe do cliente

Deve conter:

### 📊 Histórico

* Total comprado (soma de receitas)
* Último serviço:

  * data
  * descrição
  * valor

---

### 📄 Listas:

* Últimas transações
* Últimas faturas

---

### 📁 Documentos

* Upload de ficheiros
* Listagem
* Download
* Remoção

---

### 📝 Notas

* Criar notas rápidas
* Editar
* Apagar
* Histórico cronológico

---

### 📲 WhatsApp

Botão:

* Abre automaticamente:
  https://wa.me/{telefone_formatado}

Regras:

* Remover espaços e símbolos
* Incluir código país (244 default)

---

# 💰 VENDAS (NOVA ÁREA PRINCIPAL)

## Objetivo:

Centralizar toda a faturação

---

## Deve conter:

### Tabs:

1. Faturas
2. Produtos / Serviços
3. Recorrentes
4. SAF-T (AGT)

---

## Lógica:

* Criar venda deve ser simples:

  * Cliente
  * Serviço
  * Valor

---

## Integração:

* Venda gera automaticamente:
  → Transação de receita em Finanças

---

## Estado da venda:

* Pendente
* Pago
* Cancelado

---

# 📊 FINANÇAS

## Objetivo:

Substituir Excel

---

## Deve conter:

* Receita
* Despesas
* Lucro
* Saldo

---

## Funcionalidades:

* Criar transações
* Categorias simples
* Filtros

---

## Funcionalidade chave:

* Lucro por cliente

---

## IMPORTANTE:

* Não incluir faturação aqui
* Apenas controlo financeiro

---

# 📂 PROCESSOS

## Pipeline adaptado:

* Novo cliente
* Documentação pendente
* Em processamento
* Concluído
* Arquivado

---

# ✅ TAREFAS

* Ligadas a clientes
* Prioridade
* Data limite
* Conclusão rápida

---

# 📊 PAINEL

Mostrar:

* Clientes
* Processos
* Tarefas
* Receita
* Despesas
* Lucro

Leitura rápida: < 10 segundos

---

# ⚙️ CONFIGURAÇÕES

* Dados da empresa
* Equipa
* Permissões

---

# 🔒 CONTROLO DO SUPER ADMIN

## Deve permitir:

* Criar clientes
* Editar contas
* Alterar planos
* Bloquear/desbloquear
* Definir pagamentos
* Impersonar utilizadores

---

# 🧩 FUNCIONALIDADES OCULTAS

Devem existir mas não aparecer por padrão:

* Automações
* Formulários
* Calendário
* Conversas

---

# ⚡ EXPERIÊNCIA IDEAL

Criar cliente: < 30s
Criar venda: < 30s
Criar tarefa: < 15s

---

# 🚀 RESULTADO FINAL

Sistema:

* Simples
* Rápido
* Focado no dia a dia
* Adaptado a prestadores de serviço

---

# 🧠 DIFERENCIAL

* Histórico por cliente
* Integração com WhatsApp
* Separação clara entre vendas e finanças
* Personalização por negócio

---