ALTER TABLE "daily_tip_delivery"
ADD COLUMN "dismissed_in_dashboard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "dismissed_at" TIMESTAMP(3);

DROP INDEX IF EXISTS "OnboardingProgress_organization_id_key";

CREATE UNIQUE INDEX "OnboardingProgress_organization_id_workspace_mode_key"
ON "OnboardingProgress"("organization_id", "workspace_mode");
