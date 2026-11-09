import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { EmailVerificationService } from '../email-verification.service';
import { makePrismaMock } from '../../../../../../test/mocks/prisma';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let email: { sendVerification: Mock };
  let config: { get: Mock };

  beforeEach(() => {
    prisma = makePrismaMock();
    email = { sendVerification: vi.fn(async () => undefined) };
    config = { get: vi.fn((k: string) => k === 'APP_ORIGIN' ? 'https://app.test' : undefined) };
    service = new EmailVerificationService(prisma as never, email as never, config as never);
  });

  it('generates token, stores hash, sends email', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', tenantId: 't1', email: 'x@y.com', name: 'X', emailVerified: false,
    });
    prisma.emailVerification.updateMany.mockResolvedValue({});
    prisma.emailVerification.create.mockResolvedValue({});

    await service.sendVerification('u1', 't1');

    expect(prisma.emailVerification.updateMany).toHaveBeenCalled(); // invalidate old
    expect(prisma.emailVerification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      }),
    });
    expect(email.sendVerification).toHaveBeenCalledWith(
      'x@y.com', 'X', expect.stringContaining('https://app.test/verify-email?token='),
    );
  });

  it('skips if already verified', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', emailVerified: true, tenantId: 't1' });
    await service.sendVerification('u1', 't1');
    expect(email.sendVerification).not.toHaveBeenCalled();
  });

  it('verifies valid token, marks user verified', async () => {
    prisma.emailVerification.findUnique.mockResolvedValue({
      id: 'ev1', userId: 'u1', tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 3600_000), usedAt: null,
      user: { tenantId: 't1' },
    });
    prisma.emailVerification.update.mockResolvedValue({});
    prisma.user.update.mockResolvedValue({});

    const result = await service.verify('plain-token');

    expect(result).toEqual({ userId: 'u1', tenantId: 't1' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { emailVerified: true },
    });
  });

  it('rejects expired token', async () => {
    prisma.emailVerification.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1000), usedAt: null,
    });
    await expect(service.verify('x')).rejects.toThrow(/expired/i);
  });

  it('rejects already-used token', async () => {
    prisma.emailVerification.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 3600_000), usedAt: new Date(),
    });
    await expect(service.verify('x')).rejects.toThrow(/used/i);
  });

  it('rejects unknown token', async () => {
    prisma.emailVerification.findUnique.mockResolvedValue(null);
    await expect(service.verify('x')).rejects.toThrow(/Invalid/);
  });
});