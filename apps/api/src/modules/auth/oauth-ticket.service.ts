import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { randomUUID } from 'node:crypto';

const TICKET_TTL = 60;
const PREFIX = 'oauth:ticket:';
interface TicketPayload { sub: string; jti: string; returnTo: string; }

@Injectable()
export class OAuthTicketService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async issue(userId: string, returnTo: string): Promise<string> {
    const jti = randomUUID();
    await this.redis.raw.set(`${PREFIX}${jti}`, '1', 'EX', TICKET_TTL);
    return this.jwt.signAsync(
      { sub: userId, jti, returnTo },
      { secret: this.config.getOrThrow<string>('JWT_SECRET'), expiresIn: `${TICKET_TTL}s` },
    );
  }

  async consume(ticket: string): Promise<{ userId: string; returnTo: string }> {
    let payload: TicketPayload;
    try {
      payload = await this.jwt.verifyAsync<TicketPayload>(ticket, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
    } catch { throw new Error('Invalid or expired OAuth ticket'); }

    const consumed = await this.redis.raw.del(`${PREFIX}${payload.jti}`);
    if (consumed !== 1) throw new Error('OAuth ticket already used');

    return { userId: payload.sub, returnTo: payload.returnTo };
  }
}