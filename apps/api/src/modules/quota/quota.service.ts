import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type QuotaMetric = 'events' | 'ai_tokens' | 'deliveries';

export interface QuotaResult {
  metric: QuotaMetric;
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  period: string;
  resetAt: string;
}

export interface QuotaSnapshot {
  period: string;
  metrics: Record<
    QuotaMetric,
    { used: number; limit: number; remaining: number; resetAt: string }
  >;
}

const METRICS: QuotaMetric[] = ['events', 'ai_tokens', 'deliveries'];

@Injectable()
export class QuotaService {
  constructor(private readonly prisma: PrismaService) {}

  async checkAndConsume(
    tenantId: string,
    metric: QuotaMetric,
    cost: number,
  ): Promise<QuotaResult> {
    if (cost < 0 || !Number.isFinite(cost)) cost = 1;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        quotaEventsPerMonth: true,
        quotaAiTokensPerMonth: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const limit =
      metric === 'ai_tokens'
        ? tenant.quotaAiTokensPerMonth
        : tenant.quotaEventsPerMonth;

    const period = this.periodKey();
    const resetAt = this.nextPeriodStart();

    const outcome = await this.prisma.withTenant(tenantId, async (tx) => {
      await tx.$executeRaw`
        INSERT INTO usage_counters (tenant_id, period, metric, count, updated_at)
        VALUES (${tenantId}, ${period}, ${metric}, 0, NOW())
        ON CONFLICT (tenant_id, period, metric) DO NOTHING
      `;

      const reserved = await tx.$queryRaw<Array<{ count: bigint }>>`
        UPDATE usage_counters
        SET count = count + ${cost}, updated_at = NOW()
        WHERE tenant_id = ${tenantId}
          AND period = ${period}
          AND metric = ${metric}
          AND count + ${cost} <= ${limit}
        RETURNING count
      `;

      if (reserved.length > 0) {
        return { allowed: true, used: Number(reserved[0]!.count) };
      }

      const current = await tx.$queryRaw<Array<{ count: bigint }>>`
        SELECT count FROM usage_counters
        WHERE tenant_id = ${tenantId} AND period = ${period} AND metric = ${metric}
      `;
      return { allowed: false, used: Number(current[0]?.count ?? 0n) };
    });

    return {
      metric,
      allowed: outcome.allowed,
      used: outcome.used,
      limit,
      remaining: Math.max(0, limit - outcome.used),
      period,
      resetAt,
    };
  }

  async snapshot(tenantId: string): Promise<QuotaSnapshot> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        quotaEventsPerMonth: true,
        quotaAiTokensPerMonth: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const period = this.periodKey();
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.usageCounter.findMany({ where: { tenantId, period } }),
    );

    const byMetric = new Map(rows.map((r) => [r.metric, Number(r.count)]));

    const limits: Record<QuotaMetric, number> = {
      events: tenant.quotaEventsPerMonth,
      deliveries: tenant.quotaEventsPerMonth,
      ai_tokens: tenant.quotaAiTokensPerMonth,
    };

    const metrics = {} as QuotaSnapshot['metrics'];
    for (const metric of METRICS) {
      const used = byMetric.get(metric) ?? 0;
      const limit = limits[metric];
      metrics[metric] = {
        used,
        limit,
        remaining: Math.max(0, limit - used),
        resetAt: this.nextPeriodStart(),
      };
    }

    return { period, metrics };
  }

  private periodKey(now = new Date()): string {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private nextPeriodStart(now = new Date()): string {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  }
}