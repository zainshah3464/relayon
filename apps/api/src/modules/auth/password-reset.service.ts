import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthEmailService } from './email/email.service';
import { randomBytes, createHash } from 'node:crypto';

const TOKEN_TTL_MINUTES = 60;

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: AuthEmailService,
    private readonly config: ConfigService,
  ) {}

  async requestReset(email: string): Promise<void> {
    const normalized = email.toLowerCase();
    const user = await this.prisma.withoutTenant((c) => c.user.findUnique({ where: { email: normalized } }));
    if (!user || !user.passwordHash) return;

    await this.prisma.withTenant(user.tenantId, (tx) =>
      tx.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    );

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hash(token);

    await this.prisma.withTenant(user.tenantId, (tx) =>
      tx.passwordReset.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000) },
      }),
    );

    const appUrl = this.config.get<string>('APP_ORIGIN') ?? 'http://localhost:4200';
    await this.email.sendPasswordReset(user.email, user.name, `${appUrl}/reset-password?token=${token}`);
  }

  async reset(token: string, newPasswordHash: string): Promise<{ userId: string; tenantId: string; email: string; name: string }> {
    const tokenHash = this.hash(token);
    const record = await this.prisma.withoutTenant((c) =>
      c.passwordReset.findUnique({ where: { tokenHash }, include: { user: true } }),
    );
    if (!record) throw new Error('Invalid reset link');
    if (record.usedAt) throw new Error('This link has already been used');
    if (record.expiresAt < new Date()) throw new Error('This link has expired');

    await this.prisma.withTenant(record.user.tenantId, async (tx) => {
      await tx.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash: newPasswordHash, emailVerified: true },
      });
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { userId: record.userId, tenantId: record.user.tenantId, email: record.user.email, name: record.user.name };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}