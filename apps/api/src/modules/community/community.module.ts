import { Module } from '@nestjs/common';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { TemplatesService } from './templates.service';
import { AnnouncementsController } from './announcements.controller';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [WorkflowsModule],
  controllers: [CommunityController, AnnouncementsController],
  providers: [CommunityService, TemplatesService],
  exports: [CommunityService],
})
export class CommunityModule {}