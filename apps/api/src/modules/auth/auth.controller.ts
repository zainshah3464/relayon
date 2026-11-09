import {
  Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { OAuthStateService } from './strategies/oauth-state';
import { OAuthTicketService } from './oauth-ticket.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { OAuthExchangeDto } from './dto/oauth-exchange.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { OAuthProfile } from './strategies/google.strategy';
import { buildGoogleAuthUrl, buildGitHubAuthUrl } from './strategies/oauth-url-builder';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly state: OAuthStateService,
    private readonly tickets: OAuthTicketService,
    private readonly verification: EmailVerificationService,
    private readonly passwordReset: PasswordResetService,
    private readonly config: ConfigService,
  ) {}

  // ── Local auth ─────────────────────────────────────────────
  @Post('signup') signup(@Body() dto: SignupDto) { return this.auth.signup(dto); }

  @Post('login') @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) { return this.auth.login(dto); }

  @Post('refresh') @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }

  @Post('logout') @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto): Promise<void> { await this.auth.logout(dto.refreshToken); }

  @Get('me') @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtUser) {
    const dbUser = await this.prisma.withoutTenant((c) =>
      c.user.findUnique({ where: { id: user.sub }, include: { tenant: true } }),
    );
    if (!dbUser) return null;
    return {
      id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role,
      tenantId: dbUser.tenantId, tenantName: dbUser.tenant.name, tenantSlug: dbUser.tenant.slug,
      emailVerified: dbUser.emailVerified,
      hasPassword: dbUser.passwordHash !== null,
      provider: dbUser.googleId ? 'google' : dbUser.githubId ? 'github' : 'local',
    };
  }

  // ── Google OAuth ──────────────────────────────────────────
  @Get('google')
  async googleStart(@Query('returnTo') returnTo: string, @Res() res: Response) {
    const stateJwt = await this.state.generate('google', returnTo ?? '/dashboard');
    res.redirect(buildGoogleAuthUrl(stateJwt, this.config));
  }

  @Get('google/callback') @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Query('state') stateJwt: string, @Res() res: Response) {
    const returnTo = await this.state.verify(stateJwt, 'google');
    const profile = req.user as OAuthProfile;
    const session = await this.auth.loginWithOAuth(profile);
    const ticket = await this.tickets.issue(session.user.id, returnTo);
    const appUrl = this.config.get<string>('APP_ORIGIN') ?? 'http://localhost:4200';
    res.redirect(`${appUrl}/auth/oauth-callback?ticket=${ticket}`);
  }

  // ── GitHub OAuth ──────────────────────────────────────────
  @Get('github')
  async githubStart(@Query('returnTo') returnTo: string, @Res() res: Response) {
    const stateJwt = await this.state.generate('github', returnTo ?? '/dashboard');
    res.redirect(buildGitHubAuthUrl(stateJwt, this.config));
  }

  @Get('github/callback') @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: Request, @Query('state') stateJwt: string, @Res() res: Response) {
    const returnTo = await this.state.verify(stateJwt, 'github');
    const profile = req.user as OAuthProfile;
    const session = await this.auth.loginWithOAuth(profile);
    const ticket = await this.tickets.issue(session.user.id, returnTo);
    const appUrl = this.config.get<string>('APP_ORIGIN') ?? 'http://localhost:4200';
    res.redirect(`${appUrl}/auth/oauth-callback?ticket=${ticket}`);
  }

  @Post('oauth-exchange') @HttpCode(HttpStatus.OK)
  async oauthExchange(@Body() dto: OAuthExchangeDto) {
    const { userId, returnTo } = await this.tickets.consume(dto.ticket);
    const dbUser = await this.prisma.withoutTenant((c) =>
      c.user.findUnique({ where: { id: userId }, include: { tenant: true } }),
    );
    if (!dbUser) throw new Error('User not found');
    return { ...(await this.auth.issueSessionForUser(dbUser)), returnTo };
  }

  // ── Email verification ────────────────────────────────────
  @Post('verify-email') @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const { userId, tenantId } = await this.verification.verify(dto.token);
    return { verified: true, userId, tenantId };
  }

  @Post('resend-verification') @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.withoutTenant((c) => c.user.findUnique({ where: { email } }));
    if (user && !user.emailVerified) {
      await this.verification.sendVerification(user.id, user.tenantId).catch(() => undefined);
    }
    return { message: 'If this email exists and is unverified, a new link has been sent.' };
  }

  // ── Password reset ────────────────────────────────────────
  @Post('forgot-password') @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.passwordReset.requestReset(dto.email).catch(() => undefined);
    return { message: 'If this email exists, a reset link has been sent.' };
  }

  @Post('reset-password') @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { reset: true };
  }
}