import { redis } from './redis';
import type { SourceType } from '@prisma/client';

/**
 * Payload pushed to the incoming queue. Workers (Phase 4) will consume
 * this via RPOPLPUSH and process it through AI enrichment + transform +
 * egress fan-out.
 */
export interface QueuedEvent {
  correlationId: string;
  tenantId: string;
  workflowId: string;
  sourceType: SourceType;
  receivedAt: string;
  rawPayload: Record<string, unknown>;
  headers: Record<string, string>;
  ipHash: string | null;
  userAgent: string | null;
  idempotencyKey: string | null;
}

export const INCOMING_QUEUE = 'queue:events:incoming';
export const PROCESSING_QUEUE = 'queue:events:processing';

/**
 * Push event to the incoming queue.
 *
 * Uses LPUSH (left push) + RPOP (right pop) pattern in workers so
 * that ordering is FIFO. Workers pop from the right, new events
 * go to the left — natural queue order.
 */
export async function enqueueEvent(event: QueuedEvent): Promise<void> {
  await redis.lpush(INCOMING_QUEUE, JSON.stringify(event));
}