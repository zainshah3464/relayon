-- CreateTable
CREATE TABLE "tunnel_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "target_port" INTEGER NOT NULL,
    "label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tunnel_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tunnel_sessions_session_id_key" ON "tunnel_sessions"("session_id");

-- CreateIndex
CREATE INDEX "tunnel_sessions_tenant_id_is_active_idx" ON "tunnel_sessions"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "tunnel_sessions_expires_at_idx" ON "tunnel_sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "tunnel_sessions" ADD CONSTRAINT "tunnel_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
