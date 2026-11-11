import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { AuthEmailService } from './email/email.service';
import type { OAuthProfile } from './strategies/google.strategy';

export interface AuthResultUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthResultUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly verification: EmailVerificationService,
    private readonly passwordReset: PasswordResetService,
    private readonly email: AuthEmailService,
  ) {}

  // ─── SIGNUP ────────────────────────────────────────────────────────
  async signup(dto: SignupDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();

    const existing = await this.prisma.withoutTenant((c) =>
      c.user.findUnique({ where: { email } }),
    );
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const baseSlug = this.slugify(dto.tenantName);
    const slugTaken = await this.prisma.withoutTenant((c) =>
      c.tenant.findUnique({ where: { slug: baseSlug } }),
    );
    const finalSlug = slugTaken
      ? `${baseSlug}-${randomBytes(3).toString('hex')}`
      : baseSlug;

    const tenant = await this.prisma.withoutTenant((c) =>
      c.tenant.create({ data: { name: dto.tenantName, slug: finalSlug } }),
    );

    const user = await this.prisma.withTenant(tenant.id, (tx) =>
      tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          name: dto.name,
          passwordHash,
          role: 'owner',
          // ⚠️ v2.1 — local signups require verification
          emailVerified: false,
        },
      }),
    );

    this.logger.log(`Signup: ${tenant.slug}/${user.email}`);

    // Fire-and-forget verification email (non-blocking)
    this.verification.sendVerification(user.id, tenant.id).catch((err) => {
      this.logger.error(`Verification email failed: ${err.message}`);
    });

    return this.issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
    });
  }

  // ─── LOGIN (email/password) ────────────────────────────────────────
  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.withoutTenant((c) =>
      c.user.findUnique({ where: { email }, include: { tenant: true } }),
    );

    // ⚠️ v2.1 — OAuth-only users have null passwordHash
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    // ⚠️ v2.1 — block login until email verified
    if (!user.emailVerified) {
      throw new UnauthorizedException({
        message:
          'Please verify your email before logging in. Check your inbox.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    await this.prisma.withTenant(user.tenantId, (tx) =>
      tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    );

    return this.issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      tenantSlug: user.tenant.slug,
    });
  }

  // ─── OAUTH LOGIN (Google / GitHub) ─────────────────────────────────
  async loginWithOAuth(profile: OAuthProfile): Promise<AuthResult> {
    const email = profile.email.toLowerCase();
    const providerField =
      profile.provider === 'google' ? 'googleId' : 'githubId';

    // 1. Existing user by provider ID
    const byProvider = await this.prisma.withoutTenant((c) =>
      c.user.findFirst({
        where: { [providerField]: profile.providerId } as never,
        include: { tenant: true },
      }),
    );
    if (byProvider) return this.issueOAuthSession(byProvider);

    // 2. Existing user by email — link provider
    const byEmail = await this.prisma.withoutTenant((c) =>
      c.user.findUnique({ where: { email }, include: { tenant: true } }),
    );

    if (byEmail) {
      await this.prisma.withTenant(byEmail.tenantId, (tx) =>
        tx.user.update({
          where: { id: byEmail.id },
          data: {
            [providerField]: profile.providerId,
            emailVerified: true, // OAuth provider already verified
          } as never,
        }),
      );
      return this.issueOAuthSession(byEmail);
    }

    // 3. Brand new user via OAuth
    const baseSlug = this.slugify(profile.name || email.split('@')[0]!);
    const slugTaken = await this.prisma.withoutTenant((c) =>
      c.tenant.findUnique({ where: { slug: baseSlug } }),
    );
    const finalSlug = slugTaken
      ? `${baseSlug}-${randomBytes(3).toString('hex')}`
      : baseSlug;

    const tenant = await this.prisma.withoutTenant((c) =>
      c.tenant.create({
        data: { name: profile.name || email.split('@')[0]!, slug: finalSlug },
      }),
    );

    const user = await this.prisma.withTenant(tenant.id, (tx) =>
      tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          name: profile.name,
          passwordHash: null, // OAuth-only — no password
          role: 'owner',
          emailVerified: true, // trusted provider
          [providerField]: profile.providerId,
        } as never,
      }),
    );

    this.logger.log(`OAuth signup: ${profile.provider}/${user.email}`);
    return this.issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
    });
  }

  // Used by OAuth callback controllers
  async issueSessionForUser(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
    tenant: { name: string; slug: string };
  }): Promise<AuthResult> {
    return this.issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      tenantSlug: user.tenant.slug,
    });
  }

  // ─── PASSWORD RESET ────────────────────────────────────────────────
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    // ⚠️ v2.2 — passwordReset.reset now returns locale so confirmation email
    //           can be sent in the user's preferred language.
    const { email, name, locale } = await this.passwordReset.reset(
      token,
      passwordHash,
    );
    this.email.sendPasswordChanged(email, name, locale).catch(() => undefined);
  }

  // ─── REFRESH / LOGOUT ──────────────────────────────────────────────
  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.withoutTenant((c) =>
      c.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: { include: { tenant: true } } },
      }),
    );

    if (!stored) throw new UnauthorizedException('Invalid refresh token');
    if (stored.revokedAt)
      throw new UnauthorizedException('Refresh token has been revoked');
    if (stored.expiresAt < new Date())
      throw new UnauthorizedException('Refresh token has expired');

    await this.prisma.withTenant(stored.tenantId, (tx) =>
      tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
    );

    return this.issueTokens({
      id: stored.user.id,
      email: stored.user.email,
      name: stored.user.name,
      role: stored.user.role,
      tenantId: stored.user.tenantId,
      tenantName: stored.user.tenant.name,
      tenantSlug: stored.user.tenant.slug,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.withoutTenant((c) =>
      c.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
  }

  // ─── INTERNAL HELPERS ──────────────────────────────────────────────
  private async issueOAuthSession(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
    tenant: { name: string; slug: string };
  }): Promise<AuthResult> {
    await this.prisma.withTenant(user.tenantId, (tx) =>
      tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    );
    return this.issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      tenantSlug: user.tenant.slug,
    });
  }

  private async issueTokens(user: AuthResultUser): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: (this.config.get<string>('JWT_EXPIRES_IN') ?? '15m') as never,
      },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(refreshToken);
    const refreshExpiresIn =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const expiresAt = this.calculateExpiry(refreshExpiresIn);

    await this.prisma.withTenant(user.tenantId, (tx) =>
      tx.refreshToken.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          tokenHash,
          expiresAt,
        },
      }),
    );

    return { accessToken, refreshToken, user };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private calculateExpiry(duration: string): Date {
    const m = duration.match(/^(\d+)([smhd])$/);
    if (!m) throw new Error(`Invalid duration format: ${duration}`);
    const v = parseInt(m[1]!, 10);
    const msPerUnit: Record<string, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return new Date(Date.now() + v * msPerUnit[m[2]!]!);
  }

  private slugify(text: string): string {
    const slug = text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return slug || `tenant-${randomBytes(4).toString('hex')}`;
  }
}