import { PrismaClient } from '@prisma/client';

let client: PrismaClient | null = null;

function getClient(): PrismaClient {
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}

export type QuotaMetric = 'events' | 'ai_tokens';

export async function checkQuota(
  tenantId: string,
  metric: QuotaMetric,
  cost: number,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  if (cost < 0 || !Number.isFinite(cost)) cost = 1;
  const prisma = getClient();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      quotaEventsPerMonth: true,
      quotaAiTokensPerMonth: true,
    },
  });
  if (!tenant) return { allowed: false, used: 0, limit: 0 };

  const limit =
    metric === 'ai_tokens'
      ? tenant.quotaAiTokensPerMonth
      : tenant.quotaEventsPerMonth;

  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

    await tx.$executeRaw`
      INSERT INTO usage_counters (tenant_id, period, metric, count, updated_at)
      VALUES (${tenantId}, ${period}, ${metric}, 0, NOW())
      ON CONFLICT (tenant_id, period, metric) DO NOTHING
    `;

    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      UPDATE usage_counters
      SET count = count + ${cost}, updated_at = NOW()
      WHERE tenant_id = ${tenantId}
        AND period = ${period}
        AND metric = ${metric}
        AND count + ${cost} <= ${limit}
      RETURNING count
    `;

    if (rows.length > 0) {
      return { allowed: true, used: Number(rows[0]!.count), limit };
    }

    const current = await tx.$queryRaw<Array<{ count: bigint }>>`
      SELECT count FROM usage_counters
      WHERE tenant_id = ${tenantId} AND period = ${period} AND metric = ${metric}
    `;
    return { allowed: false, used: Number(current[0]?.count ?? 0n), limit };
  });
}