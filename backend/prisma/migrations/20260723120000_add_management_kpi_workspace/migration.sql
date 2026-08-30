CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "management_organizations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_owner_id" INTEGER NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "profiles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "management_organizations"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "auth_user_id" UUID UNIQUE,
  "full_name" TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK ("role" IN ('admin','marketing','commercial','designer','editor')),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_by" UUID
);

CREATE TABLE "clients" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" UUID NOT NULL REFERENCES "management_organizations"("id") ON DELETE CASCADE,
  "company_name" TEXT NOT NULL, "contact_name" TEXT NOT NULL, "phone" TEXT, "email" TEXT,
  "contracted_service" TEXT, "monthly_value" NUMERIC(18,2), "total_contract_value" NUMERIC(18,2),
  "start_date" DATE, "expected_end_date" DATE, "contract_duration_months" INTEGER,
  "commercial_responsible_id" UUID REFERENCES "profiles"("id") ON DELETE SET NULL,
  "operational_responsible_id" UUID REFERENCES "profiles"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'lead' CHECK ("status" IN ('lead','em_negociacao','ativo','pausado','inativo','cancelado')),
  "source" TEXT, "notes" TEXT, "cancellation_date" DATE, "cancellation_reason" TEXT, "archived_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "created_by" UUID
);

CREATE TABLE "campaigns" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" UUID NOT NULL REFERENCES "management_organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL, "channel" TEXT NOT NULL, "objective" TEXT NOT NULL, "start_date" DATE NOT NULL, "end_date" DATE,
  "status" TEXT NOT NULL DEFAULT 'planeada', "responsible_user_id" UUID REFERENCES "profiles"("id") ON DELETE SET NULL,
  "investment" NUMERIC(18,2) NOT NULL DEFAULT 0, "impressions" INTEGER NOT NULL DEFAULT 0, "reach" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0, "leads" INTEGER NOT NULL DEFAULT 0, "qualified_leads" INTEGER NOT NULL DEFAULT 0,
  "meetings_generated" INTEGER NOT NULL DEFAULT 0, "clients_won" INTEGER NOT NULL DEFAULT 0,
  "attributed_revenue" NUMERIC(18,2) NOT NULL DEFAULT 0, "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "created_by" UUID
);

CREATE TABLE "opportunities" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" UUID NOT NULL REFERENCES "management_organizations"("id") ON DELETE CASCADE,
  "client_id" UUID REFERENCES "clients"("id") ON DELETE SET NULL, "campaign_id" UUID REFERENCES "campaigns"("id") ON DELETE SET NULL,
  "company_name" TEXT NOT NULL, "contact_name" TEXT NOT NULL, "phone" TEXT, "email" TEXT, "lead_source" TEXT,
  "responsible_user_id" UUID REFERENCES "profiles"("id") ON DELETE SET NULL, "entry_date" DATE NOT NULL,
  "first_contact_date" TIMESTAMPTZ, "last_interaction_date" TIMESTAMPTZ, "next_interaction_date" TIMESTAMPTZ,
  "stage" TEXT NOT NULL DEFAULT 'lead_recebido', "estimated_value" NUMERIC(18,2) NOT NULL DEFAULT 0,
  "close_probability" NUMERIC(7,2) NOT NULL DEFAULT 10 CHECK ("close_probability" BETWEEN 0 AND 100),
  "meeting_date" TIMESTAMPTZ, "proposal_date" TIMESTAMPTZ, "expected_close_date" DATE, "actual_close_date" DATE,
  "result" TEXT, "loss_reason" TEXT, "notes" TEXT, "stage_changed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "created_by" UUID
);

CREATE TABLE "opportunity_stage_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" UUID NOT NULL REFERENCES "management_organizations"("id") ON DELETE CASCADE,
  "opportunity_id" UUID NOT NULL REFERENCES "opportunities"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "profiles"("id") ON DELETE RESTRICT,
  "previous_stage" TEXT, "new_stage" TEXT NOT NULL, "notes" TEXT,
  "changed_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "pipeline_stage_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" UUID NOT NULL REFERENCES "management_organizations"("id") ON DELETE CASCADE,
  "stage" TEXT NOT NULL, "label" TEXT NOT NULL, "probability" NUMERIC(7,2) NOT NULL CHECK ("probability" BETWEEN 0 AND 100),
  "order" INTEGER NOT NULL, "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "created_by" UUID,
  UNIQUE ("organization_id", "stage")
);

