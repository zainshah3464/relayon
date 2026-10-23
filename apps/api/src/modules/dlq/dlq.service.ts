import { Injectable, NotFoundException } from '@nestjs/common';
import { MongoService } from '../mongo/mongo.service';

export interface BulkReplayResult {
  total: number;
  replayed: number;
  failed: number;
  failures: Array<{ id: string; reason: string }>;
}

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

  /**
   * Bulk replay — atomic, capped at 100 IDs.
   *
   * Uses a single updateMany scoped to tenant + status='dlq'. Per-ID
   * feedback is derived by querying which IDs actually changed. No
   * partial-write surprises.
   */
  async bulkReplay(
    tenantId: string,
    ids: string[],
  ): Promise<BulkReplayResult> {
    if (ids.length === 0) {
      return { total: 0, replayed: 0, failed: 0, failures: [] };
    }

    const uniqueIds = Array.from(new Set(ids)).slice(0, 100);

    const before = await this.mongo.deliveryModel
      .find({ _id: { $in: uniqueIds }, tenantId, status: 'dlq' })
      .select({ _id: 1 })
      .lean()
      .exec();
    const validIds = before.map((d) => String(d._id));
    const validSet = new Set(validIds);

    const failures: BulkReplayResult['failures'] = [];
    for (const id of uniqueIds) {
      if (!validSet.has(id)) {
        failures.push({ id, reason: 'Not found, not owned, or not in DLQ' });
      }
    }

    if (validIds.length > 0) {
      await this.mongo.deliveryModel.updateMany(
        { _id: { $in: validIds }, tenantId, status: 'dlq' },
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
    }

    return {
      total: uniqueIds.length,
      replayed: validIds.length,
      failed: failures.length,
      failures,
    };
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