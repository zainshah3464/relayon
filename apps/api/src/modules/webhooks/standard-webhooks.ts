import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Standard Webhooks 1.0.0 signature helpers.
 * Spec: https://www.standardwebhooks.com
 * Compatible with Svix, Stripe, Clerk, Resend, and any Standard Webhooks receiver.
 *
 * Signature: `v1,<base64(hmac-sha256)>`
 * Signed:    `${webhook-id}.${webhook-timestamp}.${rawBody}`
 * Key:       base64-decode of `whsec_`-stripped secret
 * Tolerance: 300 seconds (5 min)
 */

const PREFIX = 'whsec_';
const TIMESTAMP_TOLERANCE_SEC = 300;

export function generateWebhookSecret(): string {
  return `${PREFIX}${randomBytes(24).toString('base64')}`;
}

export interface WebhookHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

export function signWebhook(
  rawBody: string,
  opts: { id: string; timestamp: number; secret: string },
): WebhookHeaders {
  const key = decodeSecret(opts.secret);
  const signedContent = `${opts.id}.${opts.timestamp}.${rawBody}`;
  const sig = createHmac('sha256', key).update(signedContent).digest('base64');

  return {
    id: opts.id,
    timestamp: String(opts.timestamp),
    signature: `v1,${sig}`,
  };
}

export function verifyWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string,
  toleranceSec = TIMESTAMP_TOLERANCE_SEC,
): boolean {
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSec) return false;

  const key = decodeSecret(secret);
  const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expected = createHmac('sha256', key).update(signedContent).digest('base64');
  const expectedBuf = Buffer.from(expected);

  // Space-separated signatures — accept ANY match (rotation support)
  for (const entry of headers.signature.split(' ').filter(Boolean)) {
    const [version, sig] = entry.split(',', 2);
    if (version !== 'v1' || !sig) continue;
    const sigBuf = Buffer.from(sig);
    if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}

function decodeSecret(secret: string): Buffer {
  const raw = secret.startsWith(PREFIX) ? secret.slice(PREFIX.length) : secret;
  return Buffer.from(raw, 'base64');
}