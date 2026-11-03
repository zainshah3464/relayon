-- ═══════════════════════════════════════════════════════════════
-- Relayon RLS policies — v1.9+v2.0
-- Applied via: npm run db:rls
-- CRITICAL: tenant_id is TEXT — never cast to ::uuid
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE tenants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows           ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys            ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_rotations   ENABLE ROW LEVEL SECURITY;

ALTER TABLE tenants             FORCE ROW LEVEL SECURITY;
ALTER TABLE users               FORCE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens      FORCE ROW LEVEL SECURITY;
ALTER TABLE workflows           FORCE ROW LEVEL SECURITY;
ALTER TABLE destinations        FORCE ROW LEVEL SECURITY;
ALTER TABLE workflow_schedules  FORCE ROW LEVEL SECURITY;
ALTER TABLE api_keys            FORCE ROW LEVEL SECURITY;
ALTER TABLE usage_counters      FORCE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions   FORCE ROW LEVEL SECURITY;
ALTER TABLE api_key_rotations   FORCE ROW LEVEL SECURITY;

-- ── Policies ────────────────────────────────────────────────────
DROP POLICY IF EXISTS tenants_tenant_isolation ON tenants;
CREATE POLICY tenants_tenant_isolation ON tenants
  USING (id = current_setting('app.tenant_id', true))
  WITH CHECK (id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS refresh_tokens_tenant_isolation ON refresh_tokens;
CREATE POLICY refresh_tokens_tenant_isolation ON refresh_tokens
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS workflows_tenant_isolation ON workflows;
CREATE POLICY workflows_tenant_isolation ON workflows
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS destinations_tenant_isolation ON destinations;
CREATE POLICY destinations_tenant_isolation ON destinations
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS workflow_schedules_tenant_isolation ON workflow_schedules;
CREATE POLICY workflow_schedules_tenant_isolation ON workflow_schedules
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS api_keys_tenant_isolation ON api_keys;
CREATE POLICY api_keys_tenant_isolation ON api_keys
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS usage_counters_tenant_isolation ON usage_counters;
CREATE POLICY usage_counters_tenant_isolation ON usage_counters
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS workflow_versions_tenant_isolation ON workflow_versions;
CREATE POLICY workflow_versions_tenant_isolation ON workflow_versions
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS api_key_rotations_tenant_isolation ON api_key_rotations;
CREATE POLICY api_key_rotations_tenant_isolation ON api_key_rotations
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── System role (BYPASSRLS) ────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'relayon_system') THEN
    CREATE ROLE relayon_system NOLOGIN BYPASSRLS;
  END IF;
END
$$;

GRANT relayon_system TO CURRENT_USER;

-- Table + sequence grants so `SET LOCAL ROLE relayon_system` can query
GRANT USAGE ON SCHEMA public TO relayon_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO relayon_system;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO relayon_system;

-- Future tables automatically inherit grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO relayon_system;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO relayon_system;