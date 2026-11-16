import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { WorkflowVersionsService } from './workflow-versions.service';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [WebhooksModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowVersionsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}