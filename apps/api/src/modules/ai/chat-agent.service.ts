import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from './rag.service';
import { ALL_TOOLS, getToolByName, toGroqTools } from './tools/registry';
import type { ToolContext } from './tools/tool.types';
// ⚠️ v3.5 — BYOK provider key resolver
import { ProviderKeyResolver } from '../integrations/provider-resolver';

const MAX_ITERATIONS = 5;
const RETRIES_PER_MODEL = 2;

const MODEL_CHAIN = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
] as const;

// ═══════════════════════════════════════════════════════════════
// NEW SYSTEM PROMPT — intent detection + synthesis (v3.6)
// ═══════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `You are Relayon's AI assistant. Your ONE job: help the user solve their actual problem. Not to show them documentation.

## Understanding user intent (CRITICAL — do this first)

Before doing anything, silently classify the user's message:

1. **LEARN** — "How do I...", "What is...", "Explain...", "Why does..."
   → Use search_docs. Then SYNTHESIZE a specific, tailored answer.

2. **DO** — "Create a...", "Make a...", "Set up a...", "Build me a..."
   → This is a COMMAND, not a question. Ask for missing info (name, source type, secret), then use create_workflow.

3. **LIST** — "Show me my...", "What workflows do I have..."
   → Use list_workflows. Summarize results in 2-3 bullets.

4. **DEBUG** — "It's not working", "Why did X fail", "Error..."
   → Use get_workflow + get_delivery_stats. Diagnose, then suggest fix.

5. **CHAT** — "Hi", "Thanks", "What can you do?"
   → Answer briefly. Don't search docs for greetings.

## ABSOLUTE RULES (violation = failure)

### ❌ NEVER DO THESE:
- NEVER paste raw markdown from docs. No "###" headers, no "---", no "## Section".
- NEVER say "According to docs..." or "The documentation says..."
- NEVER paste tool output verbatim (search results, JSON, workflow objects).
- NEVER mention internal tool names (search_docs, create_workflow) to the user.
- NEVER say "File: docs/relayon-guide.md".
- NEVER respond with a wall of text. If > 250 words, you're doing it wrong.
- NEVER invent features that don't exist in the docs.

### ✅ ALWAYS DO THESE:
- ALWAYS understand the intent before acting (see above).
- ALWAYS synthesize: read the docs, extract only what answers THIS user's question, rewrite in your own words.
- ALWAYS give SPECIFIC steps for THEIR case, not generic docs.
- ALWAYS use bold for UI elements: click **Workflows**, not "click the workflows page".
- ALWAYS use numbered steps for "how to" questions.
- ALWAYS end with "Next step:" suggestion if relevant.

## Answer format by intent

**LEARN intent:**
\`\`\`
Here's how to do X:

1. **Step 1** — specific action
2. **Step 2** — specific action
3. **Step 3** — specific action

Example: <concrete example with real values>

⚠️ Common mistake: <one thing to avoid>
\`\`\`

**DO intent:**
Before creating, confirm in one short message:
\`\`\`
I'll create a workflow with:
- Name: "X"
- Source: <type>
- Enrichment: <on/off>

Confirm to proceed? (You'll also need the signing secret from <platform>)
\`\`\`

**DEBUG intent:**
\`\`\`
I see the issue:

**Problem:** <what's failing in one line>
**Why:** <root cause in one line>
**Fix:** <specific action>
\`\`\`

## Example answers (learn from these)

**Good answer (LEARN):**
User: "How do I create a Stripe → Slack workflow?"

Response:
\`\`\`
Here's the 60-second setup:

1. Go to **Workflows** → click **+ New workflow**
2. Name it "Stripe → Slack", pick **Stripe** as source
3. Paste your Stripe signing secret (find it at Stripe Dashboard → Webhooks → your endpoint → Signing secret)
4. Click **Create**, then **+ Add destination** → choose **Slack**
5. Paste your Slack incoming webhook URL, test connection, save

Next: copy the webhook URL from the workflow page and paste it in Stripe → Webhooks → Add endpoint.
\`\`\`

**BAD answer (NEVER do this):**
\`\`\`
## Creating a workflow

A workflow consists of source, transform, destinations.

### Steps
1. Go to Workflows
2. ...
\`\`\`

## User context
- Tenant ID: {{tenantId}}
- Role: {{role}}

Now answer the user. Understand intent first, then act.`;

