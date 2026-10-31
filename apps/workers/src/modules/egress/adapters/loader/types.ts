export interface SandboxResponse {
  success: boolean;
  statusCode: number;
  latencyMs: number;
  responseBody: string;
  error: string | null;
  retryable: boolean;
}

export interface SandboxModule {
  send(
    config: Record<string, unknown>,
    payload: unknown,
    context: {
      eventId: string;
      correlationId: string;
      attemptNumber: number;
    },
  ): Promise<SandboxResponse>;
}