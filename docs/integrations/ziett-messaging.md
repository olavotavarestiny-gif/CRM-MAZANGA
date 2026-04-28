# Ziett Messaging

## Estado atual

Esta integração já tem base funcional no código, mas está em rollout controlado e deve ser tratada como funcionalidade em evolução.

## Onde está no código

- `backend/src/services/ziett.service.js`
- `backend/src/services/messaging-admin.service.js`
- `backend/src/routes/superadmin-messaging.js`
- `frontend/src/components/superadmin/messaging-section.tsx`
- `frontend/src/lib/api.ts`

## Capacidades atuais

- validar campanhas batch antes de envio
- enviar campanhas batch
- listar campanhas
- obter detalhe e sincronizar campanhas
- listar mensagens
- obter detalhe e sincronizar mensagens
- enviar mensagem individual de teste

## Envs relevantes

- `ZIETT_ENABLE`
- `ZIETT_BASE_URL`
- `ZIETT_API_KEY`
- `ZIETT_DEFAULT_CHANNEL`
- `ZIETT_DEFAULT_COUNTRY`
- `ZIETT_TEST_ALLOWED_RECIPIENTS`

## Regras e proteções já existentes

- a integração pode ser desligada por ambiente com `ZIETT_ENABLE`
- o serviço falha com erro explícito quando `ZIETT_API_KEY` não existe
- o envio de testes depende de allowlist em `ZIETT_TEST_ALLOWED_RECIPIENTS`
- o canal e o país por defeito vêm do ambiente, não do frontend
- os erros do provider são normalizados no backend antes de chegar à UI

## Superfície atual de API

- `POST /api/superadmin/messaging/campaigns/validate`
- `POST /api/superadmin/messaging/campaigns/send`
- `GET /api/superadmin/messaging/campaigns`
- `GET /api/superadmin/messaging/campaigns/:id`
- `POST /api/superadmin/messaging/campaigns/:id/sync`
- `GET /api/superadmin/messaging/messages`
- `GET /api/superadmin/messaging/messages/:id`
- `POST /api/superadmin/messaging/messages/:id/sync`
- `POST /api/superadmin/messaging/test/send-single`

## Limitações atuais

- o rollout está orientado a uso administrativo, não a uso geral por toda a conta
- a documentação funcional do produto ainda deve assumir esta área como controlada
- a integração depende fortemente de envs corretas e da allowlist de teste
