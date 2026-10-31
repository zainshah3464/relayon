import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateQuotaDto } from './dto/update-quota.dto';

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('me')
  getMine(@CurrentUser() user: JwtUser) {
    return this.tenants.getMine(user.tenantId);
  }

  @Patch('me')
  updateMine(@CurrentUser() user: JwtUser, @Body() dto: UpdateTenantDto) {
    return this.tenants.updateMine(user.tenantId, dto);
  }

  @Patch('me/quota')
  updateQuota(@CurrentUser() user: JwtUser, @Body() dto: UpdateQuotaDto) {
    if (user.role !== 'owner') {
      throw new ForbiddenException('Only the tenant owner can change quota');
    }
    return this.tenants.updateQuota(user.tenantId, dto);
  }

  @Get('users')
  listUsers(@CurrentUser() user: JwtUser) {
    return this.tenants.listUsers(user.tenantId);
  }
}