-- Account access duration / billing gating
ALTER TABLE "User"
  ADD COLUMN "billingType" TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "graceEndsAt" TIMESTAMP(3),
  ADD COLUMN "accountStatus" TEXT NOT NULL DEFAULT 'active';

CREATE INDEX "User_accountStatus_idx" ON "User"("accountStatus");
CREATE INDEX "User_expiresAt_idx" ON "User"("expiresAt");
CREATE INDEX "User_trialEndsAt_idx" ON "User"("trialEndsAt");

-- Onboarding v2 scoping without deleting previous progress rows.
ALTER TABLE "OnboardingProgress"
  ADD COLUMN "flow_key" TEXT NOT NULL DEFAULT 'onboarding_legacy',
  ADD COLUMN "reopened_at" TIMESTAMP(3);

DROP INDEX IF EXISTS "OnboardingProgress_organization_id_workspace_mode_key";

CREATE UNIQUE INDEX "OnboardingProgress_organization_id_workspace_mode_flow_key_key"
  ON "OnboardingProgress"("organization_id", "workspace_mode", "flow_key");

ALTER TABLE "OnboardingProgress"
  ALTER COLUMN "flow_key" SET DEFAULT 'onboarding_v2';

-- One startup model per account.
CREATE TABLE "StartupTemplateApplication" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "templateKey" TEXT NOT NULL,
  "workspaceMode" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedByUserId" INTEGER,
  "metadata" JSONB,

  CONSTRAINT "StartupTemplateApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StartupTemplateApplication_organizationId_key"
  ON "StartupTemplateApplication"("organizationId");
CREATE INDEX "StartupTemplateApplication_templateKey_idx"
  ON "StartupTemplateApplication"("templateKey");
CREATE INDEX "StartupTemplateApplication_workspaceMode_idx"
  ON "StartupTemplateApplication"("workspaceMode");

ALTER TABLE "StartupTemplateApplication"
  ADD CONSTRAINT "StartupTemplateApplication_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StartupTemplateApplication"
  ADD CONSTRAINT "StartupTemplateApplication_appliedByUserId_fkey"
  FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
