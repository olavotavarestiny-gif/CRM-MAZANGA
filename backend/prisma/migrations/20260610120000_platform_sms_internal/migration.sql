-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "PlatformSmsCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "segmentType" TEXT NOT NULL,
    "segmentFiltersJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "senderName" TEXT,
    "createdByUserId" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSmsCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAutomationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "conditionsJson" JSONB,
    "messageTemplate" TEXT NOT NULL,
    "senderName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSmsMessage" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ZIETT',
    "targetUserId" INTEGER NOT NULL,
    "targetAccountOwnerId" INTEGER,
    "phone" TEXT NOT NULL,
    "recipientName" TEXT,
    "message" TEXT NOT NULL,
    "senderName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "providerMessageId" TEXT,
    "providerStatus" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "triggerSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "campaignId" TEXT,
    "automationRuleId" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "rawResponseJson" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAutomationLog" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "targetUserId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "errorMessage" TEXT,
    "smsMessageId" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAutomationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformSmsCampaign_status_idx" ON "PlatformSmsCampaign"("status");

-- CreateIndex
CREATE INDEX "PlatformSmsCampaign_segmentType_idx" ON "PlatformSmsCampaign"("segmentType");

-- CreateIndex
CREATE INDEX "PlatformSmsCampaign_createdAt_idx" ON "PlatformSmsCampaign"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformAutomationRule_isActive_idx" ON "PlatformAutomationRule"("isActive");

-- CreateIndex
CREATE INDEX "PlatformAutomationRule_triggerType_idx" ON "PlatformAutomationRule"("triggerType");

-- CreateIndex
CREATE INDEX "PlatformSmsMessage_targetUserId_createdAt_idx" ON "PlatformSmsMessage"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformSmsMessage_status_idx" ON "PlatformSmsMessage"("status");

-- CreateIndex
CREATE INDEX "PlatformSmsMessage_campaignId_idx" ON "PlatformSmsMessage"("campaignId");

-- CreateIndex
CREATE INDEX "PlatformSmsMessage_automationRuleId_targetUserId_createdAt_idx" ON "PlatformSmsMessage"("automationRuleId", "targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformAutomationLog_ruleId_executedAt_idx" ON "PlatformAutomationLog"("ruleId", "executedAt");

-- CreateIndex
CREATE INDEX "PlatformAutomationLog_ruleId_targetUserId_executedAt_idx" ON "PlatformAutomationLog"("ruleId", "targetUserId", "executedAt");

-- CreateIndex
CREATE INDEX "PlatformAutomationLog_targetUserId_executedAt_idx" ON "PlatformAutomationLog"("targetUserId", "executedAt");

-- AddForeignKey
ALTER TABLE "PlatformSmsMessage" ADD CONSTRAINT "PlatformSmsMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PlatformSmsCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSmsMessage" ADD CONSTRAINT "PlatformSmsMessage_automationRuleId_fkey" FOREIGN KEY ("automationRuleId") REFERENCES "PlatformAutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAutomationLog" ADD CONSTRAINT "PlatformAutomationLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PlatformAutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
