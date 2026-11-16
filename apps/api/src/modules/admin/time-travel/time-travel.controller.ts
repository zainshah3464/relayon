import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TimeTravelService } from './time-travel.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../super-admin.guard';

@Controller('admin/time-travel')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class TimeTravelController {
  constructor(private readonly tt: TimeTravelService) {}

  @Get('tenants/:id')
  stateAt(@Param('id') id: string, @Query('at') at: string) {
    if (!at) throw new BadRequestException('?at=<ISO8601> query param required');
    const ts = new Date(at);
    if (isNaN(ts.getTime())) throw new BadRequestException('Invalid timestamp');
    return this.tt.stateAt(id, ts);
  }

  @Get('tenants/:id/diff')
  diff(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) throw new BadRequestException('?from=&to= required');
    const fromTs = new Date(from);
    const toTs = new Date(to);
    if (isNaN(fromTs.getTime()) || isNaN(toTs.getTime())) {
      throw new BadRequestException('Invalid timestamp format');
    }
    return this.tt.diff(id, fromTs, toTs);
  }
}