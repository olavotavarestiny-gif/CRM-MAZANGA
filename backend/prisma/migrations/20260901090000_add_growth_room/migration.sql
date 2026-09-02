CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "growth_organizations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_owner_id" INTEGER NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "growth_memberships" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "growth_organizations"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL DEFAULT 'mazanga_admin' CHECK ("role" = 'mazanga_admin'),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("organization_id", "user_id")
);

CREATE TABLE "growth_clients" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "growth_organizations"("id") ON DELETE CASCADE,
  "company_name" TEXT NOT NULL,
  "logo_url" TEXT,
  "sector" TEXT,
  "contact_name" TEXT,
  "contact_email" TEXT,
  "phone" TEXT,
  "main_goal" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','paused','finished','archived')),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "growth_client_accesses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" UUID NOT NULL REFERENCES "growth_clients"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "invited_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "growth_performance_periods" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" UUID NOT NULL REFERENCES "growth_clients"("id") ON DELETE CASCADE,
  "period_name" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "investment" NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK ("investment" >= 0),
  "contacts" INTEGER NOT NULL DEFAULT 0 CHECK ("contacts" >= 0),
  "qualified_contacts" INTEGER NOT NULL DEFAULT 0 CHECK ("qualified_contacts" >= 0),
  "meetings" INTEGER NOT NULL DEFAULT 0 CHECK ("meetings" >= 0),
  "proposals" INTEGER NOT NULL DEFAULT 0 CHECK ("proposals" >= 0),
  "sales" INTEGER NOT NULL DEFAULT 0 CHECK ("sales" >= 0),
  "attributed_revenue" NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK ("attributed_revenue" >= 0),
  "executive_summary" TEXT,
  "main_bottleneck" TEXT,
  "recommendation" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft','published','archived')),
  "source_system" TEXT NOT NULL DEFAULT 'manual',
  "external_id" TEXT,
  "archived_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("client_id", "external_id"),
  CHECK ("end_date" >= "start_date")
);

CREATE TABLE "growth_contact_sources" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "period_id" UUID NOT NULL REFERENCES "growth_performance_periods"("id") ON DELETE CASCADE,
  "source_name" TEXT NOT NULL,
  "contacts" INTEGER NOT NULL DEFAULT 0 CHECK ("contacts" >= 0),
  "qualified_contacts" INTEGER NOT NULL DEFAULT 0 CHECK ("qualified_contacts" >= 0),
  "meetings" INTEGER NOT NULL DEFAULT 0 CHECK ("meetings" >= 0),
  "proposals" INTEGER NOT NULL DEFAULT 0 CHECK ("proposals" >= 0),
  "sales" INTEGER NOT NULL DEFAULT 0 CHECK ("sales" >= 0),
  "revenue" NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK ("revenue" >= 0),
  "quality_label" TEXT NOT NULL DEFAULT 'medium' CHECK ("quality_label" IN ('low','medium','high','very_high')),
  "strategic_reading" TEXT,
  "external_id" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("period_id", "external_id")
);

CREATE TABLE "growth_campaign_actions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "period_id" UUID NOT NULL REFERENCES "growth_performance_periods"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "objective" TEXT,
  "source_name" TEXT,
  "investment" NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK ("investment" >= 0),
  "contacts" INTEGER NOT NULL DEFAULT 0 CHECK ("contacts" >= 0),
  "sales" INTEGER NOT NULL DEFAULT 0 CHECK ("sales" >= 0),
  "revenue" NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK ("revenue" >= 0),
  "status" TEXT NOT NULL DEFAULT 'testing' CHECK ("status" IN ('testing','maintain','scale','optimize','pause','finished')),
  "decision" TEXT,
  "note" TEXT,
  "external_id" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("period_id", "external_id")
);

CREATE TABLE "growth_strategic_readings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "period_id" UUID NOT NULL UNIQUE REFERENCES "growth_performance_periods"("id") ON DELETE CASCADE,
  "what_happened" TEXT, "what_data_shows" TEXT, "bottleneck" TEXT,
  "business_meaning" TEXT, "recommended_decision" TEXT, "next_actions" TEXT, "client_needs" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "growth_next_decisions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "period_id" UUID NOT NULL REFERENCES "growth_performance_periods"("id") ON DELETE CASCADE,
  "decision" TEXT NOT NULL, "reason" TEXT, "owner" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'medium' CHECK ("priority" IN ('low','medium','high')),
  "status" TEXT NOT NULL DEFAULT 'next_action' CHECK ("status" IN ('next_action','in_progress','completed','cancelled')),
  "expected_impact" TEXT, "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "growth_performance_reports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "period_id" UUID NOT NULL UNIQUE REFERENCES "growth_performance_periods"("id") ON DELETE CASCADE,
  "executive_summary" TEXT, "main_learnings" TEXT, "what_worked" TEXT,
  "what_did_not_work" TEXT, "decisions_taken" TEXT, "next_steps" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "growth_publications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "period_id" UUID NOT NULL REFERENCES "growth_performance_periods"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL CHECK ("version" > 0),
  "snapshot" JSONB NOT NULL,
  "published_by_id" INTEGER,
  "published_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("period_id", "version")
);

CREATE INDEX "growth_memberships_user_active_idx" ON "growth_memberships"("user_id", "active");
CREATE INDEX "growth_clients_org_status_name_idx" ON "growth_clients"("organization_id", "status", "company_name");
CREATE INDEX "growth_access_client_active_idx" ON "growth_client_accesses"("client_id", "active");
CREATE INDEX "growth_period_client_start_status_idx" ON "growth_performance_periods"("client_id", "start_date", "status");
CREATE INDEX "growth_source_period_order_idx" ON "growth_contact_sources"("period_id", "sort_order");
CREATE INDEX "growth_campaign_period_order_idx" ON "growth_campaign_actions"("period_id", "sort_order");
CREATE INDEX "growth_decision_period_order_idx" ON "growth_next_decisions"("period_id", "sort_order");
CREATE INDEX "growth_publication_period_date_idx" ON "growth_publications"("period_id", "published_at");

