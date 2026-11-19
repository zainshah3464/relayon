import type { ToolDefinition } from './tool.types';

export const searchDocsTool: ToolDefinition = {
  name: 'search_docs',
  description:
    'Search Relayon documentation. Returns CLEANED excerpts (no markdown headers). ALWAYS call this before answering any "how do I" or "what is" question. After receiving results, SYNTHESIZE a tailored answer — never paste the excerpts verbatim.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'User intent in 2-8 words, expanded with synonyms. Example: "create workflow setup steps new". Include the actual topic, not just the literal question.',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  async execute(args, ctx) {
    const rawQuery = String(args['query'] ?? '').slice(0, 200);
    if (!rawQuery) return { error: 'query is required' };

    // Step 1: expand query with synonyms
    const expandedQuery = expandQuery(rawQuery);

    // Step 2: multi-tier search (FTS → plain → keywords → ILIKE)
    let results = await ctx.rag.search(ctx.tenantId, expandedQuery, 4);

    if (results.length === 0) {
      results = await ctx.rag.search(ctx.tenantId, rawQuery, 4);
    }

    if (results.length === 0) {
      const keywords = rawQuery.split(/\s+/).filter((k) => k.length > 3);
      for (const kw of keywords.slice(0, 3)) {
        const r = await ctx.rag.search(ctx.tenantId, kw, 3);
        if (r.length > 0) {
          results = r;
          break;
        }
      }
    }

    if (results.length === 0) {
      return {
        results: [],
        instruction:
          'No docs found. Tell the user you could not find specific docs. Suggest they check /guide or contact hello@relayon.dev. Do NOT invent features.',
      };
    }

    // Step 3: extract clean, relevant excerpts
    return {
      results: results.slice(0, 3).map((r) => ({
        title: r.title,
        excerpt: extractRelevantExcerpt(r.content, rawQuery),
      })),
      instruction:
        'CRITICAL: You now have raw doc excerpts. DO NOT paste them. Instead: (1) Read them. (2) Extract only what answers THIS user\'s question. (3) Rewrite in plain, tailored language. (4) If they asked "how to", give numbered steps specific to their case. (5) Max 250 words.',
    };
  },
};

// ═══ Query expansion — synonyms ═══
const EXPANSIONS: Record<string, string[]> = {
  workflow: ['workflow', 'pipeline', 'automation', 'setup', 'create'],
  create: ['create', 'add', 'new', 'make', 'setup', 'build'],
  add: ['add', 'create', 'new', 'setup'],
  destination: ['destination', 'slack', 'email', 'http', 'webhook', 'deliver', 'output'],
  source: ['source', 'trigger', 'webhook', 'input', 'receive'],
  slack: ['slack', 'channel', 'message', 'destination'],
  discord: ['discord', 'channel', 'message', 'destination'],
  email: ['email', 'resend', 'notification'],
  webhook: ['webhook', 'source', 'trigger', 'receive', 'post'],
  signature: ['signature', 'hmac', 'verify', 'secret', 'security'],
  secret: ['secret', 'signing', 'hmac', 'key', 'auth'],
  error: ['error', 'fail', 'debug', 'troubleshoot', 'broken'],
  fail: ['fail', 'error', 'retry', 'debug'],
  retry: ['retry', 'backoff', 'attempt', 'fail'],
  quota: ['quota', 'limit', 'events', 'usage', 'billing'],
  limit: ['limit', 'quota', 'throttle', 'rate'],
  dlq: ['dlq', 'dead', 'letter', 'failed', 'retry', 'replay'],
  ai: ['ai', 'enrichment', 'groq', 'llm', 'summarize', 'classify'],
  enrichment: ['enrichment', 'ai', 'groq', 'summarize', 'transform'],
  transform: ['transform', 'jsonata', 'reshape', 'modify'],
  api: ['api', 'key', 'token', 'auth', 'endpoint'],
  key: ['key', 'api', 'token', 'secret', 'auth'],
  schedule: ['schedule', 'cron', 'timer', 'recurring'],
  cron: ['cron', 'schedule', 'timer', 'recurring'],
};

function expandQuery(query: string): string {
  const words = query.toLowerCase().split(/\s+/);
  const expanded = new Set<string>(words);
  for (const word of words) {
    const clean = word.replace(/[^a-z0-9]/g, '');
    const exps = EXPANSIONS[clean];
    if (exps) exps.forEach((e) => expanded.add(e));
  }
  return Array.from(expanded).join(' ');
}

// ═══ Excerpt extraction — clean markdown, find most relevant paragraph ═══
function extractRelevantExcerpt(content: string, query: string): string {
  const cleaned = content
    .replace(/^#{1,6}\s+.+$/gm, '')
    .replace(/^---+\s*$/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned.length === 0) return content.slice(0, 400);

  const paragraphs = cleaned.split(/\n\n+/).filter((p) => p.trim().length > 20);

  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const scored = paragraphs.map((p, i) => {
    const lower = p.toLowerCase();
    const score = queryWords.reduce(
      (acc, w) => acc + (lower.includes(w) ? 1 : 0),
      0,
    );
    const positionBonus = Math.max(0, 1 - i * 0.1);
    return { p, score: score + positionBonus };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 2).map((s) => s.p).join('\n\n');
  return top.slice(0, 600);
}