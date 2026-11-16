import { Controller, Get, UseGuards } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../decorators/current-user.decorator';

@Controller('feature-flags')
@UseGuards(JwtAuthGuard)
export class FeatureFlagController {
  constructor(private readonly flags: FeatureFlagService) {}

  @Get('me')
  mine(@CurrentUser() user: JwtUser) {
    return this.flags.allFor(user.tenantId);
  }
}