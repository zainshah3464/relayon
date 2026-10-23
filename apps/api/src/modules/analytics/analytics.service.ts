import { Injectable } from '@nestjs/common';
import { MongoService } from '../mongo/mongo.service';

const GROQ_COST_PER_1K_TOKENS = 0.0001;
const REDIS_CMD_COST = 0.00002;

@Injectable()
export class AnalyticsService {
  constructor(private readonly mongo: MongoService) {}

  async overview(tenantId: string) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [events24h, events7d, processed, failed, delivered, dlq, pending] =
      await Promise.all([
        this.mongo.eventModel.countDocuments({ tenantId, receivedAt: { $gte: since24h } }),
        this.mongo.eventModel.countDocuments({ tenantId, receivedAt: { $gte: since7d } }),
        this.mongo.eventModel.countDocuments({ tenantId, status: 'processed' }),
        this.mongo.eventModel.countDocuments({ tenantId, status: 'failed' }),
        this.mongo.deliveryModel.countDocuments({ tenantId, status: 'delivered' }),
        this.mongo.deliveryModel.countDocuments({ tenantId, status: 'dlq' }),
        this.mongo.deliveryModel.countDocuments({
          tenantId,
          status: { $in: ['pending', 'delivering'] },
        }),
      ]);

    const totalAttempts = delivered + dlq;
    const successRate =
      totalAttempts > 0 ? Math.round((delivered / totalAttempts) * 100) : null;

