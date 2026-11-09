import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { randomUUID } from 'node:crypto';

const STATE_TTL_SECONDS = 300;
const NONCE_PREFIX = 'oauth:state:';

interface StatePayload { nonce: string; returnTo: string; provider: 'google' | 'github'; }

@Injectable()
export class OAuthStateService {
  private readonly logger = new Logger(OAuthStateService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async generate(provider: 'google' | 'github', returnTo: string): Promise<string> {
    const safeReturnTo = this.sanitizeReturnTo(returnTo);
    const nonce = randomUUID();
    await this.redis.raw.set(`${NONCE_PREFIX}${nonce}`, '1', 'EX', STATE_TTL_SECONDS);
    return this.jwt.signAsync(
      { nonce, returnTo: safeReturnTo, provider },
      { secret: this.config.getOrThrow<string>('JWT_SECRET'), expiresIn: `${STATE_TTL_SECONDS}s` },
    );
  }

  async verify(stateJwt: string, expectedProvider: 'google' | 'github'): Promise<string> {
    let payload: StatePayload;
    try {
      payload = await this.jwt.verifyAsync<StatePayload>(stateJwt, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
    } catch { throw new Error('Invalid OAuth state'); }

    if (payload.provider !== expectedProvider) throw new Error('OAuth state provider mismatch');

    const consumed = await this.redis.raw.del(`${NONCE_PREFIX}${payload.nonce}`);
    if (consumed !== 1) throw new Error('OAuth state already used or expired');

    return this.sanitizeReturnTo(payload.returnTo);
  }

  private sanitizeReturnTo(returnTo: string | undefined): string {
    if (!returnTo) return '/dashboard';
    if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return '/dashboard';
    return returnTo;
  }
}