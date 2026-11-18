import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { createHash } from 'crypto';
import { RedisService } from '../redis/redis.service';
// ⚠️ v3.5 — BYOK key resolver (worker-side, functional variant)
import { resolveProviderKey } from '../../lib/provider-resolver';

export interface EnrichmentResult {
  enrichedPayload: unknown;
  cached: boolean;
  model: string | null;
  durationMs: number;
}

const CACHE_TTL_SECONDS = 3600; // 1 hour

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  // ⚠️ v3.5 — platform config only; no more hardcoded client / model / apiKey
  private readonly platformTimeoutMs: number;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.platformTimeoutMs = parseInt(
      config.get<string>('GROQ_TIMEOUT_MS') ?? '20000',
      10,
    );
    this.maxTokens = config.get<number>('GROQ_MAX_TOKENS') ?? 1024;
    this.temperature = config.get<number>('GROQ_TEMPERATURE') ?? 0.2;
  }

  async enrich(input: {
    tenantId: string; // ⚠️ v3.5 — NEW
    workflowId: string;
    prompt: string | null;
    payload: unknown;
  }): Promise<EnrichmentResult> {
    const startedAt = Date.now();
    const userPrompt = input.prompt?.trim() || DEFAULT_PROMPT;
    const payloadJson = JSON.stringify(input.payload);

    // ⚠️ v3.5 — resolve key cascade (tenant key → platform key)
    const resolved = await resolveProviderKey(input.tenantId, 'groq');
    if (!resolved) {
      throw new Error(
        'No Groq API key available (neither tenant nor platform)',
      );
    }

    // ⚠️ v3.5 — per-call SDK client with resolved key
    const client = new Groq({
      apiKey: resolved.key,
      timeout: this.platformTimeoutMs,
      maxRetries: 0, // we handle retries via model chain
    });

    // ⚠️ v3.5 — build model chain: tenant-preferred model first, then defaults
    const defaultModel =
      this.config.get<string>('GROQ_MODEL') ?? 'openai/gpt-oss-120b';
    const modelChain = resolved.model
      ? [
          resolved.model,
          defaultModel,
          'openai/gpt-oss-20b',
          'qwen/qwen3.8-27b',
        ]
      : [defaultModel, 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];

    // Deduplicate in case tenant model equals a default
    const models = [...new Set(modelChain)];

    const cacheKey = this.cacheKey(input.workflowId, userPrompt, payloadJson);

    // ── Cache check (unchanged logic — workflowId is tenant-scoped) ──
    const cached = await this.redis.raw.get(cacheKey);
    if (cached) {
      return {
        enrichedPayload: JSON.parse(cached),
        cached: true,
        model: models[0] ?? null,
        durationMs: Date.now() - startedAt,
      };
    }

    // ── Call Groq with per-model fallback ─────────────────────────
    const errors: string[] = [];
    let content: string | null = null;
    let usedModel: string | null = null;

    for (const model of models) {
      try {
        this.logger.debug(`Enrich: trying model ${model}`);

        const completion = await client.chat.completions.create({
          model,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are a JSON enrichment engine. Analyze the given webhook payload and produce a JSON object with the requested enrichments. Always respond with valid JSON only — no explanations, no markdown fences.',
            },
            {
              role: 'user',
              content: `${userPrompt}\n\nPayload:\n${payloadJson}`,
            },
          ],
        });

        const c = completion.choices[0]?.message?.content;
        if (!c) {
          errors.push(`${model}: empty response`);
          continue;
        }

        content = c;
        usedModel = model;
        this.logger.debug(`Enrich: success with model ${model}`);
        break; // stop at first successful model
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Enrich: model ${model} failed — ${msg.slice(0, 200)}`,
        );
        errors.push(`${model}: ${msg.slice(0, 150)}`);
        // fall through to next model
      }
    }

    if (!content || !usedModel) {
      throw new Error(
        `All Groq models failed for enrichment:\n${errors.join('\n')}`,
      );
    }

    // ── Parse JSON (unchanged) ────────────────────────────────────
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Some models wrap JSON in markdown fences despite the instruction
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    }

    // Cache for 1h
    await this.redis.raw.set(
      cacheKey,
      JSON.stringify(parsed),
      'EX',
      CACHE_TTL_SECONDS,
    );

    return {
      enrichedPayload: parsed,
      cached: false,
      model: usedModel,
      durationMs: Date.now() - startedAt,
    };
  }

  private cacheKey(
    workflowId: string,
    prompt: string,
    payloadJson: string,
  ): string {
    const hash = createHash('sha256')
      .update(workflowId)
      .update('\u0000')
      .update(prompt)
      .update('\u0000')
      .update(payloadJson)
      .digest('hex');
    return `groq:enrich:${hash}`;
  }
}

const DEFAULT_PROMPT = `Enrich this webhook event. Return a JSON object with these fields:
- "summary": a concise 1-2 sentence summary of what happened
- "category": a short category label (e.g. "payment", "order", "alert", "customer")
- "severity": one of "low", "medium", "high"
- "entities": an object with extracted key-value pairs (amounts, emails, IDs)
If a field cannot be inferred, omit it.`;