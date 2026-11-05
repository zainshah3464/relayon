import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailAdapter } from './email.adapter';
import { mockFetch } from '../../../../../../test/mocks';
import type { DeliveryContext } from './types';

function makeCtx(overrides: Partial<DeliveryContext> = {}): DeliveryContext {
  return {
    destinationId: 'email-1',
    destinationType: 'email',
    config: {
      apiKey: 're_test_abc123',
      to: ['ops@example.com'],
      from: 'Relayon <noreply@relayon.dev>',
      subject: 'Test event',
    },
    payload: { type: 'test', data: { amount: 100 } },
    correlationId: 'corr-1',
    eventId: 'evt-1',
    attemptNumber: 1,
    ...overrides,
  };
}

describe('EmailAdapter', () => {
  let adapter: EmailAdapter;

  beforeEach(() => {
    adapter = new EmailAdapter();
    vi.restoreAllMocks();
  });

  it('rejects missing apiKey', async () => {
    const r = await adapter.send(makeCtx({ config: { to: [], from: 'x' } }));
    expect(r.success).toBe(false);
    expect(r.error).toContain('apiKey');
  });

  it('rejects apiKey without re_ prefix', async () => {
    const r = await adapter.send(
      makeCtx({ config: { apiKey: 'wrong', to: [], from: 'x' } }),
    );
    expect(r.success).toBe(false);
  });

  it('rejects missing from', async () => {
    const r = await adapter.send(
      makeCtx({ config: { apiKey: 're_abc', to: ['a@b.com'] } }),
    );
    expect(r.success).toBe(false);
    expect(r.error).toContain('from');
  });

  it('sends to Resend endpoint with auth header', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: { id: 'email-1' } }]);
    try {
      await adapter.send(makeCtx());
      expect(calls[0]!.url).toBe('https://api.resend.com/emails');
      const headers = calls[0]!.init!.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer re_test_abc123');
    } finally {
      restore();
    }
  });

  it('serializes payload into HTML body', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: {} }]);
    try {
      await adapter.send(makeCtx());
      const body = JSON.parse(calls[0]!.init!.body as string);
      expect(body.html).toContain('amount');
      expect(body.html).toContain('100');
    } finally {
      restore();
    }
  });

  it('escapes HTML in payload to prevent XSS', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: {} }]);
    try {
      await adapter.send(
        makeCtx({ payload: { name: '<script>alert(1)</script>' } }),
      );
      const body = JSON.parse(calls[0]!.init!.body as string);
      expect(body.html).not.toContain('<script>');
      expect(body.html).toContain('&lt;script&gt;');
    } finally {
      restore();
    }
  });

  it('dry-run uses GET /domains, not POST /emails', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: { data: [] } }]);
    try {
      await adapter.send(makeCtx({ config: { ...makeCtx().config, __dryRun: true } }));
      expect(calls[0]!.url).toBe('https://api.resend.com/domains');
      expect(calls[0]!.init!.method).toBe('GET');
    } finally {
      restore();
    }
  });

  it('marks 5xx retryable, 4xx not', async () => {
    const { restore } = mockFetch([{ status: 503, body: {} }]);
    try {
      expect((await adapter.send(makeCtx())).retryable).toBe(true);
    } finally {
      restore();
    }

    const { restore: r2 } = mockFetch([{ status: 422, body: {} }]);
    try {
      expect((await adapter.send(makeCtx())).retryable).toBe(false);
    } finally {
      r2();
    }
  });
});