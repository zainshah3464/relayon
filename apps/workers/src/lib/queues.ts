import type { SourceType } from '@prisma/client';

export const INCOMING_QUEUE = 'queue:events:incoming';
export const PROCESSING_QUEUE = 'queue:events:processing';
export const EGRESS_QUEUE = 'queue:egress:pending';

export const EGRESS_PENDING_QUEUE = EGRESS_QUEUE; // alias for readability
export const EGRESS_DELAYED_QUEUE = 'queue:egress:delayed';

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

export interface EgressJob {
  tenantId: string;
  eventId: string;
  correlationId: string;
  destinationId: string;
  destinationType: string;
  destinationConfig: Record<string, unknown>;
  payload: unknown;
  attemptCount: number;
  enqueuedAt: string;
}