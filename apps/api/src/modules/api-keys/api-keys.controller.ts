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
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.keys.list(user.tenantId);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateApiKeyDto) {
    return this.keys.create(user.tenantId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  revoke(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.keys.revoke(user.tenantId, id);
  }
}