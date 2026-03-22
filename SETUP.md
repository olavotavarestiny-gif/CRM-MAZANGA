# ULU Gestão — Guia de Setup Beta

Guia rápido para configurar e fazer deploy do ULU Gestão em produção.

---

## 1. Pré-requisitos

- Node.js 18+
- Conta [Vercel](https://vercel.com) (frontend)
- Conta [Render](https://render.com) (backend + PostgreSQL)
- Domínio configurado (ex: `app.ulu.ao`, `api.ulu.ao`)
- Conta [Upstash](https://upstash.com) (rate limiting — opcional)

---

## 2. Base de Dados (Render PostgreSQL)

1. No Render, criar um serviço **PostgreSQL**
2. Copiar o `DATABASE_URL` (formato `postgresql://...`)
3. No backend: `cd backend && npx prisma db push`

---

## 3. Backend (Render Web Service)

### Variáveis de ambiente no Render

| Variável | Valor |
|---|---|
| `DATABASE_URL` | URL do PostgreSQL do Render |
| `JWT_SECRET` | String aleatória longa (`openssl rand -hex 64`) |
| `FRONTEND_URL` | `https://app.ulu.ao` |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `noreply@mazanga.digital` |
| `SMTP_PASS` | Password do Hostinger |
| `SMTP_FROM` | `ULU Gestão <noreply@mazanga.digital>` |
| `NIF_EMPRESA` | NIF da empresa |
| `COMPANY_NAME` | Nome da empresa |
| `AGT_MOCK_MODE` | `true` (até obter credenciais AGT reais) |
| `AGT_CERT_NUMBER` | `PENDING` |

### Deploy

- **Build command**: `npm install && npx prisma generate`
- **Start command**: `node src/index.js`
- **Health check**: `/health`

---

## 4. Frontend (Vercel)

### Variáveis de ambiente no Vercel

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.ulu.ao` |
| `UPSTASH_REDIS_REST_URL` | URL do Upstash (opcional) |
| `UPSTASH_REDIS_REST_TOKEN` | Token do Upstash (opcional) |

### Deploy

```bash
cd frontend
npm install
npm run build   # verificar sem erros
vercel --prod
```

Ou ligar o repositório ao Vercel para deploy automático em cada push.

---

## 5. Rate Limiting (Upstash — Opcional)

1. Criar conta em [upstash.com](https://upstash.com)
2. Criar database Redis (região Frankfurt recomendada)
3. Copiar `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`
4. Adicionar ao Vercel como env vars

Se não configurado, o rate limiting fica desactivado mas tudo funciona normalmente.

---

## 6. Primeiro Login

1. Aceder a `https://app.ulu.ao/login`
2. Usar as credenciais de admin criadas via:
   ```bash
   cd backend
   node scripts/create-admin.js
   ```
3. Ir a **Configurações > Empresa & AGT** e preencher:
   - NIF da empresa
   - Nome da empresa
   - Morada
   - Logotipo (opcional)

---

## 7. Configurar Faturação AGT

1. Aceder a **Configurações > Empresa & AGT**
2. Criar pelo menos um **Estabelecimento** com NIF válido
3. Criar uma **Série de Numeração** para o tipo FT (Factura) e ano corrente
4. Activar **Modo Mock AGT** até obter certificação real

---

## 8. Checklist de Testes Beta

### Páginas públicas
- [ ] `/termos` abre sem login
- [ ] `/privacidade` abre sem login
- [ ] `/manutencao` abre com animação (ícone a rodar)
- [ ] Footer visível nas 3 páginas acima

### Autenticação
- [ ] Login com credenciais correctas → redireciona para dashboard
- [ ] Login com credenciais erradas → mensagem de erro
- [ ] Rate limit: 5 logins rápidos com credenciais erradas → mensagem de bloqueio temporário
- [ ] Logout → redireciona para `/login`
- [ ] Recuperação de password por email funciona

### CRM
- [ ] Criar contacto com nome + email
- [ ] Editar contacto
- [ ] Adicionar tag a contacto
- [ ] Pipeline: mover card entre colunas

### Faturação
- [ ] Criar factura com pelo menos 1 linha
- [ ] `documentNo` gerado sequencialmente (ex: `FT 2026/1`)
- [ ] Exportar PDF → ficheiro descarrega corretamente
- [ ] Anular factura → pede motivo; status muda para "ANULADA"
- [ ] SAF-T: gerar XML para mês actual

### Finanças
- [ ] Criar transacção (receita e despesa)
- [ ] Gráficos carregam sem erro

### Segurança
- [ ] Tentar aceder a `/admin` sem ser admin → redireciona
- [ ] Tentar aceder a `/finances` como membro (sem ser owner) → redireciona
- [ ] API sem token → `401 Unauthorized`

---

## 9. Domínios Recomendados

| Serviço | Domínio |
|---|---|
| Frontend | `app.ulu.ao` |
| Backend API | `api.ulu.ao` |
| Status | `status.ulu.ao` |

---

## 10. Suporte

- Email: suporte@mazanga.digital
- Privacidade: privacidade@mazanga.digital
