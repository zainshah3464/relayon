import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface FlagWithContext {
  id: string;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: Date;
  reporter: { id: string; email: string; name: string } | null;
  post: {
    id: string;
    title: string;
    slug: string;
    status: string;
    autoHidden: boolean;
    content: string;
    authorName: string | null;
  } | null;
  reply: {
    id: string;
    content: string;
    postId: string;
    authorName: string | null;
  } | null;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listFlags(opts: {
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: FlagWithContext[]; nextCursor: string | null }> {
    const limit = Math.min(opts.limit ?? 25, 100);
    const where: Record<string, unknown> = {};
    where['status'] = opts.status ?? 'pending';
    if (opts.cursor) where['id'] = { lt: opts.cursor };

    const flags = await this.prisma.withoutTenant((c) =>
      c.communityFlag.findMany({
        where,
        take: limit + 1,
        orderBy: { createdAt: 'desc' },
      }),
    );

    const hasMore = flags.length > limit;
    const items = hasMore ? flags.slice(0, limit) : flags;

    const postIds = items.map((f) => f.postId).filter(Boolean) as string[];
    const replyIds = items.map((f) => f.replyId).filter(Boolean) as string[];
    const reporterIds = items.map((f) => f.reporterId);

    const [posts, replies, reporters] = await Promise.all([
      postIds.length > 0
        ? this.prisma.withoutTenant((c) =>
            c.communityPost.findMany({
              where: { id: { in: postIds } },
              select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                autoHidden: true,
                content: true,
                author: { select: { name: true } },
              },
            }),
          )
        : Promise.resolve([]),
      replyIds.length > 0
        ? this.prisma.withoutTenant((c) =>
            c.communityReply.findMany({
              where: { id: { in: replyIds } },
              select: {
                id: true,
                content: true,
                postId: true,
                author: { select: { name: true } },
              },
            }),
          )
        : Promise.resolve([]),
      this.prisma.withoutTenant((c) =>
        c.user.findMany({
          where: { id: { in: reporterIds } },
          select: { id: true, email: true, name: true },
        }),
      ),
    ]);

    const postMap = new Map(posts.map((p) => [p.id, p]));
    const replyMap = new Map(replies.map((r) => [r.id, r]));
    const userMap = new Map(reporters.map((u) => [u.id, u]));

    return {
      items: items.map((f) => {
        const post = f.postId ? postMap.get(f.postId) : null;
        const reply = f.replyId ? replyMap.get(f.replyId) : null;
        const reporter = userMap.get(f.reporterId) ?? null;

        return {
          id: f.id,
          reason: f.reason,
          detail: f.detail,
          status: f.status,
          createdAt: f.createdAt,
          reporter,
          post: post
            ? {
                id: post.id,
                title: post.title,
                slug: post.slug,
                status: post.status,
                autoHidden: post.autoHidden,
                content: post.content.slice(0, 500),
                authorName: post.author?.name ?? null,
              }
            : null,
          reply: reply
            ? {
                id: reply.id,
                content: reply.content.slice(0, 500),
                postId: reply.postId,
                authorName: reply.author?.name ?? null,
              }
            : null,
        };
      }),
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }

  async resolveFlag(
    adminId: string,
    flagId: string,
    resolution: 'dismiss' | 'action',
    reason?: string,
  ): Promise<{ resolved: boolean }> {
    const flag = await this.prisma.withoutTenant((c) =>
      c.communityFlag.findUnique({ where: { id: flagId } }),
    );
    if (!flag) throw new NotFoundException('Flag not found');

    await this.prisma.withoutTenant(async (c) => {
      await c.communityFlag.update({
        where: { id: flagId },
        data: {
          status: resolution === 'dismiss' ? 'dismissed' : 'actioned',
          resolvedBy: adminId,
          resolvedAt: new Date(),
        },
      });

      await c.moderationAction.create({
        data: {
          adminId,
          action: resolution === 'dismiss' ? 'dismiss_flag' : 'remove',
          flagId,
          postId: flag.postId,
          replyId: flag.replyId,
          reason: reason ?? null,
        },
      });

      if (resolution === 'action') {
        if (flag.postId) {
          await c.communityPost.update({
            where: { id: flag.postId },
            data: { status: 'removed' },
          });
        } else if (flag.replyId) {
          const reply = await c.communityReply.findUnique({
            where: { id: flag.replyId },
            select: { postId: true },
          });
          await c.communityReply.update({
            where: { id: flag.replyId },
            data: { status: 'removed' },
          });
          if (reply) {
            await c.communityPost.update({
              where: { id: reply.postId },
              data: { replyCount: { decrement: 1 } },
            });
          }
        }
      }
    });

    this.logger.log(
      `Flag ${flagId} ${resolution === 'dismiss' ? 'dismissed' : 'actioned'} by ${adminId}`,
    );
    return { resolved: true };
  }

  async hidePost(
    adminId: string,
    postId: string,
    reason?: string,
  ): Promise<{ hidden: boolean }> {
    await this.assertPost(postId);
    await this.prisma.withoutTenant(async (c) => {
      await c.communityPost.update({
        where: { id: postId },
        data: { status: 'hidden', autoHidden: false, autoHiddenAt: null },
      });
      await c.moderationAction.create({
        data: { adminId, action: 'hide', postId, reason: reason ?? null },
      });
    });
    return { hidden: true };
  }

  async restorePost(
    adminId: string,
    postId: string,
    reason?: string,
  ): Promise<{ restored: boolean }> {
    await this.assertPost(postId);
    await this.prisma.withoutTenant(async (c) => {
      await c.communityPost.update({
        where: { id: postId },
        data: { status: 'published', autoHidden: false, autoHiddenAt: null },
      });
      await c.communityFlag.updateMany({
        where: { postId, status: 'pending' },
        data: {
          status: 'dismissed',
          resolvedBy: adminId,
          resolvedAt: new Date(),
        },
      });
      await c.moderationAction.create({
        data: { adminId, action: 'restore', postId, reason: reason ?? null },
      });
    });
    return { restored: true };
  }

  async removePost(
    adminId: string,
    postId: string,
    reason?: string,
  ): Promise<{ removed: boolean }> {
    await this.assertPost(postId);
    await this.prisma.withoutTenant(async (c) => {
      await c.communityPost.update({
        where: { id: postId },
        data: { status: 'removed' },
      });
      await c.communityFlag.updateMany({
        where: { postId, status: 'pending' },
        data: {
          status: 'actioned',
          resolvedBy: adminId,
          resolvedAt: new Date(),
        },
      });
      await c.moderationAction.create({
        data: { adminId, action: 'remove', postId, reason: reason ?? null },
      });
    });
    return { removed: true };
  }

  async listAudit(limit = 100) {
    return this.prisma.withoutTenant((c) =>
      c.moderationAction.findMany({
        take: Math.min(limit, 500),
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  private async assertPost(postId: string): Promise<void> {
    const post = await this.prisma.withoutTenant((c) =>
      c.communityPost.findUnique({ where: { id: postId } }),
    );
    if (!post) throw new NotFoundException('Post not found');
  }
}