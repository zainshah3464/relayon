import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

const V2_PREFIX = 'enc:v2:';
const V1_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const HKDF_INFO = 'relayon:connector:v1';

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
  'connectionString',
  'connection_string',
  'mongoUri',
  'mongo_uri',
  'postgresUrl',
  'postgres_url',
]);

export const METADATA_CONFIG_KEYS = new Set([
  'url',
  'method',
  'table',
  'database',
  'collection',
  'baseId',
  'tableName',
  'dataSourceId',
  'titleProperty',
  'spreadsheetId',
  'range',
  'to',
  'from',
  'subject',
  'username',
  'onConflict',
  'upsertKey',
  'ssl',
  'typecast',
  'notionVersion',
  'environment',
]);

export function encryptConfigAll(
  config: Record<string, unknown>,
  tenantId: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (METADATA_CONFIG_KEYS.has(key)) {
      out[key] = value;
      continue;
    }
    if (typeof value === 'string' && value.length > 0) {
      out[key] = isEncrypted(value) ? value : encryptValue(value, tenantId);
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      out[key] = encryptConfigAll(value as Record<string, unknown>, tenantId);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        typeof item === 'string' && item.length > 0 && !isEncrypted(item)
          ? encryptValue(item, tenantId)
          : item,
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

export const REDACTED = '••••••••';

interface KeyringEntry {
  kid: string;
  key: Buffer;
}

let keyringCache: { current: KeyringEntry; all: Map<string, KeyringEntry> } | null = null;

/**
 * Loads keyring from env. Supports:
 *   - NEW: CONNECTOR_ENCRYPTION_KEYS=kid1:hex,kid2:hex
 *   - LEGACY: CONNECTOR_ENCRYPTION_KEY=<hex>  (v1.3 compat)
 */
function loadKeyring(): { current: KeyringEntry; all: Map<string, KeyringEntry> } {
  if (keyringCache) return keyringCache;

  let raw = process.env['CONNECTOR_ENCRYPTION_KEYS'];

  // v1.3 backward compat: single key → single-entry keyring with legacy kid
  if (!raw) {
    const single = process.env['CONNECTOR_ENCRYPTION_KEY'];
    if (single && /^[a-f0-9]{64}$/i.test(single)) {
      raw = `v1-legacy:${single}`;
    }
  }

  if (!raw) {
    throw new Error(
      'CONNECTOR_ENCRYPTION_KEYS is required (or CONNECTOR_ENCRYPTION_KEY for v1.3 compat). Format: kid:hexkey,kid:hexkey',
    );
  }

  const entries: KeyringEntry[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx <= 0) {
      throw new Error(`Invalid keyring entry "${trimmed}" — expected "kid:hexkey"`);
    }

    const kid = trimmed.slice(0, colonIdx).trim();
    const hex = trimmed.slice(colonIdx + 1).trim();

    if (!/^[a-zA-Z0-9._-]{1,40}$/.test(kid)) {
      throw new Error(`Invalid kid "${kid}" — alphanumeric/dots/dashes/underscores (max 40)`);
    }
    if (!/^[a-f0-9]{64}$/i.test(hex)) {
      throw new Error(`Invalid key for kid "${kid}" — must be 64 hex chars`);
    }

    entries.push({ kid, key: Buffer.from(hex, 'hex') });
  }

  if (entries.length === 0) {
    throw new Error('CONNECTOR_ENCRYPTION_KEYS contains no valid entries');
  }

  const current = entries[0]!;
  const all = new Map(entries.map((e) => [e.kid, e]));

  keyringCache = { current, all };
  return keyringCache;
}

export function _resetKeyringCacheForTests(): void {
  keyringCache = null;
}

function deriveTenantKey(master: Buffer, tenantId: string): Buffer {
  const derived = hkdfSync(
    'sha256',
    master,
    Buffer.from(tenantId, 'utf8'),
    Buffer.from(HKDF_INFO, 'utf8'),
    KEY_BYTES,
  );
  return Buffer.from(derived);
}

export function isEncrypted(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (value.startsWith(V2_PREFIX) || value.startsWith(V1_PREFIX))
  );
}

export function encryptValue(plaintext: string, tenantId: string): string {
  const { current } = loadKeyring();
  const key = deriveTenantKey(current.key, tenantId);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${V2_PREFIX}${current.kid}:${iv.toString('base64url')}:${authTag.toString(
    'base64url',
  )}:${ciphertext.toString('base64url')}`;
}

export function decryptValue(envelope: string, tenantId: string): string {
  if (envelope.startsWith(V2_PREFIX)) return decryptV2(envelope, tenantId);
  if (envelope.startsWith(V1_PREFIX)) return decryptV1(envelope, tenantId);
  return envelope;
}

function decryptV2(envelope: string, tenantId: string): string {
  const body = envelope.slice(V2_PREFIX.length);
  const parts = body.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed v2 envelope — expected kid:iv:tag:ciphertext');
  }

  const [kid, ivB64, tagB64, ctB64] = parts as [string, string, string, string];
  const entry = loadKeyring().all.get(kid);
  if (!entry) {
    throw new Error(
      `Unknown kid "${kid}" — is this key still present in CONNECTOR_ENCRYPTION_KEYS?`,
    );
  }

  const key = deriveTenantKey(entry.key, tenantId);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64url')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/** Legacy v1 format — no kid in envelope. Try all keys. */
function decryptV1(envelope: string, tenantId: string): string {
  const body = envelope.slice(V1_PREFIX.length);
  const parts = body.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed v1 envelope');
  }
  const [ivB64, tagB64, ctB64] = parts as [string, string, string];

  const keys = Array.from(loadKeyring().all.values()).reverse();
  let lastError: Error | null = null;

  for (const entry of keys) {
    try {
      const key = deriveTenantKey(entry.key, tenantId);
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ctB64, 'base64url')),
        decipher.final(),
      ]);
      return plaintext.toString('utf8');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw new Error(
    `v1 envelope decryption failed with all keys: ${lastError?.message ?? 'unknown'}`,
  );
}

export function encryptConfig(
  config: Record<string, unknown>,
  tenantId: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (SECRET_CONFIG_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
      out[key] = isEncrypted(value) ? value : encryptValue(value, tenantId);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = encryptConfig(value as Record<string, unknown>, tenantId);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function decryptConfig(
  config: Record<string, unknown>,
  tenantId: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (isEncrypted(value)) {
      out[key] = decryptValue(value, tenantId);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = decryptConfig(value as Record<string, unknown>, tenantId);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function redactConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (SECRET_CONFIG_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
      out[key] = REDACTED;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactConfig(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function envelopeKid(envelope: string): string | null {
  if (envelope.startsWith(V2_PREFIX)) {
    return envelope.slice(V2_PREFIX.length).split(':')[0] ?? null;
  }
  if (envelope.startsWith(V1_PREFIX)) return 'v1-legacy';
  return null;
}

export function currentKid(): string {
  return loadKeyring().current.kid;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}