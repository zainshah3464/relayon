import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EgressService } from './egress.service';
import { AdapterRegistry } from './adapters/registry';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard';

@Controller()
@UseGuards(CronSecretGuard)
export class EgressController {
  constructor(
    private readonly egress: EgressService,
    private readonly adapters: AdapterRegistry,
  ) {}

  @Post('deliver')
  @HttpCode(HttpStatus.OK)
  async deliver() {
    return this.egress.deliverBatch();
  }

  @Post('replay/:deliveryId')
  @HttpCode(HttpStatus.OK)
  async replay(@Param('deliveryId') deliveryId: string) {
    return this.egress.replayDlq(deliveryId);
  }

  @Get('egress/stats')
  async stats() {
    return this.egress.getStats();
  }

  @Get('adapters')
  adaptersList() {
    return this.adapters.list();
  }

  @Post('egress/dry-run')
  @HttpCode(HttpStatus.OK)
  dryRun(
    @Body()
    body: {
      type?: string;
      config?: Record<string, unknown>;
      tenantId?: string;
    },
  ) {
    return this.egress.dryRun(body);
  }

  @Post('egress/replay-event')
  @HttpCode(HttpStatus.OK)
  replayEvent(
    @Body() body: { tenantId?: string; eventId?: string },
  ) {
    if (!body.tenantId || !body.eventId) {
      throw new BadRequestException('tenantId and eventId are required');
    }
    return this.egress.replayEvent(body.tenantId, body.eventId);
  }
}