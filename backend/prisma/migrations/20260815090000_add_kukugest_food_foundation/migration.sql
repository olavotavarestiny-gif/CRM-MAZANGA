-- KukuGest Food V1 - Etapa 1 foundation.

CREATE TABLE IF NOT EXISTS "food_settings" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "restaurantName" TEXT,
  "logoUrl" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'AOA',
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Luanda',
  "defaultPreparationMinutes" INTEGER NOT NULL DEFAULT 20,
  "kdsGreenMinutes" INTEGER NOT NULL DEFAULT 15,
  "kdsYellowMinutes" INTEGER NOT NULL DEFAULT 25,
  "kdsRedMinutes" INTEGER NOT NULL DEFAULT 35,
  "orderTypes" TEXT NOT NULL DEFAULT '["delivery","pickup","dine_in"]',
  "paymentMethods" TEXT NOT NULL DEFAULT '["CASH","MULTICAIXA","TPA","TRANSFER"]',
  "kitchenSoundEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "food_branches" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "estabelecimentoId" TEXT,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "neighborhood" TEXT,
  "isMain" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_branches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "food_categories" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT DEFAULT '#6b7e9a',
  "icon" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "food_products" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "branchId" TEXT,
  "categoryId" TEXT,
  "internalCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cost" DOUBLE PRECISION,
  "preparationMinutes" INTEGER NOT NULL DEFAULT 15,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "food_modifier_groups" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "minSelection" INTEGER NOT NULL DEFAULT 0,
  "maxSelection" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_modifier_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "food_modifier_options" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "groupId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "priceDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_modifier_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "food_product_modifier_groups" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "productId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_product_modifier_groups_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_settings_userId_key') THEN
    ALTER TABLE "food_settings" ADD CONSTRAINT "food_settings_userId_key" UNIQUE ("userId");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_branches_userId_name_key') THEN
    ALTER TABLE "food_branches" ADD CONSTRAINT "food_branches_userId_name_key" UNIQUE ("userId", "name");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_categories_userId_name_key') THEN
    ALTER TABLE "food_categories" ADD CONSTRAINT "food_categories_userId_name_key" UNIQUE ("userId", "name");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_products_userId_internalCode_key') THEN
    ALTER TABLE "food_products" ADD CONSTRAINT "food_products_userId_internalCode_key" UNIQUE ("userId", "internalCode");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_modifier_groups_userId_name_key') THEN
    ALTER TABLE "food_modifier_groups" ADD CONSTRAINT "food_modifier_groups_userId_name_key" UNIQUE ("userId", "name");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_modifier_options_groupId_name_key') THEN
    ALTER TABLE "food_modifier_options" ADD CONSTRAINT "food_modifier_options_groupId_name_key" UNIQUE ("groupId", "name");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_product_modifier_groups_productId_groupId_key') THEN
    ALTER TABLE "food_product_modifier_groups" ADD CONSTRAINT "food_product_modifier_groups_productId_groupId_key" UNIQUE ("productId", "groupId");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_settings_userId_fkey') THEN
    ALTER TABLE "food_settings"
      ADD CONSTRAINT "food_settings_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_branches_userId_fkey') THEN
    ALTER TABLE "food_branches"
      ADD CONSTRAINT "food_branches_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_branches_estabelecimentoId_fkey') THEN
    ALTER TABLE "food_branches"
      ADD CONSTRAINT "food_branches_estabelecimentoId_fkey"
      FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_categories_userId_fkey') THEN
    ALTER TABLE "food_categories"
      ADD CONSTRAINT "food_categories_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_products_userId_fkey') THEN
    ALTER TABLE "food_products"
      ADD CONSTRAINT "food_products_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_products_branchId_fkey') THEN
    ALTER TABLE "food_products"
      ADD CONSTRAINT "food_products_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_products_categoryId_fkey') THEN
    ALTER TABLE "food_products"
      ADD CONSTRAINT "food_products_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "food_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_modifier_groups_userId_fkey') THEN
    ALTER TABLE "food_modifier_groups"
      ADD CONSTRAINT "food_modifier_groups_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_modifier_options_userId_fkey') THEN
    ALTER TABLE "food_modifier_options"
      ADD CONSTRAINT "food_modifier_options_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_modifier_options_groupId_fkey') THEN
    ALTER TABLE "food_modifier_options"
      ADD CONSTRAINT "food_modifier_options_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "food_modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_product_modifier_groups_userId_fkey') THEN
    ALTER TABLE "food_product_modifier_groups"
      ADD CONSTRAINT "food_product_modifier_groups_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_product_modifier_groups_productId_fkey') THEN
    ALTER TABLE "food_product_modifier_groups"
      ADD CONSTRAINT "food_product_modifier_groups_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "food_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_product_modifier_groups_groupId_fkey') THEN
    ALTER TABLE "food_product_modifier_groups"
      ADD CONSTRAINT "food_product_modifier_groups_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "food_modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "food_branches_userId_idx" ON "food_branches"("userId");
CREATE INDEX IF NOT EXISTS "food_branches_estabelecimentoId_idx" ON "food_branches"("estabelecimentoId");
CREATE INDEX IF NOT EXISTS "food_branches_userId_active_idx" ON "food_branches"("userId", "active");

CREATE INDEX IF NOT EXISTS "food_categories_userId_idx" ON "food_categories"("userId");
CREATE INDEX IF NOT EXISTS "food_categories_userId_active_idx" ON "food_categories"("userId", "active");
CREATE INDEX IF NOT EXISTS "food_categories_userId_sortOrder_idx" ON "food_categories"("userId", "sortOrder");

CREATE INDEX IF NOT EXISTS "food_products_userId_idx" ON "food_products"("userId");
CREATE INDEX IF NOT EXISTS "food_products_branchId_idx" ON "food_products"("branchId");
CREATE INDEX IF NOT EXISTS "food_products_categoryId_idx" ON "food_products"("categoryId");
CREATE INDEX IF NOT EXISTS "food_products_userId_active_idx" ON "food_products"("userId", "active");
CREATE INDEX IF NOT EXISTS "food_products_userId_available_idx" ON "food_products"("userId", "available");
CREATE INDEX IF NOT EXISTS "food_products_userId_sortOrder_idx" ON "food_products"("userId", "sortOrder");

CREATE INDEX IF NOT EXISTS "food_modifier_groups_userId_idx" ON "food_modifier_groups"("userId");
CREATE INDEX IF NOT EXISTS "food_modifier_groups_userId_active_idx" ON "food_modifier_groups"("userId", "active");
CREATE INDEX IF NOT EXISTS "food_modifier_groups_userId_sortOrder_idx" ON "food_modifier_groups"("userId", "sortOrder");

CREATE INDEX IF NOT EXISTS "food_modifier_options_userId_idx" ON "food_modifier_options"("userId");
CREATE INDEX IF NOT EXISTS "food_modifier_options_groupId_idx" ON "food_modifier_options"("groupId");
CREATE INDEX IF NOT EXISTS "food_modifier_options_userId_active_idx" ON "food_modifier_options"("userId", "active");
CREATE INDEX IF NOT EXISTS "food_modifier_options_groupId_sortOrder_idx" ON "food_modifier_options"("groupId", "sortOrder");

CREATE INDEX IF NOT EXISTS "food_product_modifier_groups_userId_idx" ON "food_product_modifier_groups"("userId");
CREATE INDEX IF NOT EXISTS "food_product_modifier_groups_productId_idx" ON "food_product_modifier_groups"("productId");
CREATE INDEX IF NOT EXISTS "food_product_modifier_groups_groupId_idx" ON "food_product_modifier_groups"("groupId");
