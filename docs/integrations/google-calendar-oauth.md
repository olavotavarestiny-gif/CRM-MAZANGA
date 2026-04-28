# Google Calendar OAuth

Este documento cobre o estado atual da integração Google Calendar no KukuGest e o material necessário para verificação OAuth quando aplicável.

## Estado atual no código

- integração por utilizador, não partilhada pelo owner da conta
- ligação iniciada no backend e consumida pelo frontend do calendário
- suporte a conectar, consultar estado e desligar a integração
- bloqueio explícito durante impersonation
- tokens Google guardados no backend e usados para sincronização posterior

Ficheiros centrais:

- `backend/src/lib/google-calendar.js`
- `backend/src/routes/calendar.js`
- `frontend/src/app/calendario/page.tsx`
- `frontend/src/app/settings/calendar/page.tsx`

## Variáveis relevantes

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `FRONTEND_CALENDAR_URL`

## Fluxo atual

1. O frontend pede ao backend a URL de autorização Google.
2. O backend gera `state` assinado e devolve a `authUrl`.
3. O utilizador autoriza a conta Google.
4. O callback é processado no backend e os tokens ficam associados ao utilizador autenticado.
5. O calendário interno passa a poder sincronizar dados do Google Calendar desse utilizador.
6. O utilizador pode desligar a integração e o backend limpa tokens, watches e referências sincronizadas.

## Escopos finais

Usar apenas:

- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/userinfo.email`

## Descrição curta da app

`KukuGest liga o Google Calendar do utilizador autenticado ao calendário interno do CRM, permitindo visualizar, sincronizar e gerir eventos associados à agenda do utilizador dentro da conta.`

## Justificação dos escopos

### `calendar`

`O KukuGest usa este escopo para visualizar os calendários e eventos disponíveis do utilizador autenticado e suportar operações de sincronização e gestão de agenda ligadas ao CRM.`

### `calendar.events`

`O KukuGest usa este escopo para criar, actualizar e gerir eventos do Google Calendar quando a funcionalidade do produto exigir edição de compromissos associados ao utilizador autenticado.`

### `userinfo.email`

`O KukuGest usa este escopo para identificar a conta Google ligada e mostrar ao utilizador qual email está conectado à integração Google Calendar.`

## O que a home page pública deve mostrar

- nome KukuGest
- descrição clara da funcionalidade CRM
- menção explícita à integração Google Calendar com visualização e gestão de eventos
- link para política de privacidade
- link para termos de serviço
- contacto de suporte

## O que a política de privacidade deve cobrir

- que dados Google são lidos e, quando aplicável, editados
- como os dados são usados no produto
- como os tokens são protegidos
- com quem os dados podem ser partilhados
- como o utilizador pode desligar a integração

## Guião mínimo do vídeo de submissão

1. Abrir a página do calendário no KukuGest.
2. Mostrar o botão de ligar Google Calendar.
3. Clicar em conectar e mostrar a consent screen em inglês.
4. Mostrar na barra do navegador que o pedido pertence ao client ID correcto.
5. Mostrar que os escopos pedidos permitem visualizar e editar eventos, além de identificar o email ligado.
6. Autorizar a conta Google.
7. Voltar ao KukuGest e mostrar o estado conectado.
8. Clicar em sincronizar.
9. Mostrar os eventos externos reflectidos no calendário interno.
10. Explicar no vídeo que a app pode necessitar gerir eventos do utilizador dentro do fluxo do calendário integrado.

## Antes de submeter

- verificar domínio no Google Search Console
- confirmar homepage e privacy policy públicas no mesmo domínio
- rever support email e developer contact no Google Auth Platform
- garantir que os redirect URIs autorizados estão correctos
- confirmar que os scopes configurados no Google Cloud são exactamente os usados no código
