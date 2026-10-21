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

@Controller()
@UseGuards(JwtAuthGuard)
export class DestinationsController {
  constructor(private readonly destinations: DestinationsService) {}

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