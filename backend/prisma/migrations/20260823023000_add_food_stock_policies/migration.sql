ALTER TABLE "food_ingredients"
  ADD COLUMN "idealStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "purchaseUnit" TEXT NOT NULL DEFAULT 'unit',
  ADD COLUMN "purchaseConversion" DOUBLE PRECISION NOT NULL DEFAULT 1,
  ADD COLUMN "preferredSupplierId" TEXT;

CREATE INDEX "food_ingredients_preferredSupplierId_idx"
  ON "food_ingredients"("preferredSupplierId");

ALTER TABLE "food_ingredients"
  ADD CONSTRAINT "food_ingredients_preferredSupplierId_fkey"
  FOREIGN KEY ("preferredSupplierId") REFERENCES "food_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "food_stock_alerts" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "branchId" TEXT,
  "ingredientId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "severity" TEXT NOT NULL DEFAULT 'warning',
  "recommendedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_stock_alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_stock_alerts_ingredientId_key" ON "food_stock_alerts"("ingredientId");
CREATE INDEX "food_stock_alerts_organizationId_status_severity_idx" ON "food_stock_alerts"("organizationId", "status", "severity");
CREATE INDEX "food_stock_alerts_branchId_status_idx" ON "food_stock_alerts"("branchId", "status");

ALTER TABLE "food_stock_alerts"
  ADD CONSTRAINT "food_stock_alerts_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_stock_alerts"
  ADD CONSTRAINT "food_stock_alerts_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "food_stock_alerts"
  ADD CONSTRAINT "food_stock_alerts_ingredientId_fkey"
  FOREIGN KEY ("ingredientId") REFERENCES "food_ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
