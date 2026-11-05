import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SlackAdapter } from './slack.adapter';
import { mockFetch } from '../../../../../../test/mocks';
import type { DeliveryContext } from './types';

function makeCtx(overrides: Partial<DeliveryContext> = {}): DeliveryContext {
  return {
    destinationId: 'slack-1',
    destinationType: 'slack',
    config: {
      webhookUrl: 'https://hooks.slack.com/services/T000/B000/XXXX',
    },
    payload: { summary: 'Checkout completed for $50', type: 'checkout' },
    correlationId: 'corr-1',
    eventId: 'evt-1',
    attemptNumber: 1,
    ...overrides,
  };
}

describe('SlackAdapter', () => {
  let adapter: SlackAdapter;

  beforeEach(() => {
    adapter = new SlackAdapter();
    vi.restoreAllMocks();
  });

  it('rejects missing webhookUrl', async () => {
    const r = await adapter.send(makeCtx({ config: {} }));
    expect(r.success).toBe(false);
    expect(r.retryable).toBe(false);
    expect(r.error).toContain('webhookUrl');
  });

  it('rejects non-Slack webhook URL', async () => {
    const r = await adapter.send(
      makeCtx({ config: { webhookUrl: 'https://evil.com/hook' } }),
    );
    expect(r.success).toBe(false);
    expect(r.retryable).toBe(false);
  });

  it('accepts valid Slack URL with "ok" body', async () => {
    const { restore } = mockFetch([{ status: 200, body: 'ok' }]);
    try {
      const r = await adapter.send(makeCtx());
      expect(r.success).toBe(true);
      expect(r.statusCode).toBe(200);
    } finally {
      restore();
    }
  });

  it('extracts summary from payload', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: 'ok' }]);
    try {
      await adapter.send(makeCtx());
      const body = JSON.parse(calls[0]!.init!.body as string);
      expect(body.text).toBe('Checkout completed for $50');
    } finally {
      restore();
    }
  });

  it('falls back to event ID when no summary', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: 'ok' }]);
    try {
      await adapter.send(makeCtx({ payload: { type: 'test' } }));
      const body = JSON.parse(calls[0]!.init!.body as string);
      expect(body.text).toContain('evt-1');
    } finally {
      restore();
    }
  });

  it('marks 5xx as retryable', async () => {
    const { restore } = mockFetch([{ status: 503, body: 'down' }]);
    try {
      const r = await adapter.send(makeCtx());
      expect(r.success).toBe(false);
      expect(r.retryable).toBe(true);
    } finally {
      restore();
    }
  });

  it('marks 429 as retryable', async () => {
    const { restore } = mockFetch([{ status: 429, body: 'rate_limited' }]);
    try {
      const r = await adapter.send(makeCtx());
      expect(r.retryable).toBe(true);
    } finally {
      restore();
    }
  });

  it('marks 4xx as NOT retryable', async () => {
    const { restore } = mockFetch([{ status: 400, body: 'bad' }]);
    try {
      const r = await adapter.send(makeCtx());
      expect(r.success).toBe(false);
      expect(r.retryable).toBe(false);
    } finally {
      restore();
    }
  });
});