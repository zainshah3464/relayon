import { describe, it, expect } from 'vitest';
import { parseRetryPolicy, getBackoffMs } from './retry-policy';

describe('parseRetryPolicy', () => {
  it('returns default for null/undefined', () => {
    expect(parseRetryPolicy(null)).toEqual({
      maxAttempts: 5,
      backoffMs: [10000, 30000, 60000, 300000, 900000],
    });
  });

  it('accepts snake_case', () => {
    const p = parseRetryPolicy({ max_attempts: 3, backoff_ms: [1000, 2000] });
    expect(p.maxAttempts).toBe(3);
    expect(p.backoffMs).toEqual([1000, 2000]);
  });

  it('accepts camelCase', () => {
    const p = parseRetryPolicy({ maxAttempts: 4, backoffMs: [500, 1000] });
    expect(p.maxAttempts).toBe(4);
  });

  it('clamps maxAttempts to [1,10]', () => {
    expect(parseRetryPolicy({ max_attempts: 0 }).maxAttempts).toBe(1);
    expect(parseRetryPolicy({ max_attempts: 100 }).maxAttempts).toBe(10);
  });
});

describe('getBackoffMs', () => {
  const p = { maxAttempts: 5, backoffMs: [1000, 5000, 15000] };
  it('returns 1st for attempt 1', () => expect(getBackoffMs(p, 1)).toBe(1000));
  it('returns 2nd for attempt 2', () => expect(getBackoffMs(p, 2)).toBe(5000));
  it('clamps beyond array', () => expect(getBackoffMs(p, 100)).toBe(15000));
});