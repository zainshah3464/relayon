import type { ToolDefinition } from './tool.types';

export const searchDocsTool: ToolDefinition = {
  name: 'search_docs',
  description:
    'Search Relayon documentation for features, setup, workflows, OAuth, billing, quotas, adapters, or troubleshooting. Use whenever the user asks "how do I...", "what is...", or any question that might be answered by product docs.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Short search query (2-8 words). Example: "how to add slack destination".',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  async execute(args, ctx) {
    const query = String(args['query'] ?? '').slice(0, 200);
    if (!query) return { error: 'query is required' };

    const results = await ctx.rag.search(ctx.tenantId, query, 5);
    if (results.length === 0) {
      return { results: [], note: 'No documentation found for this query.' };
    }
    return {
      results: results.map((r) => ({
        title: r.title,
        excerpt: r.content.slice(0, 800),
        source: r.sourceId,
      })),
    };
  },
};