-- Dashboard/API hot-path indexes.
-- These match the authenticated dashboard and list queries that run on first page load.

CREATE INDEX IF NOT EXISTS "Contact_userId_updatedAt_idx"
  ON "Contact"("userId", "updatedAt");

CREATE INDEX IF NOT EXISTS "Contact_userId_status_birthDate_idx"
  ON "Contact"("userId", "status", "birthDate");

CREATE INDEX IF NOT EXISTS "Task_userId_done_dueDate_idx"
  ON "Task"("userId", "done", "dueDate");

CREATE INDEX IF NOT EXISTS "Task_userId_done_contactId_dueDate_idx"
  ON "Task"("userId", "done", "contactId", "dueDate");

CREATE INDEX IF NOT EXISTS "activity_log_org_stage_change_new_value_created_idx"
  ON "activity_log"("organization_id", "entity_type", "action", "field_changed", "new_value", "created_at");

CREATE INDEX IF NOT EXISTS "activity_log_org_stage_change_created_idx"
  ON "activity_log"("organization_id", "entity_type", "action", "field_changed", "created_at");

CREATE INDEX IF NOT EXISTS "Transaction_userId_type_status_deleted_date_idx"
  ON "Transaction"("userId", "type", "status", "deleted", "date");

CREATE INDEX IF NOT EXISTS "Transaction_userId_clientId_idx"
  ON "Transaction"("userId", "clientId");
