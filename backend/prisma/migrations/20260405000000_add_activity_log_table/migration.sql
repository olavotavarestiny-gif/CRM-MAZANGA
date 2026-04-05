CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_label" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field_changed" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "user_id" INTEGER NOT NULL,
    "user_name" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_log_organization_id_created_at_idx" ON "activity_log"("organization_id", "created_at");
CREATE INDEX "activity_log_entity_type_entity_id_idx" ON "activity_log"("entity_type", "entity_id");
