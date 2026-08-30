-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "jobTitle" TEXT,
    "supabaseUid" TEXT,
    "passwordHash" TEXT NOT NULL DEFAULT 'SUPABASE_AUTH',
    "resetToken" TEXT,
    "resetExpiry" TIMESTAMP(3),
    "role" TEXT NOT NULL DEFAULT 'user',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "plan" TEXT NOT NULL DEFAULT 'essencial',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "accountOwnerId" INTEGER,
    "assignedEstabelecimentoId" TEXT,
    "workspaceMode" TEXT NOT NULL DEFAULT 'servicos',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "nif" TEXT,
    "revenue" TEXT,
    "sector" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'Novo',
    "inPipeline" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "customFields" TEXT NOT NULL DEFAULT '{}',
    "contactType" TEXT NOT NULL DEFAULT 'interessado',
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "clienteType" TEXT NOT NULL DEFAULT 'particular',
    "documents" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactNote" (
    "id" SERIAL NOT NULL,
    "contactId" INTEGER NOT NULL,
    "userId" INTEGER,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactFieldDef" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7e9a',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactFieldConfig" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContactFieldConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "contactId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "subject" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "assignedToUserId" INTEGER,
    "contactId" INTEGER,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'Media',
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "formId" TEXT,
    "trigger" TEXT NOT NULL,
    "triggerValue" TEXT,
    "action" TEXT NOT NULL,
    "targetStage" TEXT,
    "templateName" TEXT,
    "emailSubject" TEXT,
    "emailBody" TEXT,
    "taskTitle" TEXT,
    "taskNotes" TEXT,
    "taskPriority" TEXT,
    "taskDueDays" INTEGER,
    "taskAssignedToUserId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'step',
    "thankYouUrl" TEXT,
    "brandColor" TEXT,
    "bgColor" TEXT,
    "logoUrl" TEXT,
    "metaPixelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "metaPixelId" TEXT,
    "googleTagEnabled" BOOLEAN NOT NULL DEFAULT false,
    "googleTagId" TEXT,
    "trackSubmitAsLead" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "options" TEXT,
    "contactField" TEXT,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "contactId" INTEGER,
    "contactSyncStatus" TEXT NOT NULL DEFAULT 'skipped',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fieldId" TEXT,
    "fieldLabel" TEXT,
    "contactField" TEXT,
    "value" TEXT NOT NULL,

    CONSTRAINT "FormAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "clientId" INTEGER,
    "clientName" TEXT,
    "type" TEXT NOT NULL,
    "revenueType" TEXT,
    "contractDurationMonths" INTEGER,
    "nextPaymentDate" TIMESTAMP(3),
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "description" TEXT,
    "amountKz" DOUBLE PRECISION NOT NULL,
    "currencyOrigin" TEXT NOT NULL DEFAULT 'KZ',
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pago',
    "receiptNumber" TEXT,
    "notes" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialCategory" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategories" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarToken" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "googleEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estabelecimento" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "nif" TEXT NOT NULL,
    "defaultSerieId" TEXT,
    "morada" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "isPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Estabelecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Serie" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "seriesCode" TEXT NOT NULL,
    "seriesYear" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL,
    "firstDocumentNumber" INTEGER NOT NULL DEFAULT 1,
    "lastDocumentNumber" INTEGER,
    "seriesStatus" TEXT NOT NULL DEFAULT 'A',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Serie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteFaturacao" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "customerTaxID" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerAddress" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "contactId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteFaturacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdutoCategoria" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT DEFAULT '#6b7e9a',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProdutoCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "productCode" TEXT NOT NULL,
    "productDescription" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION,
    "productType" TEXT NOT NULL DEFAULT 'S',
    "sku" TEXT,
    "barcode" TEXT,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'UN',
    "taxPercentage" DOUBLE PRECISION NOT NULL DEFAULT 14,
    "taxCode" TEXT NOT NULL DEFAULT 'NOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER DEFAULT 0,
    "stockMinimo" INTEGER DEFAULT 0,
    "categoriaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "newStock" INTEGER NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "createdByUserId" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "documentNo" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "documentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentStatus" TEXT NOT NULL DEFAULT 'N',
    "documentCancelReason" TEXT,
    "customerTaxID" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerAddress" TEXT,
    "clienteFaturacaoId" TEXT,
    "lines" TEXT NOT NULL,
    "netTotal" DOUBLE PRECISION NOT NULL,
    "taxPayable" DOUBLE PRECISION NOT NULL,
    "grossTotal" DOUBLE PRECISION NOT NULL,
    "qrCodeUrl" TEXT,
    "qrCodeImage" TEXT,
    "hashCode" TEXT,
    "hashControl" TEXT,
    "jwsSignature" TEXT NOT NULL DEFAULT 'PLACEHOLDER',
    "agtRequestId" TEXT,
    "agtValidationStatus" TEXT NOT NULL DEFAULT 'P',
    "agtSubmittedAt" TIMESTAMP(3),
    "currencyCode" TEXT NOT NULL DEFAULT 'AOA',
    "currencyAmount" DOUBLE PRECISION,
    "exchangeRate" DOUBLE PRECISION,
    "paymentMethod" TEXT NOT NULL DEFAULT 'Transferência Bancária',
    "isOffline" BOOLEAN NOT NULL DEFAULT false,
    "offlineEmittedAt" TIMESTAMP(3),
    "offlineSubmittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "caixaSessaoId" TEXT,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaixaSessao" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "openedByUserId" INTEGER NOT NULL,
    "closedByUserId" INTEGER,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingCountedAmount" DOUBLE PRECISION,
    "expectedClosingAmount" DOUBLE PRECISION,
    "differenceAmount" DOUBLE PRECISION,
    "totalSalesAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "totalCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMulticaixa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTransferencia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaixaSessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaftPeriodo" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "xmlContent" TEXT,
    "totalFacturas" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaftPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditoriaEvento" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventData" TEXT,
    "errorData" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaRecorrente" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "serieId" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "clienteFaturacaoId" TEXT,
    "customerTaxID" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerAddress" TEXT,
    "documentType" TEXT NOT NULL DEFAULT 'FT',
    "lines" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'AOA',
    "exchangeRate" DOUBLE PRECISION,
    "paymentMethod" TEXT NOT NULL DEFAULT 'Transferência Bancária',
    "frequency" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "nextRunDate" TIMESTAMP(3) NOT NULL,
    "lastRunDate" TIMESTAMP(3),
    "lastFacturaId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalGenerated" INTEGER NOT NULL DEFAULT 0,
    "maxOccurrences" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacturaRecorrente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoFaturacao" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "nifEmpresa" TEXT NOT NULL DEFAULT '',
    "nomeEmpresa" TEXT NOT NULL DEFAULT '',
    "moradaEmpresa" TEXT NOT NULL DEFAULT '',
    "iban" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "agtMockMode" BOOLEAN NOT NULL DEFAULT true,
    "agtCertNumber" TEXT NOT NULL DEFAULT 'PENDING',
    "contingencyMode" BOOLEAN NOT NULL DEFAULT false,
    "contingencyActivatedAt" TIMESTAMP(3),
    "defaultSerieId" TEXT,
    "defaultEstabelecimentoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoFaturacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatChannel" (
    "id" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'channel',
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatChannelMember" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "ChatChannelMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "senderId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "mentions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseUid_key" ON "User"("supabaseUid");

-- CreateIndex
CREATE INDEX "User_assignedEstabelecimentoId_idx" ON "User"("assignedEstabelecimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_userId_phone_key" ON "Contact"("userId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "ContactFieldDef_userId_key_key" ON "ContactFieldDef"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_userId_name_key" ON "PipelineStage"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ContactFieldConfig_userId_fieldKey_key" ON "ContactFieldConfig"("userId", "fieldKey");

-- CreateIndex
CREATE INDEX "Task_assignedToUserId_idx" ON "Task"("assignedToUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_type_category_key" ON "FinancialCategory"("type", "category");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarToken_userId_key" ON "GoogleCalendarToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Serie_userId_seriesCode_seriesYear_documentType_key" ON "Serie"("userId", "seriesCode", "seriesYear", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "ClienteFaturacao_userId_customerTaxID_key" ON "ClienteFaturacao"("userId", "customerTaxID");

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoCategoria_userId_nome_key" ON "ProdutoCategoria"("userId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_userId_productCode_key" ON "Produto"("userId", "productCode");

-- CreateIndex
CREATE UNIQUE INDEX "Factura_userId_documentNo_key" ON "Factura"("userId", "documentNo");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoFaturacao_userId_key" ON "ConfiguracaoFaturacao"("userId");

-- CreateIndex
CREATE INDEX "ChatChannel_orgId_idx" ON "ChatChannel"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatChannelMember_channelId_userId_key" ON "ChatChannelMember"("channelId", "userId");

-- CreateIndex
CREATE INDEX "ChatMessage_channelId_createdAt_idx" ON "ChatMessage"("channelId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accountOwnerId_fkey" FOREIGN KEY ("accountOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedEstabelecimentoId_fkey" FOREIGN KEY ("assignedEstabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginLog" ADD CONSTRAINT "LoginLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactFieldDef" ADD CONSTRAINT "ContactFieldDef_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactFieldConfig" ADD CONSTRAINT "ContactFieldConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAnswer" ADD CONSTRAINT "FormAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAnswer" ADD CONSTRAINT "FormAnswer_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FormField"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarToken" ADD CONSTRAINT "GoogleCalendarToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estabelecimento" ADD CONSTRAINT "Estabelecimento_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estabelecimento" ADD CONSTRAINT "Estabelecimento_defaultSerieId_fkey" FOREIGN KEY ("defaultSerieId") REFERENCES "Serie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Serie" ADD CONSTRAINT "Serie_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Serie" ADD CONSTRAINT "Serie_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteFaturacao" ADD CONSTRAINT "ClienteFaturacao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoCategoria" ADD CONSTRAINT "ProdutoCategoria_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "ProdutoCategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Serie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_clienteFaturacaoId_fkey" FOREIGN KEY ("clienteFaturacaoId") REFERENCES "ClienteFaturacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_caixaSessaoId_fkey" FOREIGN KEY ("caixaSessaoId") REFERENCES "CaixaSessao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaixaSessao" ADD CONSTRAINT "CaixaSessao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaixaSessao" ADD CONSTRAINT "CaixaSessao_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaixaSessao" ADD CONSTRAINT "CaixaSessao_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaixaSessao" ADD CONSTRAINT "CaixaSessao_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaftPeriodo" ADD CONSTRAINT "SaftPeriodo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaRecorrente" ADD CONSTRAINT "FacturaRecorrente_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaRecorrente" ADD CONSTRAINT "FacturaRecorrente_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Serie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaRecorrente" ADD CONSTRAINT "FacturaRecorrente_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaRecorrente" ADD CONSTRAINT "FacturaRecorrente_clienteFaturacaoId_fkey" FOREIGN KEY ("clienteFaturacaoId") REFERENCES "ClienteFaturacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfiguracaoFaturacao" ADD CONSTRAINT "ConfiguracaoFaturacao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatChannelMember" ADD CONSTRAINT "ChatChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatChannelMember" ADD CONSTRAINT "ChatChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
