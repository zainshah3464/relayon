import type { ToolDefinition } from './tool.types';

export const listWorkflowsTool: ToolDefinition = {
  name: 'list_workflows',
  description: 'List the user\'s workflows. Use when user asks "what workflows do I have", "show my pipelines".',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  async execute(_args, ctx) {
    const workflows = await ctx.prisma.withTenant(ctx.tenantId, (tx) =>
      tx.workflow.findMany({
        where: { tenantId: ctx.tenantId },
        select: {
          id: true, name: true, sourceType: true, isActive: true,
          enrichmentEnabled: true,
          _count: { select: { destinations: true } },
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    );
    return { count: workflows.length, workflows };
  },
};

export const getWorkflowTool: ToolDefinition = {
  name: 'get_workflow',
  description: 'Get full details of a specific workflow by ID, including destinations and configuration.',
  parameters: {
    type: 'object',
    properties: { workflowId: { type: 'string', description: 'Workflow UUID' } },
    required: ['workflowId'],
    additionalProperties: false,
  },
  async execute(args, ctx) {
    const id = String(args['workflowId'] ?? '');
    if (!id) return { error: 'workflowId is required' };

    const wf = await ctx.prisma.withTenant(ctx.tenantId, (tx) =>
      tx.workflow.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: { destinations: true, schedule: true },
      }),
    );
    if (!wf) return { error: 'Workflow not found or access denied' };

    return {
      id: wf.id, name: wf.name, sourceType: wf.sourceType,
      isActive: wf.isActive, enrichmentEnabled: wf.enrichmentEnabled,
      transformExpression: wf.transformExpression,
      destinations: wf.destinations.map((d) => ({
        id: d.id, type: d.type, name: d.name, enabled: d.enabled,
      })),
      schedule: wf.schedule
        ? { cron: wf.schedule.cronExpression, active: wf.schedule.isActive }
        : null,
    };
  },
};

export const createWorkflowTool: ToolDefinition = {
  name: 'create_workflow',
  description:
    'Create a new workflow. Requires confirmation. Only call AFTER user explicitly agreed with specific name, source type, and secret.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Workflow name (2-80 chars)' },
      sourceType: { type: 'string', enum: ['stripe', 'github', 'shopify', 'slack', 'generic'] },
      secret: { type: 'string', description: 'Signing secret from source platform' },
      enrichmentEnabled: { type: 'boolean', description: 'Enable AI enrichment (default: false)' },
    },
    required: ['name', 'sourceType', 'secret'],
    additionalProperties: false,
  },
  requiresConfirmation: true,
  allowedRoles: ['owner', 'admin'],
  async execute(args, ctx) {
    const name = String(args['name'] ?? '').slice(0, 80);
    const sourceType = String(args['sourceType'] ?? '');
    const secret = String(args['secret'] ?? '');
    const enrichmentEnabled = Boolean(args['enrichmentEnabled'] ?? false);

    if (name.length < 2) return { error: 'name must be 2-80 chars' };
    if (!['stripe', 'github', 'shopify', 'slack', 'generic'].includes(sourceType)) {
      return { error: 'invalid sourceType' };
    }
    if (secret.length < 8) return { error: 'secret must be at least 8 chars' };

    const wf = await ctx.prisma.withTenant(ctx.tenantId, (tx) =>
      tx.workflow.create({
        data: {
          tenantId: ctx.tenantId,
          name,
          sourceType: sourceType as never,
          sourceConfig: { secret },
          enrichmentEnabled,
        },
      }),
    );

    return {
      created: true,
      workflowId: wf.id,
      name: wf.name,
      sourceType: wf.sourceType,
      webhookUrl: `${process.env['INGRESS_URL'] ?? 'http://localhost:3002'}/webhook/${ctx.tenantId}/${wf.id}`,
    };
  },
};