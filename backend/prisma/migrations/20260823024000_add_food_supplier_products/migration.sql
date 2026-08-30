CREATE TABLE "food_supplier_products" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "supplierId" TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "purchaseUnit" TEXT NOT NULL,
  "packageQuantity" DOUBLE PRECISION NOT NULL,
  "packagePrice" DOUBLE PRECISION NOT NULL,
  "minimumPackages" INTEGER NOT NULL DEFAULT 1,
  "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
  "qualityRating" DOUBLE PRECISION,
  "paymentTerms" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" INTEGER,
  "updatedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_supplier_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_supplier_products_supplierId_ingredientId_key"
  ON "food_supplier_products"("supplierId", "ingredientId");
CREATE INDEX "food_supplier_products_organizationId_ingredientId_active_idx"
  ON "food_supplier_products"("organizationId", "ingredientId", "active");
CREATE INDEX "food_supplier_products_organizationId_supplierId_active_idx"
  ON "food_supplier_products"("organizationId", "supplierId", "active");

ALTER TABLE "food_supplier_products"
  ADD CONSTRAINT "food_supplier_products_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "food_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_supplier_products"
  ADD CONSTRAINT "food_supplier_products_ingredientId_fkey"
  FOREIGN KEY ("ingredientId") REFERENCES "food_ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