export interface ChatEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'meta';
  data: unknown;
}

interface ChatCompletionParams {
  messages: Array<Record<string, unknown>>;
  tools?: ReturnType<typeof toGroqTools>;
  tool_choice?: 'auto' | 'none';
  temperature?: number;
  max_tokens?: number;
}

interface GroqResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
  }>;
}

@Injectable()
export class ChatAgentService {
  private readonly logger = new Logger(ChatAgentService.name);
  private readonly platformKey: string | null;
  private readonly platformModel: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
    private readonly keys: ProviderKeyResolver,
  ) {
    this.platformKey = config.get<string>('GROQ_API_KEY') ?? null;
    this.platformModel =
      config.get<string>('GROQ_MODEL') ?? 'openai/gpt-oss-120b';
    if (!this.platformKey) {
      this.logger.warn(
        'GROQ_API_KEY missing — chat falls back to tenant keys',
      );
    }
  }

  isEnabled(): boolean {
    return this.platformKey !== null;
  }

  private async createCompletion(
    params: ChatCompletionParams & { apiKey: string; models: readonly string[] },
  ): Promise<GroqResponse> {
    const errors: string[] = [];

    for (const model of params.models) {
      for (let attempt = 1; attempt <= RETRIES_PER_MODEL; attempt++) {
        try {
          this.logger.debug(
            `Model ${model} (attempt ${attempt}/${RETRIES_PER_MODEL})`,
          );

          const res = await fetch(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${params.apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: params.messages,
                tools: params.tools,
                tool_choice: params.tool_choice,
                // ⚠️ v3.6 — lower temperature (0.3 → 0.2) for focused answers
                temperature: params.temperature ?? 0.2,
                max_tokens: params.max_tokens ?? 1024,
              }),
              signal: AbortSignal.timeout(60_000),
            },
          );

          if (!res.ok) {
            const status = res.status;
            const detail = await res.text().catch(() => '');
            const errMsg = `${model} ${status}: ${detail.slice(0, 150)}`;
            errors.push(errMsg);

            const shouldFallback =
              status === 429 ||
              status === 500 ||
              status === 502 ||
              status === 503 ||
              status === 504;

            if (!shouldFallback) throw new Error(errMsg);

            if (attempt < RETRIES_PER_MODEL) {
              await new Promise((r) => setTimeout(r, 500 * attempt));
              continue;
            }
            this.logger.warn(
              `${model} exhausted retries (${status}), next model...`,
            );
            break;
          }

          const json = (await res.json()) as GroqResponse;
          this.logger.debug(`✅ Success: ${model} (attempt ${attempt})`);
          return json;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);

          if (msg.includes('aborted') || msg.includes('timeout')) {
            errors.push(`${model} attempt ${attempt}: timeout`);
            if (attempt < RETRIES_PER_MODEL) {
              await new Promise((r) => setTimeout(r, 500 * attempt));
              continue;
            }
            break;
          }

          if (
            msg.includes('fetch failed') ||
            msg.includes('ECONNREFUSED') ||
            msg.includes('ECONNRESET') ||
            msg.includes('ENOTFOUND')
          ) {
            errors.push(
              `${model} attempt ${attempt}: network — ${msg.slice(0, 80)}`,
            );
            if (attempt < RETRIES_PER_MODEL) {
              await new Promise((r) => setTimeout(r, 500 * attempt));
              continue;
            }
            break;
          }

          throw err;
        }
      }
    }

    throw new Error(`All Groq models failed:\n${errors.join('\n')}`);
  }

  async *run(opts: {
    tenantId: string;
    userId: string;
    role: 'owner' | 'admin' | 'viewer';
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): AsyncGenerator<ChatEvent> {
    const resolved = await this.keys.resolve(opts.tenantId, 'groq');
    if (!resolved) {
      yield {
        type: 'error',
        data: {
          message:
            'AI assistant is not configured. Add your Groq API key in Settings → Integrations.',
        },
      };
      return;
    }

    const models = resolved.model
      ? [resolved.model, ...MODEL_CHAIN.filter((m) => m !== resolved.model)]
      : [...MODEL_CHAIN];

    yield { type: 'meta', data: { source: resolved.source, model: models[0] } };

    const ctx: ToolContext = {
      tenantId: opts.tenantId,
      userId: opts.userId,
      role: opts.role,
      prisma: this.prisma,
      rag: this.rag,
    };

    const allowedTools = ALL_TOOLS.filter(
      (t) => !t.allowedRoles || t.allowedRoles.includes(opts.role),
    );
    const groqTools = toGroqTools(allowedTools);

    const conversation: Array<Record<string, unknown>> = [
      {
        role: 'system',
        content: SYSTEM_PROMPT.replace('{{tenantId}}', opts.tenantId).replace(
          '{{role}}',
          opts.role,
        ),
      },
      ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        const isLast = iter === MAX_ITERATIONS - 1;

        const response = await this.createCompletion({
          messages: conversation,
          tools: groqTools.length > 0 && !isLast ? groqTools : undefined,
          tool_choice: isLast ? 'none' : 'auto',
          apiKey: resolved.key,
          models,
        });

        const msg = response.choices[0]?.message;
        if (!msg) {
          yield {
            type: 'error',
            data: { message: 'Empty response from model' },
          };
          return;
        }

        const toolCalls = msg.tool_calls ?? [];

        if (toolCalls.length === 0) {
          const raw = msg.content ?? '';
          const content = raw
            .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
            .replace(/<function=[\s\S]*?<\/function>/g, '')
            .replace(/<parameter=[\s\S]*?<\/parameter>/g, '')
            .trim();

          if (!content) {
            yield {
              type: 'error',
              data: {
                message: 'Model returned no usable content. Please try again.',
              },
            };
            return;
          }

          const tokens = content.match(/\S+\s*/g) ?? [content];
          for (const token of tokens) {
            yield { type: 'token', data: { token } };
          }
          yield { type: 'done', data: { final: true } };
          return;
        }

        conversation.push({
          role: 'assistant',
          content: msg.content ?? null,
          tool_calls: toolCalls,
        });

        for (const call of toolCalls) {
          const toolName = call.function.name;
          const tool = getToolByName(toolName);

          yield {
            type: 'tool_call',
            data: {
              id: call.id,
              name: toolName,
              args: safeJsonParse(call.function.arguments),
            },
          };

          if (!tool) {
            conversation.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
            });
            yield {
              type: 'tool_result',
              data: { id: call.id, name: toolName, error: 'Unknown tool' },
            };
            continue;
          }

          if (tool.allowedRoles && !tool.allowedRoles.includes(opts.role)) {
            conversation.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({ error: 'Permission denied' }),
            });
            yield {
              type: 'tool_result',
              data: { id: call.id, name: toolName, error: 'Permission denied' },
            };
            continue;
          }

          if (tool.requiresConfirmation) {
            yield {
              type: 'tool_call',
              data: {
                id: call.id,
                name: toolName,
                args: safeJsonParse(call.function.arguments),
                requiresConfirmation: true,
              },
            };
            conversation.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({
                error: 'Requires user confirmation. Ask user, then retry.',
              }),
            });
            yield {
              type: 'tool_result',
              data: { id: call.id, name: toolName, requiresConfirmation: true },
            };
            continue;
          }

          try {
            const args = safeJsonParse(call.function.arguments);
            const result = await tool.execute(args, ctx);
            conversation.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(result).slice(0, 8000),
            });
            yield {
              type: 'tool_result',
              data: { id: call.id, name: toolName, result },
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Tool ${toolName} failed: ${message}`);
            conversation.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({ error: message.slice(0, 500) }),
            });
            yield {
              type: 'tool_result',
              data: { id: call.id, name: toolName, error: message },
            };
          }
        }
      }

      yield {
        type: 'error',
        data: {
          message: 'Too many tool iterations. Try a simpler question.',
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Chat agent failed: ${message}`);
      yield { type: 'error', data: { message: message.slice(0, 400) } };
    }
  }
}

function safeJsonParse(s: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(s);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}