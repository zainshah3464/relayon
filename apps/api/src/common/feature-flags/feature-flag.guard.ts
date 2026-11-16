import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagService } from './feature-flag.service';
import { FEATURE_FLAG_KEY } from './feature-flag.decorator';
import type { JwtUser } from '../decorators/current-user.decorator';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly flags: FeatureFlagService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string | string[]>(
      FEATURE_FLAG_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required) return true;

    const keys = Array.isArray(required) ? required : [required];
    const req = ctx.switchToHttp().getRequest<{ user?: JwtUser }>();
    const tenantId = req.user?.tenantId ?? null;

    for (const key of keys) {
      if (!this.flags.isEnabled(key, tenantId)) {
        throw new ForbiddenException(`Feature "${key}" is not enabled`);
      }
    }
    return true;
  }
}