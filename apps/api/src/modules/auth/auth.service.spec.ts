import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import { makeTenant, makeUser } from '../../../../../test/fixtures';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: Mock; update: Mock };
    tenant: { findUnique: Mock; create: Mock };
    refreshToken: { findUnique: Mock; create: Mock; update: Mock; updateMany: Mock };
    withTenant: Mock;
    withoutTenant: Mock;
  };
  let jwt: { signAsync: Mock; verifyAsync: Mock };
  let config: { get: Mock; getOrThrow: Mock };

  beforeEach(() => {
    prisma = {
      user: { findUnique: vi.fn(), update: vi.fn() },
      tenant: { findUnique: vi.fn(), create: vi.fn() },
      refreshToken: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      withTenant: vi.fn((_tid: string, fn: any) => fn(prisma)),
      withoutTenant: vi.fn((fn: any) => fn(prisma)),
    };

    jwt = {
      signAsync: vi.fn(async () => 'mock-access-token'),
      verifyAsync: vi.fn(),
    };

    config = {
      get: vi.fn((key: string) => {
        const map: Record<string, string> = {
          JWT_SECRET: 'test-jwt-secret-min-32-chars-long-xx',
          JWT_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };
        return map[key];
      }),
      getOrThrow: vi.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test-jwt-secret-min-32-chars-long-xx';
        throw new Error(`Missing config: ${key}`);
      }),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
  });

  describe('signup', () => {
    it('creates tenant + owner user and returns tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue(null);

      const tenant = makeTenant({ name: 'Acme' });
      const user = makeUser({
        tenantId: tenant.id,
        email: 'zain@acme.com',
        role: 'owner',
      });

      prisma.tenant.create.mockResolvedValue({ ...tenant, users: [user] });
      prisma.user.create = vi.fn().mockResolvedValue(user);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.signup({
        name: 'Zain',
        tenantName: 'Acme',
        email: 'zain@acme.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('zain@acme.com');
      expect(result.user.role).toBe('owner');
    });

    it('rejects duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ email: 'zain@acme.com' }),
      );
      await expect(
        service.signup({
          name: 'Zain',
          tenantName: 'Acme',
          email: 'zain@acme.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens on valid credentials', async () => {
      const hash = await bcrypt.hash('correct-password', 12);
      const tenant = makeTenant();
      const user = makeUser({
        tenantId: tenant.id,
        email: 'zain@acme.com',
        passwordHash: hash,
      });
      prisma.user.findUnique.mockResolvedValue({ ...user, tenant });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: 'zain@acme.com',
        password: 'correct-password',
      });
      expect(result.accessToken).toBe('mock-access-token');
    });

    it('rejects wrong password', async () => {
      const hash = await bcrypt.hash('correct-password', 12);
      const tenant = makeTenant();
      prisma.user.findUnique.mockResolvedValue({
        ...makeUser({ passwordHash: hash }),
        tenant,
      });
      await expect(
        service.login({ email: 'zain@acme.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@example.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rotates refresh token', async () => {
      const tenant = makeTenant();
      const user = makeUser({ tenantId: tenant.id });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'old-token-id',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
        user: { ...user, tenant },
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      await service.refresh('some-refresh-token-value');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'old-token-id' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects revoked token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      await expect(service.refresh('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh('expired-token')).rejects.toThrow(/expired/i);
    });
  });

  describe('logout', () => {
    it('revokes refresh token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      await service.logout('some-token');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});