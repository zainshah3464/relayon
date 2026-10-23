import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsString, ArrayMaxSize, ArrayMinSize } from 'class-validator';
import { DlqService } from './dlq.service';
import { JwtOrApiKeyGuard } from '../../common/guards/jwt-or-api-key.guard';
import { RequireScopes } from '../../common/guards/api-key.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

class BulkReplayDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids!: string[];
}

@Controller('dlq')
@UseGuards(JwtOrApiKeyGuard)
export class DlqController {
  constructor(private readonly dlq: DlqService) {}

  @Get()
  @RequireScopes('dlq:read')
  list(
    @CurrentUser() user: JwtUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.dlq.list(user.tenantId, {
      limit: limit ? parseInt(limit, 10) : 25,
      cursor,
    });
  }

  @Post('bulk-replay')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('dlq:write')
  bulkReplay(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkReplayDto,
  ) {
    return this.dlq.bulkReplay(user.tenantId, dto.ids);
  }

  @Post('bulk-discard')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('dlq:write')
  bulkDiscard(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkReplayDto,
  ) {
    return this.dlq.bulkDiscard(user.tenantId, dto.ids);
  }

  @Post(':id/replay')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('dlq:write')
  replay(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.dlq.replay(user.tenantId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('dlq:write')
  discard(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.dlq.discard(user.tenantId, id);
  }
}