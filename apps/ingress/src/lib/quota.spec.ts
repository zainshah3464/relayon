import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { checkEventQuota } from './quota';

vi.mock('./prisma', () => ({
  prisma: {
    tenant: { findUnique: vi.fn() },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));
vi.mock('./redis', () => ({ redis: { get: vi.fn(), set: vi.fn() } }));

import { prisma } from './prisma';
import { redis } from './redis';

describe('ingress checkEventQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // prisma.$transaction passes a fake tx
    (prisma.$transaction as any).mockImplementation(async (fn: any) => {
      return fn(prisma);
    });
  });

  it('caches tenant limits for 5 min', async () => {
    (redis.get as Mock).mockResolvedValue(null);
    (prisma.tenant.findUnique as Mock).mockResolvedValue({
      quotaEventsPerMonth: 100,
      quotaAiTokensPerMonth: 1000,
      quotaMode: 'hard',
    });
    (prisma.$executeRaw as Mock).mockResolvedValue(0);
    (prisma.$queryRaw as Mock).mockResolvedValue([{ count: BigInt(1) }]);

    await checkEventQuota('t-1', 1);

    expect(redis.set).toHaveBeenCalledWith(
      'quota:limits:t-1',
      expect.any(String),
      'EX',
      300,
    );
  });

  it('uses cached limits', async () => {
    (redis.get as Mock).mockResolvedValue(
      JSON.stringify({ events: 100, aiTokens: 1000 }),
    );
    (prisma.$executeRaw as Mock).mockResolvedValue(0);
    (prisma.$queryRaw as Mock).mockResolvedValue([{ count: BigInt(1) }]);

    const result = await checkEventQuota('t-1', 1);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    expect(result.limit).toBe(100);
  });

  it('denies when tenant missing', async () => {
    (redis.get as Mock).mockResolvedValue(null);
    (prisma.tenant.findUnique as Mock).mockResolvedValue(null);
    const result = await checkEventQuota('missing', 1);
    expect(result.allowed).toBe(false);
  });
});