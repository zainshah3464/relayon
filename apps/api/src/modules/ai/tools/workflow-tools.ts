import type { ToolDefinition } from './tool.types';

export const listWorkflowsTool: ToolDefinition = {
  name: 'list_workflows',
  description:
    'List the user\'s workflows. Use when user asks "show me my workflows", "what do I have". Summarize results in 2-3 bullets — do not dump the full JSON.',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  async execute(_args, ctx) {
    const workflows = await ctx.prisma.withTenant(ctx.tenantId, (tx) =>
      tx.workflow.findMany({
        where: { tenantId: ctx.tenantId },
        select: {
          id: true,
          name: true,
          sourceType: true,
          isActive: true,
          enrichmentEnabled: true,
          _count: { select: { destinations: true } },
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    );
    return {
      count: workflows.length,
      workflows: workflows.map((w) => ({
        name: w.name,
        source: w.sourceType,
        status: w.isActive ? 'active' : 'paused',
        destinations: w._count.destinations,
        enrichment: w.enrichmentEnabled,
      })),
      instruction:
        'Summarize in bullets: "You have N workflows:" then list name + source + status. Do not paste JSON.',
    };
  },
};

export const getWorkflowTool: ToolDefinition = {
  name: 'get_workflow',
  description:
    'Get full details of a specific workflow by ID. Use when debugging or user asks about a specific workflow.',
  parameters: {
    type: 'object',
    properties: {
      workflowId: { type: 'string', description: 'Workflow UUID' },
    },
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
      id: wf.id,
      name: wf.name,
      sourceType: wf.sourceType,
      isActive: wf.isActive,
      enrichmentEnabled: wf.enrichmentEnabled,
      transformExpression: wf.transformExpression,
      destinationCount: wf.destinations.length,
      destinations: wf.destinations.map((d) => ({
        type: d.type,
        name: d.name,
        enabled: d.enabled,
      })),
      schedule: wf.schedule
        ? { cron: wf.schedule.cronExpression, active: wf.schedule.isActive }
        : null,
      instruction:
        'Present to user in plain language. Example: "Your workflow X receives from Stripe, sends to Slack, AI enrichment is on." Do not paste JSON.',
    };
  },
};

export const createWorkflowTool: ToolDefinition = {
  name: 'create_workflow',
  description:
    'Create a new workflow. ONLY call this AFTER: (1) user explicitly said to create one, AND (2) you have confirmed name, sourceType, and secret with them. If user said "create a Stripe workflow" but did not provide a secret, ASK for the secret first, do not call this tool.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'Workflow name (2-80 chars). Prefer descriptive names like "Stripe → Slack alerts".',
      },
      sourceType: {
        type: 'string',
        enum: ['stripe', 'github', 'shopify', 'slack', 'generic'],
        description: 'The webhook source platform.',
      },
      secret: {
        type: 'string',
        description:
          'Signing secret from the source platform (e.g. whsec_... for Stripe). User must provide this — never invent or guess.',
      },
      enrichmentEnabled: {
        type: 'boolean',
        description:
          'Enable AI enrichment. Default false. Set true only if user explicitly wants AI summaries/classifications.',
      },
    },
    required: ['name', 'sourceType', 'secret'],
    additionalProperties: false,
  },
  requiresConfirmation: true,
  allowedRoles: ['owner', 'admin'],
  async execute(args, ctx) {
    const name = String(args['name'] ?? '').slice(0, 80).trim();
    const sourceType = String(args['sourceType'] ?? '');
    const secret = String(args['secret'] ?? '').trim();
    const enrichmentEnabled = Boolean(args['enrichmentEnabled'] ?? false);

    if (name.length < 2) {
      return {
        error: 'Name must be 2-80 characters. Ask user for a proper name.',
      };
    }
    if (
      !['stripe', 'github', 'shopify', 'slack', 'generic'].includes(sourceType)
    ) {
      return {
        error: `Invalid sourceType "${sourceType}". Must be one of: stripe, github, shopify, slack, generic.`,
      };
    }
    if (secret.length < 8) {
      return {
        error:
          'Secret must be at least 8 characters. Ask the user for the signing secret from their source platform.',
      };
    }

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

    const webhookUrl = `${process.env['INGRESS_URL'] ?? 'http://localhost:3002'}/webhook/${ctx.tenantId}/${wf.id}`;

    return {
      created: true,
      workflowId: wf.id,
      name: wf.name,
      sourceType: wf.sourceType,
      enrichmentEnabled: wf.enrichmentEnabled,
      webhookUrl,
      instruction: `Present success in this format:
"✅ Created **${wf.name}**!

Webhook URL: \`${webhookUrl}\`

Next steps:
1. Paste this URL into ${wf.sourceType === 'stripe' ? 'Stripe Dashboard → Webhooks' : wf.sourceType === 'github' ? 'GitHub repo Settings → Webhooks' : 'your source platform'}
2. Add a destination: open **Workflows** → **${wf.name}** → **+ Add destination**
3. Test with a real event"

Do not paste JSON.`,
    };
  },
};