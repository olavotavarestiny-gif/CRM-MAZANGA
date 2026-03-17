# Mazanga CRM — Instruções de Deploy em Produção

## Pré-requisitos ✓
- [x] GitHub repo criado: `github.com/mazangangunza/mazanga-crm` (código comitado)
- [x] Supabase PostgreSQL criado: `db.zvpywxfwtkciakyurrcp.supabase.co`
- [x] Vercel conta conectada ao GitHub
- [x] Render conta criada

## Alterações Realizadas

### 1. Backend — CORS (index.js) ✅
- Actualizado: CORS agora aceita `process.env.FRONTEND_URL` além de localhost

### 2. Backend — Environment Variables ✅
- `.env` local: SQLite (`file:./dev.db`) — para desenvolvimento
- `.env.production` exemplo: PostgreSQL Supabase — para Render
- JWT_SECRET: Novo secret forte (87c2c9ae810d9379e5574d33f9e00c2fba3204c40bbb0fbf0fea56e233c87b24)
- FRONTEND_URL: Vazio localmente (será preenchido em Render após Vercel deploy)

### 3. Backend — Schema.prisma ⚠️ (APENAS NO RENDER)
- **Localmente**: `provider = "sqlite"` (ficheiro tem comentário sobre produção)
- **Em Render**: Render fará `npx prisma db push` que criará as tabelas em PostgreSQL automaticamente
- **Explicação**: O schema adapta-se automaticamente com `prisma db push` — não precisa mudar o ficheiro

---

## ⚡ SQLite Local vs PostgreSQL em Produção

### Por que SQLite localmente?
- ✅ Funciona offline, sem conexão à internet
- ✅ Não requer servidor externo
- ✅ Perfeito para desenvolvimento e testes
- ✅ Dados persistem em `backend/dev.db`

### Por que PostgreSQL no Render?
- ✅ Produção requer base de dados robusta
- ✅ Suporta múltiplos utilizadores em simultâneo
- ✅ Melhor performance e segurança
- ✅ Supabase fornece PostgreSQL gerido gratuitamente

### Como funciona o switch?
1. **Localmente**: Backend usa SQLite (`database.db`)
2. **Deploy**: Render executa `npx prisma db push` que cria tabelas em PostgreSQL
3. **Prisma**: Adapta-se automaticamente ao `DATABASE_URL` definido em variáveis de ambiente

**Resultado**: Mesmo código, diferentes bases de dados consoante o ambiente! 🎯

---

## 🔴 IMPORTANTE: Erro de Database Render

Se teve erro `P1001: Can't reach database server`, **leia RENDER_SETUP.md AGORA!**

A solução é usar **PostgreSQL do Render** em vez de Supabase (muito mais simples).

---

## Fase 1: Deploy do Backend no Render

### Passo 1.1 — Aceder ao Render
1. Ir a **https://render.com**
2. Login com GitHub
3. Click **New Web Service**

### Passo 1.2 — Conectar Repositório
1. **Connect repository** → seleccionar `mazanga-crm`
2. Preencher:
   - **Name**: `mazanga-crm-backend`
   - **Region**: Escolher mais próximo (ex: Frankfurt)
   - **Branch**: `main`

### Passo 1.3 — Configurar Build
1. **Root Directory**: `backend`
2. **Runtime**: `Node`
3. **Build Command**:
   ```
   npm install && npx prisma generate && npx prisma db push
   ```
4. **Start Command**:
   ```
   node src/index.js
   ```

### ⚠️ Passo 1.4 — IMPORTANTE: Adicionar Environment Variables ANTES do Deploy
**CRÍTICO**: Render precisa das variáveis de ambiente ANTES de fazer deploy, senão o build falha.

No painel Render, ir a **Environment** e adicionar **TODAS** as variáveis abaixo:

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | `postgresql://postgres:Mazangacrm2026@db.zvpywxfwtkciakyurrcp.supabase.co:5432/postgres?sslmode=require` |
| `FRONTEND_URL` | (deixar vazio por enquanto) |
| `JWT_SECRET` | `87c2c9ae810d9379e5574d33f9e00c2fba3204c40bbb0fbf0fea56e233c87b24` |
| `WHATSAPP_API_VERSION` | `v25.0` |
| `WHATSAPP_PHONE_NUMBER_ID` | `1040074275848932` |
| `WHATSAPP_ACCESS_TOKEN` | `EAAcHwZCAqZBfABQ8kk82pKXv15KElpSYjDKOStJxX6JQhtk7FNbPHguMZAQWnFwGDCqzblhyfdVXFArFhroaEcssgqR4QlwiURfXEkcAxZCbHehsHz9t00D4KvZAvZAQF80y9FiTgUnLWlmHaOM9COMfRIEtZA5mSmQ9rwNxHJ1dP7SRBRdoqsANfwnhYomxQZDZD` |
| `WABA_ID` | `904177792335249` |
| `WEBHOOK_VERIFY_TOKEN` | `686abf0a1474fe0f4b278053606d234c` |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `suporteaocliente@mazanga.digital` |
| `SMTP_PASS` | `Suporteaocliente20206.` |
| `SMTP_FROM` | `Mazanga CRM <suporteaocliente@mazanga.digital>` |

