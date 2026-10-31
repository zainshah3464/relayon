import { Controller, Get, UseGuards } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

@Controller('quota')
@UseGuards(JwtAuthGuard)
export class QuotaController {
  constructor(private readonly quota: QuotaService) {}

  @Get()
  snapshot(@CurrentUser() user: JwtUser) {
    return this.quota.snapshot(user.tenantId);
  }
}