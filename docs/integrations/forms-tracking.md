# Tracking de Formulários

## Estado atual

Os formulários públicos suportam tracking client-side com Meta Pixel e Google Tag, configurados por formulário.

## Onde está no código

- `backend/src/routes/forms.js`
- `frontend/src/app/forms/[id]/edit/page.tsx`
- `frontend/src/app/f/[id]/page.tsx`
- `frontend/src/lib/types.ts`

## O que é configurável por formulário

- ativar ou desativar Meta Pixel
- guardar `metaPixelId`
- ativar ou desativar Google Tag
- guardar `googleTagId`
- controlar se o submit dispara evento de lead

## Validação atual no backend

- `metaPixelId` aceita apenas dígitos
- `googleTagId` aceita formatos `G-`, `GTM-` e `AW-`
- se o tracking estiver ativo, o respetivo ID é obrigatório

## Comportamento atual no frontend público

- quando o Meta Pixel está ativo, o formulário injeta o script do Pixel e faz `PageView`
- quando o Google Tag está ativo, o formulário injeta o script e configura `gtag`
- no submit com sucesso:
  - o Meta Pixel dispara `Lead`
  - o Google Tag dispara `generate_lead`

## Observações importantes

- esta integração é client-side; não existe Conversions API nesta fase
- o tracking está embebido no formulário público, não no backend
- no editor de formulários, o separador de tracking está condicionado ao workspace `servicos`
