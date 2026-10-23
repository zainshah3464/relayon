import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'crypto';

const ENVELOPE_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const HKDF_INFO = 'relayon:connector:v1';

/** Keys inside a destination config that must never be stored plaintext. */
export const SECRET_CONFIG_KEYS = new Set([
  'secret',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'token',
  'password',
  'webhookUrl',
  'webhook_url',
]);

export const REDACTED = '••••••••';

let cachedMasterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;

  const raw = process.env['CONNECTOR_ENCRYPTION_KEY'];
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw)) {
    throw new Error(
      'CONNECTOR_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  cachedMasterKey = Buffer.from(raw, 'hex');
  return cachedMasterKey;
}

/**
 * Per-tenant data key via HKDF-SHA256.
 *
 * Master key is global (env), salt = tenantId. Compromise of one tenant's
 * derived key does not expose another tenant's ciphertext. This is the
 * envelope-encryption pattern for multi-tenant credential storage.
 */
function deriveTenantKey(tenantId: string): Buffer {
  const derived = hkdfSync(
    'sha256',
    getMasterKey(),
    Buffer.from(tenantId, 'utf8'),
    Buffer.from(HKDF_INFO, 'utf8'),
    KEY_BYTES,
  );
  return Buffer.from(derived);
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENVELOPE_PREFIX);
}

export function encryptValue(plaintext: string, tenantId: string): string {
  const key = deriveTenantKey(tenantId);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENVELOPE_PREFIX}${iv.toString('base64url')}:${authTag.toString(
    'base64url',
  )}:${ciphertext.toString('base64url')}`;
}

export function decryptValue(envelope: string, tenantId: string): string {
  if (!isEncrypted(envelope)) return envelope;

  const body = envelope.slice(ENVELOPE_PREFIX.length);
  const parts = body.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted value envelope');
  }

  const [ivB64, tagB64, ctB64] = parts as [string, string, string];
  const key = deriveTenantKey(tenantId);
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64url')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

/**
 * Encrypts only the values whose key is in SECRET_CONFIG_KEYS. Non-secret
 * values (url, tableName, range, ...) stay plaintext so the dashboard can
 * render summaries without decrypting.
 *
 * Idempotent: already-encrypted values are left untouched.
 */
export function encryptConfig(
  config: Record<string, unknown>,
  tenantId: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (SECRET_CONFIG_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
      out[key] = isEncrypted(value) ? value : encryptValue(value, tenantId);
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      out[key] = encryptConfig(value as Record<string, unknown>, tenantId);
    } else {
      out[key] = value;
    }
  }

  return out;
}

/**
 * Decrypts every `enc:v1:` string it finds. Plaintext legacy values pass
 * through unchanged, so pre-v1.3 rows keep working.
 */
export function decryptConfig(
  config: Record<string, unknown>,
  tenantId: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (isEncrypted(value)) {
      out[key] = decryptValue(value, tenantId);
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      out[key] = decryptConfig(value as Record<string, unknown>, tenantId);
    } else {
      out[key] = value;
    }
  }

  return out;
}

/** Client-safe view: secrets replaced with a fixed mask, never decrypted. */
export function redactConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (SECRET_CONFIG_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
      out[key] = REDACTED;
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      out[key] = redactConfig(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }

  return out;
}