import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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

  @Get(':id/export')
  @Header('Content-Type', 'application/x-yaml')
  async export(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const yaml = await this.workflows.exportYaml(user.tenantId, id);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="workflow-${id.slice(0, 8)}.yaml"`,
    );
    return yaml;
  }

  @Post('import')
  import(
    @CurrentUser() user: JwtUser,
    @Body() body: { yaml: string },
  ) {
    return this.workflows.importYaml(user.tenantId, body.yaml ?? '');
  }
}