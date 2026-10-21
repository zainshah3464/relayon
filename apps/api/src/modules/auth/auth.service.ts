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
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const baseSlug = this.slugify(dto.tenantName);
    const slugTaken = await this.prisma.tenant.findUnique({
      where: { slug: baseSlug },
    });
    const finalSlug = slugTaken
      ? `${baseSlug}-${randomBytes(3).toString('hex')}`
      : baseSlug;

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.tenantName,
        slug: finalSlug,
        users: {
          create: {
            email,
            name: dto.name,
            passwordHash,
            role: 'owner',
          },
        },
      },
      include: { users: true },
    });

    const user = tenant.users[0];
    this.logger.log(`New tenant signup: ${tenant.slug} (${user.email})`);

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

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

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

  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = this.hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { tenant: true } } },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (stored.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Rotation: revoke old token immediately
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

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
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    user: AuthResultUser,
  ): Promise<AuthResult> {
const accessToken = await this.jwt.signAsync(
  {
    sub: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  },
  {
    secret: this.config.getOrThrow<string>('JWT_SECRET'),
    expiresIn: (this.config.get<string>('JWT_EXPIRES_IN') ?? '15m') as any,
  },
);

    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(refreshToken);
    const refreshExpiresIn =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const expiresAt = this.calculateExpiry(refreshExpiresIn);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, user };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private calculateExpiry(duration: string): Date {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const msPerUnit: Record<string, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return new Date(Date.now() + value * msPerUnit[unit]);
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