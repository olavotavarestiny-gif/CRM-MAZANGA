# Integrações

Este diretório concentra as integrações externas reais do KukuGest e o estado atual de cada uma no código.

## Catálogo atual

- [google-calendar-oauth.md](google-calendar-oauth.md): integração Google Calendar por utilizador, com OAuth e sincronização
- [ziett-messaging.md](ziett-messaging.md): integração de campanhas e mensagens via Ziett, em rollout controlado
- [forms-tracking.md](forms-tracking.md): tracking dos formulários públicos com Meta Pixel e Google Tag
- [whatsapp-cloud-api.md](whatsapp-cloud-api.md): integração com WhatsApp Cloud API via Meta Graph
- [supabase-auth.md](supabase-auth.md): autenticação da aplicação com Supabase Auth
- [vercel-blob-uploads.md](vercel-blob-uploads.md): uploads públicos com Vercel Blob

## Leitura recomendada

1. Ler este índice para perceber o mapa das integrações.
2. Ler o documento específico da integração que vai ser revista.
3. Confirmar as variáveis em `.env.example`.
4. Validar as rotas e serviços referidos no código antes de qualquer alteração.

## Nota de enquadramento

O módulo AGT não aparece aqui porque, neste repositório, funciona como domínio nuclear do produto e está documentado em [../modules/agt.md](../modules/agt.md), não como integração acessória.
