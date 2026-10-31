import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UsageExportRow {
  period: string;
  metric: string;
  used: number;
  limit: number;
  remaining: number;
  updatedAt: string;
}

@Injectable()
export class UsageExportService {
  constructor(private readonly prisma: PrismaService) {}

  async *streamUsage(
    tenantId: string,
    period: string,
  ): AsyncGenerator<UsageExportRow> {
    const tenant = await this.prisma.withoutTenant((c) =>
      c.tenant.findUnique({
        where: { id: tenantId },
        select: {
          quotaEventsPerMonth: true,
          quotaAiTokensPerMonth: true,
        },
      }),
    );
    if (!tenant) return;

    const limits: Record<string, number> = {
      events: tenant.quotaEventsPerMonth,
      ai_tokens: tenant.quotaAiTokensPerMonth,
      deliveries: tenant.quotaEventsPerMonth,
    };

    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.usageCounter.findMany({
        where: { tenantId, period },
        orderBy: [{ metric: 'asc' }],
      }),
    );

    for (const row of rows) {
      const limit = limits[row.metric] ?? 0;
      const used = Number(row.count);
      yield {
        period: row.period,
        metric: row.metric,
        used,
        limit,
        remaining: Math.max(0, limit - used),
        updatedAt: row.updatedAt.toISOString(),
      };
    }
  }
}