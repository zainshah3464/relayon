-- ═══════════════════════════════════════════════════════════════
-- Relayon RLS policies — v1.8
-- Applied via: npm run db:rls
-- Scope: usage_counters, workflow_versions
--
-- NOTE: tenant_id columns are TEXT (Prisma String → TEXT).
-- Do NOT cast current_setting to ::uuid — that causes
-- "operator does not exist: text = uuid" errors.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_counters_tenant_isolation ON usage_counters;
CREATE POLICY usage_counters_tenant_isolation ON usage_counters
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_versions_tenant_isolation ON workflow_versions;
CREATE POLICY workflow_versions_tenant_isolation ON workflow_versions
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));