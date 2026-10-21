import type { RequestHandler } from 'express';
import { redis } from '../lib/redis';
import { RateLimitError } from '../lib/errors';

const LIMIT_PER_MINUTE = 300;
const WINDOW_SECONDS = 60;

export const enforceRateLimit: RequestHandler = async (req, _res, next) => {
  const workflow = req.workflow;
  if (!workflow) {
    throw new Error('resolveWorkflow must run before enforceRateLimit');
  }

  const windowBucket = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const key = `ratelimit:${workflow.id}:${windowBucket}`;

  // INCR is atomic. The first caller in the window gets 1, and we
  // set the TTL. Subsequent INCRs just increment. Total: 1-2 Redis
  // commands per request.
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS + 60);
  }

  if (count > LIMIT_PER_MINUTE) {
    throw new RateLimitError(
      `Rate limit exceeded (${LIMIT_PER_MINUTE} req/min per workflow)`,
    );
  }

  next();
};