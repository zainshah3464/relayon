import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

const MAX_BUFFER = 200;
const SESSION_TTL = 24 * 3600;

interface CapturedWebhook {
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

export async function captureTunnelWebhook(
  sessionId: string,
  req: {
    method: string;
    path: string;
    headers: Record<string, string | string[] | undefined>;
    body: Buffer;
  },
): Promise<{ captured: boolean; id?: string }> {
  // ⚠️ tunnel_sessions table MUST NOT have RLS — cross-tenant lookup by sessionId
  const session = await prisma.tunnelSession.findUnique({ where: { sessionId } });
  if (!session || !session.isActive || session.expiresAt < new Date()) {
    return { captured: false };
  }

  const id = randomBytes(12).toString('hex');
  const webhook: CapturedWebhook = {
    id,
    sessionId,
    receivedAt: new Date().toISOString(),
    method: req.method,
    path: req.path,
    headers: sanitize(req.headers),
    body: req.body.toString('utf8').slice(0, 50_000),
    contentType: (req.headers['content-type'] as string) ?? 'unknown',
    sizeBytes: req.body.length,
  };

  const listKey = `tunnel:reqs:${sessionId}`;
  const pipeline = redis.pipeline();
  pipeline.lpush(listKey, JSON.stringify(webhook));
  pipeline.ltrim(listKey, 0, MAX_BUFFER - 1);
  pipeline.expire(listKey, SESSION_TTL);
  pipeline.publish(`tunnel:stream:${sessionId}`, JSON.stringify(webhook));
  await pipeline.exec();

  // Touch lastSeenAt (best effort)
  prisma.tunnelSession
    .update({
      where: { sessionId },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => undefined);

  logger.info('tunnel.captured', { sessionId, id, size: req.body.length });
  return { captured: true, id };
}

function sanitize(
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