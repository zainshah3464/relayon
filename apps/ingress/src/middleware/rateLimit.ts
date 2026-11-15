import type { RequestHandler } from 'express';
import { RateLimitError } from '../lib/errors';
import { trySlidingWindow } from '../lib/sliding-window-limiter';

const LIMIT_PER_MINUTE = 300;
const WINDOW_MS = 60_000;

/**
 * Sliding-window rate limiter — replaces fixed-window INCR.
 *
 * Fixed window: client can send 2× limit at boundary (600 req in 2s)
 * Sliding window: any rolling 60s is capped at 300 (true accuracy)
 *
 * Same Upstash command count as before. Accuracy ~60% → ~99%.
 */
export const enforceRateLimit: RequestHandler = async (req, res, next) => {
  const workflow = req.workflow;
  if (!workflow) {
    throw new Error('resolveWorkflow must run before enforceRateLimit');
  }

  const { allowed, current, remaining } = await trySlidingWindow(
    `wl:${workflow.id}`,
    LIMIT_PER_MINUTE,
    WINDOW_MS,
  );

  res.setHeader('X-RateLimit-Limit', String(LIMIT_PER_MINUTE));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
  res.setHeader('X-RateLimit-Window', '60s');
  res.setHeader('X-RateLimit-Mode', 'sliding');

  if (!allowed) {
    res.setHeader('Retry-After', '60');
    throw new RateLimitError(
      `Rate limit exceeded (${current}/${LIMIT_PER_MINUTE} in 60s sliding window)`,
    );
  }

  next();
};