import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export type RelayonEventType =
  | 'workflow.created'
  | 'workflow.updated'
  | 'workflow.deleted'
  | 'event.received'
  | 'delivery.succeeded'
  | 'delivery.failed'
  | 'dlq.entry_created'
  | 'quota.warning'
  | 'quota.exceeded';

const EVENT_RETENTION_DAYS = 7;

export interface EmitOptions<T = Record<string, unknown>> {
  tenantId: string;
  eventType: RelayonEventType;
  payload: T;
  /** Pass caller's transaction for atomicity with business writes. */
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  async emit<T = Record<string, unknown>>(
    opts: EmitOptions<T>,
  ): Promise<{ outboxId: string }> {
    const id = randomUUID();
    const now = new Date();

    const envelope = {
      id,
      type: opts.eventType,
      createdAt: now.toISOString(),
      data: opts.payload,
    };

    const run = async (tx: Prisma.TransactionClient) => {
      const row = await tx.outboxEvent.create({
        data: {
          id,
          tenantId: opts.tenantId,
          eventType: opts.eventType,
          payload: envelope as Prisma.InputJsonValue,
          expiresAt: new Date(now.getTime() + EVENT_RETENTION_DAYS * 24 * 3600_000),
        },
      });
      return { outboxId: row.id };
    };

    try {
      if (opts.tx) return await run(opts.tx);
      return await this.prisma.withTenant(opts.tenantId, run);
    } catch (err) {
      this.logger.error(
        `outbox.emit_failed tenant=${opts.tenantId} type=${opts.eventType}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw err;
    }
  }
}