# Environment Variables

Este documento organiza as variáveis de ambiente do projeto por aplicação e por integração.

## Ficheiros usados

- `backend/.env`: variáveis privadas do backend
- `frontend/.env.local`: variáveis do frontend e rotas server-side do Next.js
- `.env.example`: modelo único de referência

## Regra prática

- se a variável começa com `NEXT_PUBLIC_`, ela pertence ao frontend e fica exposta ao bundle do browser
- se não começa com `NEXT_PUBLIC_`, trate como privada e mantenha fora do browser
- segredos reais nunca devem ser comitados

## Backend

### Core

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `PORT` | não | default local `3001` |
| `NODE_ENV` | não | útil para distinguir desenvolvimento e produção |
| `DATABASE_URL` | sim | PostgreSQL completo |
| `FRONTEND_URL` | sim | origem principal do frontend |
| `ALLOWED_VERCEL_URL` | não | origin adicional para preview/CORS |

### Auth e conta

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `SUPABASE_URL` | sim | projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | service role para operações administrativas |
| `JWT_SECRET` | sim | impersonation e state assinado |
| `SUPER_ADMIN_EMAIL` | não | email de referência do super admin |
| `SETUP_SECRET` | não | bootstrap inicial protegido |

### Email

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `SMTP_HOST` | não | necessário se o módulo de email estiver ativo |
| `SMTP_PORT` | não | ex: `465` |
| `SMTP_USER` | não | utilizador SMTP |
| `SMTP_PASS` | não | password SMTP |
| `SMTP_FROM` | não | remetente padrão |

### WhatsApp Cloud API

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `WHATSAPP_ACCESS_TOKEN` | não | token da Meta |
| `WHATSAPP_API_VERSION` | não | ex: `v21.0` |
| `WHATSAPP_PHONE_NUMBER_ID` | não | phone number id |
| `WEBHOOK_VERIFY_TOKEN` | não | challenge do webhook Meta |
| `WABA_ID` | não | usado para templates |

### Google Calendar

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `GOOGLE_CLIENT_ID` | não | necessária para OAuth |
| `GOOGLE_CLIENT_SECRET` | não | necessária para OAuth |
| `GOOGLE_REDIRECT_URI` | não | callback registado no Google |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | não | cifra dos tokens Google |
| `FRONTEND_CALENDAR_URL` | não | override do destino frontend do calendário |
| `GOOGLE_WEBHOOK_ADDRESS` | não | override explícito do endereço de webhook/watch |

### AGT

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `AGT_API_URL` | não | endpoint AGT |
| `AGT_MOCK_MODE` | não | `true` em dev por defeito |
| `AGT_CERT_NUMBER` | não | número de validação/certificação |
| `SOFTWARE_PRODUCT_ID` | não | id do software |
| `SOFTWARE_VERSION` | não | versão reportada |
| `NIF_EMPRESA` | não | NIF fiscal |
| `COMPANY_NAME` | não | nome da empresa |

### Ziett

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `ZIETT_ENABLE` | não | liga/desliga a integração por ambiente |
| `ZIETT_BASE_URL` | não | default `https://api.ziett.co` |
| `ZIETT_API_KEY` | não | chave de acesso ao provider |
| `ZIETT_DEFAULT_CHANNEL` | não | ex: `SMS` |
| `ZIETT_DEFAULT_COUNTRY` | não | ex: `AO` |
| `ZIETT_TEST_ALLOWED_RECIPIENTS` | não | allowlist de teste |

## Frontend

### Core público

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `NEXT_PUBLIC_API_URL` | sim | URL pública do backend |
| `NEXT_PUBLIC_APP_URL` | sim | URL pública do frontend |
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL pública do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | anon key pública |

### Serviços do frontend

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `BLOB_READ_WRITE_TOKEN` | não | necessária para uploads com Vercel Blob |
| `UPSTASH_REDIS_REST_URL` | não | rate limit |
| `UPSTASH_REDIS_REST_TOKEN` | não | rate limit |

## Notas importantes

- `BLOB_READ_WRITE_TOKEN` está a ser usado pelo frontend e pelas rotas Next.js do próprio frontend
- `JWT_SECRET` não substitui o login normal do Supabase
- `GOOGLE_TOKEN_ENCRYPTION_KEY` e `GOOGLE_WEBHOOK_ADDRESS` estavam ausentes da documentação antiga e passaram a estar documentados aqui
- `WHATSAPP_API_VERSION` também passa a ser parte da referência oficial porque é usada diretamente na construção das URLs da Meta
