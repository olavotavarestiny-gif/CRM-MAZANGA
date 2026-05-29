-- Drop index that included new_value (unbounded text field).
-- PostgreSQL B-tree index entries are capped at 8191 bytes; large values
-- in new_value caused "index row size exceeds maximum" at INSERT time.
-- The activity_log_org_stage_change_created_idx index covers the same
-- lookup without new_value and is sufficient for all queries.
DROP INDEX IF EXISTS "activity_log_org_stage_change_new_value_created_idx";
