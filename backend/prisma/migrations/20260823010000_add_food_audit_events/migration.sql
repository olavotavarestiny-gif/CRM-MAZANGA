CREATE TABLE "food_audit_events" (
    "id" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "branchId" TEXT,
    "actorUserId" INTEGER,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'api',
    "device" TEXT,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "food_audit_events_organizationId_occurredAt_idx"
    ON "food_audit_events"("organizationId", "occurredAt");
CREATE INDEX "food_audit_events_organizationId_action_occurredAt_idx"
    ON "food_audit_events"("organizationId", "action", "occurredAt");
CREATE INDEX "food_audit_events_organizationId_entityType_entityId_occurredAt_idx"
    ON "food_audit_events"("organizationId", "entityType", "entityId", "occurredAt");
CREATE INDEX "food_audit_events_branchId_occurredAt_idx"
    ON "food_audit_events"("branchId", "occurredAt");

ALTER TABLE "food_audit_events"
    ADD CONSTRAINT "food_audit_events_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "food_audit_events"
    ADD CONSTRAINT "food_audit_events_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "food_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "food_audit_events"
    ADD CONSTRAINT "food_audit_events_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
