import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TunnelService } from './tunnel.service';
import { RedisService } from '../redis/redis.service';
import { JwtOrApiKeyGuard } from '../../common/guards/jwt-or-api-key.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

class CreateTunnelDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  targetPort!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;
}

@Controller('tunnel')
@UseGuards(JwtOrApiKeyGuard)
export class TunnelController {
  constructor(
    private readonly tunnel: TunnelService,
    private readonly redis: RedisService,
  ) {}

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateTunnelDto) {
    return this.tunnel.createOrReuse(
      user.tenantId,
      dto.targetPort,
      dto.label ?? null,
    );
  }

  @Get('sessions/:sessionId/webhooks')
  list(
    @CurrentUser() user: JwtUser,
    @Param('sessionId') sessionId: string,
    @Query('limit') limit?: string,
  ) {
    return this.tunnel.listCaptured(
      user.tenantId,
      sessionId,
      Math.min(Number(limit) || 100, 200),
    );
  }

  @Get('sessions/:sessionId/stream')
  stream(
    @CurrentUser() user: JwtUser,
    @Param('sessionId') sessionId: string,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      void this.tunnel.touch(user.tenantId, sessionId);

      const sub = this.redis.raw.duplicate();
      const channel = `tunnel:stream:${sessionId}`;

      sub.subscribe(channel).catch((err) => subscriber.error(err));

      sub.on('message', (_ch: string, msg: string) => {
        try {
          subscriber.next({ data: JSON.parse(msg) as object });
        } catch {
          /* ignore */
        }
      });

      const ping = setInterval(() => {
        void this.tunnel.touch(user.tenantId, sessionId);
        subscriber.next({ type: 'ping', data: { ts: Date.now() } });
      }, 15_000);

      return () => {
        clearInterval(ping);
        sub.quit().catch(() => undefined);
      };
    });
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: JwtUser,
    @Param('sessionId') sessionId: string,
  ) {
    await this.tunnel.delete(user.tenantId, sessionId);
    return { deleted: true };
  }
}