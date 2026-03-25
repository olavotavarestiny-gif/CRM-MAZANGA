# Deployment

Este documento cobre o deploy recomendado para o estado atual do projeto:

- backend em Render
- frontend em Vercel
- PostgreSQL acessível por `DATABASE_URL`
- autenticação Supabase

## Visão geral

```text
Vercel  -> frontend Next.js
Render  -> backend Express
DB      -> PostgreSQL
Auth    -> Supabase
```

## Backend no Render

### Configuração do serviço

- Root directory: `backend`
- Runtime: `Node`
- Build command: `npm install && npm run build`
- Start command: `npm start`

`npm run build` no backend já executa `prisma generate` e `prisma db push`.

### Variáveis obrigatórias

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `DATABASE_URL` | sim | PostgreSQL acessível pelo Render |
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | usada em operações administrativas |
| `JWT_SECRET` | sim | usado para impersonation tokens |
| `FRONTEND_URL` | sim | origem do frontend em produção |

### Variáveis opcionais por módulo

| Grupo | Variáveis |
|-------|-----------|
| CORS preview | `ALLOWED_VERCEL_URL` |
| Bootstrap temporário | `SETUP_SECRET` |
| Super admin | `SUPER_ADMIN_EMAIL` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WEBHOOK_VERIFY_TOKEN`, `WABA_ID` |
| Google Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `FRONTEND_CALENDAR_URL` |
| AGT | `AGT_API_URL`, `AGT_MOCK_MODE`, `AGT_CERT_NUMBER`, `SOFTWARE_PRODUCT_ID`, `SOFTWARE_VERSION`, `NIF_EMPRESA`, `COMPANY_NAME` |

## Frontend no Vercel

O projeto já tem `vercel.json` preparado para construir a app dentro de `frontend`.

### Configuração do projeto

- Framework: Next.js
- Build command: usar o definido no repositório
- Output directory: usar o definido no repositório

### Variáveis obrigatórias

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `NEXT_PUBLIC_API_URL` | sim | URL pública do backend |
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL pública do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | anon key do Supabase |

### Variáveis opcionais

| Variável | Observação |
|----------|------------|
| `UPSTASH_REDIS_REST_URL` | rate limit no frontend |
| `UPSTASH_REDIS_REST_TOKEN` | rate limit no frontend |

## Ordem recomendada

1. criar ou validar a base PostgreSQL
2. fazer deploy do backend com todas as variáveis obrigatórias
3. obter a URL pública do backend
4. fazer deploy do frontend apontando para essa URL e para o Supabase
5. atualizar `FRONTEND_URL` no backend se o domínio final mudar

## Verificações pós-deploy

Depois do deploy, validar:

1. `GET /health` no backend responde `{"status":"ok"}`
2. a página `/login` abre
3. o login carrega a sessão e redireciona
4. uma rota autenticada como `/contacts` responde normalmente
5. um formulário público em `/f/[id]` abre sem autenticação

## Erros comuns

### `401` após login

Verifique:

- `SUPABASE_URL` no backend
- `NEXT_PUBLIC_SUPABASE_URL` no frontend
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` no frontend
- se frontend e backend apontam para o mesmo projeto Supabase

`JWT_SECRET` não controla o login normal do Supabase. Ele só é relevante para tokens de impersonation.

### CORS `Not allowed by CORS`

Verifique:

- `FRONTEND_URL` com o domínio exato do frontend
- `ALLOWED_VERCEL_URL` se quiser liberar uma URL específica do Vercel

### Build do backend falha

Teste localmente:

```bash
cd backend
npm install
npm run build
```

### Build do frontend falha

Teste localmente:

```bash
cd frontend
npm install
npm run build
```
