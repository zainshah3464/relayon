import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreakerService } from './circuit-breaker.service';
import { makeFakeRedis } from '../../../../../test/mocks';

describe('CircuitBreakerService', () => {
  let redis: ReturnType<typeof makeFakeRedis>;
  let service: CircuitBreakerService;

  beforeEach(() => {
    redis = makeFakeRedis();
    service = new CircuitBreakerService({ raw: redis } as never);
  });

  it('is initially closed', async () => {
    expect(await service.isOpen('dest-1')).toBe(false);
  });

  it('opens after 5 failures', async () => {
    for (let i = 0; i < 4; i++) {
      await service.recordFailure('dest-1');
      expect(await service.isOpen('dest-1')).toBe(false);
    }
    await service.recordFailure('dest-1');
    expect(await service.isOpen('dest-1')).toBe(true);
  });

  it('success resets', async () => {
    for (let i = 0; i < 3; i++) await service.recordFailure('dest-1');
    await service.recordSuccess('dest-1');
    for (let i = 0; i < 4; i++) await service.recordFailure('dest-1');
    expect(await service.isOpen('dest-1')).toBe(false);
  });
});