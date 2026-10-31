import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { WorkflowsService } from './workflows.service';
import { WorkflowVersionsService } from './workflow-versions.service';
import { JwtOrApiKeyGuard } from '../../common/guards/jwt-or-api-key.guard';
import { RequireScopes } from '../../common/guards/api-key.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { TestRunDto } from './dto/test-run.dto';
import { ImportWorkflowDto } from './dto/import-mode.dto';

@Controller('workflows')
@UseGuards(JwtOrApiKeyGuard)
export class WorkflowsController {
  constructor(
    private readonly workflows: WorkflowsService,
    private readonly versions: WorkflowVersionsService,
  ) {}

  @Get()
  @RequireScopes('workflows:read')
  list(@CurrentUser() user: JwtUser) {
    return this.workflows.list(user.tenantId);
  }

  @Get('export-all')
  @RequireScopes('workflows:read')
  async exportAll(@CurrentUser() user: JwtUser) {
    const workflows = await this.workflows.exportAll(user.tenantId);
    return { workflows };
  }

  @Get(':id')
  @RequireScopes('workflows:read')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.workflows.get(user.tenantId, id);
  }

  @Post()
  @RequireScopes('workflows:write')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateWorkflowDto) {
    return this.workflows.create(user.tenantId, dto, user.sub);
  }

  @Patch(':id')
  @RequireScopes('workflows:write')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflows.update(user.tenantId, id, dto, user.sub);
  }

  @Delete(':id')
  @RequireScopes('workflows:write')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.workflows.remove(user.tenantId, id);
  }

  @Get(':id/export')
  @RequireScopes('workflows:read')
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
  @RequireScopes('workflows:write')
  import(@CurrentUser() user: JwtUser, @Body() dto: ImportWorkflowDto) {
    return this.workflows.importYaml(
      user.tenantId,
      dto.yaml,
      user.sub,
      dto.mode ?? 'create',
    );
  }

  @Post(':id/preview-transform')
  @RequireScopes('workflows:read')
  @HttpCode(HttpStatus.OK)
  async previewTransform(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { expression?: string; samplePayload?: unknown },
  ) {
    await this.workflows.get(user.tenantId, id);
    return this.workflows.previewTransform(
      body.expression ?? '',
      body.samplePayload ?? {},
    );
  }

  @Post(':id/test')
  @RequireScopes('workflows:read')
  @HttpCode(HttpStatus.OK)
  testRun(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: TestRunDto,
  ) {
    return this.workflows.testRun(
      user.tenantId,
      id,
      dto.payload ?? {},
      dto.dryRunDestinations === true,
    );
  }

  // ── Versioning ───────────────────────────────────────────────

  @Get(':id/versions')
  @RequireScopes('workflows:read')
  listVersions(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.versions.list(user.tenantId, id);
  }

  @Get(':id/versions/:version')
  @RequireScopes('workflows:read')
  getVersion(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.versions.get(user.tenantId, id, version);
  }

  @Post(':id/versions/:version/restore')
  @RequireScopes('workflows:write')
  @HttpCode(HttpStatus.OK)
  restoreVersion(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.versions.restore(user.tenantId, id, version, user.sub);
  }

  @Get(':id/versions/:a/diff/:b')
  @RequireScopes('workflows:read')
  diffVersions(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('a', ParseIntPipe) a: number,
    @Param('b', ParseIntPipe) b: number,
  ) {
    return this.versions.diff(user.tenantId, id, a, b);
  }
}