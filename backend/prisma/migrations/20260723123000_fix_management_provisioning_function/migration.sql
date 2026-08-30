CREATE OR REPLACE FUNCTION provision_management_workspace(
  p_account_owner_id INTEGER, p_name TEXT, p_auth_user_id UUID, p_full_name TEXT
) RETURNS TABLE (organization_id UUID, profile_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org UUID; v_profile UUID;
BEGIN
  PERFORM set_config('app.management_system', 'provision', true);
  SELECT id INTO v_org FROM management_organizations WHERE account_owner_id = p_account_owner_id;
  IF v_org IS NULL THEN
    INSERT INTO management_organizations(account_owner_id, name)
    VALUES (p_account_owner_id, p_name)
    RETURNING id INTO v_org;
  END IF;

  INSERT INTO profiles(organization_id, user_id, auth_user_id, full_name, role, active)
  VALUES (v_org, p_account_owner_id, p_auth_user_id, p_full_name, 'admin', true)
  ON CONFLICT (user_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    auth_user_id = EXCLUDED.auth_user_id,
    full_name = EXCLUDED.full_name,
    role = 'admin',
    active = true,
    updated_at = now()
  RETURNING id INTO v_profile;

  INSERT INTO pipeline_stage_settings(organization_id, stage, label, probability, "order", created_by) VALUES
    (v_org,'lead_recebido','Lead recebido',10,1,v_profile),(v_org,'primeiro_contacto','Primeiro contacto',15,2,v_profile),
    (v_org,'lead_qualificado','Lead qualificado',25,3,v_profile),(v_org,'reuniao_agendada','Reunião agendada',35,4,v_profile),
    (v_org,'reuniao_realizada','Reunião realizada',45,5,v_profile),(v_org,'proposta_enviada','Proposta enviada',60,6,v_profile),
    (v_org,'negociacao','Negociação',80,7,v_profile),(v_org,'ganho','Ganho',100,8,v_profile),
    (v_org,'perdido','Perdido',0,9,v_profile)
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT v_org, v_profile;
END $$;

REVOKE ALL ON FUNCTION provision_management_workspace(INTEGER,TEXT,UUID,TEXT) FROM PUBLIC;
