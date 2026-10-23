import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service';

export const REQUIRED_SCOPES = 'relayon:required_scopes';
export const RequireScopes = (...scopes: string[]) =>
  Reflect.metadata(REQUIRED_SCOPES, scopes);

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly keys: ApiKeysService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();

    const header = req.headers['x-api-key'];
    const rawKey = typeof header === 'string' ? header : null;
    if (!rawKey) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    const verified = await this.keys.verify(rawKey);
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
}