# 🚀 Render Setup — Solução Definitiva para o Erro de Database

## O Problema
```
Error: P1001: Can't reach database server at `db.zvpywxfwtkciakyurrcp.supabase.co:5432`
```

**Causa**: O Render tenta conectar ao Supabase durante o build, mas não consegue.

---

## A Solução: Usar PostgreSQL do Render (RECOMENDADO)

**Render fornece PostgreSQL GRÁTIS automaticamente!** Não precisa do Supabase.

### ✅ Passo 1: Criar o Serviço no Render

1. Ir a **https://render.com/dashboard**
2. Click **New Web Service**
3. Conectar GitHub → seleccionar `mazanga-crm`
4. Preencher:
   - **Name**: `mazanga-crm-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npx prisma generate && npx prisma db push`
   - **Start Command**: `node src/index.js`
   - **Environment**: Node

5. **SEM clicar Deploy ainda!** Ir para o próximo passo.

---

### ✅ Passo 2: Adicionar Database PostgreSQL

1. No painel do Render, click **Add PostgreSQL**
2. Preencher:
   - **Database Name**: `mazanga_crm`
   - **User**: `mazanga_user`
   - **Region**: Mesmo do serviço (ex: Frankfurt)
3. Click **Create Database**

**Render vai gerar automaticamente**:
- `DATABASE_URL` completa
- Username e password
- Tudo o que precisa

---

### ✅ Passo 3: Adicionar Environment Variables

1. No painel do serviço `mazanga-crm-backend`, ir a **Environment**
2. Vai ver que `DATABASE_URL` já está lá (criada automaticamente pelo Render)
3. Adicionar as outras variáveis:

| Key | Value |
|-----|-------|
| `FRONTEND_URL` | (deixar vazio por agora) |
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

---

### ✅ Passo 4: Deploy

1. Click **Deploy**
2. Aguarde ✓ "Build successful"

**Porquê funciona agora**:
- Render criou a database PostgreSQL
- Render injectou `DATABASE_URL` automaticamente
- Build consegue conectar porque a database existe
- Schema cria as tabelas

---

## Alternativa: Continuar com Supabase

Se **realmente** quiser usar Supabase em vez do PostgreSQL do Render:

### 1. Solucionar o Erro de Conectividade

O problema é que Supabase não reconhece o IP do Render. Solução:

**A. No Painel do Supabase**:
1. Ir a https://supabase.com/dashboard
2. Seleccionar projeto "mazanga-crm"
3. Settings → Database
4. Click **Allow all IPs** (provisoriamente)
   - Ou adicionar IP específico do Render (menos seguro)

**B. No Render**:
1. Adicionar `DATABASE_URL` com SSL obrigatório:
   ```
   postgresql://postgres:Mazangacrm2026@db.zvpywxfwtkciakyurrcp.supabase.co:5432/postgres?sslmode=require
   ```

### 2. Problema: Supabase Restringe Connections

Supabase free tier tem limite de conexões simultâneas. Render pode exceder isso.

**Solução**:
- Usar PgBouncer (Supabase integrado)
- Ou simplesmente usar PostgreSQL do Render (mais fácil)

---

## Comparação: Render vs Supabase

| Aspecto | Render | Supabase |
|--------|--------|----------|
| **Custo** | Grátis | Grátis |
| **Setup** | Automático | Manual |
| **Conectividade** | Sempre funciona | Pode ter problemas de IP |
| **Limite de conexões** | Ilimitado (free tier) | 30 conexões |
| **Recomendação** | ✅ Use isto | ⚠️ Mais complicado |

---

## ✅ Resumo: Passo a Passo Rápido

```
1. Render Dashboard → New Web Service
2. Connect GitHub (mazanga-crm)
3. Root: backend, Build: npm install && npx prisma generate && npx prisma db push
4. Click "Add PostgreSQL" (Render cria BD + DATABASE_URL)
5. Adicionar 12 outras Environment Variables
6. Deploy
7. ✓ Build passa
8. ✓ Base de dados criada
9. ✓ Backend roda
10. URL: https://mazanga-crm-backend.onrender.com
```

---

## Se Ainda Tiver Erro

Verificar:
- [ ] `DATABASE_URL` está em Environment Variables (não em .env ficheiro)
- [ ] Build Command está correcto: `npm install && npx prisma generate && npx prisma db push`
- [ ] PostgreSQL foi adicionada (click "Add PostgreSQL" no Render)
- [ ] Clicou Deploy **após** adicionar as variáveis

Se tiver erro específico, copie a mensagem completa dos logs do Render para investigar.

---

## Depois: Vercel Frontend

Uma vez que o backend está a rodar no Render:

```
1. Vercel → New Project → Import mazanga-crm
2. Root: frontend
3. NEXT_PUBLIC_API_URL = https://mazanga-crm-backend.onrender.com
4. Deploy
5. Copiar URL do Vercel
6. Render → FRONTEND_URL = URL do Vercel
7. Redeploy Render
8. ✓ CORS funciona
9. ✓ App ao vivo
```

Simples! 🎉
