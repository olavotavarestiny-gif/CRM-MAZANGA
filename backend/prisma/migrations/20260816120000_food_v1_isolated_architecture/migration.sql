-- KukuGest Food V1 - bounded context, multi-workspace and operational aggregates.
-- This migration is additive. Existing Food catalog and order data are preserved.

CREATE TABLE IF NOT EXISTS "organization_modules" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "module" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "planTier" TEXT,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_modules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_modules_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_modules_organizationId_module_key"
  ON "organization_modules"("organizationId", "module");
CREATE INDEX IF NOT EXISTS "organization_modules_organizationId_enabled_idx"
  ON "organization_modules"("organizationId", "enabled");

INSERT INTO "organization_modules" (
  "id", "organizationId", "module", "enabled", "planTier", "createdAt", "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || u."id"::text),
  u."id",
  COALESCE(NULLIF(u."workspaceMode", ''), 'servicos'),
  true,
  u."plan",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("organizationId", "module") DO NOTHING;

INSERT INTO "organization_modules" (
  "id", "organizationId", "module", "enabled", "planTier", "createdAt", "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || fs."userId"::text || 'food'),
  fs."userId",
  'food',
  fs."isEnabled",
  u."plan",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "food_settings" fs
JOIN "User" u ON u."id" = fs."userId"
ON CONFLICT ("organizationId", "module") DO UPDATE
SET "enabled" = EXCLUDED."enabled", "updatedAt" = CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "food_staff_role_assignments" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "personId" INTEGER NOT NULL,
  "branchId" TEXT,
  "role" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_staff_role_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_staff_role_assignments_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "food_staff_role_assignments_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "food_staff_role_assignments_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "food_staff_role_assignments_org_person_active_idx"
  ON "food_staff_role_assignments"("organizationId", "personId", "active");
CREATE INDEX IF NOT EXISTS "food_staff_role_assignments_org_role_active_idx"
  ON "food_staff_role_assignments"("organizationId", "role", "active");
CREATE INDEX IF NOT EXISTS "food_staff_role_assignments_branch_active_idx"
  ON "food_staff_role_assignments"("branchId", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "food_staff_role_assignments_global_key"
  ON "food_staff_role_assignments"("organizationId", "personId", "role") WHERE "branchId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "food_staff_role_assignments_branch_key"
  ON "food_staff_role_assignments"("organizationId", "personId", "role", "branchId") WHERE "branchId" IS NOT NULL;

INSERT INTO "food_staff_role_assignments" (
  "id", "organizationId", "personId", "role", "isPrimary", "active", "createdByUserId"
)
SELECT
  md5(random()::text || clock_timestamp()::text || om."organizationId"::text || 'manager'),
  om."organizationId",
  om."organizationId",
  'manager',
  true,
  true,
  om."organizationId"
FROM "organization_modules" om
WHERE om."module" = 'food'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "food_customer_profiles" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "contactId" INTEGER NOT NULL,
  "preferredBranchId" TEXT,
  "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
  "transactionalConsent" BOOLEAN NOT NULL DEFAULT true,
  "preferences" JSONB NOT NULL DEFAULT '{}',
  "notes" TEXT,
  "totalOrders" INTEGER NOT NULL DEFAULT 0,
  "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastOrderAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_customer_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_customer_profiles_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "food_customer_profiles_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "food_customer_profiles_preferredBranchId_fkey"
    FOREIGN KEY ("preferredBranchId") REFERENCES "food_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "food_customer_profiles_org_contact_key"
  ON "food_customer_profiles"("organizationId", "contactId");
CREATE INDEX IF NOT EXISTS "food_customer_profiles_org_lastOrder_idx"
  ON "food_customer_profiles"("organizationId", "lastOrderAt");
CREATE INDEX IF NOT EXISTS "food_customer_profiles_preferredBranch_idx"
  ON "food_customer_profiles"("preferredBranchId");

CREATE TABLE IF NOT EXISTS "food_customer_addresses" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "profileId" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT 'Principal',
  "address" TEXT NOT NULL,
  "neighborhood" TEXT,
  "reference" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_customer_addresses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_customer_addresses_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "food_customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "food_customer_addresses_org_active_idx"
  ON "food_customer_addresses"("organizationId", "active");
CREATE INDEX IF NOT EXISTS "food_customer_addresses_profile_idx"
  ON "food_customer_addresses"("profileId");

ALTER TABLE "food_orders" ADD COLUMN IF NOT EXISTS "orderState" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "food_orders" ADD COLUMN IF NOT EXISTS "kitchenState" TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE "food_orders" ADD COLUMN IF NOT EXISTS "deliveryState" TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE "food_orders" ADD COLUMN IF NOT EXISTS "paymentState" TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE "food_orders" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "food_orders" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

UPDATE "food_orders"
SET
  "orderState" = CASE
    WHEN "status" = 'draft' THEN 'draft'
    WHEN "status" = 'cancelled' THEN 'cancelled'
    WHEN "status" = 'completed' THEN 'completed'
    ELSE 'active'
  END,
  "kitchenState" = CASE
    WHEN "status" IN ('sent_to_kitchen', 'pending_confirmation') THEN 'queued'
    WHEN "status" = 'kitchen_accepted' THEN 'accepted'
    WHEN "status" = 'preparing' THEN 'preparing'
    WHEN "status" IN ('ready', 'awaiting_handoff', 'out_for_delivery', 'delivered', 'completed') THEN 'ready'
    ELSE 'not_required'
  END,
  "deliveryState" = CASE
    WHEN "orderType" <> 'delivery' THEN 'not_required'
    WHEN "status" IN ('ready', 'awaiting_handoff') THEN 'awaiting_dispatch'
    WHEN "status" = 'out_for_delivery' THEN 'out_for_delivery'
    WHEN "status" IN ('delivered', 'completed') THEN 'delivered'
    ELSE 'pending'
  END,
  "paymentState" = CASE
    WHEN "paymentStatus" = 'paid' THEN 'paid'
    WHEN "paymentStatus" = 'partial' THEN 'partial'
    WHEN "paymentStatus" = 'refunded' THEN 'refunded'
    ELSE 'unpaid'
  END;

CREATE UNIQUE INDEX IF NOT EXISTS "food_orders_userId_idempotencyKey_key"
  ON "food_orders"("userId", "idempotencyKey");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_orders_branchId_fkey') THEN
    ALTER TABLE "food_orders" ADD CONSTRAINT "food_orders_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_orders_contactId_fkey') THEN
    ALTER TABLE "food_orders" ADD CONSTRAINT "food_orders_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "food_order_items" ADD COLUMN IF NOT EXISTS "kitchenState" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "food_order_items" ADD COLUMN IF NOT EXISTS "kitchenIssue" TEXT;
ALTER TABLE "food_order_items" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "food_order_items" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "food_order_events" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "branchId" TEXT,
  "orderId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorUserId" INTEGER,
  "actorRole" TEXT,
  "origin" TEXT NOT NULL DEFAULT 'api',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "idempotencyKey" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_order_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_order_events_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "food_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "food_order_events_orderId_version_key"
  ON "food_order_events"("orderId", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "food_order_events_userId_idempotencyKey_key"
  ON "food_order_events"("userId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "food_order_events_userId_occurredAt_idx"
  ON "food_order_events"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "food_order_events_branchId_occurredAt_idx"
  ON "food_order_events"("branchId", "occurredAt");

INSERT INTO "food_order_events" (
  "id", "userId", "branchId", "orderId", "version", "eventType", "actorUserId", "origin", "payload", "occurredAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || o."id"),
  o."userId",
  o."branchId",
  o."id",
  1,
  'order.migrated',
  o."createdByUserId",
  'migration',
  jsonb_build_object('legacyStatus', o."status"),
  o."createdAt"
FROM "food_orders" o
ON CONFLICT ("orderId", "version") DO NOTHING;

CREATE TABLE IF NOT EXISTS "food_kitchen_tickets" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "branchId" TEXT,
  "orderId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'queued',
  "version" INTEGER NOT NULL DEFAULT 1,
  "acceptedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "readyAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_kitchen_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_kitchen_tickets_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "food_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "food_kitchen_tickets_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "food_kitchen_tickets_orderId_key" ON "food_kitchen_tickets"("orderId");
CREATE INDEX IF NOT EXISTS "food_kitchen_tickets_userId_state_createdAt_idx"
  ON "food_kitchen_tickets"("userId", "state", "createdAt");
CREATE INDEX IF NOT EXISTS "food_kitchen_tickets_branchId_state_createdAt_idx"
  ON "food_kitchen_tickets"("branchId", "state", "createdAt");

CREATE TABLE IF NOT EXISTS "food_kitchen_ticket_items" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "ticketId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "issueType" TEXT,
  "issueNote" TEXT,
  "issueResolution" TEXT,
  "issueResolvedAt" TIMESTAMP(3),
  "issueResolvedByUserId" INTEGER,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_kitchen_ticket_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_kitchen_ticket_items_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "food_kitchen_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "food_kitchen_ticket_items_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "food_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "food_kitchen_ticket_items_orderItemId_key"
  ON "food_kitchen_ticket_items"("orderItemId");
CREATE INDEX IF NOT EXISTS "food_kitchen_ticket_items_userId_state_idx"
  ON "food_kitchen_ticket_items"("userId", "state");
CREATE INDEX IF NOT EXISTS "food_kitchen_ticket_items_ticketId_state_idx"
  ON "food_kitchen_ticket_items"("ticketId", "state");

INSERT INTO "food_kitchen_tickets" (
  "id", "userId", "branchId", "orderId", "state", "acceptedAt", "startedAt", "readyAt", "createdAt", "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || o."id" || 'ticket'),
  o."userId",
  o."branchId",
  o."id",
  o."kitchenState",
  CASE WHEN o."status" IN ('kitchen_accepted', 'preparing', 'ready', 'awaiting_handoff', 'out_for_delivery', 'delivered', 'completed') THEN o."updatedAt" END,
  CASE WHEN o."status" IN ('preparing', 'ready', 'awaiting_handoff', 'out_for_delivery', 'delivered', 'completed') THEN o."updatedAt" END,
  o."readyAt",
  COALESCE(o."sentToKitchenAt", o."createdAt"),
  o."updatedAt"
FROM "food_orders" o
WHERE o."kitchenState" <> 'not_required'
ON CONFLICT ("orderId") DO NOTHING;

INSERT INTO "food_kitchen_ticket_items" (
  "id", "userId", "ticketId", "orderItemId", "state", "createdAt", "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || oi."id" || 'ticket-item'),
  oi."userId",
  kt."id",
  oi."id",
  CASE WHEN kt."state" = 'ready' THEN 'completed' ELSE 'pending' END,
  oi."createdAt",
  COALESCE(oi."updatedAt", oi."createdAt")
FROM "food_order_items" oi
JOIN "food_kitchen_tickets" kt ON kt."orderId" = oi."orderId"
ON CONFLICT ("orderItemId") DO NOTHING;

CREATE TABLE IF NOT EXISTS "food_private_media" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "uploadedByUserId" INTEGER,
  "kind" TEXT NOT NULL,
  "storageUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER,
  "checksum" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_private_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "food_private_media_org_kind_active_idx"
  ON "food_private_media"("organizationId", "kind", "active");

CREATE TABLE IF NOT EXISTS "food_deliveries" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "branchId" TEXT,
  "orderId" TEXT NOT NULL,
  "courierUserId" INTEGER,
  "state" TEXT NOT NULL DEFAULT 'awaiting_dispatch',
  "pinHash" TEXT,
  "proofType" TEXT,
  "proofMediaId" TEXT,
  "failureReason" TEXT,
  "returnReason" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "assignedAt" TIMESTAMP(3),
  "pickedUpAt" TIMESTAMP(3),
  "arrivedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_deliveries_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "food_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "food_deliveries_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "food_deliveries_proofMediaId_fkey"
    FOREIGN KEY ("proofMediaId") REFERENCES "food_private_media"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "food_deliveries_orderId_key" ON "food_deliveries"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "food_deliveries_proofMediaId_key" ON "food_deliveries"("proofMediaId");
CREATE INDEX IF NOT EXISTS "food_deliveries_userId_state_createdAt_idx"
  ON "food_deliveries"("userId", "state", "createdAt");
CREATE INDEX IF NOT EXISTS "food_deliveries_branchId_state_createdAt_idx"
  ON "food_deliveries"("branchId", "state", "createdAt");
CREATE INDEX IF NOT EXISTS "food_deliveries_courierUserId_state_createdAt_idx"
  ON "food_deliveries"("courierUserId", "state", "createdAt");

CREATE TABLE IF NOT EXISTS "food_cash_sessions" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "branchId" TEXT NOT NULL,
  "openedByUserId" INTEGER NOT NULL,
  "closedByUserId" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'open',
  "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "expectedClosingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "closingCountedAmount" DOUBLE PRECISION,
  "differenceAmount" DOUBLE PRECISION,
  "totalSalesAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "salesCount" INTEGER NOT NULL DEFAULT 0,
  "totalsByMethod" JSONB NOT NULL DEFAULT '{}',
  "notes" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_cash_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_cash_sessions_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "food_cash_sessions_org_status_opened_idx"
  ON "food_cash_sessions"("organizationId", "status", "openedAt");
CREATE INDEX IF NOT EXISTS "food_cash_sessions_branch_status_opened_idx"
  ON "food_cash_sessions"("branchId", "status", "openedAt");
CREATE INDEX IF NOT EXISTS "food_cash_sessions_user_status_idx"
  ON "food_cash_sessions"("openedByUserId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "food_cash_sessions_open_operator_branch_key"
  ON "food_cash_sessions"("organizationId", "branchId", "openedByUserId") WHERE "status" = 'open';

CREATE TABLE IF NOT EXISTS "food_payments" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "branchId" TEXT,
  "orderId" TEXT NOT NULL,
  "cashSessionId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'confirmed',
  "transactionReference" TEXT,
  "idempotencyKey" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_payments_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "food_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "food_payments_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "food_payments_cashSessionId_fkey"
    FOREIGN KEY ("cashSessionId") REFERENCES "food_cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "food_payments_userId_idempotencyKey_key"
  ON "food_payments"("userId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "food_payments_userId_orderId_idx" ON "food_payments"("userId", "orderId");
CREATE INDEX IF NOT EXISTS "food_payments_cashSessionId_idx" ON "food_payments"("cashSessionId");
CREATE INDEX IF NOT EXISTS "food_payments_branchId_paidAt_idx" ON "food_payments"("branchId", "paidAt");

CREATE TABLE IF NOT EXISTS "food_fiscal_documents" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "branchId" TEXT,
  "orderId" TEXT NOT NULL,
  "paymentId" TEXT,
  "facturaId" TEXT,
  "documentType" TEXT NOT NULL DEFAULT 'FR',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "idempotencyKey" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issuedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_fiscal_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_fiscal_documents_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "food_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "food_fiscal_documents_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "food_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "food_fiscal_documents_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "food_fiscal_documents_userId_idempotencyKey_key"
  ON "food_fiscal_documents"("userId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "food_fiscal_documents_userId_orderId_idx"
  ON "food_fiscal_documents"("userId", "orderId");
CREATE INDEX IF NOT EXISTS "food_fiscal_documents_branchId_status_idx"
  ON "food_fiscal_documents"("branchId", "status");

CREATE TABLE IF NOT EXISTS "food_ingredients" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "branchId" TEXT,
  "internalCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'unit',
  "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "minimumStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "averageCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_ingredients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_ingredients_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "food_ingredients_org_internalCode_key"
  ON "food_ingredients"("organizationId", "internalCode");
CREATE INDEX IF NOT EXISTS "food_ingredients_org_active_idx"
  ON "food_ingredients"("organizationId", "active");
CREATE INDEX IF NOT EXISTS "food_ingredients_branch_active_idx"
  ON "food_ingredients"("branchId", "active");

CREATE TABLE IF NOT EXISTS "food_recipe_items" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "productId" TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "wastePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_recipe_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_recipe_items_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "food_products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "food_recipe_items_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "food_ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "food_recipe_items_product_ingredient_key"
  ON "food_recipe_items"("productId", "ingredientId");
CREATE INDEX IF NOT EXISTS "food_recipe_items_organizationId_idx" ON "food_recipe_items"("organizationId");
CREATE INDEX IF NOT EXISTS "food_recipe_items_ingredientId_idx" ON "food_recipe_items"("ingredientId");

CREATE TABLE IF NOT EXISTS "food_suppliers" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "branchId" TEXT,
  "name" TEXT NOT NULL,
  "nif" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_suppliers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_suppliers_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "food_suppliers_org_active_idx" ON "food_suppliers"("organizationId", "active");
CREATE INDEX IF NOT EXISTS "food_suppliers_branch_active_idx" ON "food_suppliers"("branchId", "active");

CREATE TABLE IF NOT EXISTS "food_purchases" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "branchId" TEXT NOT NULL,
  "supplierId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "reference" TEXT,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "purchasedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_purchases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_purchases_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "food_purchases_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "food_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "food_purchases_org_status_createdAt_idx"
  ON "food_purchases"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "food_purchases_branch_status_idx" ON "food_purchases"("branchId", "status");

CREATE TABLE IF NOT EXISTS "food_purchase_items" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unitCost" DOUBLE PRECISION NOT NULL,
  "total" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_purchase_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_purchase_items_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "food_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "food_purchase_items_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "food_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "food_purchase_items_organizationId_idx" ON "food_purchase_items"("organizationId");
CREATE INDEX IF NOT EXISTS "food_purchase_items_purchaseId_idx" ON "food_purchase_items"("purchaseId");
CREATE INDEX IF NOT EXISTS "food_purchase_items_ingredientId_idx" ON "food_purchase_items"("ingredientId");

CREATE TABLE IF NOT EXISTS "food_stock_movements" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "branchId" TEXT,
  "ingredientId" TEXT NOT NULL,
  "purchaseId" TEXT,
  "type" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "previousStock" DOUBLE PRECISION NOT NULL,
  "newStock" DOUBLE PRECISION NOT NULL,
  "unitCost" DOUBLE PRECISION,
  "reason" TEXT,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_stock_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_stock_movements_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "food_stock_movements_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "food_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "food_stock_movements_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "food_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "food_stock_movements_org_createdAt_idx"
  ON "food_stock_movements"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "food_stock_movements_branch_createdAt_idx"
  ON "food_stock_movements"("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "food_stock_movements_ingredient_createdAt_idx"
  ON "food_stock_movements"("ingredientId", "createdAt");

CREATE TABLE IF NOT EXISTS "food_coupons" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "discountType" TEXT NOT NULL DEFAULT 'fixed',
  "discountValue" DOUBLE PRECISION NOT NULL,
  "minimumOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "maximumDiscount" DOUBLE PRECISION,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "usageLimit" INTEGER,
  "perCustomerLimit" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_coupons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "food_coupons_org_code_key" ON "food_coupons"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "food_coupons_org_active_dates_idx" ON "food_coupons"("organizationId", "active", "startsAt", "endsAt");

CREATE TABLE IF NOT EXISTS "food_coupon_redemptions" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "couponId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "contactId" INTEGER,
  "discountAmount" DOUBLE PRECISION NOT NULL,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_coupon_redemptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_coupon_redemptions_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "food_coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "food_coupon_redemptions_coupon_order_key" ON "food_coupon_redemptions"("couponId", "orderId");
CREATE INDEX IF NOT EXISTS "food_coupon_redemptions_org_contact_date_idx" ON "food_coupon_redemptions"("organizationId", "contactId", "redeemedAt");
CREATE INDEX IF NOT EXISTS "food_coupon_redemptions_orderId_idx" ON "food_coupon_redemptions"("orderId");

CREATE TABLE IF NOT EXISTS "food_customer_segments" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "filters" JSONB NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_customer_segments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "food_customer_segments_org_name_key" ON "food_customer_segments"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "food_customer_segments_org_active_idx" ON "food_customer_segments"("organizationId", "active");

CREATE TABLE IF NOT EXISTS "food_marketing_campaigns" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "segmentId" TEXT,
  "couponId" TEXT,
  "messagingCampaignId" TEXT,
  "name" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'SMS',
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "recipientsCount" INTEGER NOT NULL DEFAULT 0,
  "deliveredCount" INTEGER NOT NULL DEFAULT 0,
  "conversionsCount" INTEGER NOT NULL DEFAULT 0,
  "attributedRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "food_marketing_campaigns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "food_marketing_campaigns_segmentId_fkey"
    FOREIGN KEY ("segmentId") REFERENCES "food_customer_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "food_marketing_campaigns_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "food_coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "food_marketing_campaigns_org_status_date_idx" ON "food_marketing_campaigns"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "food_marketing_campaigns_segmentId_idx" ON "food_marketing_campaigns"("segmentId");
CREATE INDEX IF NOT EXISTS "food_marketing_campaigns_couponId_idx" ON "food_marketing_campaigns"("couponId");
