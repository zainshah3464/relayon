import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkflowTestService } from './workflow-test.service';
import { WorkflowsService } from '../workflows.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RunWorkflowTestDto } from './dto/run-test.dto';

@Controller('workflows/:id/test-run')
@UseGuards(JwtAuthGuard)
export class WorkflowTestController {
  constructor(
    private readonly tests: WorkflowTestService,
    private readonly workflows: WorkflowsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async run(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RunWorkflowTestDto,
  ) {
    const pipeline = await this.workflows.testRun(
      user.tenantId,
      id,
      dto.payload ?? {},
      false,
    );

    const assertions = await this.tests.runAssertions({
      transformedPayload: pipeline.transform.result,
      steps: dto.steps,
    });

    return {
      pipeline,
      assertions,
      allPassed: assertions.failed === 0,
    };
  }
}