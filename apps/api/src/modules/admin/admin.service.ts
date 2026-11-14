import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MongoService } from '../mongo/mongo.service';
import { PresenceService } from '../presence/presence.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoService,
    private readonly presence: PresenceService,
    private readonly redis: RedisService,
  ) {}

  async overview() {
    const since24h = new Date(Date.now() - 24 * 3600_000);
    const since7d = new Date(Date.now() - 7 * 24 * 3600_000);

    const [
      tenantsTotal,
      tenantsNew24h,
      usersTotal,
      usersNew24h,
      workflowsTotal,
      workflowsActive,
      events24h,
      events7d,
      deliveries7d,
      dlqTotal,
      liveNow,
    ] = await Promise.all([
      this.prisma.withoutTenant((c) => c.tenant.count()),
      this.prisma.withoutTenant((c) =>
        c.tenant.count({ where: { createdAt: { gte: since24h } } }),
      ),
      this.prisma.withoutTenant((c) => c.user.count()),
      this.prisma.withoutTenant((c) =>
        c.user.count({ where: { createdAt: { gte: since24h } } }),
      ),
      this.prisma.withoutTenant((c) => c.workflow.count()),
      this.prisma.withoutTenant((c) => c.workflow.count({ where: { isActive: true } })),
      this.mongo.eventModel.countDocuments({ receivedAt: { $gte: since24h } }),
      this.mongo.eventModel.countDocuments({ receivedAt: { $gte: since7d } }),
      this.mongo.deliveryModel.countDocuments({ createdAt: { $gte: since7d } }),
      this.mongo.deliveryModel.countDocuments({ status: 'dlq' }),
      this.presence.countLive(),
    ]);

    return {
      tenants: { total: tenantsTotal, new24h: tenantsNew24h },
      users: { total: usersTotal, new24h: usersNew24h },
      workflows: { total: workflowsTotal, active: workflowsActive },
      events: { last24h: events24h, last7d: events7d },
      deliveries: { last7d: deliveries7d, dlqTotal },
      liveUsers: liveNow,
      timestamp: new Date().toISOString(),
    };
  }

  async listTenants(opts: { limit?: number; cursor?: string; search?: string }) {
    const limit = Math.min(opts.limit ?? 25, 200);
    const where: Record<string, unknown> = {};
    if (opts.search) {
      where['OR'] = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { slug: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    if (opts.cursor) where['id'] = { lt: opts.cursor };

    const rows = await this.prisma.withoutTenant((c) =>
      c.tenant.findMany({
        where,
        take: limit + 1,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { users: true, workflows: true } } },
      }),
    );

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: items.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        subscriptionStatus: t.subscriptionStatus,
        quotaEventsPerMonth: t.quotaEventsPerMonth,
        quotaAiTokensPerMonth: t.quotaAiTokensPerMonth,
        userCount: t._count.users,
        workflowCount: t._count.workflows,
        createdAt: t.createdAt,
      })),
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }

  // ⚠️ v2.9 — enhanced tenant detail with usage + chart
  async tenantDetail(tenantId: string) {
    const tenant = await this.prisma.withoutTenant((c) =>
      c.tenant.findUnique({
        where: { id: tenantId },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              emailVerified: true,
              isSuperAdmin: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
          workflows: {
            select: {
              id: true,
              name: true,
              sourceType: true,
              isActive: true,
              createdAt: true,
              _count: { select: { destinations: true } },
            },
            take: 20,
            orderBy: { createdAt: 'desc' },
          },
          apiKeys: {
            select: {
              id: true,
              name: true,
              prefix: true,
              environment: true,
              lastUsedAt: true,
              revokedAt: true,
              createdAt: true,
            },
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: { workflows: true, apiKeys: true, users: true },
          },
        },
      }),
    );

    if (!tenant) return null;

    const since30d = new Date(Date.now() - 30 * 24 * 3600_000);
    const now = new Date();
    const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const [usageRows, events24h, events7d, dlqCount, deliveries7d, liveCount] =
      await Promise.all([
        this.prisma.withoutTenant((c) =>
          c.usageCounter.findMany({
            where: { tenantId, period: currentPeriod },
          }),
        ),
        this.mongo.eventModel.countDocuments({
          tenantId,
          receivedAt: { $gte: new Date(Date.now() - 24 * 3600_000) },
        }),
        this.mongo.eventModel.countDocuments({
          tenantId,
          receivedAt: { $gte: new Date(Date.now() - 7 * 24 * 3600_000) },
        }),
        this.mongo.deliveryModel.countDocuments({ tenantId, status: 'dlq' }),
        this.mongo.deliveryModel.countDocuments({
          tenantId,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600_000) },
        }),
        this.presence.countLiveForTenant(tenantId),
      ]);

    const usage = {
      events: {
        used: Number(
          usageRows.find((r) => r.metric === 'events')?.count ?? 0n,
        ),
        limit: tenant.quotaEventsPerMonth,
      },
      aiTokens: {
        used: Number(
          usageRows.find((r) => r.metric === 'ai_tokens')?.count ?? 0n,
        ),
        limit: tenant.quotaAiTokensPerMonth,
      },
    };

    const dailyEvents = await this.mongo.eventModel.aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: { tenantId, receivedAt: { $gte: since30d } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$receivedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const chart: Array<{ day: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600_000);
      const key = d.toISOString().slice(0, 10);
      const found = dailyEvents.find((r) => r._id === key);
      chart.push({ day: key, count: found?.count ?? 0 });
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      subscriptionStatus: tenant.subscriptionStatus,
      stripeCustomerId: tenant.stripeCustomerId,
      quotaMode: tenant.quotaMode,
      currentPeriodEnd: tenant.currentPeriodEnd,
      createdAt: tenant.createdAt,
      counts: tenant._count,
      users: tenant.users,
      recentWorkflows: tenant.workflows,
      recentApiKeys: tenant.apiKeys,
      usage,
      events24h,
      events7d,
      deliveries7d,
      dlqCount,
      liveUsers: liveCount,
      dailyEventChart: chart,
    };
  }

  async listUsers(opts: { limit?: number; cursor?: string; search?: string }) {
    const limit = Math.min(opts.limit ?? 25, 200);
    const where: Record<string, unknown> = {};
    if (opts.search) {
      where['OR'] = [
        { email: { contains: opts.search, mode: 'insensitive' } },
        { name: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    if (opts.cursor) where['id'] = { lt: opts.cursor };

    return this.prisma.withoutTenant((c) =>
      c.user.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          isSuperAdmin: true,
          lastLoginAt: true,
          createdAt: true,
          tenant: { select: { id: true, name: true, slug: true } },
        },
      }),
    );
  }

  async trafficOverview(days = 7) {
    const since = new Date(Date.now() - days * 24 * 3600_000);

    const rows = await this.prisma.withoutTenant((c) =>
      c.$queryRaw<Array<{ day: Date | string; sessions: bigint; pageviews: bigint }>>`
        SELECT
          DATE(created_at) AS day,
          COUNT(DISTINCT session_id) AS sessions,
          COUNT(*) AS pageviews
        FROM page_events
        WHERE created_at >= ${since}
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `,
    );

    const topPages = await this.prisma.withoutTenant((c) =>
      c.$queryRaw<Array<{ path: string; views: bigint; visitors: bigint }>>`
        SELECT
          path,
          COUNT(*) AS views,
          COUNT(DISTINCT session_id) AS visitors
        FROM page_events
        WHERE created_at >= ${since}
        GROUP BY path
        ORDER BY views DESC
        LIMIT 20
      `,
    );

    return {
      window: `${days}d`,
      daily: rows.map((r) => ({
        day:
          r.day instanceof Date
            ? r.day.toISOString().slice(0, 10)
            : String(r.day).slice(0, 10),
        sessions: Number(r.sessions),
        pageviews: Number(r.pageviews),
      })),
      topPages: topPages.map((r) => ({
        path: r.path,
        views: Number(r.views),
        visitors: Number(r.visitors),
      })),
    };
  }

  async liveSessions(limit = 50) {
    const sessions = await this.presence.listLive(limit);
    return { count: sessions.length, sessions };
  }

  async health() {
    let pgStatus = 'down';
    let mongoStatus = 'down';
    let redisStatus = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      pgStatus = 'up';
    } catch {
      /* down */
    }

    try {
      await this.mongo.eventModel.findOne().lean().exec();
      mongoStatus = 'up';
    } catch {
      /* down */
    }

    try {
      await this.redis.raw.ping();
      redisStatus = 'up';
    } catch {
      /* down */
    }

    const [incoming, processing, egress] = await Promise.all([
      this.getQueueLen('queue:events:incoming'),
      this.getQueueLen('queue:events:processing'),
      this.getQueueLen('queue:egress:pending'),
    ]);

    return {
      services: { postgres: pgStatus, mongo: mongoStatus, redis: redisStatus },
      queues: { incoming, processing, egress },
      timestamp: new Date().toISOString(),
    };
  }

  private async getQueueLen(key: string): Promise<number> {
    try {
      return await this.redis.raw.llen(key);
    } catch {
      return -1;
    }
  }

  async recordAudit(opts: {
    adminId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
    ipHash?: string | null;
  }): Promise<void> {
    await this.prisma.withoutTenant((c) =>
      c.adminAuditLog.create({
        data: {
          adminId: opts.adminId,
          action: opts.action,
          targetType: opts.targetType,
          targetId: opts.targetId,
          metadata: (opts.metadata ?? {}) as never,
          ipHash: opts.ipHash ?? null,
        },
      }),
    );
  }

  async listAudit(limit = 100) {
    return this.prisma.withoutTenant((c) =>
      c.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 500),
      }),
    );
  }
}