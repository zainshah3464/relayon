-- CreateTable
CREATE TABLE "tenant_integrations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "model" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_validated_at" TIMESTAMP(3),
    "last_validation_ok" BOOLEAN,
    "validation_error" TEXT,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_integrations_tenant_id_is_active_idx" ON "tenant_integrations"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_integrations_tenant_id_provider_key" ON "tenant_integrations"("tenant_id", "provider");

-- AddForeignKey
ALTER TABLE "tenant_integrations" ADD CONSTRAINT "tenant_integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
