import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(@CurrentUser() user: JwtUser) {
    return this.analytics.overview(user.tenantId);
  }

  @Get('delivery')
  delivery(@CurrentUser() user: JwtUser) {
    return this.analytics.delivery(user.tenantId);
  }

  @Get('cost')
  cost(@CurrentUser() user: JwtUser) {
    return this.analytics.cost(user.tenantId);
  }

  @Get('timeseries')
  timeSeries(
    @CurrentUser() user: JwtUser,
    @Query('range') range?: string,
  ) {
    const valid: Array<'24h' | '7d' | '30d'> = ['24h', '7d', '30d'];
    const r = valid.includes(range as never) ? (range as '24h' | '7d' | '30d') : '24h';
    return this.analytics.timeSeries(user.tenantId, r);
  }
}