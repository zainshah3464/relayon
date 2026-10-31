import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { resolveWorkflow } from '../middleware/resolveWorkflow';
import { enforceSignature } from '../middleware/signature';
import { enforceIdempotency } from '../middleware/idempotency';
import { enforceRateLimit } from '../middleware/rateLimit';
import { enqueueEvent, type QueuedEvent } from '../lib/queue';
import { hashIp } from '../lib/hash';
import { config } from '../config';
import { BadRequestError, QuotaExceededError } from '../lib/errors';
import { checkEventQuota } from '../lib/quota';
import { logger } from '../lib/logger';

export const webhookRouter = Router();

webhookRouter.use((req, _res, next) => {
  const existing = req.headers['x-correlation-id'];
  req.correlationId =
    typeof existing === 'string' && existing.length > 0
      ? existing
      : randomUUID();
  next();
});

webhookRouter.post(
  '/:tenantId/:workflowId',
  resolveWorkflow,
  enforceSignature,
  enforceIdempotency,
  enforceRateLimit,
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
        : `Monthly event quota exceeded (${quota.limit}). Resets ${quota.resetAt.slice(0, 10)}.`;

    throw new QuotaExceededError(message, quota.resetAt);
  }

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
    idempotencyKey: req.idempotencyKey ?? null,
  };

  await enqueueEvent(event);

  logger.info('webhook.accepted', {
    correlationId: event.correlationId,
    tenantId: event.tenantId,
    workflowId: event.workflowId,
    sourceType: event.sourceType,
    payloadBytes: req.rawBody?.length ?? 0,
  });

  res.status(202).json({
    status: 'accepted',
    correlationId: req.correlationId,
    message: 'Event queued for processing',
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