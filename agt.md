# MÓDULO FATURAÇÃO AGT - ULU GESTÃO

## CONTEXTO

Estás a adicionar um módulo de Faturação Eletrónica AGT ao CRM ULU Gestão existente.

**NÃO CRIES PROJETO DO ZERO - APENAS ADICIONA este módulo ao código existente.**

## STACK TECH EXISTENTE

- Next.js 14 (App Router) + TypeScript
- Prisma ORM + Supabase PostgreSQL
- Tailwind CSS + Shadcn UI
- Deploy: Vercel

## CORES ULU

- Primary: #0A2540
- Accent: #635BFF
- Success: #10B981
- Error: #EF4444
- Background: #FFFFFF

---

## 1. ENDPOINTS OFICIAIS AGT

### URLs Base
```bash
# .env.local - ADICIONAR

# AGT - Endpoints Oficiais
AGT_API_URL_HOMOLOGACAO="https://sifphml.minfin.gov.ao/sigt/fe/v1"
AGT_API_URL_PRODUCAO="https://sifp.minfin.gov.ao/sigt/fe/v1"
AGT_API_URL="${AGT_API_URL_HOMOLOGACAO}"

# Modo
AGT_MOCK_MODE="true"
AGT_CERT_NUMBER="PENDING"

# Software
SOFTWARE_PRODUCT_ID="ULU Gestão"
SOFTWARE_VERSION="1.0.0"

# Empresa (SUBSTITUIR VALORES REAIS)
NIF_EMPRESA="5001636863"
COMPANY_NAME="Mazanga Marketing Lda"
COMPANY_ADDRESS="Luanda, Angola"
```

### 7 Serviços REST AGT

1. `POST /solicitarSerie` - Criar série numeração
2. `POST /listarSeries` - Listar séries
3. `POST /registarFatura` - Registar facturas (max 30)
4. `POST /consultarEstado` - Estado submissão
5. `POST /consultarFatura` - Consultar factura
6. `POST /listarFaturas` - Listar por período
7. `POST /validarDocumento` - Validar (adquirente)

### Códigos HTTP

- **200:** Sucesso
- **400:** Erro estrutura (E96)
- **422:** NIF inválido (E94)
- **429:** Rate limit (E98)

---

## 2. SCHEMA PRISMA

