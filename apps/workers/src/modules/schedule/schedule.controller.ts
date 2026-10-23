import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard';

@Controller('schedule')
@UseGuards(CronSecretGuard)
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Post('tick')
  @HttpCode(HttpStatus.OK)
  tick() {
    return this.schedule.tick();
  }

  @Get('status')
  status() {
    return this.schedule.status();
  }
}