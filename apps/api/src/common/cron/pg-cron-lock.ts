import type { PrismaService } from '../../modules/prisma/prisma.service';

/**
 * PostgreSQL advisory lock for distributed cron jobs.
 *
 * Uses transaction-scoped `pg_try_advisory_xact_lock` — lock auto-releases
 * on commit OR rollback OR connection drop. Works across all Vercel instances.
 *
 * For cleanup crons (must run EXACTLY ONCE), use this.
 * For batch processing (at-least-once), use FOR UPDATE SKIP LOCKED instead.
 */
export async function withAdvisoryLock<T>(
  prisma: PrismaService,
  lockId: number,
  fn: () => Promise<T>,
  opts: { timeoutMs?: number } = {},
): Promise<{ ran: true; result: T } | { ran: false; reason: 'lock_held' }> {
  const timeoutMs = opts.timeoutMs ?? 60_000;

  let ran = false;
  let result: T | undefined;

  await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${lockId}::bigint) AS acquired
      `;
      const acquired = rows[0]?.acquired ?? false;
      if (!acquired) return;

      ran = true;
      result = await fn();
    },
    { timeout: timeoutMs, maxWait: 5_000 },
  );

  return ran
    ? { ran: true, result: result! }
    : { ran: false, reason: 'lock_held' };
}

/**
 * Deterministic 32-bit lock ID from a stable string name.
 * FNV-1a hash — stable across Node versions and restarts.
 */
export function lockId(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h % 4_000_000_000;
}