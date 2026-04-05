CREATE TABLE "automation_log" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "trigger_data" JSONB NOT NULL,
    "action_type" TEXT NOT NULL,
    "action_data" JSONB NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "contact_id" INTEGER,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_log_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "automation_log"
ADD CONSTRAINT "automation_log_automation_id_fkey"
FOREIGN KEY ("automation_id") REFERENCES "Automation"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "automation_log"
ADD CONSTRAINT "automation_log_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "automation_log"
ADD CONSTRAINT "automation_log_contact_id_fkey"
FOREIGN KEY ("contact_id") REFERENCES "Contact"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "automation_log_automation_id_created_at_idx" ON "automation_log"("automation_id", "created_at");
CREATE INDEX "automation_log_organization_id_created_at_idx" ON "automation_log"("organization_id", "created_at");
CREATE INDEX "automation_log_organization_id_success_idx" ON "automation_log"("organization_id", "success");
CREATE INDEX "automation_log_contact_id_idx" ON "automation_log"("contact_id");
