import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthEmailService } from './email/email.service';
import { randomBytes, createHash } from 'node:crypto';

const TOKEN_TTL_HOURS = 24;

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: AuthEmailService,
    private readonly config: ConfigService,
  ) {}

  async sendVerification(userId: string, tenantId: string): Promise<void> {
    const user = await this.prisma.withTenant(tenantId, (tx) =>
      tx.user.findUnique({ where: { id: userId } }),
    );
    if (!user || user.emailVerified) return;

    await this.prisma.withTenant(tenantId, (tx) =>
      tx.emailVerification.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    );

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hash(token);

    await this.prisma.withTenant(tenantId, (tx) =>
      tx.emailVerification.create({
        data: { userId, tokenHash, expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 3600_000) },
      }),
    );

    const appUrl = this.config.get<string>('APP_ORIGIN') ?? 'http://localhost:4200';
    // ⚠️ v2.2 — pass user's preferred locale so email is rendered in their language
    await this.email.sendVerification(
      user.email,
      user.name,
      `${appUrl}/verify-email?token=${token}`,
      user.locale,
    );
  }

  async verify(token: string): Promise<{ userId: string; tenantId: string }> {
    const tokenHash = this.hash(token);
    const record = await this.prisma.withoutTenant((c) =>
      c.emailVerification.findUnique({ where: { tokenHash }, include: { user: true } }),
    );
    if (!record) throw new Error('Invalid verification link');
    if (record.usedAt) throw new Error('This link has already been used');
    if (record.expiresAt < new Date()) throw new Error('This link has expired');

    await this.prisma.withTenant(record.user.tenantId, async (tx) => {
      await tx.emailVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      await tx.user.update({ where: { id: record.userId }, data: { emailVerified: true } });
    });

    return { userId: record.userId, tenantId: record.user.tenantId };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}