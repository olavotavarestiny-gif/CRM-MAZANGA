# ESPECIFICAÇÃO: MÓDULO FINANCEIRO - CRM MAZANGA

## 📋 VISÃO GERAL

Adicionar módulo completo de gestão financeira ao CRM existente da Mazanga Marketing. O módulo deve controlar entradas (recorrentes e one-off), saídas, rentabilidade por cliente e fluxo de caixa.

---

## 🗄️ ESTRUTURA BANCO DE DADOS

### Tabela: `transactions`

```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  client_name VARCHAR(255),
  
  -- Tipo de transação
  type VARCHAR(20) NOT NULL CHECK(type IN ('entrada', 'saida')),
  
  -- Específico para ENTRADAS
  revenue_type VARCHAR(20) CHECK(revenue_type IN ('recorrente', 'one-off', NULL)),
  contract_duration_months INTEGER, -- Ex: 3, 6, 12
  next_payment_date DATE, -- Próxima data de pagamento esperada
  
  -- Classificação
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  description TEXT,
  
  -- Valores
  amount_kz DECIMAL(15,2) NOT NULL,
  currency_origin VARCHAR(10) DEFAULT 'KZ', -- KZ, CHF, EUR, USD
  exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
  
  -- Status e pagamento
  payment_method VARCHAR(50), -- Transferência, Multicaixa, Cash, PayPal, Stripe
  status VARCHAR(20) DEFAULT 'pago' CHECK(status IN ('pago', 'pendente', 'atrasado')),
  
  -- Documentação
  receipt_number VARCHAR(100),
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_client ON transactions(client_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_revenue_type ON transactions(revenue_type);
```

### Tabela: `client_profitability`

```sql
CREATE TABLE client_profitability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  client_name VARCHAR(255) NOT NULL,
  
  -- Totais acumulados
  total_revenue DECIMAL(15,2) DEFAULT 0,
  total_costs DECIMAL(15,2) DEFAULT 0,
  net_margin DECIMAL(15,2) DEFAULT 0,
  margin_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- Metadados
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(client_id)
);

CREATE INDEX idx_client_profitability_client ON client_profitability(client_id);
```

### Tabela: `financial_categories` (Seed Data)

```sql
CREATE TABLE financial_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type VARCHAR(20) NOT NULL CHECK(type IN ('entrada', 'saida')),
  category VARCHAR(100) NOT NULL,
  subcategories TEXT, -- JSON array: ["sub1", "sub2"]
  color VARCHAR(7), -- Hex color para UI
  icon VARCHAR(10), -- Emoji icon
  active BOOLEAN DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  
  UNIQUE(type, category)
);
```

---

## 📊 CATEGORIAS PRÉ-DEFINIDAS

### Categorias de ENTRADA:

| Categoria | Subcategorias | Cor | Ícone |
|-----------|---------------|-----|-------|
| Serviços Recorrentes | Cliente Angola, Cliente Suíça, Cliente Portugal, Cliente Brasil, Cliente França | #10B981 | 💰 |
| Projetos One-off | Website, Landing Page, Diagnóstico, Consultoria, Setup CRM | #3B82F6 | 🚀 |
| Serviços Extras | Vídeo adicional, Posts extras, Fotografia, Design pontual | #8B5CF6 | ✨ |
| Outras Receitas | Formação, Comissões, Parceria, Diversos | #06B6D4 | 💡 |

### Categorias de SAÍDA:

