import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MongoService } from '../mongo/mongo.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mongo: MongoService,
  ) {}

  @Get()
  async check() {
    const [db, redis, mongo] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.raw.ping(),
      this.mongo.eventModel.findOne().lean().exec(),
    ]);

    const dbUp = db.status === 'fulfilled';
    const redisUp = redis.status === 'fulfilled';
    const mongoUp = mongo.status === 'fulfilled';
    const ok = dbUp && redisUp && mongoUp;

    return {
      status: ok ? 'ok' : 'degraded',
      checks: {
        postgres: dbUp ? 'up' : 'down',
        redis: redisUp ? 'up' : 'down',
        mongo: mongoUp ? 'up' : 'down',
      },
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}