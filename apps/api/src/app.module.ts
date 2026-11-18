import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { MongoModule } from './modules/mongo/mongo.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { DestinationsModule } from './modules/destinations/destinations.module';
import { EventsModule } from './modules/events/events.module';
import { DlqModule } from './modules/dlq/dlq.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { JwtOrApiKeyGuard } from './common/guards/jwt-or-api-key.guard';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { QuotaModule } from './modules/quota/quota.module';
import { BillingModule } from './modules/billing/billing.module';
import { WorkflowTestModule } from './modules/workflows/testing/workflow-test.module';
import { RedisModule } from './modules/redis/redis.module';
import { AiModule } from './modules/ai/ai.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { PresenceModule } from './modules/presence/presence.module';
import { AdminModule } from './modules/admin/admin.module';
import { CommunityModule } from './modules/community/community.module';
import { CronModule } from './modules/cron/cron.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { FeatureFlagModule } from './common/feature-flags/feature-flag.module';
import { PlaygroundModule } from './modules/playground/playground.module';
import { TunnelModule } from './modules/tunnel/tunnel.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    MongoModule,
    HealthModule,
    AuthModule,
    TenantsModule,
    WorkflowsModule,
    DestinationsModule,
    EventsModule,
    DlqModule,
    AnalyticsModule,
    ApiKeysModule,
    SchedulesModule,
    QuotaModule,
    BillingModule,
    WorkflowTestModule,
    AiModule,
    TrackingModule,
    PresenceModule,
    AdminModule,
    CommunityModule,
    CronModule,
    WebhooksModule,
    FeatureFlagModule,
    PlaygroundModule,
    TunnelModule,
    IntegrationsModule,
    RedisModule,
  ],
  providers: [JwtOrApiKeyGuard],
  exports: [JwtOrApiKeyGuard],
})
export class AppModule {}