| Categoria | Subcategorias | Cor | Ícone |
|-----------|---------------|-----|-------|
| Design | Designer freelance, Designer mensal, Assets (stock), Impressão | #EC4899 | 🎨 |
| Ferramentas | Claude Pro, CapCut Pro, Canva Pro, Buffer/Later, GHL/CRM, Google Workspace, Adobe CC, Outras | #F59E0B | 🛠️ |
| Transporte | Gasolina, Uber/Táxi, Estacionamento, Manutenção viatura | #6366F1 | 🚗 |
| Produção Audiovisual | Videógrafo freelance, Equipamento, Props/cenário, Aluguer | #EF4444 | 🎬 |
| Fotografia | Fotógrafo freelance, Edição fotos, Props | #14B8A6 | 📸 |
| CRM/Tecnologia | Desenvolvimento CRM, Hosting/Servidor, Domínios, APIs, Manutenção | #8B5CF6 | 💻 |
| Anúncios Online | Meta Ads (Mazanga), Google Ads (Mazanga), LinkedIn Ads, Outras | #F97316 | 📢 |
| Operação | Internet, Telefone, Eletricidade, Espaço trabalho, Material escritório | #64748B | 🏢 |
| Networking/Comercial | Almoços clientes, Jantares negócio, Eventos, Materiais marketing | #10B981 | 🤝 |
| Pessoal | Retirada Olavo, Colaborador fixo, Freelancer pontual, Formação/Cursos | #06B6D4 | 👤 |
| Legal/Administrativo | Contabilidade, Advogado, Impostos, Taxas/Licenças | #84CC16 | ⚖️ |
| Reserva/Investimento | Fundo emergência, Investimento futuro, Buffer estratégico | #A855F7 | 🏦 |

---

## 🎨 INTERFACE UI/UX

### Layout Principal - Aba "FINANÇAS"

```
┌─────────────────────────────────────────────────────────────────┐
│  FINANÇAS                                    [+ Nova Transação] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 DASHBOARD                                                   │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐          │
│  │ Receita │Despesas │  Lucro  │Margem % │   MRR   │          │
│  │587.000  │111.000  │476.000  │  81%    │587.000  │          │
│  └─────────┴─────────┴─────────┴─────────┴─────────┘          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💰 TRANSAÇÕES                                                  │
│  Filtros: [Data▼] [Cliente▼] [Tipo▼] [Status▼] [Categoria▼]  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Data  │Cliente     │Tipo   │Categoria│Valor   │Status│⚙️│ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │18/03  │Paula Clean │Saída  │Design   │-50.000 │✅   │⋯ │ │
│  │18/03  │Paula Clean │Saída  │Foto     │-20.000 │✅   │⋯ │ │
│  │17/03  │Paula Clean │Entrada│Recorr.  │+587.000│✅   │⋯ │ │
│  │15/03  │Cli. Suíça  │Entrada│Recorr.  │+500.000│✅   │⋯ │ │
│  └───────────────────────────────────────────────────────────┘ │
│  [◀ Anterior]  Página 1 de 3  [Seguinte ▶]                    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  👥 RENTABILIDADE POR CLIENTE                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │Cliente      │Receita │Custos  │Margem  │%   │[Detalhes]│ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │Paula Clean  │587.000 │111.000 │476.000 │81% │    [▶]   │ │
│  │Cli. Suíça   │500.000 │ 80.000 │420.000 │84% │    [▶]   │ │
│  │─────────────────────────────────────────────────────────  │ │
│  │TOTAL        │1.087.000│191.000│896.000 │82% │          │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 MODAL: NOVA TRANSAÇÃO

### Layout do Formulário

```
┌──────────────────────────────────────────────┐
│  ➕ Nova Transação                       [✕] │
├──────────────────────────────────────────────┤
│                                              │
│  Tipo *                                      │
│  ⚪ Entrada   ⚪ Saída                        │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ SE ENTRADA SELECIONADA:                │ │
│  │                                        │ │
│  │ Tipo de Receita *                      │ │
│  │ ⚪ Recorrente   ⚪ One-off              │ │
│  │                                        │ │
│  │ ┌──────────────────────────────────┐  │ │
│  │ │ SE RECORRENTE:                   │  │ │
│  │ │                                  │  │ │
│  │ │ Duração Contrato (meses) *       │  │ │
│  │ │ [____] meses                     │  │ │
│  │ │                                  │  │ │
│  │ │ Próximo Pagamento *              │  │ │
│  │ │ [__/__/____] 📅                  │  │ │
│  │ └──────────────────────────────────┘  │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  Data *                                      │
│  [__/__/____] 📅                             │
│                                              │
│  Cliente                                     │
│  [Selecionar cliente... ▼]                  │
│                                              │
│  Categoria *                                 │
│  [Selecionar categoria... ▼]                │
│                                              │
│  Subcategoria                                │
│  [Selecionar subcategoria... ▼]             │
│                                              │
│  Descrição                                   │
│  [________________________________]          │
│                                              │
│  Valor (Kz) *                                │
│  [______________] Kz                         │
│                                              │
│  Moeda Origem                                │
│  ⚪ KZ  ⚪ CHF  ⚪ EUR  ⚪ USD                 │
│                                              │
│  Taxa Câmbio (se não KZ)                    │
│  [_______] Kz por unidade                   │
│                                              │
│  Método Pagamento                            │
│  [Selecionar... ▼]                          │
│  └─ Transferência Bancária                  │
│  └─ Multicaixa                               │
│  └─ Cash                                     │
│  └─ PayPal                                   │
│  └─ Stripe                                   │
│                                              │
│  Status *                                    │
│  ⚪ Pago  ⚪ Pendente  ⚪ Atrasado            │
│                                              │
│  Nº Recibo/Fatura                           │
│  [______________]                            │
│                                              │
│  Notas                                       │
│  [________________________________]          │
│  [________________________________]          │
│                                              │
│  [Cancelar]              [💾 Guardar]       │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 🔄 LÓGICA: CONTRATOS RECORRENTES

