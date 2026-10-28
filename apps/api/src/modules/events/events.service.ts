import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MongoService } from '../mongo/mongo.service';

interface ListOptions {
  workflowId?: string;
  status?: string;
  limit: number;
  cursor?: string;
}

@Injectable()
export class EventsService {
  constructor(private readonly mongo: MongoService) {}

  async list(tenantId: string, opts: ListOptions) {
    const limit = Math.min(Math.max(opts.limit, 1), 100);

    const filter: Record<string, unknown> = { tenantId };
    if (opts.workflowId) filter['workflowId'] = opts.workflowId;
    if (opts.status) filter['status'] = opts.status;
    if (opts.cursor) filter['_id'] = { $lt: opts.cursor };

    const docs = await this.mongo.eventModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();

    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;

    return {
      items: items.map((d) => this.toSummary(d)),
      nextCursor: hasMore ? String(items[items.length - 1]?._id) : null,
    };
  }

  async get(tenantId: string, id: string) {
    const event = await this.mongo.eventModel
      .findOne({ _id: id, tenantId })
      .lean()
      .exec();
    if (!event) throw new NotFoundException('Event not found');

    const deliveries = await this.mongo.deliveryModel
      .find({ eventId: id, tenantId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return {
      ...event,
      deliveries,
    };
  }

  async replay(tenantId: string, eventId: string) {
    const event = await this.mongo.eventModel
      .findOne({ _id: eventId, tenantId })
      .lean()
      .exec();

    if (!event) throw new NotFoundException('Event not found');

    const workersUrl = process.env['WORKERS_URL'];
    const cronSecret = process.env['CRON_SECRET'];
    if (!workersUrl || !cronSecret) {
      throw new BadRequestException(
        'WORKERS_URL and CRON_SECRET must be configured to replay events',
      );
    }

    const res = await fetch(`${workersUrl}/internal/egress/replay-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': cronSecret,
      },
      body: JSON.stringify({ tenantId, eventId }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadRequestException(
        `Workers returned ${res.status}: ${detail.slice(0, 200)}`,
      );
    }

    return res.json();
  }

  private toSummary(doc: Record<string, unknown>) {
    return {
      _id: String(doc['_id']),
      correlationId: doc['correlationId'],
      workflowId: doc['workflowId'],
      sourceType: doc['sourceType'],
      status: doc['status'],
      receivedAt: doc['receivedAt'],
      processedAt: doc['processedAt'],
      hasEnrichment: doc['enrichedPayload'] !== null,
      hasError: doc['error'] !== null,
    };
  }
}