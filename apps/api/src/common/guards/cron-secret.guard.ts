import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * Guards cron endpoints via `X-Cron-Secret` header.
 *
 * Fails CLOSED — if CRON_SECRET env is not set, ALL requests denied.
 * Uses timing-safe comparison to prevent timing attacks.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-cron-secret'];
    const expected = process.env['CRON_SECRET'];

    if (!expected || expected.length < 16) {
      // Fail safe: never allow if secret not configured
      throw new UnauthorizedException(
        'Cron endpoint not configured (CRON_SECRET missing or too short)',
      );
    }

    if (typeof provided !== 'string' || provided.length === 0) {
      throw new UnauthorizedException('Missing X-Cron-Secret header');
    }

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);

    if (a.length !== b.length) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    if (!timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    return true;
  }
}