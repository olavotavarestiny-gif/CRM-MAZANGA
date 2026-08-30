CREATE TABLE "food_monthly_closes" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "branchId" TEXT,
  "scopeKey" TEXT NOT NULL,
  "month" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'closed',
  "version" INTEGER NOT NULL DEFAULT 1,
  "snapshot" JSONB NOT NULL,
  "validationSnapshot" JSONB NOT NULL,
  "closedByUserId" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_monthly_closes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "food_monthly_close_events" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "monthlyCloseId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorUserId" INTEGER NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_monthly_close_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_monthly_closes_organizationId_month_scopeKey_key" ON "food_monthly_closes"("organizationId", "month", "scopeKey");
CREATE UNIQUE INDEX "food_monthly_closes_organizationId_idempotencyKey_key" ON "food_monthly_closes"("organizationId", "idempotencyKey");
CREATE INDEX "food_monthly_closes_organizationId_status_month_idx" ON "food_monthly_closes"("organizationId", "status", "month");
CREATE INDEX "food_monthly_closes_branchId_month_idx" ON "food_monthly_closes"("branchId", "month");
CREATE UNIQUE INDEX "food_monthly_close_events_monthlyCloseId_version_key" ON "food_monthly_close_events"("monthlyCloseId", "version");
CREATE UNIQUE INDEX "food_monthly_close_events_organizationId_idempotencyKey_key" ON "food_monthly_close_events"("organizationId", "idempotencyKey");
CREATE INDEX "food_monthly_close_events_organizationId_createdAt_idx" ON "food_monthly_close_events"("organizationId", "createdAt");

ALTER TABLE "food_monthly_closes" ADD CONSTRAINT "food_monthly_closes_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "food_monthly_close_events" ADD CONSTRAINT "food_monthly_close_events_monthlyCloseId_fkey" FOREIGN KEY ("monthlyCloseId") REFERENCES "food_monthly_closes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
