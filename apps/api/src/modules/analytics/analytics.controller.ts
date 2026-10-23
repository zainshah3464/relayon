import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtOrApiKeyGuard } from '../../common/guards/jwt-or-api-key.guard';
import { RequireScopes } from '../../common/guards/api-key.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

@Controller('analytics')
@UseGuards(JwtOrApiKeyGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @RequireScopes('analytics:read')
  overview(@CurrentUser() user: JwtUser) {
    return this.analytics.overview(user.tenantId);
  }

  @Get('delivery')
  @RequireScopes('analytics:read')
  delivery(@CurrentUser() user: JwtUser) {
    return this.analytics.delivery(user.tenantId);
  }

  @Get('cost')
  @RequireScopes('analytics:read')
  cost(@CurrentUser() user: JwtUser) {
    return this.analytics.cost(user.tenantId);
  }

  @Get('timeseries')
  @RequireScopes('analytics:read')
  timeSeries(
    @CurrentUser() user: JwtUser,
    @Query('range') range?: string,
  ) {
    const valid: Array<'24h' | '7d' | '30d'> = ['24h', '7d', '30d'];
    const r = valid.includes(range as never) ? (range as '24h' | '7d' | '30d') : '24h';
    return this.analytics.timeSeries(user.tenantId, r);
  }
}