CREATE TABLE "food_staff_credentials" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "personId" INTEGER NOT NULL,
  "pinHash" TEXT NOT NULL,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastVerifiedAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" INTEGER,
  "updatedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_staff_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_staff_credentials_organizationId_personId_key"
  ON "food_staff_credentials"("organizationId", "personId");
CREATE INDEX "food_staff_credentials_organizationId_active_idx"
  ON "food_staff_credentials"("organizationId", "active");

ALTER TABLE "food_staff_credentials"
  ADD CONSTRAINT "food_staff_credentials_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_staff_credentials"
  ADD CONSTRAINT "food_staff_credentials_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "food_shifts" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "branchId" TEXT NOT NULL,
  "personId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "startDeviceId" TEXT,
  "endDeviceId" TEXT,
  "notes" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_shifts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "food_shifts_organizationId_status_startedAt_idx"
  ON "food_shifts"("organizationId", "status", "startedAt");
CREATE INDEX "food_shifts_branchId_status_startedAt_idx"
  ON "food_shifts"("branchId", "status", "startedAt");
CREATE INDEX "food_shifts_personId_status_startedAt_idx"
  ON "food_shifts"("personId", "status", "startedAt");
CREATE UNIQUE INDEX "food_shifts_one_open_per_person"
  ON "food_shifts"("organizationId", "personId") WHERE "status" = 'open';

ALTER TABLE "food_shifts"
  ADD CONSTRAINT "food_shifts_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_shifts"
  ADD CONSTRAINT "food_shifts_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_shifts"
  ADD CONSTRAINT "food_shifts_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "food_cash_sessions"
  ADD COLUMN "shiftId" TEXT,
  ADD COLUMN "openedDeviceId" TEXT,
  ADD COLUMN "closedDeviceId" TEXT;

CREATE INDEX "food_cash_sessions_shiftId_status_idx"
  ON "food_cash_sessions"("shiftId", "status");

ALTER TABLE "food_cash_sessions"
  ADD CONSTRAINT "food_cash_sessions_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "food_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