### Cenário: Cliente Paula Clean

**Input no formulário:**
- Tipo: Entrada
- Tipo Receita: Recorrente
- Valor: 587.000 Kz
- Duração: 3 meses
- Data início: 17/03/2025
- Status: Pago

**Sistema cria:**

1. **Transação inicial (paga):**
```sql
INSERT INTO transactions (
  date, client_id, client_name, type, revenue_type,
  contract_duration_months, next_payment_date,
  category, amount_kz, status
) VALUES (
  '2025-03-17', 1, 'Paula Clean', 'entrada', 'recorrente',
  3, '2025-04-17',
  'Serviços Recorrentes', 587000.00, 'pago'
);
```

2. **Transações futuras (pendentes) - OPCIONAL:**
Sistema pode auto-gerar ou criar apenas quando marcar como pago.

**Recomendação:** Criar apenas quando necessário (não pré-gerar).

---

### Interface: Gestão Pagamentos Recorrentes

**Na tabela principal, adicionar coluna "Próximo":**

| Cliente | Valor/mês | Próximo | Ações |
|---------|-----------|---------|-------|
| Paula Clean | 587.000 Kz | 17/04/2025 | [✅ Marcar Pago] |

**Ao clicar [✅ Marcar Pago]:**

```javascript
// 1. Criar nova transação
INSERT INTO transactions (
  date, client_id, type, revenue_type,
  category, amount_kz, status
) VALUES (
  '2025-04-17', 1, 'entrada', 'recorrente',
  'Serviços Recorrentes', 587000.00, 'pago'
);

// 2. Atualizar next_payment_date da transação original
UPDATE transactions 
SET next_payment_date = '2025-05-17'
WHERE id = [id_transacao_original];

// 3. Se atingiu duração total, marcar como concluído
IF (payments_made >= contract_duration_months) {
  next_payment_date = NULL; // Contrato completo
}
```

---

### Modal: Detalhes Contrato Recorrente

**Ao clicar no cliente na seção rentabilidade:**

```
┌─────────────────────────────────────────────┐
│  Paula Clean - Rentabilidade           [✕] │
├─────────────────────────────────────────────┤
│                                             │
│  📊 Resumo Geral                            │
│  Receita Total:        587.000 Kz          │
│  Custos Diretos:       111.000 Kz          │
│  Margem Líquida:       476.000 Kz          │
│  Margem %:             81%                  │
│                                             │
│  📅 Contrato Ativo                          │
│  587.000 Kz/mês × 3 meses                  │
│  ┌─────────────────────────────────────┐   │
│  │ ✅ Mês 1 - 17/03/2025 (Pago)       │   │
│  │ ⏳ Mês 2 - 17/04/2025 [Marcar Pago]│   │
│  │ ⏳ Mês 3 - 17/05/2025 (Pendente)   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  💸 Breakdown Custos                        │
│  Design:               50.000 Kz           │
│  Fotografia:           20.000 Kz           │
│  Transporte:           25.000 Kz           │
│  Ferramentas (50%):    16.000 Kz           │
│  ─────────────────────────────────          │
│  TOTAL:               111.000 Kz           │
│                                             │
│  📋 Últimas Transações                      │
│  ┌─────────────────────────────────────┐   │
│  │ 18/03 │ Design        │ -50.000    │   │
│  │ 18/03 │ Fotografia    │ -20.000    │   │
│  │ 18/03 │ Transporte    │ -25.000    │   │
│  │ 18/03 │ Ferramentas   │ -16.000    │   │
│  │ 17/03 │ Serv.Recorr.  │ +587.000   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Ver Todas Transações] [Exportar PDF]     │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🧮 CÁLCULOS AUTOMÁTICOS

### Dashboard (Tempo Real)

**Card: Receita Mês Atual**
```sql
SELECT SUM(amount_kz) 
FROM transactions 
WHERE type = 'entrada' 
  AND status = 'pago'
  AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now');
