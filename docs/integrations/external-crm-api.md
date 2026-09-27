# API externa de contactos e vendas

Esta API permite integrar aplicações externas com uma única conta KukuGest. Cada chave pertence a uma conta, é guardada apenas como hash e pode ser desactivada sem afectar outras integrações.

## Configuração do cliente

```env
KUKUGEST_API_URL=https://crm-mazanga.onrender.com/api/integrations/v1
KUKUGEST_API_KEY=kg_live_EXEMPLO
```

Envie a chave no header `X-API-Key` ou em `Authorization: Bearer <chave>`.

## Validar ligação

```http
GET /status
X-API-Key: kg_live_EXEMPLO
```

## Criar ou actualizar contacto

```http
POST /contacts
Content-Type: application/json
X-API-Key: kg_live_EXEMPLO

{
  "name": "Ana Manuel",
  "phone": "+244923000000",
  "email": "ana@example.com",
  "company": "Empresa Exemplo",
  "tags": ["website", "campanha-setembro"],
  "customFields": { "origem": "Outra aplicação" }
}
```

`name` e `phone` são obrigatórios. O telefone é a chave de deduplicação dentro da conta: repetir o pedido actualiza o mesmo contacto.

## Registar venda concluída

```http
POST /sales
Content-Type: application/json
X-API-Key: kg_live_EXEMPLO

{
  "externalId": "pedido-8472",
  "title": "Venda do pacote Fest GO",
  "valueKz": 150000,
  "companyName": "Consumidor Final",
  "source": "Outra aplicação",
  "closedAt": "2026-09-27T14:00:00Z",
  "contact": { "name": "Ana Manuel", "phone": "+244923000000", "email": "ana@example.com" }
}
```

`valueKz` é obrigatório. `externalId` deve ser o identificador estável da venda na aplicação de origem; pedidos repetidos com o mesmo valor devolvem a venda já criada. A venda é registada como negócio ganho no CRM e ligada ao contacto. Este endpoint não emite factura fiscal.

## Códigos principais

- `200`: registo já existente ou contacto actualizado.
- `201`: contacto ou venda criado.
- `400`: payload inválido.
- `401`: chave ausente, inválida, expirada ou desactivada.
- `402`: conta suspensa.
- `403`: âmbito da chave insuficiente ou limite do plano atingido.
