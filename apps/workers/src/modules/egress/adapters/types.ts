export interface DeliveryContext {
  destinationId: string;
  destinationType: string;
  config: Record<string, unknown>;
  payload: unknown;
  correlationId: string;
  eventId: string;
  attemptNumber: number;
}

export interface AdapterResult {
  success: boolean;
  statusCode: number;
  latencyMs: number;
  responseBody: string;
  error: string | null;
  /** If false, do not retry — move straight to DLQ. */
  retryable: boolean;
}

export interface DeliveryAdapter {
  readonly type: string;
  send(ctx: DeliveryContext): Promise<AdapterResult>;
}