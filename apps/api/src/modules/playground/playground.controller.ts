import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  Post,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PlaygroundService } from './playground.service';
import { RedisService } from '../redis/redis.service';

@Controller('playground')
export class PlaygroundController {
  constructor(
    private readonly svc: PlaygroundService,
    private readonly redis: RedisService,
  ) {}

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  create() {
    return this.svc.createSession();
  }

  @Get('sessions/:id/requests')
  list(@Param('id') id: string) {
    return this.svc.list(id);
  }

  @Post('sessions/:id/clear')
  @HttpCode(HttpStatus.OK)
  async clear(@Param('id') id: string) {
    await this.svc.clear(id);
    return { cleared: true };
  }

  @Sse('sessions/:id/stream')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const sub = this.redis.raw.duplicate();
      const channel = `playground:stream:${id}`;

      sub.subscribe(channel).catch((err) => subscriber.error(err));

      sub.on('message', (_ch: string, msg: string) => {
        try {
          subscriber.next({ data: JSON.parse(msg) as object });
        } catch {
          /* ignore */
        }
      });

      const heartbeat = setInterval(() => {
        subscriber.next({ type: 'ping', data: { ts: Date.now() } });
      }, 15_000);

      return () => {
        clearInterval(heartbeat);
        sub.quit().catch(() => undefined);
      };
    });
  }
}