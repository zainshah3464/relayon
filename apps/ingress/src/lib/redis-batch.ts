import { redis } from './redis';

/**
 * ⚠️ v2.3 scaling — batches Redis commands to reduce Upstash usage.
 *
 * Free tier: 500K commands/month = ~16K/day.
 * Old approach: ~5-7 commands per webhook → crash at 1000 webhooks/day.
 * New approach: 1 Lua script → ~16K webhooks/day (16× capacity).
 */

/**
 * Basic pipeline: idempotency + queue push + depth — 3 commands in 1 round-trip.
 * Use when you don't need atomic rate limiting.
 */
export async function pipelineIdempotencyAndQueue(
  idempotencyKey: string,
  queueKey: string,
  eventJson: string,
  ttlSeconds: number,
): Promise<{ isDuplicate: boolean; queueDepth: number }> {
  const pipeline = redis.pipeline();

  pipeline.set(idempotencyKey, '1', 'EX', ttlSeconds, 'NX');
  pipeline.lpush(queueKey, eventJson);
  pipeline.llen(queueKey);

  const results = await pipeline.exec();
  const setResult = results?.[0]?.[1] as string | null;
  const queueDepth = (results?.[2]?.[1] as number) ?? 0;

  return { isDuplicate: setResult !== 'OK', queueDepth };
}

/**
 * ATOMIC ingest — idempotency + rate limit + queue push in ONE Lua script.
 * This is the primary function used in the webhook handler.
 *
 * Returns:
 *   { status: 'ok', queueDepth }              → event accepted
 *   { status: 'duplicate', queueDepth: 0 }    → idempotency hit, skip
 *   { status: 'rate_limited', queueDepth: 0 } → tenant rate limit exceeded
 */
const ATOMIC_INGEST_SCRIPT = `
  local idemKey    = KEYS[1]
  local rateKey    = KEYS[2]
  local queueKey   = KEYS[3]
  local eventJson  = ARGV[1]
  local rateLimit  = tonumber(ARGV[2])
  local windowSec  = tonumber(ARGV[3])
  local idemTtlSec = tonumber(ARGV[4])

  -- 1. Idempotency check (SET NX EX)
  local ok = redis.call('SET', idemKey, '1', 'EX', idemTtlSec, 'NX')
  if not ok then
    return {0, -1, 0}  -- duplicate
  end

  -- 2. Rate limit (INCR + EXPIRE on first hit)
  local count = redis.call('INCR', rateKey)
  if count == 1 then
    redis.call('EXPIRE', rateKey, windowSec)
  end
  if count > rateLimit then
    return {1, count, -1}  -- rate limited
  end

  -- 3. Queue push
  local depth = redis.call('LPUSH', queueKey, eventJson)
  return {2, count, depth}  -- ok
`;

export interface AtomicIngestResult {
  status: 'ok' | 'duplicate' | 'rate_limited';
  queueDepth: number;
}

export async function atomicIngest(opts: {
  idempotencyKey: string;
  rateLimitKey: string;
  queueKey: string;
  eventJson: string;
  rateLimit: number;
  windowSeconds: number;
  idempotencyTtlSeconds?: number;
}): Promise<AtomicIngestResult> {
  const idemTtl = opts.idempotencyTtlSeconds ?? 86400; // 24h default

  const result = (await redis.eval(
    ATOMIC_INGEST_SCRIPT,
    3,
    opts.idempotencyKey,
    opts.rateLimitKey,
    opts.queueKey,
    opts.eventJson,
    opts.rateLimit,
    opts.windowSeconds,
    idemTtl,
  )) as [number, number, number];

  const [statusCode, , depth] = result;

  if (statusCode === 0) return { status: 'duplicate', queueDepth: 0 };
  if (statusCode === 1) return { status: 'rate_limited', queueDepth: 0 };
  return { status: 'ok', queueDepth: Number(depth) };
}