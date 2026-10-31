-- ═══════════════════════════════════════════════════════════════
-- Relayon RLS policies — v1.9 full rollout
-- Applied via: npm run db:rls
-- Scope: ALL 9 tenant-scoped tables
--
-- CRITICAL: tenant_id columns are TEXT (not UUID). Do NOT cast to
-- ::uuid in comparisons — Postgres has no implicit text<->uuid operator.
-- ═══════════════════════════════════════════════════════════════

-- ── Enable + force RLS ─────────────────────────────────────────
ALTER TABLE tenants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows           ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys            ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions   ENABLE ROW LEVEL SECURITY;

ALTER TABLE tenants             FORCE ROW LEVEL SECURITY;
ALTER TABLE users               FORCE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens      FORCE ROW LEVEL SECURITY;
ALTER TABLE workflows           FORCE ROW LEVEL SECURITY;
ALTER TABLE destinations        FORCE ROW LEVEL SECURITY;
ALTER TABLE workflow_schedules  FORCE ROW LEVEL SECURITY;
ALTER TABLE api_keys            FORCE ROW LEVEL SECURITY;
ALTER TABLE usage_counters      FORCE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions   FORCE ROW LEVEL SECURITY;

-- ── Policies (string compare, no ::uuid cast) ──────────────────
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

-- ── Bypass role for cross-tenant operations ────────────────────
-- Used ONLY by PrismaService.withoutTenant() via SET LOCAL ROLE.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'relayon_system') THEN
    CREATE ROLE relayon_system NOLOGIN BYPASSRLS;
  END IF;
END
$$;

GRANT relayon_system TO CURRENT_USER;

-- ═══════════════════════════════════════════════════════════════
-- CRITICAL: BYPASSRLS only bypasses RLS — it does NOT grant
-- SELECT/INSERT/UPDATE/DELETE. Without these grants,
-- `SET LOCAL ROLE relayon_system` → "permission denied for table X"
-- ═══════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO relayon_system;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO relayon_system;

GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public
  TO relayon_system;

-- Future tables created after this point should also be accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO relayon_system;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO relayon_system;