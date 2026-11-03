import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { WorkflowVersionsService } from './workflow-versions.service';

@Module({
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowVersionsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}