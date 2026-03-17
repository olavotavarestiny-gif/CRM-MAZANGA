# 🗄️ Database Setup — SQLite Local + PostgreSQL Produção

## O Problema

Quando tenta rodar `npx prisma db push` com DATABASE_URL do Supabase, recebe:
```
Error: P1001: Can't reach database server at `db.zvpywxfwtkciakyurrcp.supabase.co:5432`
```

**Isto é NORMAL e ESPERADO!** ✅

---

## A Solução

Use **SQLite em desenvolvimento local** e **PostgreSQL em produção (Render)**.

### Arquitectura

```
┌─────────────────────────────┐
│     Seu Computador Local    │
│  - Backend + SQLite (dev.db)│
│  - Frontend (localhost:3000)│
│  - Testa localmente         │
└─────────────────────────────┘
             ↓
      Git push para GitHub
             ↓
┌─────────────────────────────┐
│     Cloud em Produção       │
│  - Render (Backend)         │
│    └─ PostgreSQL (Supabase) │
│  - Vercel (Frontend)        │
│  - Acessível públicamente   │
└─────────────────────────────┘
```

---

## Como Funciona Agora

### 1️⃣ Desenvolvimento Local
```bash
cd backend

# Usa SQLite (backend/.env aponta para file:./dev.db)
npm start
# ✓ Backend roda em localhost:3001
# ✓ Dados guardados em backend/dev.db
```

**Ficheiro**: `backend/.env`
```
DATABASE_URL=file:./dev.db
```

### 2️⃣ Deploy em Produção (Render)
```
Render detecta build commands:
npm install && npx prisma generate && npx prisma db push
```

**O que acontece**:
1. Render lê variáveis de ambiente (definidas no painel Render)
2. `DATABASE_URL` aponta para Supabase PostgreSQL
3. `npx prisma db push` cria as tabelas em PostgreSQL
4. Backend roda contra PostgreSQL em vez de SQLite

**Ficheiro**: Render Environment → `DATABASE_URL`
```
postgresql://postgres:Mazangacrm2026@db.zvpywxfwtkciakyurrcp.supabase.co:5432/postgres
```

---

## Por Que Não Consegue Conectar Localmente?

### ❌ O que tenta
```bash
DATABASE_URL="postgresql://postgres:Mazangacrm2026@db.zvpywxfwtkciakyurrcp.supabase.co:5432/postgres" \
npx prisma db push
# Erro: Can't reach database server...
```

### ✅ Por que falha
1. **Firewall**: Máquina local tem IP privado/restrito
2. **Supabase Security**: Por padrão, bloqueia IPs desconhecidos
3. **Network**: Sua rede pode não permitir conexões externas

### ✅ Por que funciona no Render
1. **IP Público**: Render tem servidor cloud com IP fixo
2. **Whitelisted**: Supabase conhece IPs de data centers (Render)
3. **Cloud-to-Cloud**: Ambos estão na internet pública

---

## Workflow de Desenvolvimento

### ✅ Dia a Dia (Desenvolvimento)

```bash
# 1. Inicia o backend (usa SQLite localmente)
cd backend
npm start
# ✓ Roda em localhost:3001, dados em dev.db

# 2. Inicia o frontend (noutra aba)
cd frontend
npm run dev
# ✓ Roda em localhost:3000

# 3. Testa localmente
# - Cria contactos, formulários, automações
# - Tudo funciona contra SQLite

# 4. Faz commit
git add .
git commit -m "Add feature X"
git push origin main
```

---

## Deploy para Produção

### 📋 Checklist
1. **GitHub**: Código no branch `main` ✓
2. **Render**: Painel → New Web Service → Connect `mazanga-crm`
3. **Render**: Root Directory = `backend`
4. **Render**: Environment Variables (ver `DEPLOYMENT.md` para lista completa)
   ```
   DATABASE_URL=postgresql://postgres:Mazangacrm2026@...
   JWT_SECRET=87c2c9ae...
   FRONTEND_URL=(será preenchido após Vercel)
   ```
5. **Render**: Build Command = `npm install && npx prisma generate && npx prisma db push`
6. **Deploy** → Backend roda com PostgreSQL 🎉

---

## Ficheiros Importantes

| Ficheiro | Ambiente | Descrição |
|----------|----------|-----------|
| `backend/.env` | 📱 Local | SQLite, credenciais de teste |
| `backend/.env.production` | ☁️ Produção | Exemplo de vars (referência) |
| `backend/prisma/schema.prisma` | Ambos | SQLite localmente (comentário sobre prod) |
| `DEPLOYMENT.md` | Documentação | Instruções de deploy |

---

## Se Quiser Testar PostgreSQL Localmente

Se realmente precisar testar PostgreSQL antes de deploy:

### Opção 1: Docker (mais fácil)
```bash
# Instale Docker primeiro, depois:
docker run --name mazanga-postgres \
  -e POSTGRES_PASSWORD=mazanga_test \
  -e POSTGRES_DB=mazanga_crm \
  -p 5432:5432 \
  -d postgres:latest

# Crie um .env.local
DATABASE_URL="postgresql://postgres:mazanga_test@localhost:5432/mazanga_crm"

# Execute
npx prisma db push
npx prisma generate
npm start
```

### Opção 2: Supabase (requerer acesso remoto)
Contacte Supabase Support para adicionar seu IP à whitelist.

---

## Troubleshooting

### ❓ Questão: "Perco dados ao mudar de SQLite para PostgreSQL?"
✅ **Não!** Porque:
- SQLite é apenas para desenvolvimento local
- Dados de produção entram em PostgreSQL (Supabase) directo
- Quando o Render deploy, começa com BD vazia (que é normal)

### ❓ Questão: "E se mudar código e tiver de fazer migration?"
✅ **Fácil!** Prisma adapta-se automaticamente:
```bash
# Localmente com SQLite
npx prisma db push
# Render com PostgreSQL (automático no build)
```

### ❓ Questão: "Dados de teste local afectam produção?"
✅ **Não!** São BDs separadas:
- `backend/dev.db` — apenas local
- Supabase PostgreSQL — apenas produção

---

## Resumo

| Ambiente | Database | Como Acede | Configuração |
|----------|----------|-----------|-------------|
| 📱 Local | SQLite | `backend/dev.db` | `backend/.env` |
| ☁️ Render | PostgreSQL | Supabase | `Render Environment Variables` |

**Uma única base de código, dois ambientes diferentes!** 🎯

Agora pode desenvolver localmente sem problemas, e a produção roda contra PostgreSQL. ✅
