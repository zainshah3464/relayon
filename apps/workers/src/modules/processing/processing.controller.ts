import {
  BadRequestException,
  Body,
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

  @Post('process/test')
  @HttpCode(HttpStatus.OK)
  async test(
    @Body()
    body: {
      tenantId?: string;
      workflowId?: string;
      payload?: unknown;
      dryRunDestinations?: boolean;
    },
  ) {
    if (!body.tenantId || !body.workflowId) {
      throw new BadRequestException('tenantId and workflowId are required');
    }
    return this.processing.testRun({
      tenantId: body.tenantId,
      workflowId: body.workflowId,
      payload: body.payload ?? {},
      dryRunDestinations: body.dryRunDestinations === true,
    });
  }
}