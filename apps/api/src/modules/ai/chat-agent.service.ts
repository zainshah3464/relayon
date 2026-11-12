import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from './rag.service';
import { ALL_TOOLS, getToolByName, toGroqTools } from './tools/registry';
import type { ToolContext } from './tools/tool.types';

const MAX_ITERATIONS = 5;
const RETRIES_PER_MODEL = 2; // ⚠️ DNS flaky handle

const MODEL_CHAIN = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
] as const;

const SYSTEM_PROMPT = `You are Relayon's AI assistant. You help users understand and use Relayon, a serverless webhook relay platform.

Rules:
1. When user asks how to do something, use search_docs FIRST before answering.
2. When creating workflows, ALWAYS confirm details with user before calling create_workflow.
3. Never invent features. If unsure, search docs.
4. Be concise. Prefer bullet points.
5. Never expose secrets, tokens, or raw credentials.
6. NEVER output XML tags like <tool_call> or <function=...> in your response. Use the tool calling API properly.

Current user context:
- Tenant ID: {{tenantId}}
- Role: {{role}}`;

export interface ChatEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error';
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
  private readonly apiKey: string | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
  ) {
    this.apiKey = config.get<string>('GROQ_API_KEY') ?? null;
    if (!this.apiKey) this.logger.warn('GROQ_API_KEY missing — chat disabled');
  }

  isEnabled(): boolean {
    return this.apiKey !== null;
  }

  /**
   * Fetch-based Groq call with per-model retries.
   * Why fetch not SDK: groq-sdk@0.9.1 has undici issues on Node 22 +
   * Pakistani ISP DNS flakiness. Raw fetch with AbortSignal.timeout is
   * more predictable and gives us real status codes.
   */
  private async createCompletion(params: ChatCompletionParams): Promise<GroqResponse> {
    if (!this.apiKey) throw new Error('GROQ_API_KEY missing');

    const errors: string[] = [];

    for (const model of MODEL_CHAIN) {
      for (let attempt = 1; attempt <= RETRIES_PER_MODEL; attempt++) {
        try {
          this.logger.debug(`Model ${model} (attempt ${attempt}/${RETRIES_PER_MODEL})`);

          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: params.messages,
              tools: params.tools,
              tool_choice: params.tool_choice,
              temperature: params.temperature ?? 0.3,
              max_tokens: params.max_tokens ?? 1024,
            }),
            signal: AbortSignal.timeout(60_000), // 60s (was 30s)
          });

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

            if (!shouldFallback) {
              // 4xx errors — no point retrying
              throw new Error(errMsg);
            }

            // Retry with backoff
            if (attempt < RETRIES_PER_MODEL) {
              await new Promise((r) => setTimeout(r, 500 * attempt));
              continue;
            }
            this.logger.warn(`${model} exhausted retries (${status}), next model...`);
            break; // next model
          }

          const json = (await res.json()) as GroqResponse;
          this.logger.debug(`✅ Success: ${model} (attempt ${attempt})`);
          return json;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);

          // Abort/timeout — retry same model
          if (msg.includes('aborted') || msg.includes('timeout')) {
            errors.push(`${model} attempt ${attempt}: timeout`);
            if (attempt < RETRIES_PER_MODEL) {
              await new Promise((r) => setTimeout(r, 500 * attempt));
              continue;
            }
            break;
          }

          // Network error — retry
          if (
            msg.includes('fetch failed') ||
            msg.includes('ECONNREFUSED') ||
            msg.includes('ECONNRESET') ||
            msg.includes('ENOTFOUND')
          ) {
            errors.push(`${model} attempt ${attempt}: network — ${msg.slice(0, 80)}`);
            if (attempt < RETRIES_PER_MODEL) {
              await new Promise((r) => setTimeout(r, 500 * attempt));
              continue;
            }
            break;
          }

          // Other error — bubble up
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
    if (!this.isEnabled()) {
      yield { type: 'error', data: { message: 'AI assistant is not configured' } };
      return;
    }

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
        });

        const msg = response.choices[0]?.message;
        if (!msg) {
          yield { type: 'error', data: { message: 'Empty response from model' } };
          return;
        }

        const toolCalls = msg.tool_calls ?? [];

        if (toolCalls.length === 0) {
          // ⚠️ Strip any hallucinated XML tool-call syntax from qwen
          const raw = msg.content ?? '';
          const content = raw
            .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
            .replace(/<function=[\s\S]*?<\/function>/g, '')
            .replace(/<parameter=[\s\S]*?<\/parameter>/g, '')
            .trim();

          if (!content) {
            yield {
              type: 'error',
              data: { message: 'Model returned no usable content. Please try again.' },
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
            data: { id: call.id, name: toolName, args: safeJsonParse(call.function.arguments) },
          };

          if (!tool) {
            conversation.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
            });
            yield { type: 'tool_result', data: { id: call.id, name: toolName, error: 'Unknown tool' } };
            continue;
          }

          if (tool.allowedRoles && !tool.allowedRoles.includes(opts.role)) {
            conversation.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({ error: 'Permission denied' }),
            });
            yield { type: 'tool_result', data: { id: call.id, name: toolName, error: 'Permission denied' } };
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
            yield { type: 'tool_result', data: { id: call.id, name: toolName, requiresConfirmation: true } };
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
            yield { type: 'tool_result', data: { id: call.id, name: toolName, result } };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Tool ${toolName} failed: ${message}`);
            conversation.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({ error: message.slice(0, 500) }),
            });
            yield { type: 'tool_result', data: { id: call.id, name: toolName, error: message } };
          }
        }
      }

      yield {
        type: 'error',
        data: { message: 'Too many tool iterations. Try a simpler question.' },
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