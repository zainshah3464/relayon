-- AlterTable
ALTER TABLE "community_posts" ADD COLUMN     "auto_hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auto_hidden_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "community_replies" ADD COLUMN     "auto_hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auto_hidden_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "post_id" TEXT,
    "reply_id" TEXT,
    "flag_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_shares" (
    "id" TEXT NOT NULL,
    "announcement_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "external_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_actions_admin_id_created_at_idx" ON "moderation_actions"("admin_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_actions_post_id_idx" ON "moderation_actions"("post_id");

-- CreateIndex
CREATE INDEX "moderation_actions_reply_id_idx" ON "moderation_actions"("reply_id");

-- CreateIndex
CREATE INDEX "announcement_shares_announcement_id_platform_idx" ON "announcement_shares"("announcement_id", "platform");
