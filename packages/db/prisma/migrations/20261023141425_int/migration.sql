-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "routing_rules" JSONB NOT NULL DEFAULT '[]';
