import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PresenceService } from './presence.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

class HeartbeatDto {
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  sessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  path?: string;
}

@Controller('presence')
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Post('heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  async heartbeat(
    @CurrentUser() user: JwtUser,
    @Body() dto: HeartbeatDto,
  ): Promise<void> {
    await this.presence.heartbeat({
      sessionId: dto.sessionId,
      tenantId: user.tenantId,
      userId: user.sub,
      path: dto.path ?? '/',
    });
  }
}