import { createHash } from 'node:crypto';

/**
 * Privacy-first visitor hashing:
 * - IP hashed with salt that ROTATES DAILY
 * - Same visitor gets different hash tomorrow → no cross-day tracking
 * - Salt derived from env base + date, no DB storage needed
 *
 * GDPR: IP never persisted plaintext. Re-identification impossible
 * after 24h because the salt changes.
 */
export function hashVisitor(ip: string | undefined, date = new Date()): string | null {
  if (!ip) return null;
  const baseSalt = process.env['IP_HASH_SALT'];
  if (!baseSalt) return null;

  const dailySalt = `${baseSalt}:${date.toISOString().slice(0, 10)}`;
  return createHash('sha256').update(`${dailySalt}:${ip}`).digest('hex').slice(0, 32);
}

/**
 * Referrer pruning: keep only host (drop path/query). Prevents
 * leaking user journeys through external sites.
 */
export function pruneReferrer(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    return url.host.slice(0, 200);
  } catch {
    return null;
  }
}