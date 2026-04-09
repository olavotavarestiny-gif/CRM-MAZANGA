CREATE TABLE "MessagingCampaign" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ZIETT',
    "providerCampaignId" TEXT,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "channelType" TEXT NOT NULL DEFAULT 'SMS',
    "remitterId" TEXT NOT NULL,
    "countryAlpha2" TEXT NOT NULL DEFAULT 'AO',
    "requestedRecipientsCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedRecipientsCount" INTEGER NOT NULL DEFAULT 0,
    "invalidRecipientsCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateRecipientsCount" INTEGER NOT NULL DEFAULT 0,
    "optedOutRecipientsCount" INTEGER NOT NULL DEFAULT 0,
    "notAllowedRecipientsCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerStatus" TEXT,
    "triggerSource" TEXT NOT NULL DEFAULT 'SUPERADMIN_PANEL',
    "createdByUserId" INTEGER NOT NULL,
    "createdByEmail" TEXT NOT NULL,
    "accountOwnerId" INTEGER,
    "workspaceMode" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT true,
    "statusNote" TEXT,
    "providerErrorCode" TEXT,
    "providerErrorMessage" TEXT,
    "providerTraceId" TEXT,
    "rawRequestJson" JSONB,
    "rawResponseJson" JSONB,
    "sentAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessagingCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "phoneOriginal" TEXT NOT NULL,
    "phoneNormalized" TEXT,
    "contactId" INTEGER,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerMessageId" TEXT,
    "providerStatus" TEXT,
    "channelDestination" TEXT,
    "cost" DOUBLE PRECISION,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "rawProviderJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingCampaignRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessagingMessageLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ZIETT',
    "providerMessageId" TEXT,
    "campaignId" TEXT,
    "campaignRecipientId" TEXT,
    "content" TEXT NOT NULL,
    "phoneOriginal" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "contactId" INTEGER,
    "channelType" TEXT NOT NULL DEFAULT 'SMS',
    "remitterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerStatus" TEXT,
    "channelDestination" TEXT,
    "cost" DOUBLE PRECISION,
    "triggerSource" TEXT NOT NULL DEFAULT 'SUPERADMIN_PANEL',
    "createdByUserId" INTEGER NOT NULL,
    "createdByEmail" TEXT NOT NULL,
    "isTest" BOOLEAN NOT NULL DEFAULT true,
    "providerErrorCode" TEXT,
    "providerErrorMessage" TEXT,
    "providerTraceId" TEXT,
    "rawRequestJson" JSONB,
    "rawResponseJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingMessageLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessagingOptOut" (
    "id" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingOptOut_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessagingOptOut_phoneNormalized_key" ON "MessagingOptOut"("phoneNormalized");

CREATE INDEX "MessagingCampaign_createdAt_idx" ON "MessagingCampaign"("createdAt");
CREATE INDEX "MessagingCampaign_status_createdAt_idx" ON "MessagingCampaign"("status", "createdAt");
CREATE INDEX "MessagingCampaign_providerCampaignId_idx" ON "MessagingCampaign"("providerCampaignId");
CREATE INDEX "MessagingCampaign_createdByUserId_idx" ON "MessagingCampaign"("createdByUserId");

CREATE INDEX "MessagingCampaignRecipient_campaignId_createdAt_idx" ON "MessagingCampaignRecipient"("campaignId", "createdAt");
CREATE INDEX "MessagingCampaignRecipient_phoneNormalized_idx" ON "MessagingCampaignRecipient"("phoneNormalized");
CREATE INDEX "MessagingCampaignRecipient_providerMessageId_idx" ON "MessagingCampaignRecipient"("providerMessageId");

CREATE INDEX "MessagingMessageLog_createdAt_idx" ON "MessagingMessageLog"("createdAt");
CREATE INDEX "MessagingMessageLog_status_createdAt_idx" ON "MessagingMessageLog"("status", "createdAt");
CREATE INDEX "MessagingMessageLog_providerMessageId_idx" ON "MessagingMessageLog"("providerMessageId");
CREATE INDEX "MessagingMessageLog_campaignId_idx" ON "MessagingMessageLog"("campaignId");
CREATE INDEX "MessagingMessageLog_campaignRecipientId_idx" ON "MessagingMessageLog"("campaignRecipientId");

CREATE INDEX "MessagingOptOut_isActive_idx" ON "MessagingOptOut"("isActive");

ALTER TABLE "MessagingCampaignRecipient"
ADD CONSTRAINT "MessagingCampaignRecipient_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "MessagingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessagingMessageLog"
ADD CONSTRAINT "MessagingMessageLog_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "MessagingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MessagingMessageLog"
ADD CONSTRAINT "MessagingMessageLog_campaignRecipientId_fkey"
FOREIGN KEY ("campaignRecipientId") REFERENCES "MessagingCampaignRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
