import { Schema } from 'mongoose';

export type EventStatus = 'received' | 'processing' | 'processed' | 'failed';

export interface EventDoc {
  _id?: string;
  correlationId: string;
  tenantId: string;
  workflowId: string;
  sourceType: string;
  rawPayload: unknown;
  headers: Record<string, string>;
  ipHash: string | null;
  userAgent: string | null;
  idempotencyKey: string | null;
  receivedAt: Date;
  processedAt: Date | null;
  enrichedPayload: unknown | null;
  transformedPayload: unknown | null;
  enrichment: {
    enabled: boolean;
    cached: boolean;
    model: string | null;
    durationMs: number;
    error: string | null;
  } | null;
  status: EventStatus;
  error: { stage: string; code: string; message: string } | null;
  ttlExpiresAt: Date;
}

export const EventDocument = { name: 'Event' };

export const EventSchema = new Schema<EventDoc>(
  {
    correlationId: { type: String, required: true, unique: true, index: true },
    tenantId: { type: String, required: true, index: true },
    workflowId: { type: String, required: true, index: true },
    sourceType: { type: String, required: true },
    rawPayload: { type: Schema.Types.Mixed, required: true },
    headers: { type: Schema.Types.Mixed, default: {} },
    ipHash: { type: String, default: null },
    userAgent: { type: String, default: null },
    idempotencyKey: { type: String, default: null },
    receivedAt: { type: Date, required: true },
    processedAt: { type: Date, default: null },
    enrichedPayload: { type: Schema.Types.Mixed, default: null },
    transformedPayload: { type: Schema.Types.Mixed, default: null },
    enrichment: { type: Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ['received', 'processing', 'processed', 'failed'],
      required: true,
      default: 'processing',
      index: true,
    },
    error: { type: Schema.Types.Mixed, default: null },
    ttlExpiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { collection: 'events', versionKey: false },
);

EventSchema.index({ tenantId: 1, receivedAt: -1 });
EventSchema.index({ workflowId: 1, receivedAt: -1 });
EventSchema.index({ tenantId: 1, status: 1 });