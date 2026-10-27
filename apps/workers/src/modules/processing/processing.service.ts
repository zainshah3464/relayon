import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MongoService } from '../mongo/mongo.service';
import { RedisService } from '../redis/redis.service';
import { GroqService, EnrichmentResult } from './groq.service';
import { TransformService } from './transform.service';
import { RoutingService } from './routing.service';
import { logger } from '../../lib/logger';
import {
  INCOMING_QUEUE,
  PROCESSING_QUEUE,
  EGRESS_QUEUE,
  QueuedEvent,
  EgressJob,
} from '../../lib/queues';

const EVENT_TTL_DAYS = 30;
const DELIVERY_TTL_DAYS = 30;

export interface BatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  durationMs: number;
  breakdown: {
    enriched: number;
    enrichmentCacheHits: number;
    enrichmentFailures: number;
    transformed: number;
    egressJobsQueued: number;
  };
}

interface ProcessingItem {
  raw: string;
  event: QueuedEvent;
}

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mongo: MongoService,
    private readonly redis: RedisService,
    private readonly groq: GroqService,
    private readonly transform: TransformService,
    private readonly routing: RoutingService,
  ) {}

  async processBatch(): Promise<BatchResult> {
    const startedAt = Date.now();
    const batchSize = this.config.get<number>('BATCH_SIZE') ?? 5;
    const budget = this.config.get<number>('TIME_BUDGET_MS') ?? 8000;

    const result: BatchResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
      breakdown: {
        enriched: 0,
        enrichmentCacheHits: 0,
        enrichmentFailures: 0,
        transformed: 0,
        egressJobsQueued: 0,
      },
    };

    const items = await this.popBatch(batchSize);
    if (items.length === 0) {
      result.durationMs = Date.now() - startedAt;
      logger.info('batch.empty');
      return result;
    }

    // Batch-load workflows for the whole batch (one DB query)
    const workflowIds = Array.from(
      new Set(items.map((i) => i.event.workflowId)),
    );
    const workflows = await this.prisma.workflow.findMany({
      where: { id: { in: workflowIds } },
      include: { destinations: { where: { enabled: true } } },
    });
    const workflowMap = new Map(workflows.map((w) => [w.id, w]));

    for (const item of items) {
      if (Date.now() - startedAt > budget) {
        // Out of time — put remaining items back on incoming queue for next run
        this.logger.warn(
          `Time budget exceeded, requeueing ${items.length - result.processed} event(s)`,
        );
        await this.requeueRemaining(items.slice(result.processed));
        break;
      }

      result.processed++;

      try {
        const workflow = workflowMap.get(item.event.workflowId);
        if (!workflow) {
          await this.recordFailure(
            item.event,
            'workflow_lookup',
            'Workflow not found or deleted',
          );
          await this.ackProcessed(item.raw);
          result.skipped++;
          continue;
        }

        const outcome = await this.processOne(item.event, workflow, result);

        if (outcome === 'failed') {
          result.failed++;
        } else {
          result.succeeded++;
        }

        await this.ackProcessed(item.raw);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to process ${item.event.correlationId}: ${message}`,
        );
        await this.recordFailure(item.event, 'processing', message);
        await this.ackProcessed(item.raw);
        result.failed++;
      }
    }

    result.durationMs = Date.now() - startedAt;
    logger.info('batch.complete', { ...result });
    return result;
  }

  /**
   * Pipeline dry-run: runs enrichment → transform → routing on a sample
   * payload WITHOUT touching MongoDB or the egress queue.
   */
  async testRun(input: {
    tenantId: string;
    workflowId: string;
    payload: unknown;
  }): Promise<{
    enrichment: {
      enabled: boolean;
      result: unknown;
      cached: boolean;
      error: string | null;
      durationMs: number;
    };
    transform: {
      applied: boolean;
      result: unknown;
      error: string | null;
      durationMs: number;
    };
    routing: {
      destinationIds: string[];
      matchedRule: number | null;
      reason: string;
    };
    destinations: Array<{ id: string; name: string; type: string }>;
  }> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: input.workflowId, tenantId: input.tenantId },
      include: { destinations: { where: { enabled: true } } },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // ── 1. Enrichment ─────────────────────────────────────────
    let enrichedPayload: unknown = null;
    const enrichment: {
      enabled: boolean;
      result: unknown;
      cached: boolean;
      error: string | null;
      durationMs: number;
    } = {
      enabled: workflow.enrichmentEnabled,
      result: null,
      cached: false,
      error: null,
      durationMs: 0,
    };

    if (workflow.enrichmentEnabled) {
      try {
        const r = await this.groq.enrich({
          workflowId: workflow.id,
          prompt: workflow.enrichmentPrompt,
          payload: input.payload,
        });
        enrichedPayload = r.enrichedPayload;
        enrichment.result = r.enrichedPayload;
        enrichment.cached = r.cached;
        enrichment.durationMs = r.durationMs;
      } catch (err) {
        enrichment.error = err instanceof Error ? err.message : String(err);
      }
    }

    // ── 2. Transform ──────────────────────────────────────────
    const transformInput =
      enrichedPayload !== null ? enrichedPayload : input.payload;

    const transform: {
      applied: boolean;
      result: unknown;
      error: string | null;
      durationMs: number;
    } = {
      applied: false,
      result: transformInput,
      error: null,
      durationMs: 0,
    };

    if (workflow.transformExpression && workflow.transformExpression.trim()) {
      const started = Date.now();
      try {
        transform.result = await this.transform.apply(
          workflow.transformExpression,
          transformInput,
        );
        transform.applied = true;
      } catch (err) {
        transform.error = err instanceof Error ? err.message : String(err);
      }
      transform.durationMs = Date.now() - started;
    }

    // ── 3. Routing ────────────────────────────────────────────
    const routing = await this.routing.decide(
      (workflow as { routingRules?: unknown }).routingRules,
      workflow.destinations,
      transform.result,
    );

    return {
      enrichment,
      transform,
      routing,
      destinations: workflow.destinations.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
      })),
    };
  }

  async getQueueStatus() {
    const r = this.redis.raw;
    const [incoming, processing, egress] = await Promise.all([
      r.llen(INCOMING_QUEUE),
      r.llen(PROCESSING_QUEUE),
      r.llen(EGRESS_QUEUE),
    ]);
    return {
      incoming,
      processing,
      egress,
      timestamp: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE — queue operations
  // ─────────────────────────────────────────────────────────────

  private async popBatch(count: number): Promise<ProcessingItem[]> {
    const r = this.redis.raw;
    const items: ProcessingItem[] = [];

    for (let i = 0; i < count; i++) {
      const raw = await r.rpoplpush(INCOMING_QUEUE, PROCESSING_QUEUE);
      if (!raw) break;

      try {
        const event = JSON.parse(raw) as QueuedEvent;
        items.push({ raw, event });
      } catch {
        // Corrupt entry — remove it so it doesn't block the queue
        await r.lrem(PROCESSING_QUEUE, 1, raw);
        this.logger.warn('queue.corrupt_entry_removed');
      }
    }

    return items;
  }

  private async ackProcessed(raw: string): Promise<void> {
    await this.redis.raw.lrem(PROCESSING_QUEUE, 1, raw);
  }

  private async requeueRemaining(remaining: ProcessingItem[]): Promise<void> {
    const r = this.redis.raw;
    for (const item of remaining) {
      await r.lrem(PROCESSING_QUEUE, 1, item.raw);
      await r.lpush(INCOMING_QUEUE, item.raw);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE — single event processing
  // ─────────────────────────────────────────────────────────────

  private async processOne(
    event: QueuedEvent,
    workflow: {
      id: string;
      tenantId: string;
      enrichmentEnabled: boolean;
      enrichmentPrompt: string | null;
      transformExpression: string | null;
      destinations: Array<{
        id: string;
        type: string;
        config: unknown;
      }>;
    },
    result: BatchResult,
  ): Promise<'ok' | 'failed'> {
    // ── 1. Idempotency guard: skip if event already logged as processed
    const existing = await this.mongo.eventModel
      .findOne({ correlationId: event.correlationId, status: 'processed' })
      .lean()
      .exec();
    if (existing) {
      this.logger.warn(`event.duplicate_skip: ${event.correlationId}`);
      return 'ok';
    }

    // ── 2. AI enrichment (graceful degradation on failure)
    let enrichedPayload: unknown = null;
    let enrichmentMeta: {
      enabled: boolean;
      cached: boolean;
      model: string | null;
      durationMs: number;
      error: string | null;
    } | null = null;

    if (workflow.enrichmentEnabled) {
      try {
        const enrich: EnrichmentResult = await this.groq.enrich({
          workflowId: workflow.id,
          prompt: workflow.enrichmentPrompt,
          payload: event.rawPayload,
        });
        enrichedPayload = enrich.enrichedPayload;
        enrichmentMeta = {
          enabled: true,
          cached: enrich.cached,
          model: enrich.model,
          durationMs: enrich.durationMs,
          error: null,
        };
        if (enrich.cached) result.breakdown.enrichmentCacheHits++;
        else result.breakdown.enriched++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `enrichment.failed ${event.correlationId}: ${msg}`,
        );
        result.breakdown.enrichmentFailures++;
        enrichmentMeta = {
          enabled: true,
          cached: false,
          model: null,
          durationMs: 0,
          error: msg,
        };
        // Continue — event still routes without enrichment
      }
    }

    // ── 3. Transform (JSONata)
    const inputForTransform =
      enrichedPayload !== null ? enrichedPayload : event.rawPayload;

    let transformedPayload: unknown = inputForTransform;
    if (workflow.transformExpression && workflow.transformExpression.trim()) {
      try {
        transformedPayload = await this.transform.apply(
          workflow.transformExpression,
          inputForTransform,
        );
        result.breakdown.transformed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.recordFailure(event, 'transform', msg);
        return 'failed';
      }
    }

    // ── 4. Persist event in MongoDB
    const ttlExpiresAt = new Date(
      Date.now() + EVENT_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const eventDoc = await this.mongo.eventModel.create({
      correlationId: event.correlationId,
      tenantId: event.tenantId,
      workflowId: event.workflowId,
      sourceType: event.sourceType,
      rawPayload: event.rawPayload,
      headers: event.headers,
      ipHash: event.ipHash,
      userAgent: event.userAgent,
      idempotencyKey: event.idempotencyKey,
      receivedAt: new Date(event.receivedAt),
      processedAt: new Date(),
      enrichedPayload,
      transformedPayload,
      enrichment: enrichmentMeta,
      status: 'processed',
      error: null,
      ttlExpiresAt,
    });

    // ── 5. Fan-out: create delivery docs + enqueue egress jobs
    if (workflow.destinations.length === 0) {
      return 'ok';
    }

    // ── 5a. Conditional routing — decide which destinations receive this event
    const decision = await this.routing.decide(
      (workflow as { routingRules?: unknown }).routingRules,
      workflow.destinations,
      transformedPayload,
    );

    if (decision.destinationIds.length === 0) {
      this.logger.warn(
        `routing.no_destinations: ${event.correlationId} (${decision.reason})`,
      );
      return 'ok';
    }

    const selectedDestinations = workflow.destinations.filter((d) =>
      decision.destinationIds.includes(d.id),
    );

    // ── 5b. Persist delivery docs for the selected destinations only
    const deliveryTtl = new Date(
      Date.now() + DELIVERY_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const deliveryDocs = await this.mongo.deliveryModel.insertMany(
      selectedDestinations.map((d) => ({
        tenantId: event.tenantId,
        eventId: eventDoc._id.toString(),
        correlationId: event.correlationId,
        destinationId: d.id,
        destinationType: d.type,
        status: 'pending' as const,
        attemptCount: 0,
        nextAttemptAt: new Date(),
        lastAttemptAt: null,
        lastResponse: null,
        attempts: [],
        createdAt: new Date(),
        deliveredAt: null,
        ttlExpiresAt: deliveryTtl,
      })),
    );

    // ── 5c. Enqueue egress jobs
    const r = this.redis.raw;
    for (let i = 0; i < selectedDestinations.length; i++) {
      const dest = selectedDestinations[i];
      const delivery = deliveryDocs[i];
      const job: EgressJob = {
        tenantId: event.tenantId,
        eventId: eventDoc._id.toString(),
        correlationId: event.correlationId,
        destinationId: dest.id,
        destinationType: dest.type,
        destinationConfig: (dest.config ?? {}) as Record<string, unknown>,
        payload: transformedPayload,
        attemptCount: 0,
        enqueuedAt: new Date().toISOString(),
      };
      await r.lpush(EGRESS_QUEUE, JSON.stringify(job));
      result.breakdown.egressJobsQueued++;

      // Silence unused-var warning for delivery ref
      void delivery;
    }

    return 'ok';
  }

  private async recordFailure(
    event: QueuedEvent,
    stage: string,
    message: string,
  ): Promise<void> {
    const ttl = new Date(Date.now() + EVENT_TTL_DAYS * 24 * 60 * 60 * 1000);
    try {
      await this.mongo.eventModel.updateOne(
        { correlationId: event.correlationId },
        {
          $setOnInsert: {
            correlationId: event.correlationId,
            tenantId: event.tenantId,
            workflowId: event.workflowId,
            sourceType: event.sourceType,
            rawPayload: event.rawPayload,
            headers: event.headers,
            ipHash: event.ipHash,
            userAgent: event.userAgent,
            idempotencyKey: event.idempotencyKey,
            receivedAt: new Date(event.receivedAt),
            processedAt: new Date(),
            enrichedPayload: null,
            transformedPayload: null,
            enrichment: null,
            status: 'failed',
            error: { stage, code: 'processing_error', message },
            ttlExpiresAt: ttl,
          },
        },
        { upsert: true },
      );
    } catch (err) {
      this.logger.error(
        `Failed to record failure for ${event.correlationId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}