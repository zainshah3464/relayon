import { Injectable, NotFoundException } from '@nestjs/common';
import { MongoService } from '../mongo/mongo.service';

@Injectable()
export class DlqService {
  constructor(private readonly mongo: MongoService) {}

  async list(
    tenantId: string,
    opts: { limit: number; cursor?: string },
  ) {
    const limit = Math.min(Math.max(opts.limit, 1), 100);

    const filter: Record<string, unknown> = { tenantId, status: 'dlq' };
    if (opts.cursor) filter['_id'] = { $lt: opts.cursor };

    const docs = await this.mongo.deliveryModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();

    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;

    return {
      items,
      nextCursor: hasMore ? String(items[items.length - 1]?._id) : null,
    };
  }

  async replay(tenantId: string, deliveryId: string) {
    const delivery = await this.mongo.deliveryModel
      .findOne({ _id: deliveryId, tenantId, status: 'dlq' })
      .exec();
    if (!delivery) throw new NotFoundException('DLQ entry not found');

    // Reset to pending — the egress worker will pick it up on next run
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

    return { replayed: true, deliveryId: String(delivery._id) };
  }

  async discard(tenantId: string, deliveryId: string) {
    const result = await this.mongo.deliveryModel.deleteOne({
      _id: deliveryId,
      tenantId,
      status: 'dlq',
    });
    if (result.deletedCount === 0) {
      throw new NotFoundException('DLQ entry not found');
    }
    return { discarded: true, deliveryId };
  }
}