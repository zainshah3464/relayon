import { createHash, createHmac, timingSafeEqual } from 'crypto';

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hmacSha256(
  secret: string,
  payload: string | Buffer,
  encoding: 'hex' | 'base64' = 'hex',
): string {
  return createHmac('sha256', secret).update(payload).digest(encoding);
}

export function hashIp(ip: string | undefined, salt: string): string | null {
  if (!ip) return null;
  return sha256Hex(`${salt}:${ip}`);
}

/**
 * Constant-time string comparison. Prevents timing attacks during
 * signature verification.
 */
export function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}