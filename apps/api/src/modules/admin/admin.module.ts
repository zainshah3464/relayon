import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from './super-admin.guard';
import { PresenceModule } from '../presence/presence.module';
import { ModerationController } from './moderation/moderation.controller';
import { ModerationService } from './moderation/moderation.service';
import { SocialController } from './social/social.controller';
import { SocialService } from './social/social.service';
import { ImpersonationService } from './impersonation/impersonation.service';

@Module({
  imports: [PresenceModule, JwtModule.register({})],
  controllers: [AdminController, ModerationController, SocialController],
  providers: [
    AdminService,
    SuperAdminGuard,
    ModerationService,
    SocialService,
    ImpersonationService,
  ],
  exports: [
    AdminService,
    ModerationService,
    SocialService,
    ImpersonationService,
  ],
})
export class AdminModule {}