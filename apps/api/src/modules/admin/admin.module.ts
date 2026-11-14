import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from './super-admin.guard';
import { PresenceModule } from '../presence/presence.module';
import { ModerationController } from './moderation/moderation.controller';
import { ModerationService } from './moderation/moderation.service';
import { SocialController } from './social/social.controller';
import { SocialService } from './social/social.service';

@Module({
  imports: [PresenceModule],
  controllers: [AdminController, ModerationController, SocialController],
  providers: [AdminService, SuperAdminGuard, ModerationService, SocialService],
  exports: [AdminService, ModerationService, SocialService],
})
export class AdminModule {}