### Adicionar ao schema.prisma existente
```prisma
// ============================================
// SÉRIES DE NUMERAÇÃO
// ============================================
model Serie {
  id                    String    @id @default(cuid())
  seriesCode            String    @unique
  seriesYear            Int
  documentType          String
  firstDocumentNumber   Int       @default(1)
  lastDocumentNumber    Int?
  seriesStatus          String    @default("A")
  seriesCreationDate    DateTime  @default(now())
  invoicingMethod       String    @default("FESF")
  
  // Campos AGT obrigatórios
  establishmentNumber   Int
  seriesContingencyIndicator String @default("N")
  
  agtRequestId          String?
  agtValidationStatus   String?
  agtApprovedAt         DateTime?
  
  estabelecimentoId     String?
  estabelecimento       Estabelecimento? @relation(fields: [estabelecimentoId], references: [id])
  facturas              Factura[]
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  @@index([seriesCode, seriesYear])
  @@index([documentType, seriesStatus])
}

// ============================================
// ESTABELECIMENTOS
// ============================================
model Estabelecimento {
  id                    String    @id @default(cuid())
  nome                  String
  nif                   String
  endereco              String
  cidade                String
  provincia             String
  telefone              String?
  email                 String?
  isPrincipal           Boolean   @default(false)
  establishmentNumber   Int       @unique
  
  series                Serie[]
  facturas              Factura[]
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

// ============================================
// FACTURAS
// ============================================
model Factura {
  id                    String    @id @default(cuid())
  documentNo            String    @unique
  
  serieId               String
  serie                 Serie     @relation(fields: [serieId], references: [id])
  
  documentType          String
  documentDate          DateTime
  systemEntryDate       DateTime  @default(now())
  
  customerTaxID         String
  customerName          String
  customerCountry       String    @default("AO")
  customerAddress       String?
  
  estabelecimentoId     String
  estabelecimento       Estabelecimento @relation(fields: [estabelecimentoId], references: [id])
  
  eacCode               String?
  lines                 Json
  
  taxPayable            Decimal   @db.Decimal(15, 2)
  netTotal              Decimal   @db.Decimal(15, 2)
  grossTotal            Decimal   @db.Decimal(15, 2)
  
  currencyCode          String?
  currencyAmount        Decimal?  @db.Decimal(15, 2)
  exchangeRate          Decimal?  @db.Decimal(15, 6)
  
  withholdingTaxList    Json?
  paymentReceipt        Json?
  referenceInfo         Json?
  
  documentStatus        String    @default("N")
  documentCancelReason  String?
  
  agtSubmissionGUID     String?
  agtRequestId          String?
  agtValidationStatus   String?
  agtSubmittedAt        DateTime?
  agtValidatedAt        DateTime?
  agtErrorList          Json?
  
  jwsSignature          String    @default("PLACEHOLDER")
  
  qrCodeUrl             String
  qrCodeImage           String?
  
  isOffline             Boolean   @default(false)
  offlineEmittedAt      DateTime?
  offlineSubmittedAt    DateTime?
  
  includedInSaftPeriod  String?
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  @@index([documentNo])
  @@index([documentType, documentDate])
  @@index([customerTaxID])
  @@index([agtValidationStatus])
  @@index([isOffline])
}

// ============================================
// PRODUTOS/SERVIÇOS
// ============================================
model Produto {
  id                    String    @id @default(cuid())
  productCode           String    @unique
  productDescription    String
  unitPrice             Decimal   @db.Decimal(15, 2)
  unitOfMeasure         String
  taxType               String
  taxCode               String?
  taxPercentage         Decimal?  @db.Decimal(5, 2)
  taxExemptionCode      String?
  eacCode               String?
  isActive              Boolean   @default(true)
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  @@index([productCode])
}

// ============================================
// AUDITORIA
// ============================================
model AuditoriaEvento {
  id                    String    @id @default(cuid())
  eventType             String
  entityType            String
  entityId              String
  userId                String?
  eventData             Json?
  errorData             Json?
  ipAddress             String?
  userAgent             String?
  createdAt             DateTime  @default(now())
  
  @@index([eventType, createdAt])
  @@index([entityType, entityId])
}

// ============================================
// SAF-T
// ============================================
model SaftPeriodo {
  id                    String    @id @default(cuid())
  periodo               String    @unique
  startDate             DateTime
  endDate               DateTime
  status                String    @default("PENDING")
  xmlFilePath           String?
  xmlFileSize           Int?
  xmlGeneratedAt        DateTime?
  agtSubmittedAt        DateTime?
  agtSubmissionStatus   String?
  agtErrorData          Json?
  totalFacturas         Int       @default(0)
  totalClientes         Int       @default(0)
  totalProdutos         Int       @default(0)
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  @@index([periodo])
  @@index([status])
}

// ============================================
// CONFIGURAÇÃO
// ============================================
model ConfiguracaoFaturacao {
  id                    String    @id @default(cuid())
  privateKey            String    @default("PENDING")
  publicKey             String?
  softwareValidationNumber String? @default("PENDING")
  agtApiUrl             String    @default("https://sifphml.minfin.gov.ao/sigt/fe/v1")
  agtApiKey             String?
  contingencyMode       Boolean   @default(false)
  contingencyActivatedAt DateTime?
  maxOfflineDays        Int       @default(60)
  lastCommunicationDate DateTime?
  nextCommunicationDue  DateTime?
  isBlocked             Boolean   @default(false)
  blockedAt             DateTime?
  blockReason           String?
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

---

## 3. CLIENTE API AGT

Criar: `lib/faturacao/agt-api.ts`
```typescript
const AGT_API_URL = process.env.AGT_API_URL || 'https://sifphml.minfin.gov.ao/sigt/fe/v1';
const MOCK_MODE = process.env.AGT_MOCK_MODE === 'true';

