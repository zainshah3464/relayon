import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('me')
  getMine(@CurrentUser() user: JwtUser) {
    return this.tenants.getMine(user.tenantId);
  }

  @Patch('me')
  updateMine(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenants.updateMine(user.tenantId, dto);
  }

  @Get('users')
  listUsers(@CurrentUser() user: JwtUser) {
    return this.tenants.listUsers(user.tenantId);
  }
}