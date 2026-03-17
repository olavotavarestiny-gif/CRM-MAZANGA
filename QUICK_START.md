# 🚀 Quick Start — Deploy Mazanga CRM em 15 Minutos

## Pré-Requisitos Já Prontos ✅
- ✅ Código no GitHub: `github.com/mazangangunza/mazanga-crm`
- ✅ Vercel conta conectada ao GitHub
- ✅ Render conta criada
- ✅ `vercel.json` já configurado
- ✅ `RENDER_SETUP.md` pronto

---

## 🎯 Resumo: 3 Passos Principais

```
1. RENDER (Backend + Database)
   └─ 5 minutos

2. VERCEL (Frontend)
   └─ 5 minutos

3. CONECTAR (CORS)
   └─ 5 minutos

TOTAL: 15 minutos, CRM ao vivo na web! 🎉
```

---

## Passo 1️⃣: Render Backend (5 min)

### 1.1 - Criar Serviço
1. https://render.com/dashboard
2. **New Web Service**
3. Conectar GitHub → seleccionar `mazanga-crm`

### 1.2 - Configurar
```
Root Directory: backend
Build Command: npm install && npx prisma generate && npx prisma db push
Start Command: node src/index.js
Environment: Node
```

### 1.3 - Adicionar Database
1. Click **Add PostgreSQL**
2. (Render cria automaticamente DATABASE_URL)

### 1.4 - Adicionar Variáveis
Ir a **Environment** e copiar todas de `backend/.env.render`:

```
FRONTEND_URL=
JWT_SECRET=87c2c9ae810d9379e5574d33f9e00c2fba3204c40bbb0fbf0fea56e233c87b24
WHATSAPP_API_VERSION=v25.0
WHATSAPP_PHONE_NUMBER_ID=1040074275848932
WHATSAPP_ACCESS_TOKEN=EAAcHwZCAqZBfABQ8...
WABA_ID=904177792335249
WEBHOOK_VERIFY_TOKEN=686abf0a1474fe0f4b278053606d234c
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=suporteaocliente@mazanga.digital
SMTP_PASS=Suporteaocliente20206.
SMTP_FROM="Mazanga CRM <suporteaocliente@mazanga.digital>"
```

### 1.5 - Deploy
Click **Deploy** e aguardar ✓ "Build successful"

**Copiar URL**: ex. `https://mazanga-crm-backend.onrender.com`

---

## Passo 2️⃣: Vercel Frontend (5 min)

### 2.1 - Criar Projecto
1. https://vercel.com/dashboard
2. **Add New... → Project**
3. **Import Git Repository** → seleccionar `mazanga-crm`

### 2.2 - Configurar
```
Root Directory: frontend (automático com vercel.json)
Build: npm run build (automático)
```

### 2.3 - Environment Variable
Adicionar:
```
NEXT_PUBLIC_API_URL=https://mazanga-crm-backend.onrender.com
```
(Substituir com URL real do seu Render)

### 2.4 - Deploy
Click **Deploy** e aguardar ✓ "Deployment completed"

**Copiar URL**: ex. `https://mazanga-crm.vercel.app`

---

## Passo 3️⃣: Conectar CORS (5 min)

### 3.1 - Actualizar Render
1. https://render.com/dashboard
2. Seleccionar `mazanga-crm-backend`
3. **Environment** → Editar `FRONTEND_URL`
4. Novo valor: `https://mazanga-crm.vercel.app` (copiar do Vercel)
5. **Save** e **Re-deploy**

Aguardar ✓ "Build successful"

---

## ✅ Testes Finais

```
1. Abrir: https://mazanga-crm.vercel.app
   ✓ Página de login aparece

2. Login com credenciais
   ✓ Dashboard carrega

3. Criar contacto
   ✓ Aparece na lista

4. Ir a Formulários → Copiar link
   ✓ Link mostra: https://mazanga-crm.vercel.app/f/<id>

5. Abrir link em aba privada
   ✓ Formulário carrega sem login (público)

6. Submeter formulário
   ✓ Contacto criado no backend
```

Se tudo passar ✓, **CRM está ao vivo!** 🎉

---

## 🔗 URLs Finais

```
Frontend:     https://mazanga-crm.vercel.app
Backend:      https://mazanga-crm-backend.onrender.com
GitHub:       github.com/mazangangunza/mazanga-crm
```

---

## 📚 Documentação Detalhada

Se tiver **problemas**:
- **Render Database Error**: Ler `RENDER_SETUP.md`
- **Vercel Root Directory**: Ler `VERCEL_SETUP.md`
- **Geral**: Ler `DEPLOYMENT.md`
- **Database Local**: Ler `DATABASE_SETUP.md`

Se tudo correr bem, não precisa ler nada! 😄

---

## 🆘 Troubleshooting Rápido

| Erro | Solução |
|------|---------|
| "Can't reach database" | Ler RENDER_SETUP.md (usar Render PostgreSQL) |
| "Root Directory só mostra backend" | Já fixo com `vercel.json`, se persistir ler VERCEL_SETUP.md |
| "CORS error" | Verificar `FRONTEND_URL` no Render = URL do Vercel |
| "API returns 401" | Logout e login novamente |
| "Formulário não carrega" | Verificar `NEXT_PUBLIC_API_URL` no Vercel |

---

## 🎯 Checklist Final

- [ ] Render backend deploy ✓
- [ ] Vercel frontend deploy ✓
- [ ] CORS configurado (FRONTEND_URL definido)
- [ ] Login funciona
- [ ] Contacto criado
- [ ] Formulário público funciona
- [ ] Links de formulário corretos
- [ ] Automações funcionam

**Parabéns! 🎉 CRM ao vivo na web!**