### Passo 1.5 — Deploy
1. Click **Deploy**
2. Aguardar até ver ✓ "Build successful"
3. **Copiar URL do backend** (ex: `https://mazanga-crm-backend.onrender.com`)

---

## Fase 2: Deploy do Frontend no Vercel

**⚠️ Se o Root Directory só mostra `backend`, leia VERCEL_SETUP.md!**

O `vercel.json` na raiz do projecto já está configurado para seleccionar `frontend` automaticamente.

### Passo 2.1 — Aceder ao Vercel
1. Ir a **https://vercel.com**
2. Click **Add New... → Project**
3. **Import Git Repository** → seleccionar `mazanga-crm`

### Passo 2.2 — Configurar Project
1. **Root Directory**: `frontend` (deve aparecer automaticamente)
   - Se não aparecer, ver VERCEL_SETUP.md para solução
2. **Framework Preset**: Next.js (automático)
3. **Build Command**: `npm run build` (automático)
4. **Output Directory**: `.next` (automático)

### Passo 2.3 — Adicionar Environment Variables
1. Click **Environment Variables**
2. Adicionar:

| Variável | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://mazanga-crm-backend.onrender.com` |

(Substituir com URL real do seu backend Render)

### Passo 2.4 — Deploy
1. Click **Deploy**
2. Aguardar até ver "Deployment completed"
3. **Copiar URL do frontend** (ex: `https://mazanga-crm.vercel.app`)

---

## Fase 3: Actualizar CORS no Backend

### Passo 3.1 — Render Dashboard
1. Ir a **https://render.com/dashboard**
2. Seleccionar `mazanga-crm-backend`
3. Click **Environment**
4. Editar `FRONTEND_URL`:
   - Novo valor: `https://mazanga-crm.vercel.app`
5. Click **Save**

### Passo 3.2 — Redeploy
1. Click **Manual Deploy** ou **Re-deploy**
2. Aguardar até "Build successful"

---

## Verificação Final

1. **Abrir frontend**: `https://mazanga-crm.vercel.app`
   - ✓ Página de login carrega

2. **Login**: usar credenciais de um utilizador criado localmente
   - ✓ Dashboard aparece

3. **Criar contacto**:
   - ✓ Contacto criado e aparece na lista
   - Prova: DB Supabase está conectada

4. **Testar formulário público**:
   - Ir a **Formulários**
   - Copiar link de um formulário
   - Abrir em modo anónimo (nova aba private/incognito)
   - ✓ Formulário carrega sem login
   - Submeter → contacto criado

5. **Testar automações**:
   - Criar automação: "Se faturação = '- 50 Milhões De Kwanzas' → Mover para Qualificado"
   - Criar contacto com essa faturação
   - ✓ Contacto move automaticamente para "Qualificado"

---

## Troubleshooting

### CORS Error: "Not allowed by CORS"
- Verificar que `FRONTEND_URL` no Render corresponde ao domínio do Vercel
- Fazer redeploy do backend

### Database connection refused
- Verificar que `DATABASE_URL` está correcto no Render
- Assegurar que Supabase projeto está activo

### "401 Unauthorized" em protected routes
- Verificar que `JWT_SECRET` no Render é igual ao usado no frontend
- Testar login novamente

### Build falha no Render
- Verificar que `backend/package.json` tem todas as dependências
- Rodar localmente: `cd backend && npm install && npm run build`

---

## Links Úteis
- **Supabase Dashboard**: https://supabase.com/dashboard/projects
- **Render Dashboard**: https://render.com/dashboard
- **Vercel Dashboard**: https://vercel.com/dashboard
- **GitHub Repo**: https://github.com/mazangangunza/mazanga-crm

---

## Próximos Passos (Opcional)
1. **Domínios Personalizados**:
   - Vercel: Settings → Domains → `app.mazanga.digital`
   - Render: Settings → Custom Domain → `api.mazanga.digital`

2. **Webhook WhatsApp**:
   - Actualizar em WhatsApp Business para: `https://api.mazanga.digital/api/webhook`

3. **SSL Automático**:
   - Vercel e Render já fornecem SSL gratuito ✓
