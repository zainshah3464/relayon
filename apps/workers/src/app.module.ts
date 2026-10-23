import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { MongoModule } from './modules/mongo/mongo.module';
import { RedisModule } from './modules/redis/redis.module';
import { ProcessingModule } from './modules/processing/processing.module';
import { EgressModule } from './modules/egress/egress.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    MongoModule,
    RedisModule,
    ProcessingModule,
    EgressModule,
    ScheduleModule,
    HealthModule,
  ],
})
export class AppModule {}