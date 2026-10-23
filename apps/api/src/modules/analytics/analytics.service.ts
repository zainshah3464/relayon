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
}