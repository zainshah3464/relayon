import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { QuotaService } from './quota.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { BillingService } from '../billing/billing.service';

describe('QuotaService (API)', () => {
  let service: QuotaService;
  let prisma: {
    tenant: { findUnique: Mock };
    withTenant: Mock;
    withoutTenant: Mock;
  };
  let billing: { reportUsageForQuota: Mock };

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: vi.fn() },
      withTenant: vi.fn((_tid: string, fn: any) => fn(prisma)),
      withoutTenant: vi.fn((fn: any) => fn(prisma)),
    };
    billing = { reportUsageForQuota: vi.fn() };

    service = new QuotaService(
      prisma as unknown as PrismaService,
      billing as unknown as BillingService,
    );
  });

  describe('checkAndConsume', () => {
    it('allows under limit and increments counter', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        quotaEventsPerMonth: 100,
        quotaAiTokensPerMonth: 1000,
        quotaMode: 'hard',
      });

      let currentCount = 0;
      const fakeTx = {
        $executeRaw: vi.fn(async () => 0),
        $queryRaw: vi.fn(async (query: TemplateStringsArray) => {
          const sql = query.join('');
          if (sql.includes('UPDATE')) {
            currentCount += 1;
            return [{ count: BigInt(currentCount) }];
          }
          return [{ count: BigInt(currentCount) }];
        }),
      };
      prisma.withTenant.mockImplementation(async (_tid: string, fn: any) =>
        fn(fakeTx),
      );

      const result = await service.checkAndConsume('t-1', 'events', 1);
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(1);
      expect(result.limit).toBe(100);
      expect(result.mode).toBe('hard');
    });

    it('rejects when at limit (hard mode)', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        quotaEventsPerMonth: 10,
        quotaAiTokensPerMonth: 100,
        quotaMode: 'hard',
      });
      const fakeTx = {
        $executeRaw: vi.fn(async () => 0),
        $queryRaw: vi.fn(async (query: TemplateStringsArray) => {
          if (query.join('').includes('UPDATE')) return [];
          return [{ count: BigInt(10) }];
        }),
      };
      prisma.withTenant.mockImplementation(async (_tid: string, fn: any) =>
        fn(fakeTx),
      );

      const result = await service.checkAndConsume('t-1', 'events', 1);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('throws when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(
        service.checkAndConsume('missing', 'events', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('reports usage to Stripe on success', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        quotaEventsPerMonth: 100,
        quotaAiTokensPerMonth: 1000,
        quotaMode: 'hard',
      });
      const fakeTx = {
        $executeRaw: vi.fn(async () => 0),
        $queryRaw: vi.fn(async () => [{ count: BigInt(1) }]),
      };
      prisma.withTenant.mockImplementation(async (_tid: string, fn: any) =>
        fn(fakeTx),
      );

      await service.checkAndConsume('t-1', 'events', 1);
      await new Promise((r) => setTimeout(r, 10));
      expect(billing.reportUsageForQuota).toHaveBeenCalledWith(
        't-1',
        'events',
        1,
      );
    });
  });

  describe('snapshot', () => {
    it('returns all 3 metrics', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        quotaEventsPerMonth: 10000,
        quotaAiTokensPerMonth: 100000,
        quotaMode: 'hard',
      });
      const fakeTx = {
        usageCounter: {
          findMany: vi.fn(async () => [
            { metric: 'events', count: BigInt(123) },
            { metric: 'ai_tokens', count: BigInt(456) },
          ]),
        },
      };
      prisma.withTenant.mockImplementation(async (_tid: string, fn: any) =>
        fn(fakeTx),
      );

      const snap = await service.snapshot('t-1');
      expect(snap.mode).toBe('hard');
      expect(snap.metrics.events.used).toBe(123);
      expect(snap.metrics.events.remaining).toBe(9877);
      expect(snap.metrics.ai_tokens.used).toBe(456);
      expect(snap.metrics.deliveries.used).toBe(0);
    });
  });
});