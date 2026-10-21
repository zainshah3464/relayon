import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { createHash } from 'crypto';
import { RedisService } from '../redis/redis.service';

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
  private readonly client: Groq;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    const timeoutMs =
      config.get<number>('GROQ_TIMEOUT_MS') ?? 20_000;

    this.client = new Groq({
      apiKey: config.getOrThrow<string>('GROQ_API_KEY'),
      timeout: timeoutMs,
    });
    this.model =
      config.get<string>('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';
    this.maxTokens = config.get<number>('GROQ_MAX_TOKENS') ?? 1024;
    this.temperature =
      config.get<number>('GROQ_TEMPERATURE') ?? 0.2;
  }

  async enrich(input: {
    workflowId: string;
    prompt: string | null;
    payload: unknown;
  }): Promise<EnrichmentResult> {
    const startedAt = Date.now();
    const userPrompt = input.prompt?.trim() || DEFAULT_PROMPT;
    const payloadJson = JSON.stringify(input.payload);

    const cacheKey = this.cacheKey(input.workflowId, userPrompt, payloadJson);

    // Cache check
    const cached = await this.redis.raw.get(cacheKey);
    if (cached) {
      return {
        enrichedPayload: JSON.parse(cached),
        cached: true,
        model: this.model,
        durationMs: Date.now() - startedAt,
      };
    }

    // Call Groq
    const completion = await this.client.chat.completions.create({
      model: this.model,
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

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Groq returned empty response');
    }

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
      model: this.model,
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