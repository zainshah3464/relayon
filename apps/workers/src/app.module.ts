import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { MongoModule } from './modules/mongo/mongo.module';
import { RedisModule } from './modules/redis/redis.module';
import { ProcessingModule } from './modules/processing/processing.module';
import { EgressModule } from './modules/egress/egress.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    MongoModule,
    RedisModule,
    ProcessingModule,
    EgressModule,
    HealthModule,
  ],
})
export class AppModule {}