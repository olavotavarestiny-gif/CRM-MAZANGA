CREATE TABLE "food_work_schedules" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "branchId" TEXT NOT NULL,
  "personId" INTEGER NOT NULL,
  "workDate" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" INTEGER,
  "updatedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_work_schedules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_work_schedules_organizationId_personId_workDate_key"
  ON "food_work_schedules"("organizationId", "personId", "workDate");
CREATE INDEX "food_work_schedules_organizationId_workDate_active_idx"
  ON "food_work_schedules"("organizationId", "workDate", "active");
CREATE INDEX "food_work_schedules_branchId_workDate_active_idx"
  ON "food_work_schedules"("branchId", "workDate", "active");

ALTER TABLE "food_work_schedules"
  ADD CONSTRAINT "food_work_schedules_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_work_schedules"
  ADD CONSTRAINT "food_work_schedules_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_work_schedules"
  ADD CONSTRAINT "food_work_schedules_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "food_cash_sessions"
  ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN "approvedByUserId" INTEGER,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvalNote" TEXT;

UPDATE "food_cash_sessions"
SET "approvalStatus" = 'pending'
WHERE "status" = 'closed' AND ABS(COALESCE("differenceAmount", 0)) > 0.005;

CREATE INDEX "food_cash_sessions_organizationId_approvalStatus_closedAt_idx"
  ON "food_cash_sessions"("organizationId", "approvalStatus", "closedAt");
