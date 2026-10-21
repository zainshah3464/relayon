import { Schema } from 'mongoose';

export type DeliveryStatus =
  | 'pending'
  | 'delivering'
  | 'delivered'
  | 'dlq';

export interface DeliveryAttempt {
  at: Date;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
}

export interface DeliveryDoc {
  _id?: string;
  tenantId: string;
  eventId: string;
  correlationId: string;
  destinationId: string;
  destinationType: string;
  status: DeliveryStatus;
  attemptCount: number;
  nextAttemptAt: Date;
  lastAttemptAt: Date | null;
  lastResponse: {
    statusCode: number;
    bodySnippet: string;
    latencyMs: number;
  } | null;
  attempts: DeliveryAttempt[];
  error: { code: string; message: string } | null;
  dlqReason: string | null;
  dlqAt: Date | null;
  createdAt: Date;
  deliveredAt: Date | null;
  ttlExpiresAt: Date;
}

export const DeliveryDocument = { name: 'Delivery' };

export const DeliverySchema = new Schema<DeliveryDoc>(
  {
    tenantId: { type: String, required: true, index: true },
    eventId: { type: String, required: true, index: true },
    correlationId: { type: String, required: true, index: true },
    destinationId: { type: String, required: true, index: true },
    destinationType: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'delivering', 'delivered', 'dlq'],
      required: true,
      default: 'pending',
      index: true,
    },
    attemptCount: { type: Number, required: true, default: 0 },
    nextAttemptAt: { type: Date, required: true, index: true },
    lastAttemptAt: { type: Date, default: null },
    lastResponse: { type: Schema.Types.Mixed, default: null },
    attempts: { type: Schema.Types.Mixed, default: [] },
    error: { type: Schema.Types.Mixed, default: null },
    dlqReason: { type: String, default: null },
    dlqAt: { type: Date, default: null },
    createdAt: { type: Date, required: true },
    deliveredAt: { type: Date, default: null },
    ttlExpiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  { collection: 'deliveries', versionKey: false },
);

DeliverySchema.index({ tenantId: 1, status: 1 });
DeliverySchema.index({ destinationId: 1, status: 1 });
DeliverySchema.index({ status: 1, lastAttemptAt: 1 });