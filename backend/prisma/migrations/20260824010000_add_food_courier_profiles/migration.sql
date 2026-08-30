CREATE TABLE "food_courier_profiles" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "personId" INTEGER NOT NULL,
  "phone" TEXT,
  "address" TEXT,
  "transportType" TEXT,
  "vehiclePlate" TEXT,
  "baseStatus" TEXT NOT NULL DEFAULT 'off_shift',
  "lastLatitude" DOUBLE PRECISION,
  "lastLongitude" DOUBLE PRECISION,
  "lastLocationAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" INTEGER,
  "updatedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_courier_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_courier_profiles_organizationId_personId_key"
  ON "food_courier_profiles"("organizationId", "personId");
CREATE INDEX "food_courier_profiles_organizationId_baseStatus_active_idx"
  ON "food_courier_profiles"("organizationId", "baseStatus", "active");

CREATE TABLE "food_courier_status_events" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "profileId" TEXT NOT NULL,
  "personId" INTEGER NOT NULL,
  "branchId" TEXT,
  "previousStatus" TEXT,
  "newStatus" TEXT NOT NULL,
  "reason" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "actorUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_courier_status_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "food_courier_status_events_organizationId_personId_createdAt_idx"
  ON "food_courier_status_events"("organizationId", "personId", "createdAt");
CREATE INDEX "food_courier_status_events_profileId_createdAt_idx"
  ON "food_courier_status_events"("profileId", "createdAt");

ALTER TABLE "food_courier_status_events"
  ADD CONSTRAINT "food_courier_status_events_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "food_courier_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
