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

### Variáveis obrigatórias

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `DATABASE_URL` | sim | PostgreSQL acessível pelo Render |
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
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WEBHOOK_VERIFY_TOKEN`, `WABA_ID` |
| WhatsApp API | `WHATSAPP_API_VERSION` |
| Google Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `FRONTEND_CALENDAR_URL`, `GOOGLE_TOKEN_ENCRYPTION_KEY`, `GOOGLE_WEBHOOK_ADDRESS` |
| AGT | `AGT_API_URL`, `AGT_MOCK_MODE`, `AGT_CERT_NUMBER`, `SOFTWARE_PRODUCT_ID`, `SOFTWARE_VERSION`, `NIF_EMPRESA`, `COMPANY_NAME` |
| Lead público Mazanga | `MAZANGA_WEBHOOK_SECRET`, `MAZANGA_LEAD_OWNER_EMAIL` |
| SMS/Ziett | `ZIETT_ENABLE`, `ZIETT_BASE_URL`, `ZIETT_API_KEY`, `ZIETT_DEFAULT_REMITTER_ID`, `ZIETT_DEFAULT_CHANNEL`, `ZIETT_DEFAULT_COUNTRY`, `ZIETT_TEST_ALLOWED_RECIPIENTS` |

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
| `CRON_SECRET` | sim | segredo usado pelo Vercel Cron para manter o backend acordado |

### Variáveis opcionais

| Variável | Observação |
|----------|------------|
| `UPSTASH_REDIS_REST_URL` | rate limit no frontend |
| `UPSTASH_REDIS_REST_TOKEN` | rate limit no frontend |
| `BLOB_READ_WRITE_TOKEN` | uploads via Vercel Blob |

## Ordem recomendada

1. criar ou validar a base PostgreSQL
2. fazer deploy do backend com todas as variáveis obrigatórias
3. obter a URL pública do backend
4. fazer deploy do frontend apontando para essa URL e para o Supabase
5. atualizar `FRONTEND_URL` no backend se o domínio final mudar

## Verificações pós-deploy

Depois do deploy, validar:

1. `GET /health` no backend responde `{"status":"ok"}`
2. `GET /api/health` no backend responde `{"status":"ok"}`
3. `GET /api/auth/diagnostics` responde sem expor tokens, passwords ou connection strings
4. a página `/login` abre
5. o login carrega a sessão e redireciona
6. uma rota autenticada como `/contacts` responde normalmente
7. um formulário público em `/f/[id]` abre sem autenticação
8. um upload de anexo/avatar/fatura funciona se `BLOB_READ_WRITE_TOKEN` estiver configurado
9. `POST /api/public/lead` devolve `201` ou `200` com `MAZANGA_LEAD_OWNER_EMAIL` configurado para um utilizador real
10. `GET /api/ready` no backend responde `{"status":"ready"}` quando a base está acessível
11. o endpoint `/api/backend-warmup` responde `200` com `CRON_SECRET` configurado

## Performance da API

### Pool de ligações à base de dados (crítico)

A `DATABASE_URL` deve **limitar explicitamente** o pool do Prisma. Sem limite, o Prisma
abre ligações até esgotar o `max_connections` do Postgres sob carga real (cada página
do CRM dispara várias queries em paralelo), causando filas e o sintoma "demora a ligar /
fica sem servidor". Acrescentar à `DATABASE_URL` no painel do Render:

```text
?sslmode=require&connection_limit=<N>&pool_timeout=20&connect_timeout=10
```

- `connection_limit = (max_connections do plano Postgres − margem) ÷ nº de instâncias web`.
  Confirmar o `max_connections` do plano (`SHOW max_connections;`) e quantas instâncias web
  correm (se houver autoscaling, dividir o budget por elas).
- Se o Render expuser um endpoint de **pooler/PgBouncer**, usar esse host em vez do host
  direto (`dpg-...-a.frankfurt-postgres.render.com`).
- Deixar sempre folga de ligações para migrações (`db:migrate:deploy`) e acesso de admin.

### Readiness vs liveness na monitorização

O monitor externo (UptimeRobot) deve apontar para **`GET /api/ready`** (executa `SELECT 1`
na base de dados), **não** para `/health` (que responde "alive" sem tocar na DB). Caso
contrário, se as ligações de DB esgotarem, o monitor fica falso-verde enquanto os
utilizadores estão bloqueados. Recomendado: 1 monitor em `/api/ready` (readiness real) e
1 monitor leve em `/health` (liveness do processo), para distinguir os dois casos.

### Warmup

O endpoint `/api/backend-warmup` valida o segredo `CRON_SECRET` e chama `/api/ready` no backend para manter o serviço Render e a ligação Prisma aquecidos.

O projeto Vercel está em plano Hobby, que bloqueia crons mais frequentes que uma vez por dia. Para warmup a cada 10 minutos, use Render sem sleep ou um monitor externo que chame `https://SEU_FRONTEND/api/backend-warmup` com header `Authorization: Bearer CRON_SECRET`.

Quando este release for para produção, execute no backend:

```bash
npm run db:migrate:deploy
```

## Checklist beta

Antes de abrir a beta a utilizadores reais:

- `NODE_ENV=production` no Render
- `BYPASS_AUTH` ausente ou `false`
- `SETUP_SECRET` removido depois do bootstrap, ou mantido como segredo forte
- `AGT_MOCK_MODE=true` enquanto a integração fiscal não estiver certificada para produção real
- `MAZANGA_LEAD_OWNER_EMAIL` aponta para o dono correcto da organização que deve receber leads públicos
- `FRONTEND_URL` no backend é exactamente a origem do Vercel/domínio final
- `NEXT_PUBLIC_API_URL` no frontend é exactamente a URL pública do Render, sem chave Supabase

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

### Build do frontend falha

Teste localmente:

```bash
cd frontend
npm install
npm run build
```
