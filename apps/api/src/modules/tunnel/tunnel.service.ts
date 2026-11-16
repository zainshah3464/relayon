import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const SESSION_TTL_HOURS = 24;
const MAX_REQUESTS_BUFFER = 200;

export interface PublicTunnelSession {
  sessionId: string;
  url: string;
  targetPort: number;
  label: string | null;
  expiresAt: string;
}

export interface CapturedWebhook {
  id: string;
  sessionId: string;
  receivedAt: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
  contentType: string;
  sizeBytes: number;
}

@Injectable()
export class TunnelService {
  private readonly logger = new Logger(TunnelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async createOrReuse(
    tenantId: string,
    targetPort: number,
    label: string | null,
  ): Promise<PublicTunnelSession> {
    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tunnelSession.findFirst({
        where: {
          tenantId,
          targetPort,
          label,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );

    if (existing) {
      await this.prisma
        .withTenant(tenantId, (tx) =>
          tx.tunnelSession.update({
            where: { id: existing.id },
            data: { lastSeenAt: new Date() },
          }),
        )
        .catch(() => undefined);
      return this.toPublic(existing);
    }

    const sessionId = randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000);

    const created = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tunnelSession.create({
        data: { tenantId, sessionId, targetPort, label, expiresAt },
      }),
    );

    this.logger.log(
      `tunnel.created tenant=${tenantId} session=${sessionId} port=${targetPort}`,
    );
    return this.toPublic(created);
  }

  async touch(tenantId: string, sessionId: string): Promise<void> {
    await this.prisma
      .withTenant(tenantId, (tx) =>
        tx.tunnelSession.updateMany({
          where: { tenantId, sessionId },
          data: { lastSeenAt: new Date() },
        }),
      )
      .catch(() => undefined);
  }

  async listCaptured(
    tenantId: string,
    sessionId: string,
    limit = 100,
  ): Promise<CapturedWebhook[]> {
    const owned = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tunnelSession.findFirst({ where: { tenantId, sessionId } }),
    );
    if (!owned) throw new NotFoundException('Session not found');

    const rows = await this.redis.raw.lrange(
      `tunnel:reqs:${sessionId}`,
      0,
      limit - 1,
    );
    return rows.map((r) => JSON.parse(r) as CapturedWebhook);
  }

  async delete(tenantId: string, sessionId: string): Promise<void> {
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.tunnelSession.deleteMany({ where: { tenantId, sessionId } }),
    );
    await this.redis.raw.del(`tunnel:reqs:${sessionId}`);
  }

  private toPublic(row: {
    sessionId: string;
    targetPort: number;
    label: string | null;
    expiresAt: Date;
  }): PublicTunnelSession {
    const base =
      process.env['PUBLIC_TUNNEL_URL'] ??
      process.env['PUBLIC_INGRESS_URL']?.replace(/\/webhook.*$/, '') ??
      'http://localhost:3002';
    return {
      sessionId: row.sessionId,
      url: `${base}/t/${row.sessionId}`,
      targetPort: row.targetPort,
      label: row.label,
      expiresAt: row.expiresAt.toISOString(),
    };
  }
}