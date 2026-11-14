-- AlterTable
ALTER TABLE "admin_audit_logs" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "impersonated_tenant_id" TEXT,
ADD COLUMN     "session_token" TEXT;

-- CreateIndex
CREATE INDEX "admin_audit_logs_impersonated_tenant_id_idx" ON "admin_audit_logs"("impersonated_tenant_id");
