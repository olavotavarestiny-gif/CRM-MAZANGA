# Database Setup

## Estado real do projeto

O backend usa Prisma com `provider = "postgresql"` em `backend/prisma/schema.prisma`. Isso significa:

- PostgreSQL é obrigatório em desenvolvimento e produção
- `backend/dev.db` não faz parte do fluxo atual
- qualquer documentação antiga que mencionava SQLite deixou de ser válida

## Estratégia recomendada

Use um destes cenários para desenvolvimento:

1. PostgreSQL local com Docker
2. PostgreSQL remoto de desenvolvimento
3. A mesma instância usada pela equipa, se o acesso estiver controlado

## Configuração mínima

Em `backend/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=generate-a-long-random-secret
FRONTEND_URL=http://localhost:3000
```

Se a base remota exigir SSL, acrescente `?sslmode=require` ao `DATABASE_URL`.

## Fluxo local recomendado

```bash
cd backend
npm install
npm run db:push
npm run dev
```

Comandos úteis:

```bash
npm run db:push
npm run db:studio
```

## Exemplo com Docker

```bash
docker run --name kukugest-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=kukugest \
  -p 5432:5432 \
  -d postgres:16
```

Depois configure:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kukugest
```

## Boas práticas

- não comitar `backend/.env`
- não usar credenciais reais em documentação
- não assumir que `prisma db push` em produção substitui um processo de migração formal para sempre
- confirmar sempre que a base local é diferente da base de produção

## Problemas comuns

### `P1001: Can't reach database server`

Verifique:

- host, porta e credenciais no `DATABASE_URL`
- VPN, firewall ou whitelist de IP
- se a instância remota aceita conexões externas

### `relation does not exist`

Sincronize o schema:

```bash
cd backend
npm run db:push
```

### `PrismaClientInitializationError`

Quase sempre é uma destas causas:

- `DATABASE_URL` inválido
- base de dados desligada
- SSL exigido mas ausente na connection string

## Resumo

- o projeto já não usa SQLite
- o ficheiro `backend/dev.db` pode ser tratado como legado
- a fonte de verdade é o `schema.prisma`, e ele está configurado para PostgreSQL
