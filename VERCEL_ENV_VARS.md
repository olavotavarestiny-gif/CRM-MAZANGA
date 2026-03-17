# 🌍 Vercel Environment Variables — Solução para Build Fail

## O Problema
Vercel tenta fazer build com `NEXT_PUBLIC_API_URL=http://localhost:3001`, o que falha em produção.

## Causa
O ficheiro `frontend/.env.local` foi incluído no git, mas **não deveria estar lá** (já está no `.gitignore`).

---

## A Solução (3 Passos)

### ✅ Passo 1: Vercel Dashboard

1. https://vercel.com/dashboard
2. Seleccionar projecto `mazanga-crm`
3. Ir a **Settings** → **Environment Variables**

### ✅ Passo 2: Adicionar Variável

Clicar **Add New Environment Variable**:

| Variável | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://mazanga-crm-backend.onrender.com` |

(Substituir `mazanga-crm-backend.onrender.com` pela URL **real** do seu Render)

✅ **IMPORTANTE**: Deixar vazio o `Select Environments` ou seleccionar **Production + Preview + Development**

### ✅ Passo 3: Redeploy

1. Vercel Dashboard → Deployments
2. Click "Redeploy" no deployment anterior
3. Aguardar "Deployment completed"

**Desta vez o build deve passar!** ✓

---

## Por Que Isto Funciona

**Processo**:
```
1. Git push → Vercel recebe código
2. Vercel vê vercel.json → "build frontend"
3. Build começa sem .env.local
4. Vercel injeta NEXT_PUBLIC_API_URL (do dashboard)
5. Build usa NEXT_PUBLIC_API_URL (Render URL)
6. ✓ Build bem-sucedido
```

**SEM isto**:
```
1. Git push → Vercel recebe código + .env.local
2. Build começa
3. Carrega .env.local (localhost:3001)
4. Tenta conectar a localhost em produção
5. ✗ Build falha
```

---

## Verificação Local

Confirmar que funciona localmente:

```bash
cd frontend

# Com .env.local (localhost)
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run build
# ✓ Deve passar

# Sem .env.local (como Vercel faz)
unset NEXT_PUBLIC_API_URL
npm run build
# ✓ Deve passar (Vercel vai injectar a variável)
```

---

## .env.local — Apenas Para Desenvolvimento Local

**Ficheiro**: `frontend/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Este ficheiro:
- ✅ Deve existir localmente (para `npm run dev`)
- ❌ **NÃO deve estar no git** (já está no `.gitignore`)
- ❌ **Vercel ignora** este ficheiro
- ✓ Vercel usa variáveis do dashboard em vez

---

## Resumo

| Ambiente | Variável | Origem |
|----------|----------|--------|
| 📱 Local | `NEXT_PUBLIC_API_URL=http://localhost:3001` | `frontend/.env.local` |
| ☁️ Vercel | `NEXT_PUBLIC_API_URL=https://...onrender.com` | Vercel Dashboard |

**Vercel NÃO usa `.env.local`** — usa o que está definido no dashboard!

---

## Troubleshooting

### ❓ "Build ainda falha com NEXT_PUBLIC_API_URL error"

**Solução**:
1. Vercel Dashboard → Environment Variables
2. Confirmar que `NEXT_PUBLIC_API_URL` está definida
3. Confirmar que o valor é uma URL válida (não localhost)
4. Redeploy

### ❓ "Vercel não mostra a variável que adicionei"

**Solução**:
1. Refresh página (F5)
2. Logout e login novamente
3. Tentar adicionar de novo

### ❓ "Frontend consegue rodar localmente mas falha no Vercel"

**Causa**: Variável definida localmente em `.env.local` mas não no Vercel

**Solução**:
1. Adicionar mesma variável no Vercel Dashboard
2. Redeploy

---

## Next: Depois do Deploy

Uma vez que o frontend está ao vivo:

1. Copiar URL do Vercel (ex: `https://mazanga-crm.vercel.app`)
2. Ir ao Render → `FRONTEND_URL` = copiar URL
3. Render redeploy
4. ✓ CORS funciona
5. ✓ App ao vivo

---

## Referência Rápida

```bash
# Local development
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
npm run dev

# Vercel production (configurar no dashboard)
# NEXT_PUBLIC_API_URL=https://mazanga-crm-backend.onrender.com
```

**Pronto!** 🎉