```

**Card: Despesas Mês Atual**
```sql
SELECT SUM(ABS(amount_kz)) 
FROM transactions 
WHERE type = 'saida' 
  AND status = 'pago'
  AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now');
```

**Card: Lucro Mês Atual**
```sql
Lucro = Receita - Despesas
```

**Card: Margem %**
```sql
Margem % = (Lucro / Receita) * 100
```

**Card: MRR (Monthly Recurring Revenue)**
```sql
SELECT SUM(amount_kz)
FROM transactions
WHERE type = 'entrada'
  AND revenue_type = 'recorrente'
  AND status = 'pago'
  AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now');
```

---

### Rentabilidade por Cliente (Auto-Update)

**Trigger ao criar/editar/deletar transação:**

```sql
-- Trigger after INSERT
CREATE TRIGGER update_client_profitability_insert
AFTER INSERT ON transactions
FOR EACH ROW
WHEN NEW.client_id IS NOT NULL
BEGIN
  INSERT OR REPLACE INTO client_profitability (
    client_id, 
    client_name,
    total_revenue,
    total_costs,
    net_margin,
    margin_percentage,
    last_updated
  )
  SELECT 
    NEW.client_id,
    NEW.client_name,
    COALESCE((SELECT SUM(amount_kz) FROM transactions 
              WHERE client_id = NEW.client_id 
                AND type = 'entrada' 
                AND status = 'pago'), 0),
    COALESCE((SELECT SUM(ABS(amount_kz)) FROM transactions 
              WHERE client_id = NEW.client_id 
                AND type = 'saida' 
                AND status = 'pago'), 0),
    0, -- calculado abaixo
    0, -- calculado abaixo
    CURRENT_TIMESTAMP;
    
  UPDATE client_profitability
  SET 
    net_margin = total_revenue - total_costs,
    margin_percentage = CASE 
      WHEN total_revenue > 0 THEN ((total_revenue - total_costs) / total_revenue) * 100
      ELSE 0
    END
  WHERE client_id = NEW.client_id;
END;

