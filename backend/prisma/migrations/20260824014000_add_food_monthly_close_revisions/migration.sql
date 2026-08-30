CREATE TABLE "food_monthly_close_revisions" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "monthlyCloseId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "aggregateVersion" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "validationSnapshot" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "closedByUserId" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_monthly_close_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_monthly_close_revisions_monthlyCloseId_revisionNumber_key" ON "food_monthly_close_revisions"("monthlyCloseId", "revisionNumber");
CREATE UNIQUE INDEX "food_monthly_close_revisions_organizationId_idempotencyKey_key" ON "food_monthly_close_revisions"("organizationId", "idempotencyKey");
CREATE INDEX "food_monthly_close_revisions_organizationId_closedAt_idx" ON "food_monthly_close_revisions"("organizationId", "closedAt");
CREATE INDEX "food_monthly_close_revisions_monthlyCloseId_closedAt_idx" ON "food_monthly_close_revisions"("monthlyCloseId", "closedAt");

ALTER TABLE "food_monthly_close_revisions"
  ADD CONSTRAINT "food_monthly_close_revisions_monthlyCloseId_fkey"
  FOREIGN KEY ("monthlyCloseId") REFERENCES "food_monthly_closes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
