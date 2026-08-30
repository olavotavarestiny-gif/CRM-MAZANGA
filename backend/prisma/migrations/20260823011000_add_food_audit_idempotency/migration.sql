ALTER TABLE "food_audit_events" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "food_audit_events_organizationId_idempotencyKey_key"
    ON "food_audit_events"("organizationId", "idempotencyKey");
