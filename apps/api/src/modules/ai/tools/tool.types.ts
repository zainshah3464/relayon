import type { PrismaService } from '../../prisma/prisma.service';
import type { RagService } from '../rag.service';

export interface ToolContext {
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin' | 'viewer';
  prisma: PrismaService;
  rag: RagService;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: false;
  };
  requiresConfirmation?: boolean;
  allowedRoles?: Array<'owner' | 'admin' | 'viewer'>;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
}