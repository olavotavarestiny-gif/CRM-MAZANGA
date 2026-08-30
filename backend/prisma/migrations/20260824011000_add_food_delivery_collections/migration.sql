ALTER TABLE "food_payments"
  ADD COLUMN "deliveryCollectionId" TEXT,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'cashier',
  ADD COLUMN "courierUserId" INTEGER;

CREATE TABLE "food_delivery_collections" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "branchId" TEXT,
  "deliveryId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "courierUserId" INTEGER NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending_collection',
  "expectedAmount" DOUBLE PRECISION NOT NULL,
  "expectedMethod" TEXT,
  "actualAmount" DOUBLE PRECISION,
  "actualMethod" TEXT,
  "discrepancyAmount" DOUBLE PRECISION,
  "exceptionReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "receivedByCourierUserId" INTEGER,
  "handedOverByUserId" INTEGER,
  "reconciledByUserId" INTEGER,
  "receivedAt" TIMESTAMP(3),
  "handedOverAt" TIMESTAMP(3),
  "reconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_delivery_collections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "food_delivery_collection_events" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "collectionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorUserId" INTEGER,
  "actorRole" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_delivery_collection_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_payments_deliveryCollectionId_key" ON "food_payments"("deliveryCollectionId");
CREATE UNIQUE INDEX "food_delivery_collections_deliveryId_key" ON "food_delivery_collections"("deliveryId");
CREATE UNIQUE INDEX "food_delivery_collections_orderId_key" ON "food_delivery_collections"("orderId");
CREATE INDEX "food_delivery_collections_organizationId_state_createdAt_idx" ON "food_delivery_collections"("organizationId", "state", "createdAt");
CREATE INDEX "food_delivery_collections_branchId_state_createdAt_idx" ON "food_delivery_collections"("branchId", "state", "createdAt");
CREATE INDEX "food_delivery_collections_courierUserId_state_createdAt_idx" ON "food_delivery_collections"("courierUserId", "state", "createdAt");
CREATE UNIQUE INDEX "food_delivery_collection_events_collectionId_version_key" ON "food_delivery_collection_events"("collectionId", "version");
CREATE UNIQUE INDEX "food_delivery_collection_events_organizationId_idempotencyKey_key" ON "food_delivery_collection_events"("organizationId", "idempotencyKey");
CREATE INDEX "food_delivery_collection_events_organizationId_createdAt_idx" ON "food_delivery_collection_events"("organizationId", "createdAt");
CREATE INDEX "food_delivery_collection_events_collectionId_createdAt_idx" ON "food_delivery_collection_events"("collectionId", "createdAt");

ALTER TABLE "food_delivery_collections" ADD CONSTRAINT "food_delivery_collections_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "food_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_delivery_collections" ADD CONSTRAINT "food_delivery_collections_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "food_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_delivery_collection_events" ADD CONSTRAINT "food_delivery_collection_events_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "food_delivery_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_payments" ADD CONSTRAINT "food_payments_deliveryCollectionId_fkey" FOREIGN KEY ("deliveryCollectionId") REFERENCES "food_delivery_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