CREATE TABLE "operational_tasks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" UUID NOT NULL REFERENCES "management_organizations"("id") ON DELETE CASCADE,
  "client_id" UUID REFERENCES "clients"("id") ON DELETE SET NULL, "project" TEXT, "work_type" TEXT NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT, "responsible_user_id" UUID REFERENCES "profiles"("id") ON DELETE SET NULL,
  "request_date" DATE NOT NULL, "start_date" DATE, "deadline" TIMESTAMPTZ NOT NULL, "completion_date" TIMESTAMPTZ,
  "priority" TEXT NOT NULL DEFAULT 'normal', "status" TEXT NOT NULL DEFAULT 'pendente',
  "estimated_hours" NUMERIC(10,2), "actual_hours" NUMERIC(10,2), "revision_count" INTEGER NOT NULL DEFAULT 0,
  "delivered_on_time" BOOLEAN, "client_approved" BOOLEAN NOT NULL DEFAULT false, "delay_reason" TEXT, "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "created_by" UUID
);

CREATE TABLE "financial_transactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" UUID NOT NULL REFERENCES "management_organizations"("id") ON DELETE CASCADE,
  "client_id" UUID REFERENCES "clients"("id") ON DELETE SET NULL, "date" DATE NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('receita','despesa')), "category" TEXT NOT NULL, "subcategory" TEXT, "project" TEXT,
  "description" TEXT NOT NULL, "expected_value" NUMERIC(18,2) NOT NULL DEFAULT 0, "actual_value" NUMERIC(18,2),
  "due_date" DATE, "payment_date" DATE, "status" TEXT NOT NULL DEFAULT 'previsto', "payment_method" TEXT,
  "receipt_url" TEXT, "notes" TEXT, "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "created_by" UUID
);

CREATE TABLE "goals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" UUID NOT NULL REFERENCES "management_organizations"("id") ON DELETE CASCADE,
  "month" INTEGER NOT NULL CHECK ("month" BETWEEN 1 AND 12), "year" INTEGER NOT NULL,
  "area" TEXT NOT NULL, "kpi" TEXT NOT NULL, "target_value" NUMERIC(18,2) NOT NULL, "actual_value" NUMERIC(18,2),
  "unit" TEXT NOT NULL, "responsible_user_id" UUID REFERENCES "profiles"("id") ON DELETE SET NULL,
  "notes" TEXT, "calculated_at" TIMESTAMPTZ, "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "created_by" UUID,
  UNIQUE NULLS NOT DISTINCT ("organization_id", "month", "year", "area", "kpi", "responsible_user_id")
);

CREATE TABLE "activity_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" UUID NOT NULL REFERENCES "management_organizations"("id") ON DELETE CASCADE,
  "user_id" UUID REFERENCES "profiles"("id") ON DELETE SET NULL, "action_type" TEXT NOT NULL, "module" TEXT NOT NULL,
  "related_record_id" UUID, "description" TEXT NOT NULL, "metadata" JSONB, "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "profiles_org_role_active_idx" ON "profiles" ("organization_id", "role", "active");
CREATE INDEX "clients_org_status_created_idx" ON "clients" ("organization_id", "status", "created_at");
CREATE INDEX "clients_org_commercial_idx" ON "clients" ("organization_id", "commercial_responsible_id");
CREATE INDEX "clients_org_operational_idx" ON "clients" ("organization_id", "operational_responsible_id");
CREATE INDEX "clients_org_company_idx" ON "clients" ("organization_id", "company_name");
CREATE INDEX "campaigns_org_status_start_idx" ON "campaigns" ("organization_id", "status", "start_date");
CREATE INDEX "campaigns_org_channel_start_idx" ON "campaigns" ("organization_id", "channel", "start_date");
CREATE INDEX "campaigns_org_responsible_idx" ON "campaigns" ("organization_id", "responsible_user_id");
CREATE INDEX "opportunities_org_stage_entry_idx" ON "opportunities" ("organization_id", "stage", "entry_date");
CREATE INDEX "opportunities_org_responsible_idx" ON "opportunities" ("organization_id", "responsible_user_id");
CREATE INDEX "opportunities_org_client_idx" ON "opportunities" ("organization_id", "client_id");
CREATE INDEX "opportunity_history_org_opportunity_changed_idx" ON "opportunity_stage_history" ("organization_id", "opportunity_id", "changed_at");
CREATE INDEX "pipeline_settings_org_order_idx" ON "pipeline_stage_settings" ("organization_id", "order");
CREATE INDEX "operational_tasks_org_status_deadline_idx" ON "operational_tasks" ("organization_id", "status", "deadline");
CREATE INDEX "operational_tasks_org_responsible_deadline_idx" ON "operational_tasks" ("organization_id", "responsible_user_id", "deadline");
CREATE INDEX "financial_transactions_org_type_status_date_idx" ON "financial_transactions" ("organization_id", "type", "status", "date");
CREATE INDEX "financial_transactions_org_client_date_idx" ON "financial_transactions" ("organization_id", "client_id", "date");
CREATE INDEX "goals_org_year_month_idx" ON "goals" ("organization_id", "year", "month");
CREATE INDEX "activity_logs_org_created_idx" ON "activity_logs" ("organization_id", "created_at");
CREATE INDEX "activity_logs_org_module_record_idx" ON "activity_logs" ("organization_id", "module", "related_record_id");

