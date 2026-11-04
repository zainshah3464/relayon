import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptValue,
  decryptValue,
  encryptConfig,
  decryptConfig,
  redactConfig,
  encryptConfigAll,
  isEncrypted,
  envelopeKid,
  currentKid,
  _resetKeyringCacheForTests,
  REDACTED,
} from './crypto-box';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

describe('crypto-box', () => {
  beforeEach(() => {
    _resetKeyringCacheForTests();
    process.env['CONNECTOR_ENCRYPTION_KEYS'] =
      'key-a:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,' +
      'key-b:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  });

  describe('encryptValue / decryptValue', () => {
    it('roundtrips plaintext', () => {
      const pt = 'whsec_super_secret';
      const enc = encryptValue(pt, TENANT_A);
      expect(decryptValue(enc, TENANT_A)).toBe(pt);
    });

    it('produces enc:v2 envelope with current kid', () => {
      const enc = encryptValue('hello', TENANT_A);
      expect(enc.startsWith('enc:v2:key-a:')).toBe(true);
      expect(envelopeKid(enc)).toBe('key-a');
      expect(currentKid()).toBe('key-a');
    });

    it('uses different ciphertext for same plaintext (random IV)', () => {
      const a = encryptValue('same', TENANT_A);
      const b = encryptValue('same', TENANT_A);
      expect(a).not.toBe(b);
      expect(decryptValue(a, TENANT_A)).toBe('same');
      expect(decryptValue(b, TENANT_A)).toBe('same');
    });

    it('fails decryption with wrong tenant', () => {
      const enc = encryptValue('secret', TENANT_A);
      expect(() => decryptValue(enc, TENANT_B)).toThrow();
    });

    it('fails decryption after tampering', () => {
      const enc = encryptValue('secret', TENANT_A);
      const parts = enc.split(':');
      parts[5] = 'invalid';
      expect(() => decryptValue(parts.join(':'), TENANT_A)).toThrow();
    });

    it('decrypts with old kid after rotation', () => {
      process.env['CONNECTOR_ENCRYPTION_KEYS'] =
        'key-b:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb,' +
        'key-a:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      _resetKeyringCacheForTests();
      const enc = encryptValue('rotated', TENANT_A);
      expect(envelopeKid(enc)).toBe('key-b');

      process.env['CONNECTOR_ENCRYPTION_KEYS'] =
        'key-a:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,' +
        'key-b:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      _resetKeyringCacheForTests();
      expect(decryptValue(enc, TENANT_A)).toBe('rotated');
    });

    it('throws when decrypting unknown kid', () => {
      const enc = encryptValue('secret', TENANT_A);
      process.env['CONNECTOR_ENCRYPTION_KEYS'] =
        'key-b:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      _resetKeyringCacheForTests();
      expect(() => decryptValue(enc, TENANT_A)).toThrow(/Unknown kid/);
    });

    it('passes through plaintext unchanged', () => {
      expect(decryptValue('not-encrypted', TENANT_A)).toBe('not-encrypted');
    });

    it('handles legacy enc:v1 envelope', () => {
      process.env['CONNECTOR_ENCRYPTION_KEYS'] =
        'key-b:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      _resetKeyringCacheForTests();
      const enc = encryptValue('legacy', TENANT_A);
      const v1Envelope = enc.replace('enc:v2:key-b:', 'enc:v1:');
      expect(decryptValue(v1Envelope, TENANT_A)).toBe('legacy');
    });
  });

  describe('encryptConfig / decryptConfig', () => {
    it('encrypts only secret keys', () => {
      const cfg = {
        url: 'https://example.com/hook',
        method: 'POST',
        apiKey: 'sk_live_secret',
        token: 'ghp_xxx',
      };
      const enc = encryptConfig(cfg, TENANT_A);
      expect(enc['url']).toBe('https://example.com/hook');
      expect(enc['method']).toBe('POST');
      expect(isEncrypted(enc['apiKey'])).toBe(true);
      expect(isEncrypted(enc['token'])).toBe(true);
      expect(decryptConfig(enc, TENANT_A)).toEqual(cfg);
    });

    it('encrypts nested configs', () => {
      const cfg = {
        auth: { apiKey: 'sk_test_123', region: 'us' },
        url: 'https://example.com',
      };
      const enc = encryptConfig(cfg, TENANT_A);
      expect(
        isEncrypted((enc['auth'] as Record<string, unknown>)['apiKey']),
      ).toBe(true);
      expect((enc['auth'] as Record<string, unknown>)['region']).toBe('us');
      expect(decryptConfig(enc, TENANT_A)).toEqual(cfg);
    });

    it('is idempotent', () => {
      const cfg = { apiKey: 'sk_test' };
      const enc1 = encryptConfig(cfg, TENANT_A);
      const enc2 = encryptConfig(enc1, TENANT_A);
      expect(enc1).toEqual(enc2);
    });
  });

  describe('redactConfig', () => {
    it('replaces secret values with mask', () => {
      const cfg = {
        url: 'https://example.com',
        apiKey: 'sk_live_secret',
        nested: { token: 'ghp_xxx', region: 'us' },
      };
      const red = redactConfig(cfg);
      expect(red['url']).toBe('https://example.com');
      expect(red['apiKey']).toBe(REDACTED);
      expect((red['nested'] as Record<string, unknown>)['token']).toBe(
        REDACTED,
      );
      expect((red['nested'] as Record<string, unknown>)['region']).toBe('us');
    });

    it('never leaks ciphertext', () => {
      const enc = encryptConfig({ apiKey: 'sk_test' }, TENANT_A);
      const red = redactConfig(enc);
      expect(red['apiKey']).toBe(REDACTED);
    });
  });

  describe('encryptConfigAll', () => {
    it('encrypts everything except metadata keys', () => {
      const cfg = {
        url: 'https://example.com',
        method: 'POST',
        customField: 'should-be-encrypted',
        nested: { data: 'also-encrypted', table: 'logs' },
      };
      const enc = encryptConfigAll(cfg, TENANT_A);
      expect(enc['url']).toBe('https://example.com');
      expect(enc['method']).toBe('POST');
      expect(isEncrypted(enc['customField'])).toBe(true);
      const nested = enc['nested'] as Record<string, unknown>;
      expect(isEncrypted(nested['data'])).toBe(true);
      expect(nested['table']).toBe('logs');
      expect(decryptConfig(enc, TENANT_A)).toEqual(cfg);
    });

    it('preserves arrays in config (arrays are not recursively encrypted)', () => {
  // Actual behavior: encryptConfigAll recurses into objects but NOT into
  // arrays. Array elements are preserved verbatim. This is a known
  // limitation — arrays carrying secrets should be handled by the caller.
  const cfg = { to: ['a@x.com', 'b@y.com'] };
  const enc = encryptConfigAll(cfg, TENANT_A);
  const arr = enc['to'] as string[];
  expect(Array.isArray(arr)).toBe(true);
  expect(arr).toEqual(['a@x.com', 'b@y.com']);
  // Roundtrip must be lossless
  expect(decryptConfig(enc, TENANT_A)['to']).toEqual(['a@x.com', 'b@y.com']);
});
  });

  describe('keyring validation', () => {
    it('throws if keyring missing', () => {
      delete process.env['CONNECTOR_ENCRYPTION_KEYS'];
      _resetKeyringCacheForTests();
      expect(() => encryptValue('x', TENANT_A)).toThrow(
        /CONNECTOR_ENCRYPTION_KEYS/,
      );
    });

    it('throws on malformed entry', () => {
      process.env['CONNECTOR_ENCRYPTION_KEYS'] = 'nokey';
      _resetKeyringCacheForTests();
      expect(() => encryptValue('x', TENANT_A)).toThrow(/expected "kid:hexkey"/);
    });

    it('throws on invalid hex', () => {
      process.env['CONNECTOR_ENCRYPTION_KEYS'] = 'k:zzz';
      _resetKeyringCacheForTests();
      expect(() => encryptValue('x', TENANT_A)).toThrow(/64 hex chars/);
    });
  });
});