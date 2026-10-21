import type { IncomingHttpHeaders } from 'http';
import type { SourceType } from '@prisma/client';
import { hmacSha256, safeCompare } from '../lib/hash';
import { SignatureError } from '../lib/errors';
import { logger } from '../lib/logger';

interface VerifyOptions {
  sourceType: SourceType;
  sourceConfig: Record<string, unknown>;
  rawBody: Buffer;
  headers: IncomingHttpHeaders;
  toleranceSeconds: number;
}

interface VerificationContext {
  rawBody: Buffer;
  headers: IncomingHttpHeaders;
  secret: string;
  toleranceSeconds: number;
}

// ═══════════════════════════════════════════════════════════════
// Signature verifiers — each returns true on valid, false on invalid
// ═══════════════════════════════════════════════════════════════

function verifyStripe(ctx: VerificationContext): boolean {
  const header = ctx.headers['stripe-signature'];
  if (typeof header !== 'string') return false;

  const parts = header.split(',');
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('t=')) timestamp = trimmed.slice(2);
    else if (trimmed.startsWith('v1=')) signatures.push(trimmed.slice(3));
  }

  if (!timestamp || signatures.length === 0) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > ctx.toleranceSeconds) return false;

  const signedPayload = `${timestamp}.${ctx.rawBody.toString('utf8')}`;
  const expected = hmacSha256(ctx.secret, signedPayload, 'hex');

  return signatures.some((sig) => safeCompare(sig, expected));
}

function verifyGitHub(ctx: VerificationContext): boolean {
  const header = ctx.headers['x-hub-signature-256'];
  if (typeof header !== 'string' || !header.startsWith('sha256=')) return false;

  const received = header.slice(7);
  const expected = hmacSha256(ctx.secret, ctx.rawBody, 'hex');
  return safeCompare(received, expected);
}

function verifyShopify(ctx: VerificationContext): boolean {
  const header = ctx.headers['x-shopify-hmac-sha256'];
  if (typeof header !== 'string') return false;

  const expected = hmacSha256(ctx.secret, ctx.rawBody, 'base64');
  return safeCompare(header, expected);
}

function verifySlack(ctx: VerificationContext): boolean {
  const signature = ctx.headers['x-slack-signature'];
  const timestamp = ctx.headers['x-slack-request-timestamp'];
  if (typeof signature !== 'string' || typeof timestamp !== 'string') {
    return false;
  }
  if (!signature.startsWith('v0=')) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > ctx.toleranceSeconds) return false;

  const signedPayload = `v0:${timestamp}:${ctx.rawBody.toString('utf8')}`;
  const expected = hmacSha256(ctx.secret, signedPayload, 'hex');
  return safeCompare(signature.slice(3), expected);
}

function verifyGeneric(
  ctx: VerificationContext,
  config: Record<string, unknown>,
): boolean {
  const headerName =
    typeof config['header'] === 'string'
      ? config['header'].toLowerCase()
      : 'x-webhook-signature';
  const encoding = config['encoding'] === 'base64' ? 'base64' : 'hex';

  const header = ctx.headers[headerName];
  if (typeof header !== 'string') return false;

  const expected = hmacSha256(ctx.secret, ctx.rawBody, encoding);
  return safeCompare(header, expected);
}

// ═══════════════════════════════════════════════════════════════
// Orchestrator — routes to the correct verifier
// ═══════════════════════════════════════════════════════════════

export async function verifySignature(opts: VerifyOptions): Promise<void> {
  const secret = opts.sourceConfig['secret'];
  if (typeof secret !== 'string' || secret.length === 0) {
    // Workflow has no secret — reject. Signature verification is
    // mandatory for all sources.
    throw new SignatureError(
      `Workflow is missing signing secret for source '${opts.sourceType}'`,
    );
  }

  const ctx: VerificationContext = {
    rawBody: opts.rawBody,
    headers: opts.headers,
    secret,
    toleranceSeconds: opts.toleranceSeconds,
  };

  let valid = false;
  let reason = 'invalid signature';

  try {
    switch (opts.sourceType) {
      case 'stripe':
        valid = verifyStripe(ctx);
        break;
      case 'github':
        valid = verifyGitHub(ctx);
        break;
      case 'shopify':
        valid = verifyShopify(ctx);
        break;
      case 'slack':
        valid = verifySlack(ctx);
        break;
      case 'generic':
        valid = verifyGeneric(ctx, opts.sourceConfig);
        break;
      default:
        reason = `unsupported source type: ${opts.sourceType}`;
        valid = false;
    }
  } catch (err) {
    logger.error('signature.verifier.crashed', {
      sourceType: opts.sourceType,
      message: err instanceof Error ? err.message : String(err),
    });
    valid = false;
    reason = 'signature verification failed';
  }

  if (!valid) {
    throw new SignatureError(reason);
  }
}