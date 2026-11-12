import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { resolveWorkflow } from '../middleware/resolveWorkflow';
import { enforceSignature } from '../middleware/signature';
import { atomicIngest } from '../lib/redis-batch';
import type { QueuedEvent } from '../lib/queue';
import { hashIp } from '../lib/hash';
import { config } from '../config';
import { BadRequestError, QuotaExceededError } from '../lib/errors';
import { checkEventQuota } from '../lib/quota';
import { logger } from '../lib/logger';

// ⚠️ v2.3 — queue key (must match workers' INCOMING_QUEUE)
const INCOMING_QUEUE = 'queue:events:incoming';

// ⚠️ v2.3 — per-tenant per-minute rate limit
const RATE_LIMIT_PER_MINUTE = Number(
  process.env.RATE_LIMIT_PER_MINUTE ?? 1000,
);

export const webhookRouter = Router();

webhookRouter.use((req, _res, next) => {
  const existing = req.headers['x-correlation-id'];
  req.correlationId =
    typeof existing === 'string' && existing.length > 0
      ? existing
      : randomUUID();
  next();
});

// ⚠️ v2.3 — idempotency + rate limit middleware ab yahan nahi
// (atomic Lua script handle karega)
webhookRouter.post(
  '/:tenantId/:workflowId',
  resolveWorkflow,
  enforceSignature,
  handleWebhook,
);

async function handleWebhook(req: Request, res: Response): Promise<void> {
  const workflow = req.workflow;
  if (!workflow) {
    throw new Error('workflow missing — resolveWorkflow did not run');
  }

  const payload = req.body as unknown;
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    Buffer.isBuffer(payload)
  ) {
    throw new BadRequestError('Payload must be a JSON object');
  }

  // ── Quota check (atomic decrement, RLS-safe) ────────────────
  const quota = await checkEventQuota(workflow.tenantId, 1);

  res.setHeader('X-Quota-Metric', 'events');
  res.setHeader('X-Quota-Limit', String(quota.limit));
  res.setHeader('X-Quota-Remaining', String(quota.remaining));
  res.setHeader('X-Quota-Reset', quota.resetAt);
  res.setHeader('X-Quota-Mode', quota.mode);

  if (quota.warning) {
    res.setHeader(
      'X-Quota-Warning',
      `Usage at ${Math.round(
        (quota.used / Math.max(quota.limit, 1)) * 100,
      )}% — approaching limit`,
    );
  }

  if (!quota.allowed) {
    const message =
      quota.mode === 'soft'
        ? `Monthly event quota exceeded in soft mode (hard cap at ${
            quota.limit * 2
          }). Resets ${quota.resetAt.slice(0, 10)}.`
        : `Monthly event quota exceeded (${
            quota.limit
          }). Resets ${quota.resetAt.slice(0, 10)}.`;

    throw new QuotaExceededError(message, quota.resetAt);
  }

  // ⚠️ v2.3 — derive idempotency key from header OR correlationId
  const headerIdem =
    typeof req.headers['x-idempotency-key'] === 'string'
      ? req.headers['x-idempotency-key']
      : null;
  const idempotencyKey = `idem:${workflow.tenantId}:${workflow.id}:${
    headerIdem ?? req.correlationId
  }`;

  // ⚠️ v2.3 — per-tenant per-minute rate limit bucket
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const rateLimitKey = `rl:${workflow.tenantId}:${minuteBucket}`;

  const event: QueuedEvent = {
    correlationId: req.correlationId,
    tenantId: workflow.tenantId,
    workflowId: workflow.id,
    sourceType: workflow.sourceType,
    receivedAt: new Date().toISOString(),
    rawPayload: payload as Record<string, unknown>,
    headers: sanitizeHeaders(req.headers),
    ipHash: hashIp(req.ip ?? undefined, config.IP_HASH_SALT),
    userAgent:
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : null,
    idempotencyKey: headerIdem,
  };

  // ⚠️ v2.3 — atomic: idempotency + rate limit + queue push (1 Lua script)
  const ingest = await atomicIngest({
    idempotencyKey,
    rateLimitKey,
    queueKey: INCOMING_QUEUE,
    eventJson: JSON.stringify(event),
    rateLimit: RATE_LIMIT_PER_MINUTE,
    windowSeconds: 60,
  });

  if (ingest.status === 'duplicate') {
    logger.info('webhook.duplicate_skip', {
      correlationId: event.correlationId,
      tenantId: event.tenantId,
      workflowId: event.workflowId,
    });
    res.status(200).json({
      status: 'duplicate',
      correlationId: req.correlationId,
      message: 'Duplicate event (idempotency key reused)',
    });
    return;
  }

  if (ingest.status === 'rate_limited') {
    logger.warn('webhook.rate_limited', {
      correlationId: event.correlationId,
      tenantId: event.tenantId,
      workflowId: event.workflowId,
      limit: RATE_LIMIT_PER_MINUTE,
    });
    res.setHeader('Retry-After', '60');
    res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_PER_MINUTE));
    res.status(429).json({
      status: 'rate_limited',
      correlationId: req.correlationId,
      message: `Rate limit exceeded (${RATE_LIMIT_PER_MINUTE}/min). Retry in a minute.`,
    });
    return;
  }

  res.setHeader('X-Queue-Depth', String(ingest.queueDepth));

  logger.info('webhook.accepted', {
    correlationId: event.correlationId,
    tenantId: event.tenantId,
    workflowId: event.workflowId,
    sourceType: event.sourceType,
    payloadBytes: req.rawBody?.length ?? 0,
    queueDepth: ingest.queueDepth,
  });

  res.status(202).json({
    status: 'accepted',
    correlationId: req.correlationId,
    message: 'Event queued for processing',
    queueDepth: ingest.queueDepth,
  });
}

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'proxy-authorization',
]);

function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) continue;
    if (typeof value === 'string') out[key] = value;
    else if (Array.isArray(value)) out[key] = value.join(', ');
  }
  return out;
}