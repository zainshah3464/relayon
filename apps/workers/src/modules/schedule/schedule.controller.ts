import {
  Body,
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

  @Post('run-now')
  @HttpCode(HttpStatus.OK)
  runNow(@Body() body: { workflowId?: string }) {
    if (!body?.workflowId) {
      throw new Error('workflowId is required');
    }
    return this.schedule.runNow(body.workflowId);
  }

  @Get('status')
  status() {
    return this.schedule.status();
  }
}