import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { SheetsAdapter } from './sheets.adapter';
import { mockFetch } from '../../../../../../test/mocks';
import type { DeliveryContext } from './types';

// Generate test RSA key pair once for JWT signing
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

function makeCtx(overrides: Partial<DeliveryContext> = {}): DeliveryContext {
  return {
    destinationId: 'sheets-1',
    destinationType: 'sheets',
    config: {
      spreadsheetId: '1AbCdEf',
      range: 'Sheet1!A:Z',
      serviceAccountEmail: 'sa@project.iam.gserviceaccount.com',
      privateKey,
    },
    payload: { type: 'test', amount: 100 },
    correlationId: 'corr-1',
    eventId: 'evt-1',
    attemptNumber: 1,
    ...overrides,
  };
}

describe('SheetsAdapter', () => {
  let adapter: SheetsAdapter;

  beforeEach(() => {
    adapter = new SheetsAdapter();
    vi.restoreAllMocks();
  });

  it('rejects missing required fields', async () => {
    const r = await adapter.send(makeCtx({ config: {} }));
    expect(r.success).toBe(false);
    expect(r.error).toContain('serviceAccountEmail');
  });

  it('exchanges JWT for access token, then appends row', async () => {
    const { calls, restore } = mockFetch([
      { status: 200, body: { access_token: 'ya29.mock', expires_in: 3600 } },
      { status: 200, body: { updates: { updatedRows: 1 } } },
    ]);
    try {
      const r = await adapter.send(makeCtx());
      expect(r.success).toBe(true);

      expect(calls[0]!.url).toBe('https://oauth2.googleapis.com/token');
      expect(calls[0]!.init!.body).toContain(
        'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer',
      );

      expect(calls[1]!.url).toContain('/values/Sheet1!A%3AZ:append');
      expect(calls[1]!.url).toContain('valueInputOption=USER_ENTERED');
      const headers = calls[1]!.init!.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer ya29.mock');
    } finally {
      restore();
    }
  });

  it('truncates payload to 50K chars (Google cell limit)', async () => {
    const { calls, restore } = mockFetch([
      { status: 200, body: { access_token: 'tok' } },
      { status: 200, body: {} },
    ]);
    try {
      const hugePayload = { data: 'x'.repeat(100_000) };
      await adapter.send(makeCtx({ payload: hugePayload }));
      const body = JSON.parse(calls[1]!.init!.body as string);
      expect(body.values[0][0].length).toBe(50_000);
    } finally {
      restore();
    }
  });

  it('dry-run fetches metadata, does not append', async () => {
    const { calls, restore } = mockFetch([
      { status: 200, body: { access_token: 'tok' } },
      { status: 200, body: { spreadsheetId: '1AbCdEf' } },
    ]);
    try {
      await adapter.send(
        makeCtx({ config: { ...makeCtx().config, __dryRun: true } }),
      );
      expect(calls[1]!.url).toContain('/spreadsheets/1AbCdEf');
      expect(calls[1]!.url).not.toContain(':append');
    } finally {
      restore();
    }
  });

  it('fails when token exchange fails (401)', async () => {
    const { restore } = mockFetch([{ status: 401, body: { error: 'invalid_grant' } }]);
    try {
      const r = await adapter.send(makeCtx());
      expect(r.success).toBe(false);
      expect(r.retryable).toBe(false);
    } finally {
      restore();
    }
  });

  it('handles Sheets 403 (share permission)', async () => {
    const { restore } = mockFetch([
      { status: 200, body: { access_token: 'tok' } },
      { status: 403, body: { error: 'forbidden' } },
    ]);
    try {
      const r = await adapter.send(makeCtx());
      expect(r.success).toBe(false);
      expect(r.retryable).toBe(false);
    } finally {
      restore();
    }
  });

  it('handles private key with escaped newlines', async () => {
    const { calls, restore } = mockFetch([
      { status: 200, body: { access_token: 'tok' } },
      { status: 200, body: {} },
    ]);
    try {
      const escaped = privateKey.replace(/\n/g, '\\n');
      await adapter.send(
        makeCtx({ config: { ...makeCtx().config, privateKey: escaped } }),
      );
      expect(calls[0]!.url).toBe('https://oauth2.googleapis.com/token');
    } finally {
      restore();
    }
  });
});