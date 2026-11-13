import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { AdminListDto } from './dto/admin-query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('tenants')
  listTenants(@Query() q: AdminListDto) {
    return this.admin.listTenants(q);
  }

  @Get('tenants/:id')
  tenantDetail(@Param('id') id: string) {
    return this.admin.tenantDetail(id);
  }

  @Get('users')
  listUsers(@Query() q: AdminListDto) {
    return this.admin.listUsers(q);
  }

  @Get('analytics/traffic')
  traffic(@Query('days') days?: string) {
    const d = Math.min(Math.max(Number(days) || 7, 1), 90);
    return this.admin.trafficOverview(d);
  }

  @Get('live')
  live(@Query('limit') limit?: string) {
    return this.admin.liveSessions(Math.min(Number(limit) || 50, 200));
  }

  @Get('health')
  health() {
    return this.admin.health();
  }

  @Get('audit')
  audit(@Query('limit') limit?: string) {
    return this.admin.listAudit(Number(limit) || 100);
  }
}