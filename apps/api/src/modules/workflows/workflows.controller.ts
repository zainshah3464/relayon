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
import { WorkflowsService } from './workflows.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.workflows.list(user.tenantId);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.workflows.get(user.tenantId, id);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateWorkflowDto) {
    return this.workflows.create(user.tenantId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflows.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.workflows.remove(user.tenantId, id);
  }
}