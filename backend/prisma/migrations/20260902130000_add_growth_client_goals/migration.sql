CREATE TABLE "growth_client_goals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" UUID NOT NULL UNIQUE REFERENCES "growth_clients"("id") ON DELETE CASCADE,
  "target_contacts" INTEGER CHECK ("target_contacts" IS NULL OR "target_contacts" > 0),
  "target_sales" INTEGER CHECK ("target_sales" IS NULL OR "target_sales" > 0),
  "target_revenue" NUMERIC(18,2) CHECK ("target_revenue" IS NULL OR "target_revenue" > 0),
  "max_cost_per_contact" NUMERIC(18,2) CHECK ("max_cost_per_contact" IS NULL OR "max_cost_per_contact" > 0),
  "min_estimated_return" NUMERIC(10,2) CHECK ("min_estimated_return" IS NULL OR "min_estimated_return" > 0),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "growth_client_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "growth_client_goals" FORCE ROW LEVEL SECURITY;

CREATE POLICY growth_client_goal_access ON "growth_client_goals" FOR ALL
USING (
  growth_is_system()
  OR "client_id" = growth_current_client()
  OR (growth_is_admin() AND "client_id" IN (
    SELECT "id" FROM "growth_clients" WHERE "organization_id" = growth_current_org()
  ))
)
WITH CHECK (
  growth_is_system()
  OR (growth_is_admin() AND "client_id" IN (
    SELECT "id" FROM "growth_clients" WHERE "organization_id" = growth_current_org()
  ))
);

CREATE TRIGGER growth_client_goals_updated_at
BEFORE UPDATE ON "growth_client_goals"
FOR EACH ROW EXECUTE FUNCTION set_growth_updated_at();

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "growth_client_goals" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "growth_client_goals" FROM authenticated;
  END IF;
END $$;