// ============================================
// SERVIÇO 1: solicitarSerie
// ============================================
export async function solicitarSerie(
  seriesCode: string,
  seriesYear: number,
  documentType: string,
  establishmentNumber: number,
  firstDocumentNumber: number = 1
) {
  if (MOCK_MODE) {
    return {
      resultCode: 1,
      message: 'Série criada (MOCK)'
    };
  }
  
  const payload = {
    schemaVersion: "1.0",
    taxRegistrationNumber: process.env.NIF_EMPRESA,
    submissionTimeStamp: new Date().toISOString(),
    seriesCode,
    seriesYear,
    documentType,
    establishmentNumber,
    firstDocumentNumber,
    softwareInfo: {
      softwareInfoDetail: {
        productId: process.env.SOFTWARE_PRODUCT_ID || "ULU Gestão",
        productVersion: process.env.SOFTWARE_VERSION || "1.0.0",
        softwareValidationNumber: process.env.AGT_CERT_NUMBER || "PENDING"
      },
      jwsSoftwareSignature: "PLACEHOLDER"
    },
    jwsSignature: "PLACEHOLDER"
  };
  
  const response = await fetch(`${AGT_API_URL}/solicitarSerie`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(handleAGTError(error, response.status));
  }
  
  return await response.json();
}

