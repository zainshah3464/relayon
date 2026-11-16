import { randomUUID } from 'node:crypto';
import { redis } from './redis';
import { logger } from './logger';

const MAX_REQUESTS = 100;

interface CapturedRequest {
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

export async function capturePlaygroundRequest(
  sessionId: string,
  req: {
    method: string;
    path: string;
    headers: Record<string, string | string[] | undefined>;
    body: Buffer;
  },
): Promise<boolean> {
  try {
    const valid = await redis.get(`playground:session:${sessionId}`);
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

    await redis.lpush(`playground:reqs:${sessionId}`, JSON.stringify(captured));
    await redis.ltrim(`playground:reqs:${sessionId}`, 0, MAX_REQUESTS - 1);
    await redis.expire(`playground:reqs:${sessionId}`, 3600);
    await redis.publish(
      `playground:stream:${sessionId}`,
      JSON.stringify(captured),
    );
    return true;
  } catch (err) {
    logger.warn('playground.capture_failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
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