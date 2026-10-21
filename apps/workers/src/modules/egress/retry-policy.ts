export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number[];
}

const DEFAULT_POLICY: RetryPolicy = {
  maxAttempts: 5,
  backoffMs: [10_000, 30_000, 60_000, 300_000, 900_000],
};

/**
 * Parses the destination.retryPolicy JSONB field. Handles snake_case
 * keys from the Prisma default and validates ranges.
 */
export function parseRetryPolicy(raw: unknown): RetryPolicy {
  if (!raw || typeof raw !== 'object') return DEFAULT_POLICY;
  const obj = raw as Record<string, unknown>;

  const maxAttemptsRaw =
    typeof obj['max_attempts'] === 'number'
      ? obj['max_attempts']
      : typeof obj['maxAttempts'] === 'number'
        ? obj['maxAttempts']
        : DEFAULT_POLICY.maxAttempts;
  const maxAttempts = Math.max(1, Math.min(maxAttemptsRaw, 10));

  const backoffRaw = Array.isArray(obj['backoff_ms'])
    ? obj['backoff_ms']
    : Array.isArray(obj['backoffMs'])
      ? obj['backoffMs']
      : [];
  const backoffMs = backoffRaw.filter(
    (n): n is number => typeof n === 'number' && n > 0,
  );

  return {
    maxAttempts,
    backoffMs: backoffMs.length > 0 ? backoffMs : DEFAULT_POLICY.backoffMs,
  };
}

/**
 * Returns the delay before the NEXT retry, given the CURRENT attempt
 * number (1-based). Example: attemptNumber=1 → backoffMs[0].
 */
export function getBackoffMs(policy: RetryPolicy, attemptNumber: number): number {
  const idx = Math.max(
    0,
    Math.min(attemptNumber - 1, policy.backoffMs.length - 1),
  );
  return policy.backoffMs[idx]!;
}