-- KukuGest Food V1 - Etapa 2 pedidos.

CREATE TABLE IF NOT EXISTS "food_orders" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "branchId" TEXT,
  "contactId" INTEGER,
  "orderNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "orderType" TEXT NOT NULL DEFAULT 'delivery',
  "source" TEXT NOT NULL DEFAULT 'counter',
  "customerName" TEXT,
  "customerPhone" TEXT,
  "customerEmail" TEXT,
  "deliveryAddress" TEXT,
  "deliveryNeighborhood" TEXT,
  "deliveryReference" TEXT,
  "tableName" TEXT,
  "paymentMethod" TEXT,
  "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "estimatedPreparationMinutes" INTEGER NOT NULL DEFAULT 20,
  "notes" TEXT,
  "cancelReason" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "sentToKitchenAt" TIMESTAMP(3),
  "readyAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdByUserId" INTEGER,
  "updatedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "food_order_items" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT,
  "productName" TEXT NOT NULL,
  "productCode" TEXT,
  "productImageUrl" TEXT,
  "categoryName" TEXT,
  "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "offered" BOOLEAN NOT NULL DEFAULT false,
  "preparationMinutes" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "food_order_item_modifiers" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "modifierGroupId" TEXT,
  "modifierOptionId" TEXT,
  "groupName" TEXT NOT NULL,
  "optionName" TEXT NOT NULL,
  "priceDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_order_item_modifiers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "food_order_status_history" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "orderId" TEXT NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT NOT NULL,
  "note" TEXT,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "food_orders_userId_orderNumber_key" ON "food_orders"("userId", "orderNumber");
CREATE INDEX IF NOT EXISTS "food_orders_userId_idx" ON "food_orders"("userId");
CREATE INDEX IF NOT EXISTS "food_orders_userId_status_idx" ON "food_orders"("userId", "status");
CREATE INDEX IF NOT EXISTS "food_orders_userId_orderType_idx" ON "food_orders"("userId", "orderType");
CREATE INDEX IF NOT EXISTS "food_orders_userId_createdAt_idx" ON "food_orders"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "food_orders_userId_contactId_idx" ON "food_orders"("userId", "contactId");
CREATE INDEX IF NOT EXISTS "food_orders_branchId_idx" ON "food_orders"("branchId");

CREATE INDEX IF NOT EXISTS "food_order_items_userId_idx" ON "food_order_items"("userId");
CREATE INDEX IF NOT EXISTS "food_order_items_orderId_idx" ON "food_order_items"("orderId");
CREATE INDEX IF NOT EXISTS "food_order_items_productId_idx" ON "food_order_items"("productId");

CREATE INDEX IF NOT EXISTS "food_order_item_modifiers_userId_idx" ON "food_order_item_modifiers"("userId");
CREATE INDEX IF NOT EXISTS "food_order_item_modifiers_orderItemId_idx" ON "food_order_item_modifiers"("orderItemId");
CREATE INDEX IF NOT EXISTS "food_order_item_modifiers_modifierGroupId_idx" ON "food_order_item_modifiers"("modifierGroupId");
CREATE INDEX IF NOT EXISTS "food_order_item_modifiers_modifierOptionId_idx" ON "food_order_item_modifiers"("modifierOptionId");

CREATE INDEX IF NOT EXISTS "food_order_status_history_userId_idx" ON "food_order_status_history"("userId");
CREATE INDEX IF NOT EXISTS "food_order_status_history_orderId_idx" ON "food_order_status_history"("orderId");
CREATE INDEX IF NOT EXISTS "food_order_status_history_userId_createdAt_idx" ON "food_order_status_history"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'food_orders_userId_fkey'
  ) THEN
    ALTER TABLE "food_orders"
    ADD CONSTRAINT "food_orders_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'food_order_items_orderId_fkey'
  ) THEN
    ALTER TABLE "food_order_items"
    ADD CONSTRAINT "food_order_items_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "food_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'food_order_item_modifiers_orderItemId_fkey'
  ) THEN
    ALTER TABLE "food_order_item_modifiers"
    ADD CONSTRAINT "food_order_item_modifiers_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "food_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'food_order_status_history_orderId_fkey'
  ) THEN
    ALTER TABLE "food_order_status_history"
    ADD CONSTRAINT "food_order_status_history_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "food_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
