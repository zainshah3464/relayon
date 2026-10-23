import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtOrApiKeyGuard } from '../../common/guards/jwt-or-api-key.guard';
import { RequireScopes } from '../../common/guards/api-key.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

@Controller('events')
@UseGuards(JwtOrApiKeyGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @RequireScopes('events:read')
  list(
    @CurrentUser() user: JwtUser,
    @Query('workflowId') workflowId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.events.list(user.tenantId, {
      workflowId,
      status,
      limit: limit ? parseInt(limit, 10) : 25,
      cursor,
    });
  }

  @Get(':id')
  @RequireScopes('events:read')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.events.get(user.tenantId, id);
  }
}