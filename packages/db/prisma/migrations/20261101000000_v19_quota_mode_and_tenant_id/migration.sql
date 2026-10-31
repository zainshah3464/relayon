-- ═══════════════════════════════════════════════════════════════
-- v1.9 — quota_mode + tenant_id on destinations & schedules
-- ═══════════════════════════════════════════════════════════════

-- 1. Add quota_mode to tenants
ALTER TABLE "tenants" ADD COLUMN "quota_mode" TEXT NOT NULL DEFAULT 'hard';

-- 2. Add tenant_id to destinations (nullable first)
ALTER TABLE "destinations" ADD COLUMN "tenant_id" TEXT;

-- 3. Backfill from parent workflow
UPDATE "destinations" d
SET "tenant_id" = w."tenant_id"
FROM "workflows" w
WHERE d."workflow_id" = w."id";

-- 4. Make NOT NULL after backfill
ALTER TABLE "destinations" ALTER COLUMN "tenant_id" SET NOT NULL;

-- 5. Add tenant_id to workflow_schedules (nullable first)
ALTER TABLE "workflow_schedules" ADD COLUMN "tenant_id" TEXT;

-- 6. Backfill
UPDATE "workflow_schedules" s
SET "tenant_id" = w."tenant_id"
FROM "workflows" w
WHERE s."workflow_id" = w."id";

-- 7. Make NOT NULL
ALTER TABLE "workflow_schedules" ALTER COLUMN "tenant_id" SET NOT NULL;

-- 8. Indexes
CREATE INDEX "destinations_tenant_id_idx" ON "destinations"("tenant_id");
CREATE INDEX "workflow_schedules_tenant_id_idx" ON "workflow_schedules"("tenant_id");