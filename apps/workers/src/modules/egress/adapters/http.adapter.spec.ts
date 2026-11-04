import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpAdapter } from './http.adapter';
import { mockFetch } from '../../../../../../test/mocks';
import type { DeliveryContext } from './types';

function makeCtx(overrides: Partial<DeliveryContext> = {}): DeliveryContext {
  return {
    destinationId: 'dest-1',
    destinationType: 'http',
    config: { url: 'https://example.com/hook', method: 'POST' },
    payload: { type: 'test', amount: 100 },
    correlationId: 'corr-1',
    eventId: 'evt-1',
    attemptNumber: 1,
    ...overrides,
  };
}

describe('HttpAdapter', () => {
  let adapter: HttpAdapter;

  beforeEach(() => {
    adapter = new HttpAdapter();
    vi.restoreAllMocks();
  });

  it('returns success on 200', async () => {
    const { restore } = mockFetch([{ status: 200, body: { ok: true } }]);
    try {
      const r = await adapter.send(makeCtx());
      expect(r.success).toBe(true);
      expect(r.statusCode).toBe(200);
    } finally {
      restore();
    }
  });

  it('sends required headers', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: {} }]);
    try {
      await adapter.send(makeCtx());
      const h = calls[0]!.init!.headers as Record<string, string>;
      expect(h['X-Relayon-Event-Id']).toBe('evt-1');
      expect(h['Idempotency-Key']).toBe('evt-1:dest-1');
    } finally {
      restore();
    }
  });

  it('marks 5xx retryable', async () => {
    const { restore } = mockFetch([{ status: 503, body: '' }]);
    try {
      const r = await adapter.send(makeCtx());
      expect(r.retryable).toBe(true);
    } finally {
      restore();
    }
  });

  it('marks 4xx non-retryable', async () => {
    const { restore } = mockFetch([{ status: 400, body: '' }]);
    try {
      const r = await adapter.send(makeCtx());
      expect(r.retryable).toBe(false);
    } finally {
      restore();
    }
  });

  it('rejects invalid URL', async () => {
    const r = await adapter.send(makeCtx({ config: { url: 'not-a-url' } }));
    expect(r.success).toBe(false);
    expect(r.retryable).toBe(false);
  });

  it('dry-run uses HEAD', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: '' }]);
    try {
      await adapter.send(
        makeCtx({ config: { url: 'https://example.com', __dryRun: true } }),
      );
      expect(calls[0]!.init!.method).toBe('HEAD');
    } finally {
      restore();
    }
  });
});