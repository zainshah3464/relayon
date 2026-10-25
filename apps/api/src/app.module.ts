import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
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
  ],
  providers: [
    // Globally provide so it's injectable across modules
    JwtOrApiKeyGuard,
  ],
  exports: [JwtOrApiKeyGuard],
})
export class AppModule {}