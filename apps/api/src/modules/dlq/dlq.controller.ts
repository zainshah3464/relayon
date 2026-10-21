import {
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
import { DlqService } from './dlq.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

@Controller('dlq')
@UseGuards(JwtAuthGuard)
export class DlqController {
  constructor(private readonly dlq: DlqService) {}

  @Get()
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

  @Post(':id/replay')
  @HttpCode(HttpStatus.OK)
  replay(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.dlq.replay(user.tenantId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  discard(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.dlq.discard(user.tenantId, id);
  }
}