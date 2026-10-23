import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MongoService } from '../mongo/mongo.service';
import { RedisService } from '../redis/redis.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { parseRetryPolicy, getBackoffMs } from './retry-policy';
import { AdapterRegistry } from './adapters/registry';
import type { AdapterResult, DeliveryContext } from './adapters/types';
import {
  EGRESS_PENDING_QUEUE,
  EGRESS_DELAYED_QUEUE,
  type EgressJob,
} from '../../lib/queues';
import { logger } from '../../lib/logger';

const STUCK_AFTER_MS = 5 * 60 * 1000;
const CIRCUIT_OPEN_DELAY_MS = 60_000;

export interface DeliverBatchResult {
  processed: number;
  delivered: number;
  retried: number;
  dlq: number;
  skipped: number;
  stuckRecovered: number;
  durationMs: number;
}

@Injectable()
export class EgressService {
  private readonly logger = new Logger(EgressService.name);
  private readonly adapterTimeoutMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mongo: MongoService,
    private readonly redis: RedisService,
    private readonly circuit: CircuitBreakerService,
    private readonly adapters: AdapterRegistry,
  ) {
    this.adapterTimeoutMs = parseInt(this.config.get<string>('ADAPTER_TIMEOUT_MS') ?? '15000', 10);
  }

  async deliverBatch(): Promise<DeliverBatchResult> {
    const startedAt = Date.now();
    const batchSize = this.config.get<number>('BATCH_SIZE') ?? 5;
    const timeBudget = this.config.get<number>('TIME_BUDGET_MS') ?? 8000;

    const result: DeliverBatchResult = {
      processed: 0,
      delivered: 0,
      retried: 0,
      dlq: 0,
      skipped: 0,
      stuckRecovered: 0,
      durationMs: 0,
    };

    // 0. Re-queue DB-pending deliveries (picks up DLQ replays, manual edits)
    await this.recoverPendingFromDb();

    // 1. Recover deliveries stuck in 'delivering' from a crashed worker
    result.stuckRecovered = await this.recoverStuck();

    // 2. Immediate queue (FIFO from the right)
    while (result.processed < batchSize) {
      if (Date.now() - startedAt > timeBudget) break;

      const raw = await this.redis.raw.rpop(EGRESS_PENDING_QUEUE);
      if (!raw) break;

      try {
        const job = JSON.parse(raw) as EgressJob;
        result.processed++;
        await this.processJob(job, result);
      } catch {
        this.logger.warn('queue.corrupt_egress_entry_removed');
      }
    }

    // 3. Due retries from ZSET (score <= now)
    while (result.processed < batchSize * 2) {
      if (Date.now() - startedAt > timeBudget) break;

      const due = await this.redis.raw.zrangebyscore(
        EGRESS_DELAYED_QUEUE,
        0,
        Date.now(),
        'LIMIT',
        0,
        1,
      );
      const raw = due[0];
      if (!raw) break;

      const removed = await this.redis.raw.zrem(EGRESS_DELAYED_QUEUE, raw);
      if (removed !== 1) continue; // race: another worker claimed it

      try {
        const job = JSON.parse(raw) as EgressJob;
        result.processed++;
        await this.processJob(job, result);
      } catch {
        this.logger.warn('queue.corrupt_delayed_entry_removed');
      }
    }

    result.durationMs = Date.now() - startedAt;
    logger.info('egress.batch_complete', { ...result });
    return result;
  }

  async getStats(): Promise<{
    pending: number;
    delayed: number;
    delivered24h: number;
    dlq: number;
  }> {
    const [pending, delayed] = await Promise.all([
      this.redis.raw.llen(EGRESS_PENDING_QUEUE),
      this.redis.raw.zcard(EGRESS_DELAYED_QUEUE),
    ]);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [delivered24h, dlq] = await Promise.all([
      this.mongo.deliveryModel.countDocuments({
        status: 'delivered',
        deliveredAt: { $gte: since },
      }),
      this.mongo.deliveryModel.countDocuments({ status: 'dlq' }),
    ]);

    return { pending, delayed, delivered24h, dlq };
  }

  async replayDlq(deliveryId: string): Promise<{ replayed: boolean; message: string }> {
    const delivery = await this.mongo.deliveryModel.findById(deliveryId).exec();
    if (!delivery) return { replayed: false, message: 'Delivery not found' };
    if (delivery.status !== 'dlq') {
      return {
        replayed: false,
        message: `Cannot replay: delivery status is '${delivery.status}'`,
      };
    }

    const event = await this.mongo.eventModel.findById(delivery.eventId).exec();
    if (!event) {
      return { replayed: false, message: 'Parent event not found (expired?)' };
    }

    await this.mongo.deliveryModel.updateOne(
      { _id: delivery._id },
      {
        $set: {
          status: 'pending',
          attemptCount: 0,
          nextAttemptAt: new Date(),
          error: null,
          dlqReason: null,
          dlqAt: null,
        },
      },
    );

    const job: EgressJob = {
      tenantId: delivery.tenantId,
      eventId: delivery.eventId,
      correlationId: delivery.correlationId,
      destinationId: delivery.destinationId,
      destinationType: delivery.destinationType,
      destinationConfig: {},
      payload:
        event.transformedPayload ?? event.enrichedPayload ?? event.rawPayload,
      attemptCount: 0,
      enqueuedAt: new Date().toISOString(),
    };

    await this.redis.raw.lpush(EGRESS_PENDING_QUEUE, JSON.stringify(job));

    return { replayed: true, message: 'Delivery re-queued' };
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE
  // ─────────────────────────────────────────────────────────────

  private async processJob(
    job: EgressJob,
    result: DeliverBatchResult,
  ): Promise<void> {
    try {
      // 1. Load delivery doc
      const existing = await this.mongo.deliveryModel
        .findOne({
          tenantId: job.tenantId,
          eventId: job.eventId,
          destinationId: job.destinationId,
        })
        .exec();

      if (!existing) {
        this.logger.warn(`delivery.missing ${job.correlationId}/${job.destinationId}`);
        result.skipped++;
        return;
      }

      if (existing.status === 'delivered' || existing.status === 'dlq') {
        result.skipped++;
        return;
      }

      // 2. Atomic claim — only one worker can transition to 'delivering'
      const staleCutoff = new Date(Date.now() - STUCK_AFTER_MS);
      const claimed = await this.mongo.deliveryModel
        .findOneAndUpdate(
          {
            _id: existing._id,
            $or: [
              { status: 'pending' },
              { status: 'delivering', lastAttemptAt: { $lt: staleCutoff } },
            ],
          },
          {
            $set: { status: 'delivering', lastAttemptAt: new Date() },
            $inc: { attemptCount: 1 },
          },
          { new: true },
        )
        .exec();

      if (!claimed) {
        // Another worker won the race, or status is already terminal
        result.skipped++;
        return;
      }

      const attemptNumber = claimed.attemptCount;

      // 3. Load destination — fresh config from DB (handles updates)
      const destination = await this.prisma.destination.findFirst({
        where: {
          id: claimed.destinationId,
          workflow: { tenantId: claimed.tenantId },
        },
      });

      if (!destination || !destination.enabled) {
        await this.moveToDlq(
          claimed._id.toString(),
          'Destination disabled or deleted',
          null,
          attemptNumber,
        );
        result.dlq++;
        return;
      }

      // 4. Circuit breaker
      if (await this.circuit.isOpen(destination.id)) {
        this.logger.warn(`circuit.open ${destination.id} — delaying`);
        await this.scheduleRetry(job, attemptNumber, CIRCUIT_OPEN_DELAY_MS);
        result.retried++;
        return;
      }

      // 5. Load event (for payload)
      const event = await this.mongo.eventModel.findById(job.eventId).exec();
      if (!event) {
        await this.moveToDlq(
          claimed._id.toString(),
          'Parent event not found (expired?)',
          null,
          attemptNumber,
        );
        result.dlq++;
        return;
      }

      const payload =
        event.transformedPayload ?? event.enrichedPayload ?? event.rawPayload;

      const registered = this.adapters.get(destination.type);
      if (!registered) {
        await this.moveToDlq(
          claimed._id.toString(),
          `No adapter registered for type '${destination.type}'`,
          null,
          attemptNumber,
        );
        result.dlq++;
        return;
      }

      const adapter = registered.instance;

      const config = (destination.config ?? {}) as Record<string, unknown>;
      const ctx: DeliveryContext = {
        destinationId: destination.id,
        destinationType: destination.type,
        config,
        payload,
        correlationId: claimed.correlationId,
        eventId: claimed.eventId,
        attemptNumber,
      };

      let adapterResult: AdapterResult;
      try {
        adapterResult = await this.withTimeout(
          adapter.send(ctx),
          this.adapterTimeoutMs,
        );
      } catch (err) {
        adapterResult = {
          success: false,
          statusCode: 0,
          latencyMs: this.adapterTimeoutMs,
          responseBody: '',
          error: err instanceof Error ? err.message : String(err),
          retryable: true,
        };
      }

      // 6. Handle outcome
      const attemptRecord = {
        at: new Date(),
        statusCode: adapterResult.statusCode,
        latencyMs: adapterResult.latencyMs,
        error: adapterResult.error,
      };

      if (adapterResult.success) {
        await this.mongo.deliveryModel.updateOne(
          { _id: claimed._id },
          {
            $set: {
              status: 'delivered',
              deliveredAt: new Date(),
              nextAttemptAt: new Date(),
              lastResponse: {
                statusCode: adapterResult.statusCode,
                bodySnippet: adapterResult.responseBody,
                latencyMs: adapterResult.latencyMs,
              },
            },
            $push: { attempts: attemptRecord },
          },
        );
        await this.circuit.recordSuccess(destination.id);
        result.delivered++;
        return;
      }

      // Failure path
      if (adapterResult.retryable) {
        await this.circuit.recordFailure(destination.id);
      }

      const retryPolicy = parseRetryPolicy(destination.retryPolicy);
      const canRetry =
        adapterResult.retryable && attemptNumber < retryPolicy.maxAttempts;

      if (!canRetry) {
        await this.mongo.deliveryModel.updateOne(
          { _id: claimed._id },
          {
            $set: {
              status: 'dlq',
              lastAttemptAt: new Date(),
              lastResponse: {
                statusCode: adapterResult.statusCode,
                bodySnippet: adapterResult.responseBody,
                latencyMs: adapterResult.latencyMs,
              },
              error: {
                code: this.errorCode(adapterResult),
                message: adapterResult.error ?? 'Unknown error',
              },
              dlqReason: adapterResult.retryable
                ? 'Max retry attempts exhausted'
                : 'Non-retryable failure',
              dlqAt: new Date(),
            },
            $push: { attempts: attemptRecord },
          },
        );
        result.dlq++;
        return;
      }

      // Schedule retry
      const backoffMs = getBackoffMs(retryPolicy, attemptNumber);
      const nextAttemptAt = new Date(Date.now() + backoffMs);

      await this.mongo.deliveryModel.updateOne(
        { _id: claimed._id },
        {
          $set: {
            status: 'pending',
            nextAttemptAt,
            lastResponse: {
              statusCode: adapterResult.statusCode,
              bodySnippet: adapterResult.responseBody,
              latencyMs: adapterResult.latencyMs,
            },
            error: {
              code: this.errorCode(adapterResult),
              message: adapterResult.error ?? 'Unknown error',
            },
          },
          $push: { attempts: attemptRecord },
        },
      );

      await this.redis.raw.zadd(
        EGRESS_DELAYED_QUEUE,
        Date.now() + backoffMs,
        JSON.stringify({ ...job, attemptCount: attemptNumber }),
      );

      result.retried++;
    } catch (err) {
      this.logger.error(
        `process_job.failed ${job.correlationId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      result.skipped++;
    }
  }

  private async scheduleRetry(
    job: EgressJob,
    attemptCount: number,
    delayMs: number,
  ): Promise<void> {
    // Reset status to 'pending' so next attempt can claim it
    const delivery = await this.mongo.deliveryModel
      .findOne({
        tenantId: job.tenantId,
        eventId: job.eventId,
        destinationId: job.destinationId,
      })
      .exec();

    if (delivery) {
      await this.mongo.deliveryModel.updateOne(
        { _id: delivery._id },
        { $set: { status: 'pending', nextAttemptAt: new Date(Date.now() + delayMs) } },
      );
    }

    await this.redis.raw.zadd(
      EGRESS_DELAYED_QUEUE,
      Date.now() + delayMs,
      JSON.stringify({ ...job, attemptCount }),
    );
  }

  private async moveToDlq(
    deliveryId: string,
    reason: string,
    response: { statusCode: number; latencyMs: number; responseBody: string } | null,
    attemptNumber: number,
  ): Promise<void> {
    const update: Record<string, unknown> = {
      $set: {
        status: 'dlq',
        lastAttemptAt: new Date(),
        error: { code: 'dlq', message: reason },
        dlqReason: reason,
        dlqAt: new Date(),
      },
    };
    if (response) {
      update['$set'] = {
        ...(update['$set'] as Record<string, unknown>),
        lastResponse: {
          statusCode: response.statusCode,
          bodySnippet: response.responseBody,
          latencyMs: response.latencyMs,
        },
      };
    }
    void attemptNumber;
    await this.mongo.deliveryModel.updateOne({ _id: deliveryId }, update);
  }

  private async recoverStuck(): Promise<number> {
    const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
    const stuck = await this.mongo.deliveryModel
      .find({
        status: 'delivering',
        lastAttemptAt: { $lt: cutoff },
      })
      .limit(50)
      .exec();

    if (stuck.length === 0) return 0;

    let recovered = 0;
    for (const d of stuck) {
      await this.mongo.deliveryModel.updateOne(
        { _id: d._id },
        { $set: { status: 'pending', nextAttemptAt: new Date() } },
      );

      const event = await this.mongo.eventModel.findById(d.eventId).exec();
      if (!event) continue;

      const job: EgressJob = {
        tenantId: d.tenantId,
        eventId: d.eventId,
        correlationId: d.correlationId,
        destinationId: d.destinationId,
        destinationType: d.destinationType,
        destinationConfig: {},
        payload:
          event.transformedPayload ?? event.enrichedPayload ?? event.rawPayload,
        attemptCount: d.attemptCount,
        enqueuedAt: new Date().toISOString(),
      };

      await this.redis.raw.lpush(EGRESS_PENDING_QUEUE, JSON.stringify(job));
      recovered++;
    }

    if (recovered > 0) {
      this.logger.warn(`egress.recovered_stuck count=${recovered}`);
    }
    return recovered;
  }

  /**
   * Re-queue DB-pending deliveries whose nextAttemptAt has passed.
   * Called at batch start to pick up:
   *   - DLQ replays (API flips status to 'pending')
   *   - Manual Mongo edits
   *   - Missed Redis pushes
   */
  private async recoverPendingFromDb(): Promise<number> {
    const due = await this.mongo.deliveryModel
      .find({
        status: 'pending',
        nextAttemptAt: { $lte: new Date() },
      })
      .limit(20)
      .exec();

    if (due.length === 0) return 0;

    let recovered = 0;
    for (const d of due) {
      const event = await this.mongo.eventModel.findById(d.eventId).exec();
      if (!event) continue;

      const job: EgressJob = {
        tenantId: d.tenantId,
        eventId: d.eventId,
        correlationId: d.correlationId,
        destinationId: d.destinationId,
        destinationType: d.destinationType,
        destinationConfig: {},
        payload:
          event.transformedPayload ?? event.enrichedPayload ?? event.rawPayload,
        attemptCount: d.attemptCount,
        enqueuedAt: new Date().toISOString(),
      };

      // Only push if not already in queue — use a simple in-queue check
      const queueKey = JSON.stringify(job);
      const exists = await this.redis.raw.lpos(EGRESS_PENDING_QUEUE, queueKey);
      if (exists === null) {
        await this.redis.raw.lpush(EGRESS_PENDING_QUEUE, queueKey);
        recovered++;
      }
    }

    if (recovered > 0) {
      this.logger.warn(`egress.recovered_pending count=${recovered}`);
    }
    return recovered;
  }

  private errorCode(result: AdapterResult): string {
    if (result.statusCode === 0) return 'network_error';
    if (result.statusCode === 429) return 'rate_limited';
    if (result.statusCode >= 500) return 'destination_error';
    if (result.statusCode >= 400) return 'client_error';
    return 'unknown';
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Adapter timed out after ${ms}ms`)),
          ms,
        ),
      ),
    ]);
  }
}