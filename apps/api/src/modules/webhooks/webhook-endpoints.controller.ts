import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { WebhookEndpointsService } from './webhook-endpoints.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

class CreateEndpointDto {
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventTypes?: string[];
}

@Controller('webhook-endpoints')
@UseGuards(JwtAuthGuard)
export class WebhookEndpointsController {
  constructor(private readonly svc: WebhookEndpointsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.svc.list(user.tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateEndpointDto) {
    return this.svc.create(user.tenantId, dto);
  }

  @Post(':id/toggle')
  @HttpCode(HttpStatus.OK)
  toggle(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.toggle(user.tenantId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.remove(user.tenantId, id);
  }
}