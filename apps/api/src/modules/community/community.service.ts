import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePostDto,
  CreateReplyDto,
  ListPostsQuery,
} from './dto/community.dto';

const POST_RATE_LIMIT_PER_HOUR = 5;
const REPLY_RATE_LIMIT_PER_HOUR = 20;

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Posts ────────────────────────────────────────────────────

  async listPosts(query: ListPostsQuery) {
    const limit = Math.min(query.limit ?? 25, 50);
    const where: Record<string, unknown> = {
      status: 'published',
      autoHidden: false, // ⚠️ v2.8
    };

    if (query.type) where['type'] = query.type;
    if (query.tag) where['tags'] = { has: query.tag };
    if (query.search) {
      where['OR'] = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.cursor) where['id'] = { lt: query.cursor };

    const orderBy =
      query.sort === 'popular'
        ? [{ likeCount: 'desc' as const }, { createdAt: 'desc' as const }]
        : query.sort === 'top'
          ? [{ pinnedUntil: 'desc' as const }, { likeCount: 'desc' as const }]
          : [{ createdAt: 'desc' as const }];

    const rows = await this.prisma.withoutTenant((c) =>
      c.communityPost.findMany({
        where,
        take: limit + 1,
        orderBy,
        select: {
          id: true,
          type: true,
          title: true,
          slug: true,
          tags: true,
          likeCount: true,
          replyCount: true,
          viewCount: true,
          pinnedUntil: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
          tenant: { select: { name: true, slug: true } },
        },
      }),
    );

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: items.map((p) => ({
        ...p,
        isOfficial: p.type === 'announcement',
        isPinned: p.pinnedUntil ? new Date(p.pinnedUntil) > new Date() : false,
      })),
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }

  async getPost(idOrSlug: string, viewerUserId: string | null) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const post = await this.prisma.withoutTenant((c) =>
      c.communityPost.findFirst({
        where: isUuid
          ? { id: idOrSlug, status: 'published', autoHidden: false }
          : { slug: idOrSlug, status: 'published', autoHidden: false },
        include: {
          author: { select: { id: true, name: true } },
          tenant: { select: { name: true, slug: true } },
          replies: {
            where: { status: 'published', autoHidden: false }, // ⚠️ v2.8
            orderBy: [{ isSolution: 'desc' }, { createdAt: 'asc' }],
            include: {
              author: { select: { id: true, name: true } },
              parent: { select: { id: true } },
            },
          },
        },
      }),
    );

    if (!post) throw new NotFoundException('Post not found');

    this.prisma
      .withoutTenant((c) =>
        c.communityPost.update({
          where: { id: post.id },
          data: { viewCount: { increment: 1 } },
        }),
      )
      .catch(() => undefined);

    const likes = viewerUserId
      ? await this.prisma.withoutTenant((c) =>
          c.communityLike.findMany({
            where: { userId: viewerUserId },
            select: { postId: true, replyId: true },
          }),
        )
      : [];

    const likedPostIds = new Set(likes.map((l) => l.postId).filter(Boolean));
    const likedReplyIds = new Set(likes.map((l) => l.replyId).filter(Boolean));

    return {
      ...post,
      hasLiked: likedPostIds.has(post.id),
      isOfficial: post.type === 'announcement',
      isPinned: post.pinnedUntil ? new Date(post.pinnedUntil) > new Date() : false,
      replies: post.replies.map((r) => ({
        ...r,
        hasLiked: likedReplyIds.has(r.id),
      })),
    };
  }

  async createPost(authorId: string, tenantId: string, dto: CreatePostDto) {
    const hourAgo = new Date(Date.now() - 3600_000);
    const recentCount = await this.prisma.withoutTenant((c) =>
      c.communityPost.count({
        where: { authorId, createdAt: { gte: hourAgo } },
      }),
    );
    if (recentCount >= POST_RATE_LIMIT_PER_HOUR) {
      throw new BadRequestException(
        `Rate limit: ${POST_RATE_LIMIT_PER_HOUR} posts per hour.`,
      );
    }

    if (dto.type === 'template') {
      const yaml = dto.metadata?.['workflowYaml'];
      if (typeof yaml !== 'string' || !yaml.includes('apiVersion: relayon/v1')) {
        throw new BadRequestException(
          'Template posts require metadata.workflowYaml with valid Relayon YAML',
        );
      }
    }

    const slug = this.makeSlug(dto.title);

    return this.prisma.withoutTenant((c) =>
      c.communityPost.create({
        data: {
          tenantId,
          authorId,
          type: dto.type,
          title: dto.title,
          slug,
          content: dto.content,
          tags: (dto.tags ?? []).map((t) =>
            t.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          ),
          metadata: (dto.metadata ?? {}) as never,
        },
      }),
    );
  }

  async deletePost(
    userId: string,
    tenantId: string,
    postId: string,
    isAdmin: boolean,
  ) {
    const post = await this.prisma.withoutTenant((c) =>
      c.communityPost.findUnique({ where: { id: postId } }),
    );
    if (!post) throw new NotFoundException('Post not found');

    const isAuthor = post.authorId === userId;
    const sameTenant = post.tenantId === tenantId;

    if (!isAdmin && !(isAuthor && sameTenant)) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.prisma.withoutTenant((c) =>
      c.communityPost.delete({ where: { id: postId } }),
    );
    return { deleted: true, id: postId };
  }

  // ── Replies ──────────────────────────────────────────────────

  async createReply(userId: string, dto: CreateReplyDto) {
    const hourAgo = new Date(Date.now() - 3600_000);
    const recentCount = await this.prisma.withoutTenant((c) =>
      c.communityReply.count({
        where: { authorId: userId, createdAt: { gte: hourAgo } },
      }),
    );
    if (recentCount >= REPLY_RATE_LIMIT_PER_HOUR) {
      throw new BadRequestException(
        `Rate limit: ${REPLY_RATE_LIMIT_PER_HOUR} replies per hour.`,
      );
    }

    const post = await this.prisma.withoutTenant((c) =>
      c.communityPost.findUnique({ where: { id: dto.postId } }),
    );
    if (!post || post.status !== 'published') {
      throw new NotFoundException('Post not found');
    }

    const reply = await this.prisma.withoutTenant(async (c) => {
      const created = await c.communityReply.create({
        data: {
          postId: dto.postId,
          authorId: userId,
          parentId: dto.parentId ?? null,
          content: dto.content,
        },
        include: { author: { select: { id: true, name: true } } },
      });
      await c.communityPost.update({
        where: { id: dto.postId },
        data: { replyCount: { increment: 1 } },
      });
      return created;
    });

    return reply;
  }

  async markSolution(userId: string, replyId: string) {
    const reply = await this.prisma.withoutTenant((c) =>
      c.communityReply.findUnique({
        where: { id: replyId },
        include: { post: { select: { authorId: true } } },
      }),
    );
    if (!reply) throw new NotFoundException('Reply not found');

    if (reply.post.authorId !== userId) {
      throw new ForbiddenException(
        'Only the post author can mark a solution',
      );
    }

    await this.prisma.withoutTenant((c) =>
      c.communityReply.updateMany({
        where: { postId: reply.postId, isSolution: true },
        data: { isSolution: false },
      }),
    );

    return this.prisma.withoutTenant((c) =>
      c.communityReply.update({
        where: { id: replyId },
        data: { isSolution: true },
        include: { author: { select: { id: true, name: true } } },
      }),
    );
  }

  // ── Likes ────────────────────────────────────────────────────

  async toggleLike(
    userId: string,
    opts: { postId?: string; replyId?: string },
  ) {
    if (!opts.postId && !opts.replyId) {
      throw new BadRequestException('postId or replyId required');
    }

    const existing = await this.prisma.withoutTenant((c) =>
      c.communityLike.findFirst({
        where: {
          userId,
          postId: opts.postId ?? null,
          replyId: opts.replyId ?? null,
        },
      }),
    );

    if (existing) {
      await this.prisma.withoutTenant((c) =>
        c.communityLike.delete({ where: { id: existing.id } }),
      );
      if (opts.postId) {
        await this.prisma.withoutTenant((c) =>
          c.communityPost.update({
            where: { id: opts.postId! },
            data: { likeCount: { decrement: 1 } },
          }),
        );
      } else if (opts.replyId) {
        await this.prisma.withoutTenant((c) =>
          c.communityReply.update({
            where: { id: opts.replyId! },
            data: { likeCount: { decrement: 1 } },
          }),
        );
      }
      return { liked: false };
    }

    await this.prisma.withoutTenant((c) =>
      c.communityLike.create({
        data: {
          userId,
          postId: opts.postId ?? null,
          replyId: opts.replyId ?? null,
        },
      }),
    );
    if (opts.postId) {
      await this.prisma.withoutTenant((c) =>
        c.communityPost.update({
          where: { id: opts.postId! },
          data: { likeCount: { increment: 1 } },
        }),
      );
    } else if (opts.replyId) {
      await this.prisma.withoutTenant((c) =>
        c.communityReply.update({
          where: { id: opts.replyId! },
          data: { likeCount: { increment: 1 } },
        }),
      );
    }
    return { liked: true };
  }

  // ── Flags ────────────────────────────────────────────────────

  async flag(
    userId: string,
    opts: { postId?: string; replyId?: string; reason: string; detail?: string },
  ) {
    if (!opts.postId && !opts.replyId) {
      throw new BadRequestException('postId or replyId required');
    }

    const created = await this.prisma.withoutTenant((c) =>
      c.communityFlag.create({
        data: {
          reporterId: userId,
          postId: opts.postId ?? null,
          replyId: opts.replyId ?? null,
          reason: opts.reason,
          detail: opts.detail ?? null,
        },
      }),
    );

    // ⚠️ v2.8 — auto-hide after 3 pending flags
    const AUTO_HIDE_THRESHOLD = 3;

    if (opts.postId) {
      const pendingFlags = await this.prisma.withoutTenant((c) =>
        c.communityFlag.count({
          where: { postId: opts.postId!, status: 'pending' },
        }),
      );

      if (pendingFlags >= AUTO_HIDE_THRESHOLD) {
        await this.prisma.withoutTenant(async (c) => {
          await c.communityPost.updateMany({
            where: {
              id: opts.postId!,
              status: 'published',
              autoHidden: false,
            },
            data: { autoHidden: true, autoHiddenAt: new Date() },
          });
          await c.moderationAction.create({
            data: {
              adminId: '00000000-0000-0000-0000-000000000000',
              action: 'auto_hide',
              postId: opts.postId!,
              reason: `Auto-hidden after ${pendingFlags} flags`,
            },
          });
        });
      }
    } else if (opts.replyId) {
      const pendingFlags = await this.prisma.withoutTenant((c) =>
        c.communityFlag.count({
          where: { replyId: opts.replyId!, status: 'pending' },
        }),
      );

      if (pendingFlags >= AUTO_HIDE_THRESHOLD) {
        await this.prisma.withoutTenant(async (c) => {
          await c.communityReply.updateMany({
            where: {
              id: opts.replyId!,
              status: 'published',
              autoHidden: false,
            },
            data: { autoHidden: true, autoHiddenAt: new Date() },
          });
          await c.moderationAction.create({
            data: {
              adminId: '00000000-0000-0000-0000-000000000000',
              action: 'auto_hide',
              replyId: opts.replyId!,
              reason: `Auto-hidden after ${pendingFlags} flags`,
            },
          });
        });
      }
    }

    return created;
  }

  // ── Announcements feed ──────────────────────────────────────

  async listAnnouncements(limit = 3) {
    return this.prisma.withoutTenant((c) =>
      c.communityPost.findMany({
        where: { type: 'announcement', status: 'published' },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          createdAt: true,
        },
      }),
    );
  }

  // ── Helpers ──────────────────────────────────────────────────

  private makeSlug(title: string): string {
    const base = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80)
      .replace(/^-|-$/g, '');
    const suffix = randomUUID().slice(0, 8);
    return `${base || 'post'}-${suffix}`;
  }
}