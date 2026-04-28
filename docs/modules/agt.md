# Módulo AGT

## Objetivo

O projeto já contém um módulo de faturação orientado para os requisitos AGT. Este ficheiro documenta o estado real do módulo, não um plano de implementação.

## O que existe no código

### Backend

- cliente AGT em `backend/src/lib/faturacao/agt-api.js`
- validações, numeração, QR code, PDF e SAF-T em `backend/src/lib/faturacao`
- rotas em `backend/src/routes/faturacao-*.js`

### Frontend

- páginas em `frontend/src/app/faturacao`
- componentes em `frontend/src/components/faturacao`

## Capacidades atuais

- configuração de faturação por utilizador
- estabelecimentos
- séries documentais
- clientes de faturação
- catálogo de produtos
- emissão de faturas
- faturas recorrentes
- exportação SAF-T

## Variáveis de ambiente relevantes

```env
AGT_API_URL=https://sifphml.minfin.gov.ao/sigt/fe/v1
AGT_MOCK_MODE=true
AGT_CERT_NUMBER=PENDING
SOFTWARE_PRODUCT_ID=KukuGest
SOFTWARE_VERSION=1.0.0
NIF_EMPRESA=5000123456
COMPANY_NAME=Sua Empresa
```

## Modos de operação

### Modo mock

É o modo mais seguro para desenvolvimento e demos.

- `AGT_MOCK_MODE=true`
- o cliente AGT devolve respostas simuladas
- não exige integração real com a AGT

### Modo real

Para submissão real, além das variáveis acima, o projeto precisa de credenciais e assinatura válidas.

## Limitação importante

No estado atual do código, a parte de assinatura segura ainda está marcada com `PLACEHOLDER` em `backend/src/lib/faturacao/agt-api.js`. Isso significa:

- o módulo funciona para modelação interna, PDFs, SAF-T e fluxo mock
- a integração fiscal real precisa de endurecimento antes de ser tratada como pronta para produção regulatória

## Endpoints AGT modelados no cliente

- `solicitarSerie`
- `listarSeries`
- `registarFatura`
- `consultarEstado`
- `consultarFatura`
- `listarFaturas`
- `validarDocumento`

## Recomendações

- usar `AGT_MOCK_MODE=true` em ambientes de desenvolvimento
- só ativar chamadas reais depois de validar assinatura, certificados e regras fiscais
- documentar separadamente qualquer adaptação regulatória feita para produção
