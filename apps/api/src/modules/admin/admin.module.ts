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
import { TimeTravelController } from './time-travel/time-travel.controller';
import { TimeTravelService } from './time-travel/time-travel.service';
import { FeatureFlagsAdminController } from './feature-flags/feature-flags-admin.controller';

@Module({
  imports: [PresenceModule, JwtModule.register({})],
  controllers: [
    AdminController,
    ModerationController,
    SocialController,
    TimeTravelController,
    FeatureFlagsAdminController,
  ],
  providers: [
    AdminService,
    SuperAdminGuard,
    ModerationService,
    SocialService,
    ImpersonationService,
    TimeTravelService,
  ],
  exports: [
    AdminService,
    ModerationService,
    SocialService,
    ImpersonationService,
    TimeTravelService,
  ],
})
export class AdminModule {}