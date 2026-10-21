import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProcessingService } from './processing.service';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard';

@Controller()
@UseGuards(CronSecretGuard)
export class ProcessingController {
  constructor(private readonly processing: ProcessingService) {}

  @Post('process')
  @HttpCode(HttpStatus.OK)
  async process() {
    return this.processing.processBatch();
  }

  @Get('status')
  async status() {
    return this.processing.getQueueStatus();
  }
}