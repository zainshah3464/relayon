import { redis } from './redis';

const LUA_SLIDING_WINDOW = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])

  redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

  local count = redis.call('ZCARD', key)

  if count < limit then
    redis.call('ZADD', key, now, ARGV[4])
    redis.call('EXPIRE', key, math.ceil(window / 1000) + 1)
    return {1, count + 1, limit - count - 1}
  else
    return {0, count, 0}
  end
`;

/**
 * True sliding-window rate limit via Redis ZSET + Lua.
 *
 * Fixes the fixed-window boundary exploit: at 59.9s send 300, at 60.1s send
 * 300 more → fixed window allows all 600; sliding window rejects the excess.
 *
 * Cost: 1 Redis command (same as INCR). Upstash usage unchanged.
 */
export async function trySlidingWindow(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; current: number; remaining: number }> {
  const now = Date.now();
  const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;

  const result = (await redis.eval(
    LUA_SLIDING_WINDOW,
    1,
    `sw:${key}`,
    String(now),
    String(windowMs),
    String(limit),
    member,
  )) as [number, number, number];

  return {
    allowed: result[0] === 1,
    current: result[1],
    remaining: result[2],
  };
}