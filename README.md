# Mazanga CRM

CRM simples para agência de marketing com integração WhatsApp via Meta Cloud API.

## Stack

- **Backend**: Node.js + Express + Prisma ORM + SQLite
- **Frontend**: Next.js 14 (App Router) + React + Tailwind + Shadcn/ui
- **WhatsApp**: Meta Cloud API (Graph API v19.0)

## Funcionalidades MVP

1. ✅ CRUD de contactos (nome, email, phone, empresa, serviço, stage)
2. ✅ Webhook para receber mensagens WhatsApp
3. ✅ Enviar mensagens WhatsApp via API
4. ✅ Formulário público para capturar leads
5. ✅ Dashboard com stats e pipeline Kanban
6. ✅ Inbox WhatsApp com histórico de conversas
7. ✅ Automações (enviar template ao criar contacto)

## Estrutura do Projeto

```
mazanga-crm/
├── backend/              # API REST (Node.js/Express)
│   ├── src/
│   │   ├── index.js     # Entry point
│   │   ├── lib/         # Utilitários (Prisma, WhatsApp)
│   │   ├── routes/      # Endpoints
│   │   └── services/    # Lógica de negócio
│   ├── prisma/          # Schema e seed
│   ├── package.json
│   ├── .env.example
│   └── dev.db
├── frontend/            # Next.js 14 App
│   ├── src/
│   │   ├── app/         # Páginas e layouts
│   │   ├── components/  # Componentes React
│   │   └── lib/         # API client e tipos
│   ├── package.json
│   ├── .env.local.example
│   └── tailwind.config.ts
└── README.md
```

## Setup Rápido

### 1. Backend

```bash
cd backend
npm install
npx prisma db push       # Criar banco de dados
node prisma/seed.js     # Dados de teste (opcional)
npm run dev             # Servidor em http://localhost:3001
```

Variáveis de ambiente necessárias em `.env`:
- `WHATSAPP_PHONE_NUMBER_ID` - ID do número de telefone no Meta
- `WHATSAPP_ACCESS_TOKEN` - Token de acesso permanente
- `WEBHOOK_VERIFY_TOKEN` - Token para verificação de webhook

### 2. Frontend

```bash
cd frontend
npm install
npm run dev             # Servidor em http://localhost:3000
```

Variáveis de ambiente necessárias em `.env.local`:
- `NEXT_PUBLIC_API_URL=http://localhost:3001`

## Configurar WhatsApp Webhook

1. Obter credenciais no [Meta Developer Dashboard](https://developers.facebook.com)
2. Criar aplicação e configurar WhatsApp Cloud API
3. Para desenvolvimento local, usar **ngrok**:
   ```bash
   ngrok http 3001
   # Copiar URL https gerada
   ```
4. No Dashboard Meta > Webhooks, configurar:
   - **Callback URL**: `https://seu-ngrok-url/api/webhook`
   - **Verify Token**: mesmo valor de `WEBHOOK_VERIFY_TOKEN` em `.env`
5. Testar webhook clicando "Verify and Save"

## Endpoints da API

### Contactos
- `GET /api/contacts` - Listar (com filtros `?stage=` e `?search=`)
- `POST /api/contacts` - Criar
- `GET /api/contacts/:id` - Detalhe com mensagens
- `PUT /api/contacts/:id` - Atualizar
- `DELETE /api/contacts/:id` - Apagar

### Mensagens
- `GET /api/messages/:contactId` - Histórico
- `POST /api/send` - Enviar `{ contactId, text }`

### WhatsApp Webhook
- `GET /api/webhook` - Meta verification challenge
- `POST /api/webhook` - Receber mensagens inbound

### Automações
- `GET /api/automations` - Listar
- `POST /api/automations` - Criar `{ trigger, action, templateName }`
- `PUT /api/automations/:id` - Atualizar
- `DELETE /api/automations/:id` - Apagar

## Páginas Frontend

- `/dashboard` - Stats + Kanban por stage
- `/contacts` - Tabela de contactos com CRUD
- `/contacts/[id]` - Detalhe + chat
- `/inbox` - Histórico de conversas WhatsApp
- `/automations` - CRUD de automações
- `/form` - Formulário público (sem autenticação)

## Stages de Contacto

- **LEAD** - Novo contacto
- **PROSPECT** - Interessado
- **CLIENT** - Contratado
- **INACTIVE** - Inativo

## Features

### Dashboard
- Cards com contadores (leads este mês, prospects, clientes)
- Kanban board com colunas por stage
- Mudança de stage via dropdown

### Contactos
- Pesquisa por nome/telefone/empresa
- Filtro por stage
- Criar/editar/apagar contactos
- Ver conversas do contacto

### Inbox WhatsApp
- Lista de conversas
- Chat em tempo real com polling 5s
- Enviar mensagens de texto

### Automações
- Disparar template WhatsApp ao criar contacto
- Toggle ativo/inativo
- Gerenciar templates

### Formulário Público
- Página sem autenticação para capturar leads
- URL compartilhável em anúncios/WhatsApp
- Integração com automações

## Notas de Desenvolvimento

### Prisma
```bash
# Sincronizar schema com DB
npx prisma db push

# Abrir Prisma Studio (GUI)
npm run db:studio

# Rodar seed com dados de teste
npm run db:seed
```

### Desenvolvimento
- Frontend auto-recarrega com `next dev`
- Backend recarrega com `nodemon`
- React Query faz polling de messages a cada 5s

### Deploy
- Backend: Vercel, Heroku, Railway, etc
- Frontend: Vercel, Netlify, etc
- Database: Migrar de SQLite para PostgreSQL mudando apenas `datasource` em `prisma/schema.prisma`

## Roadmap Futuro

- [ ] Autenticação de utilizadores
- [ ] WebSockets para inbox em tempo real
- [ ] Relatórios e analytics
- [ ] Múltiplas contas WhatsApp
- [ ] Integrações com ferramentas de email
- [ ] Agendamento de mensagens
- [ ] Tags e categorias para contactos
- [ ] Sistema de notas/anotações
- [ ] Atribuição de contactos a utilizadores

## Troubleshooting

**Erro ao conectar ao banco:**
```bash
rm backend/dev.db
npx prisma db push
```

**Webhook não recebe mensagens:**
- Verificar se ngrok está rodando
- Confirmar Verify Token no Meta Dashboard
- Ver logs: `curl -X GET "http://localhost:3001/health"`

**Frontend não conecta ao backend:**
- Confirmar `NEXT_PUBLIC_API_URL` em `.env.local`
- Verificar CORS em `backend/src/index.js`
- Backend rodando em porta 3001?

## Licença

MIT
