# ✅ Deploy Checklist — CRM Mazanga

## Status: PRONTO PARA DEPLOY ✅

### Backend (Node.js/Express + Prisma)
- [x] Schema migrado: SQLite → PostgreSQL
- [x] CORS actualizado para aceitar `FRONTEND_URL` env var
- [x] Prisma Client gerado com sucesso (`npx prisma generate`)
- [x] Todas as dependências instaladas (`npm install` no backend)
- [x] Environment variables configuradas (`.env`)
- [x] Build verificado localmente (sem erros)

### Frontend (Next.js 14)
- [x] Build completo: `npm run build` — 16 páginas, zero erros
- [x] Form links usam `window.location.origin` (automático em produção)
- [x] Variáveis de ambiente: `NEXT_PUBLIC_API_URL` (será definida no Vercel)
- [x] Todas as páginas compilam com sucesso

### Configuração de Produção
- [x] Supabase PostgreSQL criada e acessível
- [x] Git repository contém todo o código
- [x] `DEPLOYMENT.md` com instruções passo a passo
- [x] JWT_SECRET novo e forte gerado
- [x] Credenciais sensíveis não comitadas (apenas em `.env` ignorado)

### Recursos Externos
- [x] GitHub: Código comitado em `main`
- [x] Supabase: PostgreSQL pronto (URL: `db.zvpywxfwtkciakyurrcp.supabase.co`)
- [x] Vercel: Conta conectada ao GitHub
- [x] Render: Pronto para conectar GitHub

---

## Próximos Passos (Manual via UI)

### 1️⃣ Render — Deploy Backend

**Acesso**: https://render.com

**Passo 1**: New Web Service
- Conectar GitHub
- Seleccionar `mazanga-crm`

**Passo 2**: Configuração
| Campo | Valor |
|-------|-------|
| Name | `mazanga-crm-backend` |
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm install && npx prisma generate && npx prisma db push` |
| Start Command | `node src/index.js` |

**Passo 3**: Environment Variables
Copiar da tabela em `DEPLOYMENT.md` (13 variáveis):
- `DATABASE_URL` (Supabase PostgreSQL)
- `JWT_SECRET` (87c2c9ae...)
- `WHATSAPP_*` (valores do `.env`)
- `SMTP_*` (valores do `.env`)
- `FRONTEND_URL` (deixar vazio por agora)

**Passo 4**: Deploy
- Click "Deploy"
- Esperar por ✓ "Build successful"
- **Copiar URL**: ex. `https://mazanga-crm-backend.onrender.com`

---

### 2️⃣ Vercel — Deploy Frontend

**Acesso**: https://vercel.com

**Passo 1**: Add New Project
- Click "Import GitHub Repository"
- Seleccionar `mazanga-crm`

**Passo 2**: Configuração
| Campo | Valor |
|-------|-------|
| Framework | Next.js (auto-detectado) |
| Root Directory | `frontend` |
| Build Command | `npm run build` (automático) |

**Passo 3**: Environment Variables
| Variável | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | URL do Render acima (ex. `https://mazanga-crm-backend.onrender.com`) |

**Passo 4**: Deploy
- Click "Deploy"
- Esperar por ✓ "Deployment completed"
- **Copiar URL**: ex. `https://mazanga-crm.vercel.app`

---

### 3️⃣ Render — Actualizar CORS

**Acesso**: https://render.com/dashboard

**Passo 1**: Seleccionar `mazanga-crm-backend`

**Passo 2**: Environment
- Editar `FRONTEND_URL`
- Valor novo: URL do Vercel acima (ex. `https://mazanga-crm.vercel.app`)
- Click "Save"

**Passo 3**: Manual Deploy
- Click "Re-deploy"
- Esperar por ✓ "Build successful"

---

## Verificação Final

✅ **Checklist de Testes**

1. **Frontend Load**
   - [ ] Abrir `https://mazanga-crm.vercel.app`
   - [ ] Ecrã de login aparece

2. **Authentication**
   - [ ] Login com utilizador existente funciona
   - [ ] Dashboard carrega após login

3. **Contactos**
   - [ ] Criar novo contacto
   - [ ] Contacto aparece na lista
   - [ ] Editar contacto funciona
   - **Prova**: Database Supabase está conectada

4. **Formulários Públicos**
   - [ ] Ir a "Formulários"
   - [ ] Copiar link de um formulário
   - [ ] Abrir link em aba private/incognito
   - [ ] Formulário carrega **sem login** (público)
   - [ ] Submeter formulário
   - [ ] Contacto criado no backend

5. **Automações**
   - [ ] Criar automação: "Se faturação = '- 50 Milhões De Kwanzas' → Mover para Qualificado"
   - [ ] Criar novo contacto com essa faturação
   - [ ] Verificar que contacto move automaticamente para "Qualificado"
   - [ ] Verificar logs do Render para confirmar execução

6. **Mensagens & Tasks**
   - [ ] Criar task para um contacto
   - [ ] Task aparece em `/tasks`
   - [ ] Filtros funcionam (Todas/Hoje/Atrasadas)

---

## Recursos de Troubleshooting

Se algo não funcionar:

**CORS Error** → Backend não reconhece domínio do Vercel
- Verificar: Render → `FRONTEND_URL` = URL Vercel exacta
- Redeploy backend

**Database Connection Failed** → Backend não consegue ligar ao Supabase
- Verificar: `DATABASE_URL` está correcto em Render
- Confirmar que Supabase projeto está activo

**"401 Unauthorized"** → Token JWT inválido
- Ambos devem usar mesmo `JWT_SECRET`
- Logout e login novamente

**Build Falha** → Erro de compilação no Render/Vercel
- Render: Ver logs "Build & Deploy"
- Vercel: Ver aba "Deployments"
- Confirmar que `package.json` tem todas as dependências

---

## Credenciais & Segurança

⚠️ **Importante**: Nunca commitá:
- `backend/.env` (credenciais sensíveis)
- `frontend/.env.local` (API URLs)

✅ **Seguro em repositório**:
- `DEPLOYMENT.md` (instruções públicas)
- `backend/prisma/schema.prisma` (configuração)
- `backend/src/` (código)

✅ **Armazenado em plataformas**:
- Render: Environment variables (secreto)
- Vercel: Environment variables (secreto)
- Supabase: Password no dashboard

---

## Datas & Prazos
- **Criado**: 2026-03-17
- **Status**: ✅ Pronto para deploy
- **Próximo**: Seguir checklist acima

---

## Contactos de Suporte
- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
