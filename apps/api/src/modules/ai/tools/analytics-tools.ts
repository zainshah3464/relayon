import type { ToolDefinition } from './tool.types';

export const getDeliveryStatsTool: ToolDefinition = {
  name: 'get_delivery_stats',
  description: 'Get delivery success rate, DLQ count, and queue depth for the user\'s tenant.',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  async execute(_args, ctx) {
    const [activeCount, totalCount] = await Promise.all([
      ctx.prisma.withTenant(ctx.tenantId, (tx) =>
        tx.workflow.count({ where: { tenantId: ctx.tenantId, isActive: true } }),
      ),
      ctx.prisma.withTenant(ctx.tenantId, (tx) =>
        tx.workflow.count({ where: { tenantId: ctx.tenantId } }),
      ),
    ]);

    return {
      activeWorkflows: activeCount,
      totalWorkflows: totalCount,
      note: 'For full delivery metrics, point the user to /analytics',
    };
  },
};

export const listDlqTool: ToolDefinition = {
  name: 'list_dlq',
  description: 'List recent DLQ entries for troubleshooting failed deliveries.',
  parameters: {
    type: 'object',
    properties: { limit: { type: 'number', description: 'Max entries (default 5, max 10)' } },
    additionalProperties: false,
  },
  async execute(args, ctx) {
    const limit = Math.min(Number(args['limit'] ?? 5), 10);
    return {
      note: `Full DLQ list (top ${limit}) needs MongoService wired — direct user to /dlq`,
      hint: 'Use search_docs("dead letter queue") for how to replay.',
    };
  },
};