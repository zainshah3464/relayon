import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

const SESSION_TTL_SEC = 3600;
const MAX_REQUESTS_PER_SESSION = 100;

export interface CapturedRequest {
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
export class PlaygroundService {
  private readonly logger = new Logger(PlaygroundService.name);

  constructor(private readonly redis: RedisService) {}

  async createSession(): Promise<{
    sessionId: string;
    url: string;
    expiresAt: string;
  }> {
    const sessionId = randomUUID().slice(0, 16);
    await this.redis.raw.setex(
      `playground:session:${sessionId}`,
      SESSION_TTL_SEC,
      '1',
    );

    const baseUrl =
      process.env['PUBLIC_INGRESS_URL'] ?? 'https://relayon-ingress.vercel.app';
    return {
      sessionId,
      url: `${baseUrl}/play/${sessionId}`,
      expiresAt: new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString(),
    };
  }

  async capture(
    sessionId: string,
    req: {
      method: string;
      path: string;
      headers: Record<string, string | string[] | undefined>;
      body: Buffer;
    },
  ): Promise<boolean> {
    const valid = await this.redis.raw.get(`playground:session:${sessionId}`);
    if (!valid) return false;

    const captured: CapturedRequest = {
      id: randomUUID(),
      sessionId,
      receivedAt: new Date().toISOString(),
      method: req.method,
      path: req.path,
      headers: sanitizeHeaders(req.headers),
      body: req.body.toString('utf8').slice(0, 10_000),
      contentType: (req.headers['content-type'] as string) ?? 'unknown',
      sizeBytes: req.body.length,
    };

    await this.redis.raw.lpush(
      `playground:reqs:${sessionId}`,
      JSON.stringify(captured),
    );
    await this.redis.raw.ltrim(
      `playground:reqs:${sessionId}`,
      0,
      MAX_REQUESTS_PER_SESSION - 1,
    );
    await this.redis.raw.expire(
      `playground:reqs:${sessionId}`,
      SESSION_TTL_SEC,
    );
    await this.redis.raw.publish(
      `playground:stream:${sessionId}`,
      JSON.stringify(captured),
    );

    return true;
  }

  async list(sessionId: string): Promise<CapturedRequest[]> {
    const rows = await this.redis.raw.lrange(
      `playground:reqs:${sessionId}`,
      0,
      -1,
    );
    return rows.map((r) => JSON.parse(r) as CapturedRequest);
  }

  async clear(sessionId: string): Promise<void> {
    await this.redis.raw.del(`playground:reqs:${sessionId}`);
  }
}

function sanitizeHeaders(
  h: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const SENSITIVE = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
  ]);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (SENSITIVE.has(k.toLowerCase())) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 500);
    else if (Array.isArray(v)) out[k] = v.join(', ').slice(0, 500);
  }
  return out;
}