-- Similar triggers para UPDATE e DELETE
```

**OU via aplicação (mais simples):**

```javascript
async function updateClientProfitability(clientId) {
  // Calcular receita total
  const revenue = await db.query(`
    SELECT SUM(amount_kz) as total
    FROM transactions
    WHERE client_id = ? AND type = 'entrada' AND status = 'pago'
  `, [clientId]);
  
  // Calcular custos totais
  const costs = await db.query(`
    SELECT SUM(ABS(amount_kz)) as total
    FROM transactions
    WHERE client_id = ? AND type = 'saida' AND status = 'pago'
  `, [clientId]);
  
  const totalRevenue = revenue.total || 0;
  const totalCosts = costs.total || 0;
  const netMargin = totalRevenue - totalCosts;
  const marginPercentage = totalRevenue > 0 
    ? (netMargin / totalRevenue) * 100 
    : 0;
  
  // Update ou insert
  await db.query(`
    INSERT INTO client_profitability (
      client_id, total_revenue, total_costs, 
      net_margin, margin_percentage, last_updated
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(client_id) DO UPDATE SET
      total_revenue = excluded.total_revenue,
      total_costs = excluded.total_costs,
      net_margin = excluded.net_margin,
      margin_percentage = excluded.margin_percentage,
      last_updated = excluded.last_updated
  `, [clientId, totalRevenue, totalCosts, netMargin, marginPercentage]);
}
```

---

## 🚨 VALIDAÇÕES E REGRAS

### Validações Frontend

**Campo Valor:**
- Não pode ser 0
- Não pode ser negativo (sistema converte automaticamente para negativo se tipo = 'saida')
- Formato: apenas números e ponto decimal

**Campo Data:**
- Se status = 'pago': data não pode ser futura
- Se status = 'pendente': data pode ser futura
- Formato: DD/MM/YYYY

**Campos Obrigatórios (*):**
- Tipo
- Data
- Categoria
- Valor
- Status
- Se tipo = 'entrada' E revenue_type = 'recorrente':
  - Duração Contrato
  - Próximo Pagamento

**Taxa Câmbio:**
- Obrigatório se currency_origin ≠ 'KZ'
- Valor > 0

---

### Regras de Negócio

1. **Soft Delete:** Não deletar transações fisicamente, marcar como `deleted = 1`

2. **Permissões:**
   - Apenas admin (Olavo) pode acessar aba Finanças
   - Apenas admin pode deletar transações
   - Apenas admin pode editar transações > 30 dias

3. **Alertas:**
   - Pagamento recorrente vence em ≤ 3 dias → Notificação badge
   - Pagamento atrasado (data < hoje e status = 'pendente') → Badge vermelho
   - Despesa única > 100.000 Kz → Modal confirmação "Tem certeza?"

4. **Conversão Automática:**
   - Se tipo = 'saida' e usuário digita valor positivo → converter para negativo automaticamente
   - Se currency_origin ≠ 'KZ' → calcular amount_kz = valor × exchange_rate

---

## 📥 DADOS EXEMPLO (SEED)

```sql
-- Inserir categorias
INSERT INTO financial_categories (type, category, subcategories, color, icon, sort_order) VALUES
('entrada', 'Serviços Recorrentes', '["Cliente Angola","Cliente Suíça","Cliente Portugal"]', '#10B981', '💰', 1),
('entrada', 'Projetos One-off', '["Website","Landing Page","Diagnóstico","Consultoria"]', '#3B82F6', '🚀', 2),
('saida', 'Design', '["Designer freelance","Designer mensal","Assets (stock)"]', '#EC4899', '🎨', 1),
('saida', 'Ferramentas', '["Claude Pro","CapCut Pro","Canva Pro","GHL/CRM"]', '#F59E0B', '🛠️', 2),
('saida', 'Transporte', '["Gasolina","Uber/Táxi","Estacionamento"]', '#6366F1', '🚗', 3),
('saida', 'Fotografia', '["Fotógrafo freelance","Edição fotos"]', '#14B8A6', '📸', 4),
('saida', 'Operação', '["Internet","Telefone","Eletricidade"]', '#64748B', '🏢', 5),
('saida', 'Pessoal', '["Retirada Olavo","Colaborador fixo","Freelancer"]', '#06B6D4', '👤', 6);

-- Paula Clean (contrato recorrente 3 meses)
INSERT INTO transactions (date, client_id, client_name, type, revenue_type, contract_duration_months, next_payment_date, category, subcategory, description, amount_kz, status, payment_method) VALUES
('2025-03-17', 1, 'Paula Clean', 'entrada', 'recorrente', 3, '2025-04-17', 'Serviços Recorrentes', 'Cliente Angola', 'Pagamento Mês 1 - Pacote Essential', 587000.00, 'pago', 'Transferência');

-- Custos Paula Clean
INSERT INTO transactions (date, client_id, client_name, type, category, subcategory, description, amount_kz, status, payment_method) VALUES
('2025-03-18', 1, 'Paula Clean', 'saida', 'Design', 'Designer freelance', 'Identidade visual + 12 posts', -50000.00, 'pago', 'Transferência'),
('2025-03-18', 1, 'Paula Clean', 'saida', 'Fotografia', 'Fotógrafo freelance', 'Sessão fotos produto', -20000.00, 'pago', 'Cash'),
('2025-03-18', 1, 'Paula Clean', 'saida', 'Transporte', 'Gasolina', 'Transporte filmagem + props', -25000.00, 'pago', 'Cash'),
('2025-03-18', 1, 'Paula Clean', 'saida', 'Ferramentas', 'CapCut Pro', 'CapCut Pro (50% alocação)', -7500.00, 'pago', 'Transferência'),
('2025-03-18', 1, 'Paula Clean', 'saida', 'Ferramentas', 'Claude Pro', 'Claude Pro (50% alocação)', -8500.00, 'pago', 'Transferência');

