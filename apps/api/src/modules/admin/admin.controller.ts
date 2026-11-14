import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminService } from './admin.service';
import { ImpersonationService } from './impersonation/impersonation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { AdminListDto } from './dto/admin-query.dto';
import {
  StartImpersonationDto,
  EndImpersonationDto,
} from './dto/impersonation.dto';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly impersonation: ImpersonationService,
  ) {}

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

  // ⚠️ v2.9 — impersonation
  @Post('impersonate')
  @HttpCode(HttpStatus.OK)
  async startImpersonation(
    @CurrentUser() user: JwtUser,
    @Body() dto: StartImpersonationDto,
    @Req() req: Request,
  ) {
    return this.impersonation.start(
      user.sub,
      dto.tenantId,
      this.clientIp(req),
      req.headers['user-agent'] as string | undefined,
    );
  }

  @Post('impersonate/end')
  @HttpCode(HttpStatus.OK)
  async endImpersonation(
    @CurrentUser() user: JwtUser,
    @Body() dto: EndImpersonationDto,
    @Req() req: Request,
  ) {
    return this.impersonation.end(
      user.sub,
      dto.auditLogId,
      this.clientIp(req),
    );
  }

  @Get('impersonate/active')
  listActiveImpersonations() {
    return this.impersonation.listActive();
  }

  private clientIp(req: Request): string | undefined {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string') return fwd.split(',')[0]!.trim();
    return req.ip;
  }
}