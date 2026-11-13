import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/**
 * Live-user presence via Redis TTL:
 * - 45s TTL, refreshed every 15s by client heartbeat
 * - 3 missed heartbeats = key expires = user offline
 * - No cron, no cleanup workers — Redis handles expiry
 */
const TTL_SECONDS = 45;
const PREFIX_SESSION = 'presence:session:';
const PREFIX_TENANT = 'presence:tenant:';

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(private readonly redis: RedisService) {}

  async heartbeat(opts: {
    sessionId: string;
    tenantId: string | null;
    userId: string | null;
    path: string;
  }): Promise<void> {
    const sessionKey = `${PREFIX_SESSION}${opts.sessionId}`;
    const payload = JSON.stringify({
      tenantId: opts.tenantId,
      userId: opts.userId,
      path: opts.path,
      ts: Date.now(),
    });

    const pipeline = this.redis.raw.pipeline();
    pipeline.set(sessionKey, payload, 'EX', TTL_SECONDS);

    if (opts.tenantId) {
      const tenantKey = `${PREFIX_TENANT}${opts.tenantId}`;
      pipeline.sadd(tenantKey, opts.sessionId);
      pipeline.expire(tenantKey, TTL_SECONDS * 2);
    }

    await pipeline.exec();
  }

  async countLive(): Promise<number> {
    let cursor = '0';
    let count = 0;
    do {
      const [nextCursor, keys] = await this.redis.raw.scan(
        cursor,
        'MATCH',
        `${PREFIX_SESSION}*`,
        'COUNT',
        500,
      );
      cursor = nextCursor;
      count += keys.length;
    } while (cursor !== '0');
    return count;
  }

  async countLiveForTenant(tenantId: string): Promise<number> {
    return this.redis.raw.scard(`${PREFIX_TENANT}${tenantId}`);
  }

  async listLive(limit = 50): Promise<
    Array<{
      sessionId: string;
      tenantId: string | null;
      userId: string | null;
      path: string;
      lastSeenMs: number;
    }>
  > {
    const out: Array<{
      sessionId: string;
      tenantId: string | null;
      userId: string | null;
      path: string;
      lastSeenMs: number;
    }> = [];

    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.raw.scan(
        cursor,
        'MATCH',
        `${PREFIX_SESSION}*`,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      if (keys.length === 0) continue;

      const values = await this.redis.raw.mget(...keys);
      for (let i = 0; i < keys.length; i++) {
        const raw = values[i];
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as {
            tenantId: string | null;
            userId: string | null;
            path: string;
            ts: number;
          };
          out.push({
            sessionId: keys[i]!.slice(PREFIX_SESSION.length),
            tenantId: parsed.tenantId,
            userId: parsed.userId,
            path: parsed.path,
            lastSeenMs: parsed.ts,
          });
        } catch {
          /* skip malformed */
        }
        if (out.length >= limit) return out;
      }
    } while (cursor !== '0');

    return out;
  }
}