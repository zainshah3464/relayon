import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { signWebhook } from './standard-webhooks';
import { decryptConfig } from '../../lib/crypto-box';

const BATCH_SIZE = 10;
const FETCH_TIMEOUT_MS = 3_000;
const CLAIM_LEASE_SEC = 60;
const MAX_ATTEMPTS = 20;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 3_600_000;
const USER_AGENT = 'Relayon-Webhooks/3.0';

type DeliveryResult = 'ok' | 'retriable' | 'non_retriable';

export interface PollResult {
  claimed: number;
  delivered: number;
  retrying: number;
  failed: number;
}

@Injectable()
export class OutboxPollerService {
  private readonly logger = new Logger(OutboxPollerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async pollAndDeliver(): Promise<PollResult> {
    // Expire pending rows past retention
    await this.prisma.$executeRaw`
      UPDATE outbox_events
      SET status = 'failed', last_error = 'Retention window expired', updated_at = NOW()
      WHERE status = 'pending' AND expires_at < NOW()
    `;

    // Atomic claim with SKIP LOCKED + 60s self-healing lease
    const claimed = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        event_type: string;
        payload: unknown;
        attempt_count: number;
      }>
    >`
      UPDATE outbox_events
      SET
        attempt_count = attempt_count + 1,
        next_attempt_at = NOW() + make_interval(secs => ${CLAIM_LEASE_SEC}),
        updated_at = NOW()
      WHERE id IN (
        SELECT id FROM outbox_events
        WHERE status = 'pending' AND next_attempt_at <= NOW()
        ORDER BY next_attempt_at ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, tenant_id, event_type, payload, attempt_count
    `;

    if (claimed.length === 0) {
      return { claimed: 0, delivered: 0, retrying: 0, failed: 0 };
    }

    const results = await Promise.allSettled(claimed.map((r) => this.deliverRow(r)));

    let delivered = 0;
    let retrying = 0;
    let failed = 0;
    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value === 'delivered') delivered++;
        else if (r.value === 'retrying') retrying++;
        else failed++;
      } else {
        failed++;
        this.logger.error(`Row delivery threw: ${r.reason}`);
      }
    }

    this.logger.log(
      `outbox.poll claimed=${claimed.length} delivered=${delivered} retrying=${retrying} failed=${failed}`,
    );
    return { claimed: claimed.length, delivered, retrying, failed };
  }

  private async deliverRow(row: {
    id: string;
    tenant_id: string;
    event_type: string;
    payload: unknown;
    attempt_count: number;
  }): Promise<'delivered' | 'retrying' | 'failed'> {
    const endpoints = await this.prisma.withTenant(row.tenant_id, (tx) =>
      tx.webhookEndpoint.findMany({
        where: {
          tenantId: row.tenant_id,
          isActive: true,
          OR: [
            { eventTypes: { isEmpty: true } },
            { eventTypes: { has: row.event_type } },
          ],
        },
      }),
    );

    if (endpoints.length === 0) {
      await this.markDelivered(row.id);
      return 'delivered';
    }

    const rawBody = JSON.stringify(row.payload);
    const timestamp = Math.floor(Date.now() / 1000);

    const outcomes = await Promise.allSettled(
      endpoints.map((ep) => this.deliverToEndpoint(row, ep, rawBody, timestamp)),
    );

    const anyNonRetriable = outcomes.some(
      (o) => o.status === 'fulfilled' && o.value === 'non_retriable',
    );
    const anyFailure = outcomes.some(
      (o) => o.status === 'rejected' || (o.status === 'fulfilled' && o.value !== 'ok'),
    );

    if (!anyFailure) {
      await this.markDelivered(row.id);
      await this.prisma.withTenant(row.tenant_id, (tx) =>
        tx.webhookEndpoint.updateMany({
          where: { id: { in: endpoints.map((e) => e.id) } },
          data: { lastSuccessAt: new Date(), consecutiveFailures: 0 },
        }),
      );
      return 'delivered';
    }

    if (anyNonRetriable) {
      await this.markFailed(row.id, 'Non-retriable failure (client error)');
      return 'failed';
    }

    if (row.attempt_count >= MAX_ATTEMPTS) {
      await this.markFailed(row.id, `Max attempts exhausted (${MAX_ATTEMPTS})`);
      return 'failed';
    }

    const delayMs = this.computeBackoff(row.attempt_count);
    const delaySec = Math.floor(delayMs / 1000);

    await this.prisma.$executeRaw`
      UPDATE outbox_events
      SET next_attempt_at = NOW() + make_interval(secs => ${delaySec}),
          last_error = ${'Delivery failed, retrying'},
          updated_at = NOW()
      WHERE id = ${row.id}::uuid
    `;

    await this.prisma.withTenant(row.tenant_id, (tx) =>
      tx.webhookEndpoint.updateMany({
        where: { id: { in: endpoints.map((e) => e.id) } },
        data: {
          lastFailureAt: new Date(),
          consecutiveFailures: { increment: 1 },
        },
      }),
    );

    return 'retrying';
  }

  private async deliverToEndpoint(
    row: { id: string; tenant_id: string },
    endpoint: { id: string; url: string; secret: string },
    rawBody: string,
    timestamp: number,
  ): Promise<DeliveryResult> {
    let plaintextSecret: string;
    try {
      const decrypted = decryptConfig(
        { secret: endpoint.secret },
        row.tenant_id,
      );
      plaintextSecret = decrypted['secret'] as string;
      if (!plaintextSecret?.startsWith('whsec_')) {
        throw new Error('Secret missing whsec_ prefix');
      }
    } catch (err) {
      this.logger.error(
        `endpoint.decrypt_failed id=${endpoint.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return 'non_retriable';
    }

    const headers = signWebhook(rawBody, {
      id: row.id,
      timestamp,
      secret: plaintextSecret,
    });

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
          'webhook-id': headers.id,
          'webhook-timestamp': headers.timestamp,
          'webhook-signature': headers.signature,
        },
        body: rawBody,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (res.ok) return 'ok';

      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after');
        this.logger.warn(
          `endpoint.rate_limited id=${endpoint.id} retry-after=${retryAfter ?? 'n/a'}`,
        );
        return 'retriable';
      }

      if (res.status >= 400 && res.status < 500 && res.status !== 408) {
        this.logger.warn(`endpoint.client_error id=${endpoint.id} status=${res.status}`);
        return 'non_retriable';
      }

      return 'retriable';
    } catch (err) {
      this.logger.warn(
        `endpoint.fetch_failed id=${endpoint.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return 'retriable';
    }
  }

  private computeBackoff(attemptCount: number): number {
    const exponential = Math.min(
      BACKOFF_MAX_MS,
      BACKOFF_BASE_MS * Math.pow(2, attemptCount - 1),
    );
    const jitter = 0.5 + Math.random();
    return Math.floor(exponential * jitter);
  }

  private async markDelivered(id: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE outbox_events
      SET status = 'delivered', delivered_at = NOW(), last_error = NULL, updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
  }

  private async markFailed(id: string, reason: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE outbox_events
      SET status = 'failed', last_error = ${reason}, updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
  }
}