// ============================================
// SERVIÇO 2: listarSeries
// ============================================
export async function listarSeries(params?: {
  seriesCode?: string;
  seriesYear?: number;
  documentType?: string;
  establishmentNumber?: number;
  seriesStatus?: 'A' | 'U' | 'F';
}) {
  if (MOCK_MODE) {
    return {
      resultCode: "1",
      seriesResultCount: "0",
      seriesInfo: []
    };
  }
  
  const payload = {
    schemaVersion: "1.0",
    taxRegistrationNumber: process.env.NIF_EMPRESA,
    submissionTimeStamp: new Date().toISOString(),
    ...params,
    softwareInfo: {
      softwareInfoDetail: {
        productId: process.env.SOFTWARE_PRODUCT_ID || "ULU Gestão",
        productVersion: process.env.SOFTWARE_VERSION || "1.0.0",
        softwareValidationNumber: process.env.AGT_CERT_NUMBER || "PENDING"
      },
      jwsSoftwareSignature: "PLACEHOLDER"
    },
    jwsSignature: "PLACEHOLDER"
  };
  
  const response = await fetch(`${AGT_API_URL}/listarSeries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(handleAGTError(error, response.status));
  }
  
  return await response.json();
}

// ============================================
// SERVIÇO 3: registarFatura (max 30)
// ============================================
export async function registarFatura(facturas: any[]) {
  if (MOCK_MODE) {
    return {
      requestID: `MOCK-${Date.now()}`,
      resultCode: 0
    };
  }
  
  if (facturas.length > 30) {
    throw new Error('Máximo 30 facturas por chamada');
  }
  
  const payload = {
    schemaVersion: "1.0",
    submissionGUID: crypto.randomUUID(),
    taxRegistrationNumber: process.env.NIF_EMPRESA,
    submissionTimeStamp: new Date().toISOString(),
    softwareInfo: {
      softwareInfoDetail: {
        productId: process.env.SOFTWARE_PRODUCT_ID || "ULU Gestão",
        productVersion: process.env.SOFTWARE_VERSION || "1.0.0",
        softwareValidationNumber: process.env.AGT_CERT_NUMBER || "PENDING"
      },
      jwsSoftwareSignature: "PLACEHOLDER"
    },
    numberOfEntries: facturas.length,
    documents: facturas
  };
  
  const response = await fetch(`${AGT_API_URL}/registarFatura`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(handleAGTError(error, response.status));
  }
  
  return await response.json();
}

// ============================================
// SERVIÇO 4: consultarEstado
// ============================================
export async function consultarEstado(requestID: string) {
  if (MOCK_MODE) {
    return {
      requestID,
      resultCode: 0,
      documentStatusList: []
    };
  }
  
  const payload = {
    schemaVersion: "1.0",
    taxRegistrationNumber: process.env.NIF_EMPRESA,
    submissionTimeStamp: new Date().toISOString(),
    requestID,
    softwareInfo: {
      softwareInfoDetail: {
        productId: process.env.SOFTWARE_PRODUCT_ID || "ULU Gestão",
        productVersion: process.env.SOFTWARE_VERSION || "1.0.0",
        softwareValidationNumber: process.env.AGT_CERT_NUMBER || "PENDING"
      },
      jwsSoftwareSignature: "PLACEHOLDER"
    },
    jwsSignature: "PLACEHOLDER"
  };
  
  const response = await fetch(`${AGT_API_URL}/consultarEstado`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(handleAGTError(error, response.status));
  }
  
  return await response.json();
}

// ============================================
// SERVIÇO 5: consultarFatura
// ============================================
export async function consultarFatura(documentNo: string) {
  if (MOCK_MODE) {
    return {
      statusFEResult: {
        documentNo,
        validationStatus: 'V',
        documents: []
      }
    };
  }
  
  const payload = {
    schemaVersion: "1.0",
    taxRegistrationNumber: process.env.NIF_EMPRESA,
    submissionTimeStamp: new Date().toISOString(),
    documentNo,
    softwareInfo: {
      softwareInfoDetail: {
        productId: process.env.SOFTWARE_PRODUCT_ID || "ULU Gestão",
        productVersion: process.env.SOFTWARE_VERSION || "1.0.0",
        softwareValidationNumber: process.env.AGT_CERT_NUMBER || "PENDING"
      },
      jwsSoftwareSignature: "PLACEHOLDER"
    },
    jwsSignature: "PLACEHOLDER"
  };
  
  const response = await fetch(`${AGT_API_URL}/consultarFatura`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(handleAGTError(error, response.status));
  }
  
  return await response.json();
}

// ============================================
// SERVIÇO 6: listarFaturas
// ============================================
export async function listarFaturas(queryStartDate: string, queryEndDate: string) {
  if (MOCK_MODE) {
    return {
      documentListResult: {
        documentResultCount: 0,
        documentResultList: []
      }
    };
  }
  
  const payload = {
    schemaVersion: "1.0",
    taxRegistrationNumber: process.env.NIF_EMPRESA,
    submissionTimeStamp: new Date().toISOString(),
    queryStartDate,
    queryEndDate,
    softwareInfo: {
      softwareInfoDetail: {
        productId: process.env.SOFTWARE_PRODUCT_ID || "ULU Gestão",
        productVersion: process.env.SOFTWARE_VERSION || "1.0.0",
        softwareValidationNumber: process.env.AGT_CERT_NUMBER || "PENDING"
      },
      jwsSoftwareSignature: "PLACEHOLDER"
    },
    jwsSignature: "PLACEHOLDER"
  };
  
  const response = await fetch(`${AGT_API_URL}/listarFaturas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(handleAGTError(error, response.status));
  }
  
  return await response.json();
}

// ============================================
// SERVIÇO 7: validarDocumento
// ============================================
export async function validarDocumento(
  documentNo: string,
  action: 'C' | 'R',
  deductibleVATPercentage?: number
) {
  if (MOCK_MODE) {
    return {
      statusFEResult: {
        documentNo,
        validationStatus: action === 'C' ? 'V' : 'R'
      }
    };
  }
  
  const payload = {
    schemaVersion: "1.0",
    taxRegistrationNumber: process.env.NIF_EMPRESA,
    submissionTimeStamp: new Date().toISOString(),
    documentNo,
    action,
    ...(deductibleVATPercentage && { deductibleVATPercentage }),
    softwareInfo: {
      softwareInfoDetail: {
        productId: process.env.SOFTWARE_PRODUCT_ID || "ULU Gestão",
        productVersion: process.env.SOFTWARE_VERSION || "1.0.0",
        softwareValidationNumber: process.env.AGT_CERT_NUMBER || "PENDING"
      },
      jwsSoftwareSignature: "PLACEHOLDER"
    },
    jwsSignature: "PLACEHOLDER"
  };
  
  const response = await fetch(`${AGT_API_URL}/validarDocumento`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(handleAGTError(error, response.status));
  }
  
  return await response.json();
}

