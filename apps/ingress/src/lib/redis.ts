import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

export const redis = new Redis(config.UPSTASH_REDIS_TCP_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy: (times) => Math.min(times * 200, 2000),
});

redis.on('connect', () => logger.info('redis.connected'));
redis.on('error', (err) =>
  logger.error('redis.error', { message: err.message }),
);

export async function closeRedis(): Promise<void> {
  await redis.quit();
}