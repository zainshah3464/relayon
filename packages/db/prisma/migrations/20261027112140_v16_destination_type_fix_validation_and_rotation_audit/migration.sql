-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DestinationType" ADD VALUE 'discord';
ALTER TYPE "DestinationType" ADD VALUE 'airtable';
ALTER TYPE "DestinationType" ADD VALUE 'notion';

-- AlterTable
ALTER TABLE "destinations" ADD COLUMN     "last_validated_at" TIMESTAMP(3),
ADD COLUMN     "last_validation_error" TEXT,
ADD COLUMN     "last_validation_ok" BOOLEAN;

-- CreateTable
CREATE TABLE "api_key_rotations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "old_key_id" TEXT NOT NULL,
    "new_key_id" TEXT NOT NULL,
    "rotated_by" TEXT,
    "grace_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_key_rotations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_key_rotations_tenant_id_created_at_idx" ON "api_key_rotations"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "api_key_rotations" ADD CONSTRAINT "api_key_rotations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
