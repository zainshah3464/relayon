import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AirtableAdapter } from './airtable.adapter';
import { mockFetch } from '../../../../../../test/mocks';
import type { DeliveryContext } from './types';

// ⚠️ baseId must match /^app[a-zA-Z0-9]{14,}$/ — use 14 chars after 'app'
const VALID_BASE_ID = 'appABC1234567890X';

function makeCtx(overrides: Partial<DeliveryContext> = {}): DeliveryContext {
  return {
    destinationId: 'airtable-1',
    destinationType: 'airtable',
    config: {
      apiKey: 'pat_test123',
      baseId: VALID_BASE_ID,
      tableName: 'Leads',
    },
    payload: { name: 'Acme Corp', amount: 5000 },
    correlationId: 'corr-1',
    eventId: 'evt-1',
    attemptNumber: 1,
    ...overrides,
  };
}

describe('AirtableAdapter', () => {
  let adapter: AirtableAdapter;

  beforeEach(() => {
    adapter = new AirtableAdapter();
    vi.restoreAllMocks();
  });

  it('rejects missing apiKey', async () => {
    const r = await adapter.send(makeCtx({ config: {} }));
    expect(r.success).toBe(false);
    expect(r.error).toContain('apiKey');
  });

  it('rejects malformed baseId', async () => {
    const r = await adapter.send(
      makeCtx({ config: { apiKey: 'pat', baseId: 'not-a-base', tableName: 'Leads' } }),
    );
    expect(r.success).toBe(false);
    expect(r.error).toContain('baseId');
  });

  it('POSTs to /v0/{baseId}/{tableName}', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: { records: [] } }]);
    try {
      await adapter.send(makeCtx());
      expect(calls[0]!.url).toBe(
        `https://api.airtable.com/v0/${VALID_BASE_ID}/Leads`,
      );
      const headers = calls[0]!.init!.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer pat_test123');
    } finally {
      restore();
    }
  });

  it('sends flat object as fields directly', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: {} }]);
    try {
      await adapter.send(makeCtx({ payload: { name: 'X', amount: 5 } }));
      const body = JSON.parse(calls[0]!.init!.body as string);
      expect(body.records[0].fields).toEqual({ name: 'X', amount: 5 });
    } finally {
      restore();
    }
  });

  it('stringifies nested payload into "Payload" field', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: {} }]);
    try {
      await adapter.send(
        makeCtx({ payload: { customer: { name: 'X', address: { city: 'Y' } } } }),
      );
      const body = JSON.parse(calls[0]!.init!.body as string);
      expect(body.records[0].fields.Payload).toBeDefined();
      expect(typeof body.records[0].fields.Payload).toBe('string');
    } finally {
      restore();
    }
  });

  it('dry-run calls /meta/whoami', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: { id: 'usr' } }]);
    try {
      await adapter.send(
        makeCtx({ config: { ...makeCtx().config, __dryRun: true } }),
      );
      expect(calls[0]!.url).toBe('https://api.airtable.com/v0/meta/whoami');
    } finally {
      restore();
    }
  });

  it('sends typecast:true when configured', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: {} }]);
    try {
      await adapter.send(
        makeCtx({
          config: { ...makeCtx().config, typecast: true },
          payload: { name: 'X' },
        }),
      );
      const body = JSON.parse(calls[0]!.init!.body as string);
      expect(body.typecast).toBe(true);
    } finally {
      restore();
    }
  });
});