-- Cliente Suíça (contrato recorrente 12 meses)
INSERT INTO transactions (date, client_id, client_name, type, revenue_type, contract_duration_months, next_payment_date, category, subcategory, description, amount_kz, currency_origin, exchange_rate, status, payment_method, notes) VALUES
('2025-03-15', 2, 'Cliente Suíça', 'entrada', 'recorrente', 12, '2025-04-15', 'Serviços Recorrentes', 'Cliente Suíça', 'Pagamento Março', 500000.00, 'CHF', 1000.00, 'pago', 'PayPal', 'Convertido: 500 CHF × 1000 = 500.000 Kz');

-- Custos operacionais gerais (sem cliente específico)
INSERT INTO transactions (date, type, category, subcategory, description, amount_kz, status, payment_method) VALUES
('2025-03-10', 'saida', 'Operação', 'Internet', 'Internet fibra - Março', -20000.00, 'pago', 'Transferência'),
('2025-03-10', 'saida', 'Operação', 'Telefone', 'Telefone/dados móveis', -15000.00, 'pago', 'Multicaixa'),
('2025-03-05', 'saida', 'Pessoal', 'Retirada Olavo', 'Retirada Março', -220000.00, 'pago', 'Transferência');

-- Pagamento futuro pendente
INSERT INTO transactions (date, client_id, client_name, type, revenue_type, category, description, amount_kz, status) VALUES
('2025-04-17', 1, 'Paula Clean', 'entrada', 'recorrente', 'Serviços Recorrentes', 'Pagamento Mês 2 - Pendente', 587000.00, 'pendente');
```

---

## ✅ FUNCIONALIDADES ESSENCIAIS

### CRUD Completo
- ✅ Criar transação (entrada/saída)
- ✅ Editar transação existente
- ✅ Deletar transação (soft delete)
- ✅ Ver detalhes transação individual

### Filtros e Busca
- ✅ Filtro por data (range: de - até)
- ✅ Filtro por cliente
- ✅ Filtro por tipo (entrada/saída/todos)
- ✅ Filtro por status (pago/pendente/atrasado/todos)
- ✅ Filtro por categoria
- ✅ Busca textual (descrição, notas, nº recibo)

### Visualizações
- ✅ Dashboard com cards principais
- ✅ Tabela paginada de transações (50/página)
- ✅ Seção rentabilidade por cliente
- ✅ Modal detalhes cliente completo

### Contratos Recorrentes
- ✅ Criar entrada recorrente com duração
- ✅ Visualizar próximos pagamentos
- ✅ Marcar pagamento pendente como pago (gera nova transação)
- ✅ Atualizar automaticamente next_payment_date
- ✅ Detectar quando contrato completo (todos pagamentos feitos)

### Alertas e Notificações
- ✅ Badge "⏳ 3 dias" para pagamentos próximos
- ✅ Badge vermelho "🔴 Atrasado" para pagamentos vencidos
- ✅ Modal confirmação para despesas > 100K
- ✅ Notificação ao salvar/editar/deletar com sucesso

### Export
- ✅ Exportar CSV todas transações (para contabilista)
- ✅ Exportar PDF relatório mês atual (opcional fase 2)

---

## 🎨 DESIGN SYSTEM

### Cards Dashboard

**Estrutura de cada card:**
```
┌──────────────────┐
│ 💰 Label         │ ← Emoji + Texto (12px, gray-600)
│                  │
│   587.000 Kz     │ ← Valor (24px, bold)
│                  │
│ ▲ +15% vs mês    │ ← Comparação (10px, green/red)
└──────────────────┘
```

**Cores por card:**
- Receita: Verde #10B981, emoji 💰
- Despesas: Vermelho #EF4444, emoji 💸
- Lucro: Azul #3B82F6, emoji 📈
- Margem: Roxo #8B5CF6, emoji 📊
- MRR: Ciano #06B6D4, emoji 🔄

### Status Badges

| Status | Badge | Cor |
|--------|-------|-----|
| Pago | ✅ Pago | Verde #10B981 |
| Pendente | ⏳ Pendente | Amarelo #F59E0B |
| Atrasado | 🔴 Atrasado | Vermelho #EF4444 |

### Tipo de Transação (Visual)

| Tipo | Cor texto | Símbolo |
|------|-----------|---------|
| Entrada | Verde #10B981 | + |
| Saída | Vermelho #EF4444 | - |

**Exemplo na tabela:**
- Entrada: `+587.000` (verde)
- Saída: `-50.000` (vermelho)

---

## 🔧 REQUISITOS TÉCNICOS

### Stack Recomendado
- **Frontend:** React + TailwindCSS (ou stack atual do CRM)
- **Backend:** Node.js/Python (o que já está em uso)
- **Database:** SQLite (dev) → PostgreSQL (prod)
- **Forms:** React Hook Form ou Formik
- **Date Picker:** react-datepicker ou similar
- **Notifications:** react-hot-toast ou similar

### Performance
- Paginação: 50 transações por página
- Lazy loading de modais e detalhes
- Índices no banco (já definidos acima)
- Cache de cálculos do dashboard (5 min)

### Segurança
- JWT autenticação obrigatória
- Permissões: só admin acessa aba Finanças
- Validação backend de TODOS inputs
- Sanitização SQL injection
- Logs de todas ações (quem, quando, o quê)

### Responsividade
- **Mobile-first** (90% uso será mobile)
- Cards empilhados em mobile
- Tabela scroll horizontal em mobile
- Modais full-screen em mobile
- Touch-friendly buttons (min 44px)

### Backup
- Backup automático diário (SQL dump)
- Guardar no Google Drive ou similar
- Retention: mínimo 30 dias

---

## 📋 CHECKLIST DE VALIDAÇÃO

Após implementação, validar:

### Funcionalidades Core
- [ ] Dashboard carrega e mostra valores corretos
- [ ] Criar entrada simples (one-off)
- [ ] Criar entrada recorrente com duração e próximo pagamento
- [ ] Criar saída vinculada a cliente
- [ ] Criar saída geral (sem cliente)
- [ ] Editar transação existente
- [ ] Deletar transação (soft delete)
- [ ] Transação deletada não aparece em cálculos

### Filtros
- [ ] Filtrar por data funciona
- [ ] Filtrar por cliente mostra só transações dele
- [ ] Filtrar por tipo (entrada/saída)
- [ ] Filtrar por status (pago/pendente/atrasado)
- [ ] Combinar múltiplos filtros simultaneamente
- [ ] Busca textual encontra transações

### Contratos Recorrentes
- [ ] Criar entrada recorrente salva corretamente
- [ ] Next_payment_date aparece na interface
- [ ] Botão [Marcar Pago] visível para pendentes
- [ ] Clicar [Marcar Pago] cria nova transação
- [ ] Next_payment_date atualiza automaticamente
- [ ] Quando completa duração, next_payment_date = NULL

### Rentabilidade Cliente
- [ ] Clicar cliente abre modal detalhes
- [ ] Modal mostra receita, custos, margem correta
- [ ] Modal mostra breakdown custos por categoria
- [ ] Modal mostra histórico transações do cliente
- [ ] Se contrato recorrente, mostra calendário pagamentos

### Cálculos
- [ ] Dashboard receita = soma entradas pagas mês atual
- [ ] Dashboard despesas = soma saídas pagas mês atual
- [ ] Dashboard lucro = receita - despesas
- [ ] Dashboard margem % = (lucro / receita) * 100
- [ ] Dashboard MRR = soma entradas recorrentes mês
- [ ] Rentabilidade por cliente calcula automaticamente
- [ ] Editar transação atualiza todos cálculos
- [ ] Deletar transação recalcula totais

### UX/UI
- [ ] Modal fecha ao clicar [Cancelar] ou [✕]
- [ ] Notificação sucesso ao salvar
- [ ] Notificação erro se validação falhar
- [ ] Loading spinner durante operações
- [ ] Formulário limpa após salvar
- [ ] Confirmação antes de deletar
- [ ] Badges coloridos corretos (pago/pendente/atrasado)

### Responsivo
- [ ] Dashboard cards empilham em mobile
- [ ] Tabela scroll horizontal em mobile
- [ ] Modal full-screen em mobile
- [ ] Todos botões touch-friendly (≥44px)
- [ ] Formulário usável em tela pequena

### Validações
- [ ] Não aceita valor = 0
- [ ] Não aceita data futura se status = pago
- [ ] Campos obrigatórios marcados com *
- [ ] Erro claro se campo obrigatório vazio
- [ ] Taxa câmbio obrigatória se moeda ≠ KZ
- [ ] Despesa > 100K pede confirmação

### Dados
- [ ] Seed data carrega categorias
- [ ] Seed data carrega transações exemplo
- [ ] Soft delete marca deleted = 1
- [ ] Transações deletadas não aparecem
- [ ] Backup exporta CSV corretamente

---

## 🚀 FASES DE IMPLEMENTAÇÃO

### FASE 1 - MVP (Semana 1)
**Objetivo:** Funcional básico completo

- ✅ Estrutura banco de dados completa
- ✅ Seed data categorias
- ✅ CRUD transações (criar, ler, editar, deletar)
- ✅ Dashboard básico (4-5 cards)
- ✅ Tabela transações com paginação
- ✅ Filtros básicos (data, cliente, tipo, status)
- ✅ Modal nova transação
- ✅ Suporte entrada recorrente
- ✅ Botão marcar pagamento como pago
- ✅ Cálculos automáticos (dashboard + profitability)

### FASE 2 - Melhorias (Semana 2)
**Objetivo:** UX polido + features extras

- ✅ Modal detalhes cliente
- ✅ Seção rentabilidade por cliente
- ✅ Alertas e notificações
- ✅ Validações completas frontend
- ✅ Responsividade mobile
- ✅ Export CSV
- ✅ Melhorias UI/design
- ✅ Loading states
- ✅ Confirmações (deletar, despesa alta)

### FASE 3 - Futuro (Backlog)
**Objetivo:** Features avançadas

- ⏳ Gráficos (evolução 6 meses, pizza categorias)
- ⏳ Relatório PDF automático
- ⏳ Dashboard comparativo mensal
- ⏳ Alertas automáticos email/WhatsApp
- ⏳ Integração bancária (importar transações)
- ⏳ Forecast automático
- ⏳ Multi-moeda com taxas API automáticas
- ⏳ Gestão de impostos

---

## 📞 NOTAS FINAIS

### Formatação Moeda
- **Frontend exibição:** `587.000 Kz` (ponto separador milhares)
- **Backend armazenamento:** `587000.00` (decimal padrão)
- **Input usuário:** Aceitar ambos formatos, normalizar antes salvar

### Timezone
- Todas datas em UTC no banco
- Converter para Angola Time (WAT, UTC+1) no frontend
- Usar biblioteca date-fns ou Day.js

### Testes Recomendados
- Teste CRUD completo de transação
- Teste cálculos dashboard (várias combinações)
- Teste contrato recorrente (3 pagamentos seguidos)
- Teste filtros (cada um individualmente + combinados)
- Teste mobile (iOS Safari + Android Chrome)

### Documentação
- Comentar código complexo (triggers, cálculos)
- README com setup instruções
- Changelog de versões

---

## 🎯 RESULTADO ESPERADO

Ao finalizar implementação, Olavo deve conseguir:

1. ✅ Ver saúde financeira Mazanga num relance (dashboard)
2. ✅ Adicionar entrada/saída em menos de 30 segundos
3. ✅ Controlar contratos recorrentes (próximos pagamentos visíveis)
4. ✅ Saber margem exata de cada cliente
5. ✅ Marcar pagamentos pendentes como pago (1 clique)
6. ✅ Filtrar transações por qualquer critério
7. ✅ Ver breakdown completo custos por cliente
8. ✅ Exportar dados para contabilista (CSV)
9. ✅ Tomar decisões baseadas em dados reais
10. ✅ Ter histórico completo auditável

---

**FIM DA ESPECIFICAÇÃO**

*Documento criado: 18 Março 2025*  
*Versão: 1.0*  
*Autor: Claude + Olavo Tavares*