// ============================================
// HELPER: Tratamento Erros AGT
// ============================================
export function handleAGTError(error: any, statusCode: number): string {
  const errors: Record = {
    'E08': 'Assinatura software inválida',
    'E39': 'Dados software divergem certificação',
    'E40': 'Assinatura chamada inválida',
    'E94': 'NIF diferente',
    'E96': 'Erro estrutura solicitação',
    'E98': 'Demasiadas solicitações'
  };
  
  if (statusCode === 200) return 'Sucesso';
  if (statusCode === 400) return errors['E96'] || 'Erro estrutura';
  if (statusCode === 422) return errors['E94'] || 'NIF inválido';
  if (statusCode === 429) return errors['E98'] || 'Rate limit';
  
  return error.descriptionError || 'Erro desconhecido';
}
```

---

## 4. TABELAS FISCAIS

Criar: `lib/faturacao/tabelas-fiscais.ts`
```typescript
// Tipos de Documento (Oficial AGT)
export const DOCUMENT_TYPES = [
  { value: 'FA', label: 'FA - Factura de Adiantamento' },
  { value: 'FT', label: 'FT - Factura' },
  { value: 'FR', label: 'FR - Factura/Recibo' },
  { value: 'FG', label: 'FG - Factura Global' },
  { value: 'GF', label: 'GF - Factura Genérica' },
  { value: 'AC', label: 'AC - Aviso de Cobrança' },
  { value: 'AR', label: 'AR - Aviso de Cobrança/Recibo' },
  { value: 'TV', label: 'TV - Talão de Venda' },
  { value: 'RC', label: 'RC - Recibo em numerário' },
  { value: 'RG', label: 'RG - Recibo Geral' },
  { value: 'RE', label: 'RE - Estorno/Recibo de Estorno' },
  { value: 'ND', label: 'ND - Nota de Débito' },
  { value: 'NC', label: 'NC - Nota de Crédito' },
  { value: 'AF', label: 'AF - Factura/Recibo Autofacturação' },
  { value: 'RP', label: 'RP - Prémio/Recibo de Prémio' },
  { value: 'RA', label: 'RA - Resseguro Aceite' },
  { value: 'CS', label: 'CS - Imputação Co-seguradoras' },
  { value: 'LD', label: 'LD - Imputação Co-seguradora Líder' }
];

// Status Série
export const SERIES_STATUS = [
  { value: 'A', label: 'Aberta' },
  { value: 'U', label: 'Em utilização' },
  { value: 'F', label: 'Fechada' }
];

// Métodos Faturação
export const INVOICING_METHODS = [
  { value: 'FEPC', label: 'Faturação Eletrónica via Portal' },
  { value: 'FESF', label: 'Faturação Eletrónica via Software' },
  { value: 'SF', label: 'Faturação não eletrónica' }
];

// Taxas IVA Angola
export const TAXAS_IVA = {
  NOR: 14,
  ISE: 0,
  OUT: 0
};

// Unidades Medida
export const UNITS_OF_MEASURE = [
  { value: 'UN', label: 'Unidade' },
  { value: 'H', label: 'Hora' },
  { value: 'KG', label: 'Quilograma' },
  { value: 'L', label: 'Litro' },
  { value: 'M', label: 'Metro' }
];
```

---

## 5. ESTRUTURA FICHEIROS
```
app/
├── api/faturacao/
│   ├── series/
│   │   ├── create/route.ts
│   │   ├── list/route.ts
│   │   └── [id]/route.ts
│   ├── facturas/
│   │   ├── create/route.ts
│   │   ├── submit/route.ts
│   │   ├── list/route.ts
│   │   ├── [id]/route.ts
│   │   └── [id]/pdf/route.ts
│   ├── produtos/
│   │   ├── create/route.ts
│   │   └── list/route.ts
│   └── saft/
│       ├── generate/route.ts
│       └── list/route.ts
├── (dashboard)/faturacao/
│   ├── page.tsx
│   ├── nova/page.tsx
│   ├── [id]/page.tsx
│   ├── series/page.tsx
│   ├── produtos/page.tsx
│   └── saft/page.tsx