    return {
      events24h,
      events7d,
      eventsProcessed: processed,
      eventsFailed: failed,
      deliveries: { delivered, dlq, pending, successRate },
    };
  }

  async delivery(tenantId: string) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const byStatus = await this.mongo.deliveryModel.aggregate([
      { $match: { tenantId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const byDestination = await this.mongo.deliveryModel.aggregate([
      { $match: { tenantId, createdAt: { $gte: since24h } } },
      {
        $group: {
          _id: '$destinationId',
          destinationType: { $first: '$destinationType' },
          total: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          dlq: { $sum: { $cond: [{ $eq: ['$status', 'dlq'] }, 1, 0] } },
          avgLatencyMs: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'delivered'] },
                '$lastResponse.latencyMs',
                null,
              ],
            },
          },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 20 },
    ]);

    return {
      byStatus: byStatus.map((b) => ({ status: b._id, count: b.count })),
      byDestination,
    };
  }

  async cost(tenantId: string) {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const eventAgg = await this.mongo.eventModel.aggregate([
      { $match: { tenantId, receivedAt: { $gte: since30d } } },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          enrichedEvents: {
            $sum: { $cond: [{ $ne: ['$enrichedPayload', null] }, 1, 0] },
          },
          enrichmentCacheHits: {
            $sum: { $cond: [{ $eq: ['$enrichment.cached', true] }, 1, 0] },
          },
          totalPayloadBytes: {
            $sum: {
              $cond: [
                { $eq: [{ $type: '$rawPayload' }, 'object'] },
                { $bsonSize: '$rawPayload' },
                0,
              ],
            },
          },
        },
      },
    ]);

    const deliveryAgg = await this.mongo.deliveryModel.aggregate([
      { $match: { tenantId, createdAt: { $gte: since30d } } },
      {
        $group: {
          _id: '$destinationId',
          destinationType: { $first: '$destinationType' },
          totalAttempts: { $sum: { $ifNull: ['$attemptCount', 0] } },
          totalDeliveries: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          dlq: { $sum: { $cond: [{ $eq: ['$status', 'dlq'] }, 1, 0] } },
          retries: {
            $sum: {
              $cond: [{ $gt: [{ $ifNull: ['$attemptCount', 0] }, 1] }, 1, 0],
            },
          },
        },
      },
      { $sort: { totalAttempts: -1 } },
    ]);

    const ev = eventAgg[0] ?? {
      totalEvents: 0,
      enrichedEvents: 0,
      enrichmentCacheHits: 0,
      totalPayloadBytes: 0,
    };

    const approxTokensPerEnrichment = Math.ceil(
      (ev.totalPayloadBytes / Math.max(ev.totalEvents, 1)) / 4,
    );
    const billableEnrichments = ev.enrichedEvents - ev.enrichmentCacheHits;
    const estimatedGroqCost =
      (Math.max(billableEnrichments, 0) * approxTokensPerEnrichment / 1000) *
      GROQ_COST_PER_1K_TOKENS;

    const totalAttempts = deliveryAgg.reduce((sum, d) => sum + d.totalAttempts, 0);
    const estimatedRedisCost = totalAttempts * 2 * REDIS_CMD_COST;

    const perDestination = deliveryAgg.map((d) => {
      const retryRate =
        d.totalDeliveries > 0 ? d.retries / d.totalDeliveries : 0;
      const estRedis = d.totalAttempts * 2 * REDIS_CMD_COST;
      return {
        destinationId: d._id,
        destinationType: d.destinationType,
        totalDeliveries: d.totalDeliveries,
        totalAttempts: d.totalAttempts,
        retries: d.retries,
        retryRate: Math.round(retryRate * 1000) / 10,
        delivered: d.delivered,
        dlq: d.dlq,
        estimatedRedisCostUsd: Math.round(estRedis * 1e6) / 1e6,
      };
    });

    return {
      windowDays: 30,
      events: {
        total: ev.totalEvents,
        enriched: ev.enrichedEvents,
        cacheHits: ev.enrichmentCacheHits,
        estimatedTokens: ev.enrichedEvents * approxTokensPerEnrichment,
      },
      cost: {
        groqUsd: Math.round(estimatedGroqCost * 1e4) / 1e4,
        redisUsd: Math.round(estimatedRedisCost * 1e4) / 1e4,
        totalUsd: Math.round((estimatedGroqCost + estimatedRedisCost) * 1e4) / 1e4,
      },
      perDestination,
      notes: [
        'Groq cost is estimated from payload size (1 token ≈ 4 bytes).',
        'Redis cost assumes $0.00002/command (Upstash pay-as-you-go rate).',
        'MongoDB Atlas M0 is free up to 512 MB — not included.',
      ],
    };
  }

  /**
   * Time-series rollup for charts. Buckets events + deliveries by
   * hour (24h range) or day (7d/30d range) using $dateTrunc.
   */
  async timeSeries(
    tenantId: string,
    range: '24h' | '7d' | '30d' = '24h',
  ) {
    const config = {
      '24h': { sinceMs: 24 * 3600_000, unit: 'hour' as const, buckets: 24 },
      '7d': { sinceMs: 7 * 24 * 3600_000, unit: 'day' as const, buckets: 7 },
      '30d': { sinceMs: 30 * 24 * 3600_000, unit: 'day' as const, buckets: 30 },
    }[range];

    const since = new Date(Date.now() - config.sinceMs);

    const eventBuckets = await this.mongo.eventModel.aggregate([
      { $match: { tenantId, receivedAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: '$receivedAt',
              unit: config.unit,
            },
          },
          events: { $sum: 1 },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const deliveryBuckets = await this.mongo.deliveryModel.aggregate([
      { $match: { tenantId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: '$createdAt',
              unit: config.unit,
            },
          },
          delivered: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
          dlq: {
            $sum: { $cond: [{ $eq: ['$status', 'dlq'] }, 1, 0] },
          },
          attempts: { $sum: { $ifNull: ['$attemptCount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Merge on bucket key
    const merged = new Map<
      string,
      { ts: string; events: number; failed: number; delivered: number; dlq: number; attempts: number }
    >();

    for (const b of eventBuckets) {
      const key = (b._id as Date).toISOString();
      merged.set(key, {
        ts: key,
        events: b.events as number,
        failed: b.failed as number,
        delivered: 0,
        dlq: 0,
        attempts: 0,
      });
    }
    for (const b of deliveryBuckets) {
      const key = (b._id as Date).toISOString();
      const existing = merged.get(key) ?? {
        ts: key,
        events: 0,
        failed: 0,
        delivered: 0,
        dlq: 0,
        attempts: 0,
      };
      existing.delivered = b.delivered as number;
      existing.dlq = b.dlq as number;
      existing.attempts = b.attempts as number;
      merged.set(key, existing);
    }

    // Fill gaps — frontend ko continuous buckets chahiye
    const filled: Array<{
      ts: string;
      events: number;
      failed: number;
      delivered: number;
      dlq: number;
      attempts: number;
    }> = [];
    const stepMs = config.unit === 'hour' ? 3600_000 : 86_400_000;
    const startMs = Math.floor(since.getTime() / stepMs) * stepMs;

    for (let i = 0; i <= config.buckets; i++) {
      const ts = new Date(startMs + i * stepMs).toISOString();
      filled.push(
        merged.get(ts) ?? {
          ts,
          events: 0,
          failed: 0,
          delivered: 0,
          dlq: 0,
          attempts: 0,
        },
      );
    }

    return {
      range,
      unit: config.unit,
      buckets: filled,
    };
  }
}