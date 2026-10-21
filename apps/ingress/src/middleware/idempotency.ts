import type { RequestHandler } from 'express';
import { createHash } from 'crypto';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24; // 24 hours

function deriveIdempotencyKey(req: Parameters<RequestHandler>[0]): string | null {
  const candidates = [
    req.headers['idempotency-key'],
    req.headers['x-github-delivery'],
    req.headers['x-shopify-webhook-id'],
    req.headers['x-event-id'],
    req.headers['x-slack-event-id'],
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  // Fallback: hash the raw body. Retries from the same source with the
  // same payload within 24h will be deduplicated. Sources that need
  // finer control should send an idempotency header.
  if (req.rawBody && req.rawBody.length > 0) {
    const hash = createHash('sha256').update(req.rawBody).digest('hex');
    return `body:${hash.slice(0, 32)}`;
  }

  return null;
}

export const enforceIdempotency: RequestHandler = async (req, res, next) => {
  const workflow = req.workflow;
  if (!workflow) {
    throw new Error('resolveWorkflow must run before enforceIdempotency');
  }

  const key = deriveIdempotencyKey(req);
  if (!key) {
    // No way to derive key — skip idempotency, let the event through
    return next();
  }

  const redisKey = `idempotency:${workflow.id}:${key}`;

  // SET ... NX EX — atomic create-if-not-exists with TTL.
  // Returns 'OK' on success, null if the key already exists.
  const result = await redis.set(
    redisKey,
    '1',
    'EX',
    IDEMPOTENCY_TTL_SECONDS,
    'NX',
  );

  if (result !== 'OK') {
    req.isDuplicate = true;
    logger.info('webhook.duplicate', {
      correlationId: req.correlationId,
      workflowId: workflow.id,
      idempotencyKey: key,
    });
    res.status(200).json({
      status: 'duplicate',
      message: 'Event already processed',
      correlationId: req.correlationId,
    });
    return;
  }

  req.idempotencyKey = key;
  next();
};