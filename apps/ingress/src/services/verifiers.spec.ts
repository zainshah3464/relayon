import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifySignature } from './verifiers';
import { SignatureError } from '../lib/errors';

const SECRET = 'whsec_test_secret_123';
const TOLERANCE = 300;

function stripeSig(payload: string, ts = Math.floor(Date.now() / 1000), secret = SECRET): string {
  const signed = `${ts}.${payload}`;
  const sig = createHmac('sha256', secret).update(signed).digest('hex');
  return `t=${ts},v1=${sig}`;
}
function githubSig(payload: string, secret = SECRET): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
}
function shopifySig(payload: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(payload).digest('base64');
}
function slackSig(payload: string, ts: number, secret = SECRET): string {
  return 'v0=' + createHmac('sha256', secret).update(`v0:${ts}:${payload}`).digest('hex');
}

describe('verifySignature', () => {
  describe('Stripe', () => {
    it('accepts valid', async () => {
      const body = '{"id":"evt_1"}';
      await expect(
        verifySignature({
          sourceType: 'stripe',
          sourceConfig: { secret: SECRET },
          rawBody: Buffer.from(body),
          headers: { 'stripe-signature': stripeSig(body) },
          toleranceSeconds: TOLERANCE,
        }),
      ).resolves.toBeUndefined();
    });
    it('rejects wrong secret', async () => {
      const body = '{"x":1}';
      await expect(
        verifySignature({
          sourceType: 'stripe',
          sourceConfig: { secret: SECRET },
          rawBody: Buffer.from(body),
          headers: { 'stripe-signature': stripeSig(body, undefined, 'wrong') },
          toleranceSeconds: TOLERANCE,
        }),
      ).rejects.toThrow(SignatureError);
    });
    it('rejects stale timestamp', async () => {
      const body = '{"x":1}';
      const old = Math.floor(Date.now() / 1000) - TOLERANCE - 100;
      await expect(
        verifySignature({
          sourceType: 'stripe',
          sourceConfig: { secret: SECRET },
          rawBody: Buffer.from(body),
          headers: { 'stripe-signature': stripeSig(body, old) },
          toleranceSeconds: TOLERANCE,
        }),
      ).rejects.toThrow(SignatureError);
    });
    it('rejects missing header', async () => {
      await expect(
        verifySignature({
          sourceType: 'stripe',
          sourceConfig: { secret: SECRET },
          rawBody: Buffer.from('{}'),
          headers: {},
          toleranceSeconds: TOLERANCE,
        }),
      ).rejects.toThrow(SignatureError);
    });
    it('rejects tampered payload', async () => {
      const body = '{"amount":100}';
      const sig = stripeSig(body);
      await expect(
        verifySignature({
          sourceType: 'stripe',
          sourceConfig: { secret: SECRET },
          rawBody: Buffer.from('{"amount":999}'),
          headers: { 'stripe-signature': sig },
          toleranceSeconds: TOLERANCE,
        }),
      ).rejects.toThrow(SignatureError);
    });
  });

  describe('GitHub', () => {
    it('accepts valid', async () => {
      const body = '{"action":"opened"}';
      await expect(
        verifySignature({
          sourceType: 'github',
          sourceConfig: { secret: SECRET },
          rawBody: Buffer.from(body),
          headers: { 'x-hub-signature-256': githubSig(body) },
          toleranceSeconds: TOLERANCE,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('Shopify', () => {
    it('accepts valid base64', async () => {
      const body = '{"id":123}';
      await expect(
        verifySignature({
          sourceType: 'shopify',
          sourceConfig: { secret: SECRET },
          rawBody: Buffer.from(body),
          headers: { 'x-shopify-hmac-sha256': shopifySig(body) },
          toleranceSeconds: TOLERANCE,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('Slack', () => {
    it('accepts valid v0', async () => {
      const body = '{"event":"test"}';
      const ts = Math.floor(Date.now() / 1000);
      await expect(
        verifySignature({
          sourceType: 'slack',
          sourceConfig: { secret: SECRET },
          rawBody: Buffer.from(body),
          headers: {
            'x-slack-signature': slackSig(body, ts),
            'x-slack-request-timestamp': String(ts),
          },
          toleranceSeconds: TOLERANCE,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('Generic', () => {
    it('accepts valid HMAC', async () => {
      const body = 'payload';
      const sig = createHmac('sha256', SECRET).update(body).digest('hex');
      await expect(
        verifySignature({
          sourceType: 'generic',
          sourceConfig: { secret: SECRET },
          rawBody: Buffer.from(body),
          headers: { 'x-webhook-signature': sig },
          toleranceSeconds: TOLERANCE,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('common', () => {
    it('rejects missing secret', async () => {
      await expect(
        verifySignature({
          sourceType: 'stripe',
          sourceConfig: {},
          rawBody: Buffer.from('{}'),
          headers: { 'stripe-signature': 't=1,v1=abc' },
          toleranceSeconds: TOLERANCE,
        }),
      ).rejects.toThrow(/missing signing secret/i);
    });
  });
});