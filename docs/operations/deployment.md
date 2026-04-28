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
- Start command: `node src/index.js`

`npm run build` no backend deve executar apenas `prisma generate`.
Não usar `prisma db push` no build nem no start command de produção.

### Base de dados no Render

- Defina `DATABASE_URL` com a connection string completa copiada diretamente do Render Postgres.
- Não monte a ligação a partir de `DB_HOST`, `DB_NAME`, `DB_PORT` ou variáveis parciais.
- Para backend e PostgreSQL no mesmo workspace/região, prefira a **Render Internal Database URL**.
- Se o host no log parecer truncado ou incompleto, volte a copiar a URL completa a partir do dashboard do Render.

### Migrations em produção

- Fluxo normal de arranque do backend:
  - build: `npm install && npm run build`
  - start: `node src/index.js`
- Quando um deploy incluir migrations Prisma, execute separadamente:

```bash
cd backend
npm run db:migrate:deploy
```

- Não usar `prisma db push --accept-data-loss` em produção.
- Não sincronizar schema em cada restart do serviço web.

### Variáveis obrigatórias

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `DATABASE_URL` | sim | URL completa do Render Postgres, preferencialmente a Internal Database URL |
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | usada em operações administrativas |
| `JWT_SECRET` | sim | usado para impersonation tokens |
| `FRONTEND_URL` | sim | origem completa do frontend em produção, por exemplo `https://app.kukugest.ao` |

### Variáveis opcionais por módulo

| Grupo | Variáveis |
|-------|-----------|
| CORS preview | `ALLOWED_VERCEL_URL` |
| Bootstrap temporário | `SETUP_SECRET` |
| Super admin | `SUPER_ADMIN_EMAIL` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION`, `WHATSAPP_PHONE_NUMBER_ID`, `WEBHOOK_VERIFY_TOKEN`, `WABA_ID` |
| Google Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_TOKEN_ENCRYPTION_KEY`, `FRONTEND_CALENDAR_URL`, `GOOGLE_WEBHOOK_ADDRESS` |
| AGT | `AGT_API_URL`, `AGT_MOCK_MODE`, `AGT_CERT_NUMBER`, `SOFTWARE_PRODUCT_ID`, `SOFTWARE_VERSION`, `NIF_EMPRESA`, `COMPANY_NAME` |
| Ziett | `ZIETT_ENABLE`, `ZIETT_BASE_URL`, `ZIETT_API_KEY`, `ZIETT_DEFAULT_CHANNEL`, `ZIETT_DEFAULT_COUNTRY`, `ZIETT_TEST_ALLOWED_RECIPIENTS` |

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
| `NEXT_PUBLIC_APP_URL` | sim | origem pública do frontend, por exemplo `https://app.kukugest.ao` |
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL pública do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | anon key do Supabase |

### Variáveis opcionais

| Variável | Observação |
|----------|------------|
| `BLOB_READ_WRITE_TOKEN` | uploads no frontend com Vercel Blob |
| `UPSTASH_REDIS_REST_URL` | rate limit no frontend |
| `UPSTASH_REDIS_REST_TOKEN` | rate limit no frontend |

Para referência completa e agrupada por domínio, ver também [../setup/environment.md](../setup/environment.md).

## Ordem recomendada

1. criar ou validar a base PostgreSQL
2. copiar a `DATABASE_URL` completa a partir do Render Postgres
3. fazer deploy do backend com todas as variáveis obrigatórias
4. se o release tiver migrations Prisma, correr `npm run db:migrate:deploy` separadamente
5. obter a URL pública do backend
6. fazer deploy do frontend apontando para essa URL e para o Supabase
7. atualizar `FRONTEND_URL` no backend se o domínio final mudar

## Verificações pós-deploy

Depois do deploy, validar:

1. `GET /health` no backend responde `{"status":"ok"}`
2. os logs mostram `Prisma client initialized`
3. os logs mostram `Backend started`
4. os logs mostram o mapa de presença das env vars essenciais sem expor segredos
5. quando a base responder, os logs mostram `Prisma database connection ready`
6. a página `/login` abre
7. o login carrega a sessão e redireciona
8. uma rota autenticada como `/contacts` responde normalmente
9. um formulário público em `/f/[id]` abre sem autenticação

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

- `FRONTEND_URL` com a origem exata do frontend, por exemplo `https://app.kukugest.ao`
- `ALLOWED_VERCEL_URL` se quiser liberar uma URL específica do Vercel, com ou sem protocolo

### Build do backend falha

Teste localmente:

```bash
cd backend
npm install
npm run build
```

Se a falha vier de `P1001`, confirme primeiro se o Render service está a usar a `DATABASE_URL` completa e correta.

### Build do frontend falha

Teste localmente:

```bash
cd frontend
npm install
npm run build
```
