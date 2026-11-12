import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/**
 * ⚠️ v2.3 scaling — Groq rate limiter.
 *
 * Groq free tier: 30 RPM, 6-8K TPM.
 * Without limiter: burst of events → 100% Groq 429 errors.
 * With limiter: 25 RPM cap → graceful skip, events still deliver without enrichment.
 */

const MAX_RPM = 25;              // 5 buffer below 30
const MAX_TPM = 6000;            // 1K buffer below 7K
const WINDOW_SECONDS = 60;

const RATE_LIMIT_LUA = `
  local rpmKey  = KEYS[1] .. ':rpm'
  local tpmKey  = KEYS[1] .. ':tpm'
  local maxRpm  = tonumber(ARGV[1])
  local maxTpm  = tonumber(ARGV[2])
  local tokens  = tonumber(ARGV[3])
  local ttl     = tonumber(ARGV[4])

  local rpm = tonumber(redis.call('GET', rpmKey) or '0')
  local tpm = tonumber(redis.call('GET', tpmKey) or '0')

  if rpm >= maxRpm then return {0, 'rpm_exceeded'} end
  if tpm + tokens > maxTpm then return {0, 'tpm_exceeded'} end

  redis.call('INCR', rpmKey)
  redis.call('EXPIRE', rpmKey, ttl)
  redis.call('INCRBY', tpmKey, tokens)
  redis.call('EXPIRE', tpmKey, ttl)

  return {1, 'ok'}
`;

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'rpm_exceeded' | 'tpm_exceeded';
}

@Injectable()
export class AiRateLimiterService {
  private readonly logger = new Logger(AiRateLimiterService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Sliding window rate limit for Groq.
   * Returns { allowed: true } → proceed with Groq call.
   * Returns { allowed: false, reason } → skip enrichment gracefully.
   */
  async tryAcquire(estimatedTokens: number): Promise<RateLimitResult> {
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `ai:rl:${Math.floor(now / WINDOW_SECONDS)}`;

    try {
      const result = (await this.redis.raw.eval(
        RATE_LIMIT_LUA,
        1,
        windowKey,
        MAX_RPM,
        MAX_TPM,
        Math.max(1, Math.ceil(estimatedTokens)),
        WINDOW_SECONDS + 5,
      )) as [number, string];

      const [allowed, reason] = result;
      if (allowed === 1) return { allowed: true };

      return {
        allowed: false,
        reason: reason === 'tpm_exceeded' ? 'tpm_exceeded' : 'rpm_exceeded',
      };
    } catch (err) {
      // Fail-open — if Redis is down, still allow (better than blocking all AI)
      this.logger.warn(
        `Rate limiter check failed, allowing request: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { allowed: true };
    }
  }

  /**
   * Estimate token cost of a payload before the Groq call.
   * Rule of thumb: 1 token ≈ 4 chars of JSON + ~1K completion tokens.
   */
  static estimateTokens(payload: unknown): number {
    try {
      const json = JSON.stringify(payload);
      return Math.ceil(json.length / 4) + 1024;
    } catch {
      return 2048;
    }
  }
}