CREATE OR REPLACE FUNCTION management_setting(setting_name TEXT) RETURNS TEXT
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting(setting_name, true), '') $$;
CREATE OR REPLACE FUNCTION management_current_org() RETURNS UUID
LANGUAGE sql STABLE AS $$ SELECT management_setting('app.management_organization_id')::uuid $$;
CREATE OR REPLACE FUNCTION management_current_profile() RETURNS UUID
LANGUAGE sql STABLE AS $$ SELECT management_setting('app.management_profile_id')::uuid $$;
CREATE OR REPLACE FUNCTION management_current_user() RETURNS INTEGER
LANGUAGE sql STABLE AS $$ SELECT management_setting('app.management_user_id')::integer $$;
CREATE OR REPLACE FUNCTION management_current_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$ SELECT management_setting('app.management_role') $$;
CREATE OR REPLACE FUNCTION management_is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$ SELECT management_current_role() = 'admin' $$;
CREATE OR REPLACE FUNCTION management_is_system() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$ SELECT management_setting('app.management_system') = 'provision' $$;

CREATE OR REPLACE FUNCTION set_management_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION prevent_management_log_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Registos de histórico e atividade são imutáveis'; END $$;

CREATE OR REPLACE FUNCTION provision_management_workspace(
  p_account_owner_id INTEGER, p_name TEXT, p_auth_user_id UUID, p_full_name TEXT
) RETURNS TABLE (organization_id UUID, profile_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org UUID; v_profile UUID;
BEGIN
  PERFORM set_config('app.management_system', 'provision', true);
  SELECT id INTO v_org FROM management_organizations WHERE account_owner_id = p_account_owner_id;
  IF v_org IS NULL THEN
    INSERT INTO management_organizations(account_owner_id, name) VALUES (p_account_owner_id, p_name) RETURNING id INTO v_org;
  END IF;
  INSERT INTO profiles(organization_id, user_id, auth_user_id, full_name, role, active)
  VALUES (v_org, p_account_owner_id, p_auth_user_id, p_full_name, 'admin', true)
  ON CONFLICT (user_id) DO UPDATE SET organization_id = EXCLUDED.organization_id, auth_user_id = EXCLUDED.auth_user_id,
    full_name = EXCLUDED.full_name, role = 'admin', active = true, updated_at = now()
  RETURNING id INTO v_profile;
  INSERT INTO pipeline_stage_settings(organization_id, stage, label, probability, "order", created_by) VALUES
    (v_org,'lead_recebido','Lead recebido',10,1,v_profile),(v_org,'primeiro_contacto','Primeiro contacto',15,2,v_profile),
    (v_org,'lead_qualificado','Lead qualificado',25,3,v_profile),(v_org,'reuniao_agendada','Reunião agendada',35,4,v_profile),
    (v_org,'reuniao_realizada','Reunião realizada',45,5,v_profile),(v_org,'proposta_enviada','Proposta enviada',60,6,v_profile),
    (v_org,'negociacao','Negociação',80,7,v_profile),(v_org,'ganho','Ganho',100,8,v_profile),(v_org,'perdido','Perdido',0,9,v_profile)
  ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT v_org, v_profile;
END $$;

REVOKE ALL ON FUNCTION provision_management_workspace(INTEGER,TEXT,UUID,TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION mark_management_overdue_tasks() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  PERFORM set_config('app.management_system', 'provision', true);
  UPDATE operational_tasks
  SET status = 'atrasado', updated_at = now()
  WHERE deadline < now()
    AND completion_date IS NULL
    AND status NOT IN ('concluido', 'cancelado', 'atrasado');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION mark_management_overdue_tasks() FROM PUBLIC;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['management_organizations','profiles','clients','campaigns','opportunities','opportunity_stage_history','pipeline_stage_settings','operational_tasks','financial_transactions','goals','activity_logs']
  LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t); END LOOP;
END $$;

CREATE POLICY management_org_select ON management_organizations FOR SELECT USING (id = management_current_org() OR management_is_system());
CREATE POLICY management_org_provision ON management_organizations FOR INSERT WITH CHECK (management_is_system());
CREATE POLICY management_profiles_select ON profiles FOR SELECT USING (
  management_is_system() OR user_id = management_current_user() OR organization_id = management_current_org()
);
CREATE POLICY management_profiles_admin_write ON profiles FOR ALL USING (
  management_is_system() OR (organization_id = management_current_org() AND management_is_admin())
) WITH CHECK (management_is_system() OR (organization_id = management_current_org() AND management_is_admin()));

CREATE POLICY clients_read ON clients FOR SELECT USING (organization_id = management_current_org() AND management_current_role() IN ('admin','commercial'));
CREATE POLICY clients_write ON clients FOR ALL USING (organization_id = management_current_org() AND management_current_role() IN ('admin','commercial')) WITH CHECK (organization_id = management_current_org() AND management_current_role() IN ('admin','commercial'));
CREATE POLICY campaigns_read ON campaigns FOR SELECT USING (organization_id = management_current_org() AND management_current_role() IN ('admin','marketing'));
CREATE POLICY campaigns_write ON campaigns FOR ALL USING (organization_id = management_current_org() AND management_current_role() IN ('admin','marketing')) WITH CHECK (organization_id = management_current_org() AND management_current_role() IN ('admin','marketing'));
CREATE POLICY opportunities_read ON opportunities FOR SELECT USING (organization_id = management_current_org() AND management_current_role() IN ('admin','commercial'));
CREATE POLICY opportunities_write ON opportunities FOR ALL USING (organization_id = management_current_org() AND management_current_role() IN ('admin','commercial')) WITH CHECK (organization_id = management_current_org() AND management_current_role() IN ('admin','commercial'));
CREATE POLICY history_read ON opportunity_stage_history FOR SELECT USING (organization_id = management_current_org() AND management_current_role() IN ('admin','commercial'));
CREATE POLICY history_insert ON opportunity_stage_history FOR INSERT WITH CHECK (organization_id = management_current_org() AND user_id = management_current_profile() AND management_current_role() IN ('admin','commercial'));
CREATE POLICY settings_read ON pipeline_stage_settings FOR SELECT USING (organization_id = management_current_org() AND management_current_role() IN ('admin','commercial'));
CREATE POLICY settings_admin_write ON pipeline_stage_settings FOR ALL USING (management_is_system() OR (organization_id = management_current_org() AND management_is_admin())) WITH CHECK (management_is_system() OR (organization_id = management_current_org() AND management_is_admin()));
CREATE POLICY tasks_read ON operational_tasks FOR SELECT USING (organization_id = management_current_org() AND (management_is_admin() OR (management_current_role() IN ('designer','editor') AND responsible_user_id = management_current_profile())));
CREATE POLICY tasks_admin_write ON operational_tasks FOR ALL USING (management_is_system() OR (organization_id = management_current_org() AND management_is_admin())) WITH CHECK (management_is_system() OR (organization_id = management_current_org() AND management_is_admin()));
CREATE POLICY tasks_assignee_update ON operational_tasks FOR UPDATE USING (organization_id = management_current_org() AND responsible_user_id = management_current_profile() AND management_current_role() IN ('designer','editor')) WITH CHECK (organization_id = management_current_org() AND responsible_user_id = management_current_profile());
CREATE POLICY finances_admin ON financial_transactions FOR ALL USING (organization_id = management_current_org() AND management_is_admin()) WITH CHECK (organization_id = management_current_org() AND management_is_admin());
CREATE POLICY goals_admin ON goals FOR ALL USING (organization_id = management_current_org() AND management_is_admin()) WITH CHECK (organization_id = management_current_org() AND management_is_admin());
CREATE POLICY activity_admin_read ON activity_logs FOR SELECT USING (organization_id = management_current_org() AND management_is_admin());
CREATE POLICY activity_insert ON activity_logs FOR INSERT WITH CHECK (organization_id = management_current_org() AND (user_id = management_current_profile() OR user_id IS NULL));

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['management_organizations','profiles','clients','campaigns','opportunities','pipeline_stage_settings','operational_tasks','financial_transactions','goals']
  LOOP EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_management_updated_at()', t, t); END LOOP;
END $$;
CREATE TRIGGER opportunity_history_immutable BEFORE UPDATE OR DELETE ON opportunity_stage_history FOR EACH ROW EXECUTE FUNCTION prevent_management_log_mutation();
CREATE TRIGGER activity_logs_immutable BEFORE UPDATE OR DELETE ON activity_logs FOR EACH ROW EXECUTE FUNCTION prevent_management_log_mutation();
