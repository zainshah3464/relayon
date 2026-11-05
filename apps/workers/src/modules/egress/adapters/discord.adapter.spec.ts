import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiscordAdapter } from './discord.adapter';
import { mockFetch } from '../../../../../../test/mocks';
import type { DeliveryContext } from './types';

function makeCtx(overrides: Partial<DeliveryContext> = {}): DeliveryContext {
  return {
    destinationId: 'discord-1',
    destinationType: 'discord',
    config: { webhookUrl: 'https://discord.com/api/webhooks/123/abc' },
    payload: { summary: 'Alert: high error rate', type: 'alert' },
    correlationId: 'corr-1',
    eventId: 'evt-1',
    attemptNumber: 1,
    ...overrides,
  };
}

describe('DiscordAdapter', () => {
  let adapter: DiscordAdapter;

  beforeEach(() => {
    adapter = new DiscordAdapter();
    vi.restoreAllMocks();
  });

  it('rejects missing webhookUrl', async () => {
    const r = await adapter.send(makeCtx({ config: {} }));
    expect(r.success).toBe(false);
    expect(r.error).toContain('webhookUrl');
  });

  it('rejects non-Discord URL', async () => {
    const r = await adapter.send(
      makeCtx({ config: { webhookUrl: 'https://hooks.slack.com/x' } }),
    );
    expect(r.success).toBe(false);
    expect(r.retryable).toBe(false);
  });

  it('sends message with default username', async () => {
    const { calls, restore } = mockFetch([{ status: 204, body: '' }]);
    try {
      await adapter.send(makeCtx());
      const body = JSON.parse(calls[0]!.init!.body as string);
      expect(body.content).toBe('Alert: high error rate');
      expect(body.username).toBe('Relayon');
    } finally {
      restore();
    }
  });

  it('uses custom username from config', async () => {
    const { calls, restore } = mockFetch([{ status: 204, body: '' }]);
    try {
      await adapter.send(
        makeCtx({
          config: {
            webhookUrl: 'https://discord.com/api/webhooks/1/a',
            username: 'Bot',
          },
        }),
      );
      const body = JSON.parse(calls[0]!.init!.body as string);
      expect(body.username).toBe('Bot');
    } finally {
      restore();
    }
  });

  it('truncates content to 2000 chars', async () => {
    const { calls, restore } = mockFetch([{ status: 204, body: '' }]);
    try {
      await adapter.send(makeCtx({ payload: { summary: 'x'.repeat(5000) } }));
      const body = JSON.parse(calls[0]!.init!.body as string);
      expect(body.content.length).toBe(2000);
    } finally {
      restore();
    }
  });

  it('marks 429 retryable', async () => {
    const { restore } = mockFetch([{ status: 429, body: '' }]);
    try {
      const r = await adapter.send(makeCtx());
      expect(r.retryable).toBe(true);
    } finally {
      restore();
    }
  });
});