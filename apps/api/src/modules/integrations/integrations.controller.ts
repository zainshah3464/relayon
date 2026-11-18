import {
  Body, Controller, Delete, ForbiddenException, Get,
  HttpCode, HttpStatus, Param, Post, UseGuards,
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser, type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { TestIntegrationDto, UpsertIntegrationDto } from './dto/integration.dto';

@Controller('settings/integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly svc: IntegrationsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.svc.list(user.tenantId);
  }

  @Get('status')
  status(@CurrentUser() user: JwtUser) {
    return this.svc.status(user.tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  upsert(@CurrentUser() user: JwtUser, @Body() dto: UpsertIntegrationDto) {
    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new ForbiddenException('Only owners and admins can manage integration keys');
    }
    return this.svc.upsert(user.tenantId, dto, user.sub);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  test(@CurrentUser() user: JwtUser, @Body() dto: TestIntegrationDto) {
    return this.svc.test(user.tenantId, dto.provider, dto.apiKey);
  }

  @Post(':provider/toggle')
  @HttpCode(HttpStatus.OK)
  toggle(@CurrentUser() user: JwtUser, @Param('provider') provider: string) {
    return this.svc.toggle(user.tenantId, provider);
  }

  @Delete(':provider')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() user: JwtUser, @Param('provider') provider: string) {
    return this.svc.remove(user.tenantId, provider);
  }
}