components/faturacao/
├── factura-form.tsx
├── factura-table.tsx
├── cliente-autocomplete.tsx
├── produto-autocomplete.tsx
├── serie-selector.tsx
└── validation-status.tsx

lib/faturacao/
├── agt-api.ts
├── qrcode.ts
├── saft-generator.ts
├── numeracao.ts
├── validations.ts
├── contingencia.ts
└── tabelas-fiscais.ts
```

---

## 6. REQUISITOS CRÍTICOS AGT

### Numeração Inviolável
```typescript
// lib/faturacao/numeracao.ts

export async function getNextDocumentNumber(serieId: string): Promise {
  const serie = await prisma.$transaction(async (tx) => {
    const s = await tx.serie.findUnique({
      where: { id: serieId }
    });
    
    if (!s) throw new Error('Série não encontrada');
    if (s.seriesStatus === 'F') throw new Error('Série fechada');
    
    const nextNumber = (s.lastDocumentNumber || s.firstDocumentNumber - 1) + 1;
    
    await tx.serie.update({
      where: { id: serieId },
      data: {
        lastDocumentNumber: nextNumber,
        seriesStatus: 'U'
      }
    });
    
    return { ...s, lastDocumentNumber: nextNumber };
  });
  
  return `${serie.seriesCode} ${serie.seriesYear}/${serie.lastDocumentNumber}`;
}
```

### QR Code
```typescript
// lib/faturacao/qrcode.ts

import QRCode from 'qrcode';
import Jimp from 'jimp';

export async function generateQRCode(documentNo: string): Promise {
  const url = `https://portaldocontribuinte.minfin.gov.ao/consultar-fe?documentNo=${documentNo.replace(/ /g, '%20')}`;
  
  const qrBuffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'M',
    type: 'png',
    width: 350,
    margin: 1
  });
  
  const qrImage = await Jimp.read(qrBuffer);
  const logo = await Jimp.read('./public/assets/agt-logo.png');
  
  logo.resize(70, 70);
  
  const x = Math.floor((350 - 70) / 2);
  const y = Math.floor((350 - 70) / 2);
  
  qrImage.composite(logo, x, y);
  
  return await qrImage.getBase64Async(Jimp.MIME_PNG);
}
```

---

## 7. ORDEM EXECUÇÃO

1. **Adicionar schema Prisma** → `npx prisma migrate dev --name add_faturacao`
2. **Criar `lib/faturacao/tabelas-fiscais.ts`**
3. **Criar `lib/faturacao/agt-api.ts`**
4. **Criar `lib/faturacao/numeracao.ts`**
5. **Criar `lib/faturacao/qrcode.ts`**
6. **Criar API Routes** (`app/api/faturacao/**`)
7. **Criar Componentes** (`components/faturacao/**`)
8. **Criar Páginas** (`app/(dashboard)/faturacao/**`)
9. **Integração CRM** (contacto → cliente, negócio → factura)

---

## 8. REGRAS CRÍTICAS

❌ **NUNCA:**
- Apagar ou editar factura emitida
- Alterar `documentNo` depois de criar
- Permitir `DELETE` de facturas

✅ **SEMPRE:**
- Validar campos obrigatórios antes de salvar
- Registar TODAS acções em `AuditoriaEvento`
- Usar transações para numeração
- Gerar QR Code com logo AGT
- Modo MOCK por padrão (até ter credenciais AGT)

---

## 9. PRÓXIMOS PASSOS APÓS CÓDIGO

1. Testar emissão 100 facturas
2. Gerar SAF-T e validar XML
3. Descarregar logo AGT oficial
4. Solicitar acesso API AGT (apoio.agt@minfin.gov.ao)
5. Gerar chaves RSA reais
6. Implementar assinatura JWS
7. Testar em homologação AGT
8. Pedir certificação
