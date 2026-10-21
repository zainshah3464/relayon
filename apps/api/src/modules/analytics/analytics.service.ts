import { Injectable } from '@nestjs/common';
import { MongoService } from '../mongo/mongo.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly mongo: MongoService) {}

  async overview(tenantId: string) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [events24h, events7d, processed, failed, delivered, dlq, pending] =
      await Promise.all([
        this.mongo.eventModel.countDocuments({
          tenantId,
          receivedAt: { $gte: since24h },
        }),
        this.mongo.eventModel.countDocuments({
          tenantId,
          receivedAt: { $gte: since7d },
        }),
        this.mongo.eventModel.countDocuments({
          tenantId,
          status: 'processed',
        }),
        this.mongo.eventModel.countDocuments({
          tenantId,
          status: 'failed',
        }),
        this.mongo.deliveryModel.countDocuments({
          tenantId,
          status: 'delivered',
        }),
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
      deliveries: {
        delivered,
        dlq,
        pending,
        successRate,
      },
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
          delivered: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
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
}