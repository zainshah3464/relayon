import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotionAdapter } from './notion.adapter';
import { mockFetch } from '../../../../../../test/mocks';
import type { DeliveryContext } from './types';

function makeCtx(overrides: Partial<DeliveryContext> = {}): DeliveryContext {
  return {
    destinationId: 'notion-1',
    destinationType: 'notion',
    config: {
      apiKey: 'secret_test123',
      dataSourceId: 'abc-123-def',
      titleProperty: 'Name',
    },
    payload: { type: 'order', summary: 'Order #1234 created' },
    correlationId: 'corr-1',
    eventId: 'evt-1',
    attemptNumber: 1,
    ...overrides,
  };
}

describe('NotionAdapter', () => {
  let adapter: NotionAdapter;

  beforeEach(() => {
    adapter = new NotionAdapter();
    vi.restoreAllMocks();
  });

  it('rejects missing apiKey', async () => {
    const r = await adapter.send(makeCtx({ config: {} }));
    expect(r.success).toBe(false);
    expect(r.error).toContain('apiKey');
  });

  it('rejects missing dataSourceId', async () => {
    const r = await adapter.send(
      makeCtx({ config: { apiKey: 'secret', titleProperty: 'Name' } }),
    );
    expect(r.success).toBe(false);
    expect(r.error).toContain('dataSourceId');
  });

  it('creates page with title from summary', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: { id: 'page-1' } }]);
    try {
      await adapter.send(makeCtx());
      expect(calls[0]!.url).toBe('https://api.notion.com/v1/pages');
      const body = JSON.parse(calls[0]!.init!.body as string);
      expect(body.parent).toEqual({ data_source_id: 'abc-123-def' });
      expect(body.properties.Name.title[0].text.content).toBe('Order #1234 created');
    } finally {
      restore();
    }
  });

  it('sends Notion-Version header (2026-03-11 default)', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: {} }]);
    try {
      await adapter.send(makeCtx());
      const headers = calls[0]!.init!.headers as Record<string, string>;
      expect(headers['Notion-Version']).toBe('2026-03-11');
    } finally {
      restore();
    }
  });

  it('respects custom notionVersion', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: {} }]);
    try {
      await adapter.send(
        makeCtx({
          config: { ...makeCtx().config, notionVersion: '2022-06-28' },
        }),
      );
      const headers = calls[0]!.init!.headers as Record<string, string>;
      expect(headers['Notion-Version']).toBe('2022-06-28');
    } finally {
      restore();
    }
  });

  it('adds payload as rich_text when payloadProperty configured', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: {} }]);
    try {
      await adapter.send(
        makeCtx({ config: { ...makeCtx().config, payloadProperty: 'Payload' } }),
      );
      const body = JSON.parse(calls[0]!.init!.body as string);
      expect(body.properties.Payload).toBeDefined();
      expect(body.properties.Payload.rich_text[0].text.content).toBeDefined();
    } finally {
      restore();
    }
  });

  it('falls back to "Relayon event {id}" when no summary/title/name', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: {} }]);
    try {
      await adapter.send(makeCtx({ payload: { arbitrary: 'data' } }));
      const body = JSON.parse(calls[0]!.init!.body as string);
      expect(body.properties.Name.title[0].text.content).toContain('Relayon event');
    } finally {
      restore();
    }
  });

  it('dry-run calls /users/me', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: { id: 'bot' } }]);
    try {
      await adapter.send(
        makeCtx({ config: { ...makeCtx().config, __dryRun: true } }),
      );
      expect(calls[0]!.url).toBe('https://api.notion.com/v1/users/me');
    } finally {
      restore();
    }
  });
});