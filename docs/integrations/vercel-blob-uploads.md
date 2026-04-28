# Vercel Blob Uploads

## Estado atual

Os uploads do frontend usam Vercel Blob com acesso público.

## Onde está no código

- `frontend/src/lib/storage.ts`
- `frontend/src/app/api/upload/route.ts`

## Capacidades atuais

- upload de ficheiros
- remoção por URL
- listagem por pasta

## Pastas usadas atualmente

- `avatars`
- `attachments`
- `invoices`

## Env relevante

- `BLOB_READ_WRITE_TOKEN`

## Observações importantes

- o token é exigido no frontend para o helper atual de uploads
- os ficheiros são publicados com `access: public`
- o nome do ficheiro é sanitizado antes de gerar o pathname final
