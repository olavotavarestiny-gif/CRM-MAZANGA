CREATE INDEX "food_orders_userId_branchId_createdAt_idx"
ON "food_orders"("userId", "branchId", "createdAt");

DROP INDEX IF EXISTS "food_order_events_userId_occurredAt_idx";
DROP INDEX IF EXISTS "food_order_events_branchId_occurredAt_idx";

CREATE INDEX "food_order_events_userId_occurredAt_id_idx"
ON "food_order_events"("userId", "occurredAt", "id");

CREATE INDEX "food_order_events_userId_branchId_occurredAt_id_idx"
ON "food_order_events"("userId", "branchId", "occurredAt", "id");
