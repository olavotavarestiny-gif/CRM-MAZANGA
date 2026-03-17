# 🌐 Vercel Setup — Deploy do Frontend

## O Problema
No Vercel, o "Root Directory" só mostra `backend` quando deveria mostrar `frontend`.

## A Solução

### ✅ Passo 1: Ir ao Vercel

1. Ir a **https://vercel.com/dashboard**
2. Click **Add New... → Project**

---

### ✅ Passo 2: Import Git Repository

1. Click **Import Git Repository**
2. Seleccionar `mazanga-crm` (seu repositório)
3. Click **Import**

---

### ✅ Passo 3: Configure Project (IMPORTANTE!)

Vercel vai mostrar:
```
Repository: mazanga-crm
Framework Preset: Next.js
Root Directory: [dropdown]
```

**Aqui é o passo crítico:**

1. Click no dropdown de **Root Directory**
2. Seleccionar **`frontend`** (NÃO deixar vazio, NÃO `backend`)

---

### ✅ Passo 4: Environment Variables

1. Scroll down para **Environment Variables**
2. Adicionar:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://mazanga-crm-backend.onrender.com` |

⚠️ **Nota**: Substituir `mazanga-crm-backend.onrender.com` pela URL real do seu backend no Render.

---

### ✅ Passo 5: Deploy

1. Click **Deploy**
2. Aguardar ✓ "Deployment completed"

---

## Se Continuar com Problema de Root Directory

Se ainda aparecer só `backend`:

### Solução A: Desconectar e Reconectar GitHub

1. Settings → Git Integration
2. Desconectar GitHub
3. Reconectar

### Solução B: Criar Ficheiro Vercel Config

Se nada funcionar, criar `vercel.json` na **raiz do projecto**:

```json
{
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/next"
    }
  ]
}
```

Depois fazer commit e push:
```bash
git add vercel.json
git commit -m "Add Vercel config for frontend"
git push
```

Depois reimportar no Vercel.

---

## Estrutura Correcta

```
mazanga-crm/
├── backend/          ← Backend (Render)
├── frontend/         ← Frontend (Vercel) ✅ SELECCIONAR ISTO
├── DEPLOYMENT.md
├── RENDER_SETUP.md
├── VERCEL_SETUP.md   ← Este ficheiro
└── vercel.json       ← (optional, apenas se tiver problemas)
```

---

## Troubleshooting

### ❓ "Root Directory não mostra frontend"

**Causas possíveis**:
1. GitHub desconectado do Vercel
2. Repositório não tem `package.json` em frontend/
3. Cache do Vercel

**Solução**:
- Verificar: `ls frontend/package.json` (deve existir)
- Refresh página do Vercel
- Se persistir, usar `vercel.json` (Solução B acima)

### ❓ "Build falha depois de seleccionar frontend"

**Causas possíveis**:
1. Missing dependencies
2. Environment variable não definida

**Solução**:
```bash
cd frontend
npm install
npm run build
```

Se funcionar localmente, funciona no Vercel também.

### ❓ "Cannot find module '@/lib/api'"

**Causa**: Path aliases não configurados

**Já está fixo** — `frontend/tsconfig.json` tem:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Não precisa alterar nada.

---

## Depois do Deploy Vercel

Uma vez que frontend está ao vivo no Vercel:

1. Copiar URL (ex: `https://mazanga-crm.vercel.app`)
2. Ir ao Render backend → Environment
3. Adicionar: `FRONTEND_URL=https://mazanga-crm.vercel.app`
4. Redeploy Render
5. ✓ CORS funciona entre Vercel e Render

---

## Links Úteis

- **Vercel Docs**: https://vercel.com/docs
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Next.js Docs**: https://nextjs.org/docs
- **GitHub Integration**: https://vercel.com/docs/git
