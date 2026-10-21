import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EgressService } from './egress.service';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard';

@Controller()
@UseGuards(CronSecretGuard)
export class EgressController {
  constructor(private readonly egress: EgressService) {}

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
}