import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { resolveWorkflow } from '../middleware/resolveWorkflow';
import { enforceSignature } from '../middleware/signature';
import { enforceIdempotency } from '../middleware/idempotency';
import { enforceRateLimit } from '../middleware/rateLimit';
import { enqueueEvent, type QueuedEvent } from '../lib/queue';
import { hashIp } from '../lib/hash';
import { config } from '../config';
import { BadRequestError } from '../lib/errors';
import { logger } from '../lib/logger';

export const webhookRouter = Router();

/**
 * Assign a correlation ID to every request. Included in responses and
 * all logs, so a webhook can be traced end-to-end across ingress,
 * workers, and egress.
 */
webhookRouter.use((req, _res, next) => {
  const existing = req.headers['x-correlation-id'];
  req.correlationId =
    typeof existing === 'string' && existing.length > 0
      ? existing
      : randomUUID();
  next();
});

/**
 * POST /webhook/:tenantId/:workflowId
 *
 * Middleware chain:
 *   1. resolveWorkflow   — loads + validates workflow from DB
 *   2. enforceSignature  — validates HMAC per source type
 *   3. enforceIdempotency — 200 if duplicate, else marks as seen
 *   4. enforceRateLimit  — 429 if workflow exceeds quota
 *   5. handler           — enqueues event, returns 202
 */
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