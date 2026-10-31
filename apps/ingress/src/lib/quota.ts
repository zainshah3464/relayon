import { prisma } from './prisma';
import { redis } from './redis';
import { logger } from './logger';

export type QuotaMetric = 'events' | 'ai_tokens';
export type QuotaMode = 'hard' | 'soft';

export interface QuotaDecision {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  period: string;
  resetAt: string;
  mode: QuotaMode;
  warning: boolean;
}

const TENANT_CACHE_TTL = 300; // 5 min
const SOFT_MODE_OVERSHOOT_MULTIPLIER = 2;
const WARNING_THRESHOLD = 0.8; // warn at 80% of nominal limit

interface TenantLimits {
  events: number;
  aiTokens: number;
  mode: QuotaMode;
}

function periodKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function nextPeriodStart(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  ).toISOString();
}

async function getTenantLimits(
  tenantId: string,
): Promise<TenantLimits | null> {
  const cacheKey = `quota:limits:${tenantId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as TenantLimits;
    } catch {
      // fall through
    }
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      quotaEventsPerMonth: true,
      quotaAiTokensPerMonth: true,
      quotaMode: true,
    },
  });
  if (!tenant) return null;

  const limits: TenantLimits = {
    events: tenant.quotaEventsPerMonth,
    aiTokens: tenant.quotaAiTokensPerMonth,
    mode: tenant.quotaMode === 'soft' ? 'soft' : 'hard',
  };

  await redis.set(cacheKey, JSON.stringify(limits), 'EX', TENANT_CACHE_TTL);
  return limits;
}

/**
 * Atomic event-quota reservation. Wraps all `usage_counters` queries
 * in a single transaction with `app.tenant_id` set (required for RLS).
 *
 * Modes:
 *   - hard: reject as soon as count + cost > limit
 *   - soft: allow overshoot up to (limit * 2), then reject.
 *           Useful for billing-based tenants who don't want sudden
 *           webhook drops at the exact limit.
 */
export async function checkEventQuota(
  tenantId: string,
  cost = 1,
): Promise<QuotaDecision> {
  const period = periodKey();
  const resetAt = nextPeriodStart();
  const limits = await getTenantLimits(tenantId);

  if (!limits) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      period,
      resetAt,
      mode: 'hard',
      warning: false,
    };
  }

  const limit = limits.events;
  const mode = limits.mode;
  const effectiveLimit =
    mode === 'soft'
      ? Math.floor(limit * SOFT_MODE_OVERSHOOT_MULTIPLIER)
      : limit;

  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

    await tx.$executeRaw`
      INSERT INTO usage_counters (tenant_id, period, metric, count, updated_at)
      VALUES (${tenantId}, ${period}, 'events', 0, NOW())
      ON CONFLICT (tenant_id, period, metric) DO NOTHING
    `;

    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      UPDATE usage_counters
      SET count = count + ${cost}, updated_at = NOW()
      WHERE tenant_id = ${tenantId}
        AND period = ${period}
        AND metric = 'events'
        AND count + ${cost} <= ${effectiveLimit}
      RETURNING count
    `;

    if (rows.length > 0) {
      return { allowed: true, used: Number(rows[0]!.count) };
    }

    const current = await tx.$queryRaw<Array<{ count: bigint }>>`
      SELECT count FROM usage_counters
      WHERE tenant_id = ${tenantId} AND period = ${period} AND metric = 'events'
    `;
    return { allowed: false, used: Number(current[0]?.count ?? 0n) };
  });

  if (!outcome.allowed) {
    logger.warn('quota.exceeded', {
      tenantId,
      metric: 'events',
      used: outcome.used,
      limit,
      effectiveLimit,
      mode,
    });
  } else if (outcome.used >= limit * WARNING_THRESHOLD && outcome.used < limit) {
    logger.warn('quota.approaching', {
      tenantId,
      metric: 'events',
      used: outcome.used,
      limit,
      mode,
    });
  }

  const warning =
    outcome.used >= limit * WARNING_THRESHOLD && outcome.used < limit;

  return {
    allowed: outcome.allowed,
    used: outcome.used,
    limit,
    remaining: Math.max(0, limit - outcome.used),
    period,
    resetAt,
    mode,
    warning,
  };
}