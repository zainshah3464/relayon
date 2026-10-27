import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DestinationsService } from './destinations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  CreateDestinationDto,
  UpdateDestinationDto,
} from './dto/destination.dto';
import { ValidateDestinationDto } from './dto/validate-destination.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class DestinationsController {
  constructor(private readonly destinations: DestinationsService) {}

  @Get('destinations/adapters')
  async listAdapters() {
    const workersUrl = process.env['WORKERS_URL'];
    const cronSecret = process.env['CRON_SECRET'];
    if (!workersUrl || !cronSecret) {
      return { adapters: [], warning: 'WORKERS_URL not configured' };
    }

    try {
      const res = await fetch(`${workersUrl}/internal/adapters`, {
        headers: { 'X-Cron-Secret': cronSecret },
      });
      if (!res.ok) {
        return { adapters: [], warning: `Workers returned ${res.status}` };
      }
      const body = (await res.json()) as { adapters?: unknown[] };
      return body;
    } catch (err) {
      return {
        adapters: [],
        warning: err instanceof Error ? err.message : String(err),
      };
    }
  }

  @Get('workflows/:workflowId/destinations')
  list(
    @CurrentUser() user: JwtUser,
    @Param('workflowId') workflowId: string,
  ) {
    return this.destinations.list(user.tenantId, workflowId);
  }

  @Post('workflows/:workflowId/destinations')
  create(
    @CurrentUser() user: JwtUser,
    @Param('workflowId') workflowId: string,
    @Body() dto: CreateDestinationDto,
  ) {
    return this.destinations.create(user.tenantId, workflowId, dto);
  }

  @Post('destinations/validate')
  @HttpCode(HttpStatus.OK)
  validate(
    @CurrentUser() user: JwtUser,
    @Body() dto: ValidateDestinationDto,
  ) {
    return this.destinations.validate(user.tenantId, dto);
  }

  @Patch('destinations/:id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateDestinationDto,
  ) {
    return this.destinations.update(user.tenantId, id, dto);
  }

  @Delete('destinations/:id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.destinations.remove(user.tenantId, id);
  }
}