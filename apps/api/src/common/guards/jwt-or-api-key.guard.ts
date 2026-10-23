import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service';
import {
  REQUIRED_SCOPES,
} from './api-key.guard';
import type { JwtUser } from '../decorators/current-user.decorator';

/**
 * Accepts EITHER:
 *   - `Authorization: Bearer <jwt>` (dashboard users)
 *   - `X-API-Key: rlk_...` (programmatic access, scoped)
 *
 * Scope enforcement only applies to API keys. JWT users bypass scope checks
 * (they have full tenant access via dashboard).
 */
@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly keys: ApiKeysService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();

    // ── 1. Try API key first
    const apiKeyHeader = req.headers['x-api-key'];
    if (typeof apiKeyHeader === 'string' && apiKeyHeader.length > 0) {
      const verified = await this.keys.verify(apiKeyHeader);
      if (!verified) {
        throw new UnauthorizedException('Invalid, revoked, or expired API key');
      }

      const required =
        this.reflector.getAllAndOverride<string[]>(REQUIRED_SCOPES, [
          ctx.getHandler(),
          ctx.getClass(),
        ]) ?? [];

      if (required.length > 0) {
        const granted = new Set(verified.scopes);
        const missing = required.filter((s) => !granted.has(s));
        if (missing.length > 0) {
          throw new ForbiddenException(
            `Missing scope(s): ${missing.join(', ')}`,
          );
        }
      }

      req.user = {
        sub: verified.apiKeyId,
        tenantId: verified.tenantId,
        scopes: verified.scopes,
      } as never;
      return true;
    }

    // ── 2. Fall back to JWT
    const header = req.headers.authorization;
    if (!header) {
      throw new UnauthorizedException('Missing authentication (JWT or API key)');
    }

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header');
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtUser>(token, {
        secret: process.env['JWT_SECRET'],
      });
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}