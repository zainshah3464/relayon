import { Router } from 'express';
import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const [db, cache] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.ping(),
  ]);

  const dbUp = db.status === 'fulfilled';
  const redisUp = cache.status === 'fulfilled';

  res.status(dbUp && redisUp ? 200 : 503).json({
    status: dbUp && redisUp ? 'ok' : 'degraded',
    checks: {
      db: dbUp ? 'up' : 'down',
      redis: redisUp ? 'up' : 'down',
    },
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});