CREATE OR REPLACE FUNCTION growth_setting(setting_name TEXT) RETURNS TEXT
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting(setting_name, true), '') $$;
CREATE OR REPLACE FUNCTION growth_current_org() RETURNS UUID
LANGUAGE sql STABLE AS $$ SELECT growth_setting('app.growth_organization_id')::uuid $$;
CREATE OR REPLACE FUNCTION growth_current_client() RETURNS UUID
LANGUAGE sql STABLE AS $$ SELECT growth_setting('app.growth_client_id')::uuid $$;
CREATE OR REPLACE FUNCTION growth_current_user() RETURNS INTEGER
LANGUAGE sql STABLE AS $$ SELECT growth_setting('app.growth_user_id')::integer $$;
CREATE OR REPLACE FUNCTION growth_current_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$ SELECT growth_setting('app.growth_role') $$;
CREATE OR REPLACE FUNCTION growth_is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$ SELECT growth_current_role() = 'mazanga_admin' $$;
CREATE OR REPLACE FUNCTION growth_is_system() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$ SELECT growth_setting('app.growth_system') = 'provision' $$;

CREATE OR REPLACE FUNCTION set_growth_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['growth_organizations','growth_memberships','growth_clients','growth_client_accesses','growth_performance_periods','growth_contact_sources','growth_campaign_actions','growth_strategic_readings','growth_next_decisions','growth_performance_reports','growth_publications']
  LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t); END LOOP;
END $$;

CREATE POLICY growth_org_access ON growth_organizations FOR ALL
USING (growth_is_system() OR id = growth_current_org())
WITH CHECK (growth_is_system() OR id = growth_current_org());
CREATE POLICY growth_membership_access ON growth_memberships FOR ALL
USING (growth_is_system() OR user_id = growth_current_user() OR (organization_id = growth_current_org() AND growth_is_admin()))
WITH CHECK (growth_is_system() OR (organization_id = growth_current_org() AND growth_is_admin()));
CREATE POLICY growth_client_access ON growth_clients FOR ALL
USING (growth_is_system() OR (organization_id = growth_current_org() AND growth_is_admin()) OR id = growth_current_client())
WITH CHECK (growth_is_system() OR (organization_id = growth_current_org() AND growth_is_admin()));
CREATE POLICY growth_client_user_access ON growth_client_accesses FOR ALL
USING (growth_is_system() OR user_id = growth_current_user() OR (growth_is_admin() AND client_id IN (SELECT id FROM growth_clients WHERE organization_id = growth_current_org())))
WITH CHECK (growth_is_system() OR (growth_is_admin() AND client_id IN (SELECT id FROM growth_clients WHERE organization_id = growth_current_org())));
CREATE POLICY growth_period_access ON growth_performance_periods FOR ALL
USING (growth_is_system() OR client_id = growth_current_client() OR (growth_is_admin() AND client_id IN (SELECT id FROM growth_clients WHERE organization_id = growth_current_org())))
WITH CHECK (growth_is_system() OR (growth_is_admin() AND client_id IN (SELECT id FROM growth_clients WHERE organization_id = growth_current_org())));

CREATE POLICY growth_source_access ON growth_contact_sources FOR ALL
USING (period_id IN (SELECT id FROM growth_performance_periods))
WITH CHECK (growth_is_admin() AND period_id IN (SELECT id FROM growth_performance_periods));
CREATE POLICY growth_campaign_access ON growth_campaign_actions FOR ALL
USING (period_id IN (SELECT id FROM growth_performance_periods))
WITH CHECK (growth_is_admin() AND period_id IN (SELECT id FROM growth_performance_periods));
CREATE POLICY growth_reading_access ON growth_strategic_readings FOR ALL
USING (period_id IN (SELECT id FROM growth_performance_periods))
WITH CHECK (growth_is_admin() AND period_id IN (SELECT id FROM growth_performance_periods));
CREATE POLICY growth_decision_access ON growth_next_decisions FOR ALL
USING (period_id IN (SELECT id FROM growth_performance_periods))
WITH CHECK (growth_is_admin() AND period_id IN (SELECT id FROM growth_performance_periods));
CREATE POLICY growth_report_access ON growth_performance_reports FOR ALL
USING (period_id IN (SELECT id FROM growth_performance_periods))
WITH CHECK (growth_is_admin() AND period_id IN (SELECT id FROM growth_performance_periods));
CREATE POLICY growth_publication_access ON growth_publications FOR ALL
USING (period_id IN (SELECT id FROM growth_performance_periods))
WITH CHECK (growth_is_admin() AND period_id IN (SELECT id FROM growth_performance_periods));

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['growth_organizations','growth_memberships','growth_clients','growth_client_accesses','growth_performance_periods','growth_contact_sources','growth_campaign_actions','growth_strategic_readings','growth_next_decisions','growth_performance_reports']
  LOOP EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_growth_updated_at()', t, t); END LOOP;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON growth_organizations, growth_memberships, growth_clients, growth_client_accesses,
      growth_performance_periods, growth_contact_sources, growth_campaign_actions,
      growth_strategic_readings, growth_next_decisions, growth_performance_reports,
      growth_publications FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON growth_organizations, growth_memberships, growth_clients, growth_client_accesses,
      growth_performance_periods, growth_contact_sources, growth_campaign_actions,
      growth_strategic_readings, growth_next_decisions, growth_performance_reports,
      growth_publications FROM authenticated;
  END IF;
END $$;
