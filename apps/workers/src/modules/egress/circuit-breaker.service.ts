import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const KEY_PREFIX = 'circuit:dest';
const FAILURE_THRESHOLD = 5;
const OPEN_DURATION_SEC = 300;

/**
 * Per-destination circuit breaker backed by Redis.
 *
 * - INCR on every retryable failure. First failure sets a 5-minute TTL.
 * - After FAILURE_THRESHOLD failures within that window, circuit is "open"
 *   → new deliveries skip the attempt and wait.
 * - Success DELs the counter, closing the circuit.
 */
@Injectable()
export class CircuitBreakerService {
  constructor(private readonly redis: RedisService) {}

  async isOpen(destinationId: string): Promise<boolean> {
    const raw = await this.redis.raw.get(`${KEY_PREFIX}:${destinationId}`);
    if (raw === null) return false;
    const count = parseInt(raw, 10);
    return Number.isFinite(count) && count >= FAILURE_THRESHOLD;
  }

  async recordSuccess(destinationId: string): Promise<void> {
    await this.redis.raw.del(`${KEY_PREFIX}:${destinationId}`);
  }

  async recordFailure(destinationId: string): Promise<number> {
    const key = `${KEY_PREFIX}:${destinationId}`;
    const count = await this.redis.raw.incr(key);
    if (count === 1) {
      await this.redis.raw.expire(key, OPEN_DURATION_SEC);
    }
    return count;
  }
}