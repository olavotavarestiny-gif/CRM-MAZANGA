# WhatsApp Cloud API

## Estado atual

O projeto já comunica com a WhatsApp Cloud API via Meta Graph para envio de mensagens e leitura de templates aprovados.

## Onde está no código

- `backend/src/lib/whatsapp.js`
- `backend/src/routes/whatsapp.js`
- `backend/src/routes/webhook.js`
- `backend/src/routes/send.js`
- `backend/src/services/automationRunner.js`

## Capacidades atuais

- envio de mensagem de texto
- envio de template WhatsApp
- leitura de templates aprovados
- receção de webhook inbound com tratamento MVP de mensagens de texto
- uso da integração em automações e envios manuais

## Envs relevantes

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_API_VERSION`
- `WABA_ID`
- `WEBHOOK_VERIFY_TOKEN`

## Superfície atual

- `GET /api/whatsapp/templates`
- `GET /api/webhook` para challenge de verificação Meta
- `POST /api/webhook` para receção de eventos inbound

## Limitações atuais

- o webhook trata apenas mensagens de texto no fluxo MVP
- media, templates inbound complexos e outras mensagens não estão documentados como fluxo maduro
- o webhook atual cria contacto por telefone quando ainda não existe e grava a mensagem inbound
