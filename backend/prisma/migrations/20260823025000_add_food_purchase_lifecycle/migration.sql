ALTER TABLE "food_purchases"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT;

ALTER TABLE "food_purchase_items"
  ADD COLUMN "receivedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE "food_purchase_events" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "branchId" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "statusFrom" TEXT,
  "statusTo" TEXT,
  "version" INTEGER NOT NULL,
  "actorUserId" INTEGER,
  "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_purchase_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_purchase_events_purchaseId_idempotencyKey_key"
  ON "food_purchase_events"("purchaseId", "idempotencyKey");
CREATE INDEX "food_purchase_events_organizationId_createdAt_idx"
  ON "food_purchase_events"("organizationId", "createdAt");
CREATE INDEX "food_purchase_events_branchId_createdAt_idx"
  ON "food_purchase_events"("branchId", "createdAt");
CREATE INDEX "food_purchase_events_purchaseId_version_idx"
  ON "food_purchase_events"("purchaseId", "version");

ALTER TABLE "food_purchase_events"
  ADD CONSTRAINT "food_purchase_events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_purchase_events"
  ADD CONSTRAINT "food_purchase_events_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "food_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_purchase_events"
  ADD CONSTRAINT "food_purchase_events_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
