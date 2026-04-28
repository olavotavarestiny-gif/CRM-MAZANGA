# Supabase Auth

## Estado atual

Supabase Auth é a base da autenticação do KukuGest e não deve ser tratado como detalhe secundário.

## Onde está no código

- `frontend/src/lib/supabase/`
- `frontend/src/lib/auth.ts`
- `frontend/src/middleware.ts`
- `backend/src/middleware/auth.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/account.js`
- `backend/src/routes/admin.js`
- `backend/src/routes/superadmin.js`

## Papel da integração

- login e gestão de sessão no frontend
- validação do JWT no backend
- resolução do utilizador interno do CRM
- operações administrativas com service role
- reset de password e linking de identidade quando aplicável

## Envs relevantes

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Observações importantes

- o backend continua a ser a fonte de verdade das permissões e do contexto real do utilizador
- o Supabase autentica, mas não substitui o modelo interno de `User`
- rotas administrativas usam cliente Supabase admin lazy-loaded no backend
