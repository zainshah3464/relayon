import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

@Controller('schedules')
@UseGuards(JwtAuthGuard)
export class SchedulesBulkController {
  constructor(private readonly schedules: SchedulesService) {}

  @Post('bulk/pause-all')
  @HttpCode(HttpStatus.OK)
  pauseAll(@CurrentUser() user: JwtUser) {
    return this.schedules.bulkSetActive(user.tenantId, false);
  }

  @Post('bulk/resume-all')
  @HttpCode(HttpStatus.OK)
  resumeAll(@CurrentUser() user: JwtUser) {
    return this.schedules.bulkSetActive(user.tenantId, true);
  }

  @Post('bulk/delete')
  @HttpCode(HttpStatus.OK)
  bulkDelete(@CurrentUser() user: JwtUser) {
    return this.schedules.bulkDelete(user.tenantId);
  }
}