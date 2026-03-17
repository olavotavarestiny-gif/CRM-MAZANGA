# 🔧 Vercel Troubleshooting

## 🔴 Se o Build Falha com "exited with 1"

**Causa**: `NEXT_PUBLIC_API_URL` não está configurada no Vercel

**Solução Rápida**:
1. Vercel Dashboard → Settings → Environment Variables
2. Adicionar: `NEXT_PUBLIC_API_URL=https://mazanga-crm-backend.onrender.com`
3. Redeploy

📖 **Detalhes**: Ler `VERCEL_ENV_VARS.md`

---

## O Problema: Frontend Não Aparece
Quando importa `mazanga-crm` no Vercel, a pasta `frontend` não aparece no dropdown "Root Directory".

## Solução Definitiva

### ✅ Opção 1: Desconectar e Reconectar (MAIS FÁCIL)

**A razão**: Vercel tem cache da primeira import

1. Vercel Dashboard → https://vercel.com/dashboard
2. Seleccionar qualquer projecto
3. Settings → Git Integration
4. Desconectar GitHub
5. Reconectar GitHub
6. Novo Project → Import `mazanga-crm`
7. Desta vez, `frontend` deve aparecer! ✓

---

### ✅ Opção 2: Usar vercel.json (JÁ FEITO)

O ficheiro `vercel.json` já foi actualizado com:

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/.next"
}
```

**Este ficheiro diz ao Vercel**:
- Build: vai para pasta `frontend/` e roda `npm run build`
- Output: está em `frontend/.next` (onde Next.js compila)

**Como usar**:
1. Vercel Dashboard → Import `mazanga-crm`
2. Mesmo que não apareça `frontend` no dropdown
3. Vercel lê `vercel.json` e faz build automaticamente
4. Ignora o dropdown do Root Directory

---

### ✅ Opção 3: Deploy com Vercel CLI (AVANÇADO)

Se as acima não funcionarem:

```bash
# Instalar Vercel CLI
npm i -g vercel

# Na raiz do projecto
cd /Users/mazangangunza/Desktop/mazanga-crm

# Login
vercel login

# Deploy
vercel --prod
# Perguntar: Root Directory? → frontend
# Deploy começa automaticamente
```

---

## Passo a Passo Recomendado

### 1. Tentar Opção 1 (Mais Rápida)

```
1. Vercel → desconectar GitHub
2. Reconectar GitHub
3. New Project → mazanga-crm
4. Desta vez aparece "frontend"?
   SIM → Continuar com deploy (passo 5 abaixo)
   NÃO → Ir para Opção 2
```

### 2. Se Opção 1 Não Funcionar, Confiar em vercel.json

```
1. Vercel → New Project → mazanga-crm
2. Não aparecer "frontend"? Tudo bem!
3. Clicar "Deploy" mesmo assim
4. Vercel lê vercel.json e sabe o que fazer
5. Build funciona porque vercel.json especifica tudo
```

---

## Verificação

Para confirmar que tudo está correcto:

```bash
# Pasta frontend existe?
ls -la frontend/
# ✓ Deve mostrar: package.json, next.config.mjs, tsconfig.json, src/, public/

# vercel.json existe?
cat vercel.json
# ✓ Deve mostrar buildCommand e outputDirectory

# Frontend consegue fazer build?
cd frontend
npm run build
# ✓ Deve compilar sem erros
```

---

## Se Ainda Não Funcionar

### Verificar Permissões GitHub

1. GitHub → Settings → Applications
2. Vercel → Granted → Authorize (se não está)
3. Tentar novamente

### Verificar Repositório Git

```bash
cd /Users/mazangangunza/Desktop/mazanga-crm
git status
# Deve mostrar branch "main"

git remote -v
# Deve mostrar GitHub URL
```

### Fazer Push de Todas as Mudanças

```bash
git add .
git commit -m "Update Vercel configuration"
git push origin main
```

Depois tentar import no Vercel novamente.

---

## Alternativa: Usar Subdomain do Vercel

Se tiver frontend em subdomínio:

```
https://mazanga-crm-frontend.vercel.app  (frontend)
https://mazanga-crm-backend.onrender.com (backend)
```

Neste caso:
- Não precisa "Root Directory"
- Cada projecto é separado no Vercel
- Mais simples para monorepo

**Como fazer**:
1. Vercel → New Project
2. Import só o repositório `mazanga-crm`
3. Root Directory: `frontend`
4. Deploy

Se isso também não funcionar, considerar separar em dois repositórios (menos recomendado).

---

## Estrutura que Vercel Espera

```
mazanga-crm/
├── vercel.json            ← Já existente, configurado ✓
├── frontend/              ← Vercel procura aqui
│   ├── package.json       ← Com dependências Next.js
│   ├── next.config.mjs    ← Configuração Next.js
│   ├── src/               ← Código
│   └── public/            ← Assets estáticos
└── backend/               ← Ignorado pelo Vercel
    └── package.json       ← Node.js normal
```

Tudo está em lugar! ✓

---

## Próximos Passos

1. Tentar **Opção 1** (desconectar/reconectar GitHub)
2. Se não funcionar, **confiar em vercel.json** (deploy mesmo assim)
3. Se erro de build, rodar `cd frontend && npm run build` localmente para debug

Qualquer erro específico, copiar da consola do Vercel e investigar.

**Em 99% dos casos, vercel.json já resolve!** ✅
