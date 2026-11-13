-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_super_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "page_events" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" TEXT,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "ip_hash" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "country" TEXT,
    "session_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_name" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_events_created_at_idx" ON "page_events"("created_at");

-- CreateIndex
CREATE INDEX "page_events_path_created_at_idx" ON "page_events"("path", "created_at");

-- CreateIndex
CREATE INDEX "page_events_session_id_created_at_idx" ON "page_events"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "page_events_tenant_id_created_at_idx" ON "page_events"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_admin_id_created_at_idx" ON "admin_audit_logs"("admin_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_created_at_idx" ON "admin_audit_logs"("action", "created_at");
