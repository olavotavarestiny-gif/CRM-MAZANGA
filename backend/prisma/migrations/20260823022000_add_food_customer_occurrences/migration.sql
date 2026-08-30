CREATE TABLE "food_customer_occurrences" (
  "id" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "contactId" INTEGER NOT NULL,
  "branchId" TEXT,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "createdByUserId" INTEGER,
  "resolvedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "food_customer_occurrences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "food_customer_occurrences_organizationId_contactId_occurredAt_idx"
  ON "food_customer_occurrences"("organizationId", "contactId", "occurredAt");
CREATE INDEX "food_customer_occurrences_organizationId_status_severity_occurredAt_idx"
  ON "food_customer_occurrences"("organizationId", "status", "severity", "occurredAt");
CREATE INDEX "food_customer_occurrences_branchId_occurredAt_idx"
  ON "food_customer_occurrences"("branchId", "occurredAt");

ALTER TABLE "food_customer_occurrences"
  ADD CONSTRAINT "food_customer_occurrences_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_customer_occurrences"
  ADD CONSTRAINT "food_customer_occurrences_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_customer_occurrences"
  ADD CONSTRAINT "food_customer_occurrences_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
