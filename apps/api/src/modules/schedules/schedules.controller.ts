import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { JwtOrApiKeyGuard } from '../../common/guards/jwt-or-api-key.guard';
import { RequireScopes } from '../../common/guards/api-key.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { UpsertScheduleDto } from './dto/upsert-schedule.dto';

@Controller('workflows/:workflowId/schedule')
@UseGuards(JwtOrApiKeyGuard)
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  @RequireScopes('workflows:read')
  get(@CurrentUser() user: JwtUser, @Param('workflowId') workflowId: string) {
    return this.schedules.get(user.tenantId, workflowId);
  }

  @Put()
  @RequireScopes('workflows:write')
  upsert(
    @CurrentUser() user: JwtUser,
    @Param('workflowId') workflowId: string,
    @Body() dto: UpsertScheduleDto,
  ) {
    return this.schedules.upsert(user.tenantId, workflowId, dto);
  }

  @Delete()
  @RequireScopes('workflows:write')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() user: JwtUser, @Param('workflowId') workflowId: string) {
    return this.schedules.remove(user.tenantId, workflowId);
  }
}