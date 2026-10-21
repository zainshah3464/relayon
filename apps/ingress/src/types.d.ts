import type { SourceType } from '@prisma/client';

export interface WorkflowContext {
  id: string;
  tenantId: string;
  sourceType: SourceType;
  sourceConfig: Record<string, unknown>;
}

declare global {
  namespace Express {
    interface Request {
      rawBody: Buffer;
      correlationId: string;
      workflow?: WorkflowContext;
      isDuplicate?: boolean;
      idempotencyKey?: string;
    }
  }
}

export {};