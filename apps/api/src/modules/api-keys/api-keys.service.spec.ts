import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { makePrismaMock } from '../../../../../test/mocks/prisma';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    process.env['API_KEY_PEPPER'] = 'test-pepper-min-32-chars-long-xxxx';
    prisma = makePrismaMock();
    service = new ApiKeysService(prisma as never);
  });

  describe('create', () => {
    it('returns raw key ONCE, stores only hash', async () => {
      prisma.apiKey.create.mockImplementation(async ({ data }: any) => ({
        id: 'key-1',
        name: data.name,
        prefix: data.prefix,
        scopes: data.scopes,
        environment: data.environment,
        expiresAt: data.expiresAt,
        createdAt: new Date(),
      }));

      const result = await service.create('t-1', {
        name: 'CI',
        scopes: ['events:read'],
        environment: 'live',
      });

      expect(result.rawKey).toBeDefined();
      expect(result.rawKey).toMatch(/^rlk_live_[a-f0-9]{8}_[a-f0-9]{48}$/);
      expect(result.prefix).toMatch(/^rlk_live_[a-f0-9]{8}$/);

      const stored = prisma.apiKey.create.mock.calls[0]![0].data;
      expect(stored.keyHash).toMatch(/^[a-f0-9]{64}$/);
      expect(stored.keyHash).not.toBe(result.rawKey);
    });

    it('applies 90-day expiry by default', async () => {
      prisma.apiKey.create.mockImplementation(async ({ data }: any) => ({
        id: 'k1',
        ...data,
        createdAt: new Date(),
      }));

      await service.create('t-1', {
        name: 'Test',
        scopes: ['events:read'],
      });

      const expiresAt = prisma.apiKey.create.mock.calls[0]![0].data.expiresAt as Date;
      const days = (expiresAt.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(89);
      expect(days).toBeLessThan(91);
    });

    it('respects neverExpires flag', async () => {
      prisma.apiKey.create.mockImplementation(async ({ data }: any) => ({
        id: 'k1',
        ...data,
        createdAt: new Date(),
      }));

      await service.create('t-1', {
        name: 'Test',
        scopes: ['events:read'],
        neverExpires: true,
      });

      expect(prisma.apiKey.create.mock.calls[0]![0].data.expiresAt).toBeNull();
    });
  });

  describe('verify', () => {
    it('returns tenant+scopes for valid key', async () => {
      prisma.apiKey.create.mockImplementation(async ({ data }: any) => ({
        id: 'k1',
        ...data,
        createdAt: new Date(),
      }));
      const created = await service.create('t-1', {
        name: 'Test',
        scopes: ['events:read', 'workflows:write'],
      });

      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'k1',
        tenantId: 't-1',
        prefix: created.prefix,
        keyHash: prisma.apiKey.create.mock.calls[0]![0].data.keyHash,
        scopes: ['events:read', 'workflows:write'],
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      prisma.apiKey.update.mockResolvedValue({});

      const verified = await service.verify(created.rawKey);

      expect(verified).toEqual({
        tenantId: 't-1',
        apiKeyId: 'k1',
        scopes: ['events:read', 'workflows:write'],
      });
    });

    it('rejects malformed key format', async () => {
      expect(await service.verify('invalid-format')).toBeNull();
    });

    it('rejects unknown prefix', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);
      expect(
        await service.verify('rlk_live_aaaaaaaa_' + 'a'.repeat(48)),
      ).toBeNull();
    });

    it('rejects revoked key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      expect(
        await service.verify('rlk_live_aaaaaaaa_' + 'a'.repeat(48)),
      ).toBeNull();
    });

    it('rejects expired key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      expect(
        await service.verify('rlk_live_aaaaaaaa_' + 'a'.repeat(48)),
      ).toBeNull();
    });

    it('rejects wrong key for known prefix (timing-safe)', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'k1',
        tenantId: 't-1',
        prefix: 'rlk_live_aaaaaaaa',
        keyHash: 'a'.repeat(64),
        scopes: [],
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
      });

      const result = await service.verify(
        'rlk_live_aaaaaaaa_' + 'b'.repeat(48),
      );
      expect(result).toBeNull();
    });
  });

  describe('rotate', () => {
    it('caps old key expiry at grace window', async () => {
      prisma.apiKey.findFirst.mockResolvedValue({
        id: 'old-id',
        tenantId: 't-1',
        name: 'Prod',
        prefix: 'rlk_live_aaaaaaaa',
        scopes: ['events:read'],
        environment: 'live',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      });
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.apiKey.update.mockResolvedValue({});
      prisma.apiKey.create.mockImplementation(async ({ data }: any) => ({
        id: 'new-id',
        ...data,
        createdAt: new Date(),
      }));

      const result = await service.rotate('t-1', 'old-id', 'user-1');

      const updateCall = prisma.apiKey.update.mock.calls[0]![0];
      const newExpiry = updateCall.data.expiresAt as Date;
      const hoursFromNow = (newExpiry.getTime() - Date.now()) / 3_600_000;
      expect(hoursFromNow).toBeLessThan(25);
      expect(hoursFromNow).toBeGreaterThan(23);

      expect(result.newKey.rawKey).toBeDefined();
      expect(result.newKey.rawKey).not.toBe(result.oldKeyId);
    });
  });
});