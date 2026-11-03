import { Module } from '@nestjs/common';
import { WorkflowTestController } from './workflow-test.controller';
import { WorkflowTestService } from './workflow-test.service';
import { WorkflowsModule } from '../workflows.module';

@Module({
  imports: [WorkflowsModule],
  controllers: [WorkflowTestController],
  providers: [WorkflowTestService],
  exports: [WorkflowTestService],
})
export class WorkflowTestModule {}