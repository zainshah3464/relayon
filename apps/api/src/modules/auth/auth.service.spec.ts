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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let jwt: { signAsync: Mock; verifyAsync: Mock };
  let config: { get: Mock; getOrThrow: Mock };
  let verification: { sendVerification: Mock; verify: Mock };
  let passwordReset: { requestReset: Mock; reset: Mock };
  let email: {
    sendVerification: Mock;
    sendPasswordReset: Mock;
    sendPasswordChanged: Mock;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      refreshToken: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      withTenant: vi.fn((_tid: string, fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
      withoutTenant: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
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

    verification = {
      sendVerification: vi.fn(async () => undefined),
      verify: vi.fn(),
    };

    passwordReset = {
      requestReset: vi.fn(),
      reset: vi.fn(),
    };

    email = {
      sendVerification: vi.fn(),
      sendPasswordReset: vi.fn(),
      sendPasswordChanged: vi.fn(async () => undefined),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      verification as never,
      passwordReset as never,
      email as never,
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

      prisma.tenant.create.mockResolvedValue(tenant);
      prisma.user.create.mockResolvedValue(user);
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
      expect(result.user.tenantName).toBe('Acme');
      expect(result.user.role).toBe('owner');

      const userCreateCall = prisma.user.create.mock.calls[0]?.[0];
      const hash = userCreateCall?.data?.passwordHash as string;
      expect(hash.startsWith('$2')).toBe(true);
      expect(await bcrypt.compare('password123', hash)).toBe(true);

      expect(verification.sendVerification).toHaveBeenCalledWith(
        user.id,
        tenant.id,
      );
    });

    it('rejects duplicate email with ConflictException', async () => {
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

      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });

    it('appends suffix to slug on collision', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ slug: 'acme' }));

      const tenant = makeTenant({ name: 'Acme' });
      const user = makeUser({ tenantId: tenant.id });
      prisma.tenant.create.mockResolvedValue(tenant);
      prisma.user.create.mockResolvedValue(user);
      prisma.refreshToken.create.mockResolvedValue({});

      await service.signup({
        name: 'Zain',
        tenantName: 'Acme',
        email: 'zain@acme.com',
        password: 'password123',
      });

      const slug = prisma.tenant.create.mock.calls[0]?.[0]?.data?.slug as string;
      expect(slug).toMatch(/^acme-[a-f0-9]{6}$/);
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
    emailVerified: true,   // ⚠️ FIX — this user is verified (simulates real login)
  });
  prisma.user.findUnique.mockResolvedValue({ ...user, tenant });
  prisma.user.update.mockResolvedValue({});
  prisma.refreshToken.create.mockResolvedValue({});

  const result = await service.login({
    email: 'zain@acme.com',
    password: 'correct-password',
  });

  expect(result.accessToken).toBe('mock-access-token');
  expect(prisma.user.update).toHaveBeenCalledWith({
    where: { id: user.id },
    data: { lastLoginAt: expect.any(Date) },
  });
});

    it('rejects wrong password', async () => {
      const hash = await bcrypt.hash('correct-password', 12);
      const tenant = makeTenant();
      const user = makeUser({
        tenantId: tenant.id,
        email: 'zain@acme.com',
        passwordHash: hash,
      });
      prisma.user.findUnique.mockResolvedValue({ ...user, tenant });

      await expect(
        service.login({ email: 'zain@acme.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects unknown email with same error (timing-safe)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects unverified email', async () => {
      const hash = await bcrypt.hash('password123', 12);
      const tenant = makeTenant();
      const user = makeUser({
        tenantId: tenant.id,
        email: 'zain@acme.com',
        passwordHash: hash,
      });
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        tenant,
        emailVerified: false,
      });

      await expect(
        service.login({ email: 'zain@acme.com', password: 'password123' }),
      ).rejects.toThrow(/verify/i);
    });
  });

  describe('refresh', () => {
    it('rotates refresh token (revokes old, issues new)', async () => {
      const tenant = makeTenant();
      const user = makeUser({ tenantId: tenant.id });
      const oldToken = {
        id: 'old-token-id',
        tokenHash: 'hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
        user: { ...user, tenant },
      };
      prisma.refreshToken.findUnique.mockResolvedValue(oldToken);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('some-refresh-token-value');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'old-token-id' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.accessToken).toBe('mock-access-token');
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

      await expect(service.refresh('expired-token')).rejects.toThrow(
        /expired/i,
      );
    });

    it('rejects unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('unknown')).rejects.toThrow(
        UnauthorizedException,
      );
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

  describe('loginWithOAuth', () => {
    it('creates a new tenant + user for first-time OAuth login', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue(null);

      const tenant = makeTenant({ name: 'Zain' });
      const user = makeUser({
        tenantId: tenant.id,
        email: 'zain@gmail.com',
        role: 'owner',
      });
      prisma.tenant.create.mockResolvedValue(tenant);
      prisma.user.create.mockResolvedValue(user);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.loginWithOAuth({
        provider: 'google',
        providerId: 'google-123',
        email: 'zain@gmail.com',
        name: 'Zain',
        emailVerified: true,
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.email).toBe('zain@gmail.com');
    });
  });
});