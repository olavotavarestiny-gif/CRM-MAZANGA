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

Para a lista completa e atualizada das envs do projeto, consultar [environment.md](environment.md).

Se a base remota exigir SSL, acrescente `?sslmode=require` ao `DATABASE_URL`.

Em produção no Render:

- use uma única `DATABASE_URL` completa fornecida pelo Render Postgres
- não reconstrua a ligação a partir de variáveis parciais
- para serviços e base na mesma região/workspace, prefira a Render Internal Database URL

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
npm run db:migrate:deploy
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
- usar `prisma db push` apenas para desenvolvimento/local quando fizer sentido
- não usar `prisma db push --accept-data-loss` no arranque de produção
- para releases com migrations, usar `npm run db:migrate:deploy` separadamente do start do backend
- confirmar sempre que a base local é diferente da base de produção

## Problemas comuns

### `P1001: Can't reach database server`

Verifique:

- se a `DATABASE_URL` é a URL completa e correta do Render/PostgreSQL
- host, porta e credenciais no `DATABASE_URL`
- VPN, firewall ou whitelist de IP
- se a instância remota aceita conexões externas
- no Render, se backend e base estão na mesma workspace e região para usar a Internal Database URL

### `relation does not exist`

Em desenvolvimento, sincronize o schema:

```bash
cd backend
npm run db:push
```

Em produção, aplique migrations:

```bash
cd backend
npm run db:migrate:deploy
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
