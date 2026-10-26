# Relayon — Security

> **Threat model, auth flow, and defense-in-depth for a multi-tenant webhook platform.**
>
> **Current version:** v1.5.0

Security in Relayon is layered. No single control is trusted to prevent all attacks. Each layer assumes the one above it might fail.

---

## Table of Contents

- [Threat Model](#threat-model)
- [Authentication](#authentication)
- [Authorization (Multi-Tenancy)](#authorization-multi-tenancy)
- [Webhook Signature Verification](#webhook-signature-verification)
- [Rate Limiting](#rate-limiting)
- [Credential Encryption at Rest](#credential-encryption-at-rest)
- [Dry-Run Safety](#dry-run-safety)
- [Secrets Management](#secrets-management)
- [Input Validation](#input-validation)
- [Audit Logging](#audit-logging)
- [What Relayon Does NOT Do](#what-relayon-does-not-do)
- [Reporting Vulnerabilities](#reporting-vulnerabilities)

---

## Threat Model

Relayon trusts **nothing** from the client. Every request is assumed to be:

1. **Hostile** — an attacker controls the request body, headers, and timing
2. **Replayable** — the same request may arrive 1 or 1000 times
3. **Impersonatable** — the source IP cannot be trusted (proxies, VPNs, shared NAT)

### Assets to protect (in priority order)

1. **Tenant data isolation** — Tenant A must never see Tenant B's workflows, events, or deliveries
2. **Destination credentials** — encrypted at rest (v1.3+), never returned to client (v1.3+), per-tenant derived keys (v1.3+)
3. **Secret leakage** — Database URLs, JWT secrets, Groq API keys, encryption master key
4. **Availability** — Prevent DoS through rate limits and circuit breakers
5. **Correctness** — Prevent duplicate deliveries, lost events, financial double-charges

### Trust boundaries

```
Untrusted zone (public internet)
    │
    ├── Webhook sources (Stripe, GitHub, Shopify, Slack)
    │       │ Verified via HMAC
    │       ▼
    ├── Dashboard users (browser)
    │       │ Verified via JWT or API Key
    │       ▼
    ├── Cron triggers (cron-job.org, Upstash QStash)
    │       │ Verified via X-Cron-Secret
    │       ▼
    └── Trusted zone (Relayon services)
            ├── Ingress → Redis → Workers
            ├── Workers → PostgreSQL, MongoDB, Redis
            └── API → PostgreSQL, MongoDB
```

**No cross-boundary trust.** A compromised Ingress cannot access destination credentials (only Workers reads those, and only after decrypting with a per-tenant key). A compromised API cannot push to queues (only Ingress and Workers do).

---

## Authentication

Relayon has **three independent authentication mechanisms**, one per trust boundary:

| Boundary | Mechanism | Where |
|---|---|---|
| Dashboard users | JWT (access) + opaque refresh token | `/api/*` (except `/api/auth/*` and `/api/health`) |
| Programmatic clients | API Key (`X-API-Key` header) | `/api/*` (alternative to JWT) |
| Webhook sources | HMAC signature | `POST /webhook/:tenantId/:workflowId` |
| Cron triggers | Shared secret (`X-Cron-Secret`) | `/internal/*` |

### Dashboard users — JWT

**Algorithm:** HMAC-SHA256 (`HS256`)

**Access token:**
- Expiry: 15 minutes
- Payload: `{ sub, email, role, tenantId, iat, exp }`
- Verified on every `/api/*` request via `JwtAuthGuard` (or `JwtOrApiKeyGuard` — see below)

**Refresh token:**
- Expiry: 7 days
- **Opaque** — random 48-byte string, not a JWT
- Stored as `SHA-256(token)` in PostgreSQL (`refresh_tokens.token_hash`)
- **Rotation on every use** — old token revoked (`revoked_at = now`), new one issued

**Why two tokens:**
- Access token in memory (XSS-safe, but requires frequent refresh)
- Refresh token in `httpOnly` cookie (XSS-safe, CSRF-protected via SameSite=Strict)

**Flow:**

```
1. POST /api/auth/signup  → returns { accessToken, refreshToken, user }
2. Client stores both (accessToken in memory, refreshToken in httpOnly cookie)
3. Every request: Authorization: Bearer <accessToken>
4. On 401: POST /api/auth/refresh with refreshToken cookie → new pair
5. Logout: POST /api/auth/logout with refreshToken → revoked in DB
```

**Refresh token theft mitigation:**
- If a stolen refresh token is used, it's **revoked immediately** on success
- If the legitimate user then refreshes, their token fails (already revoked)
- This signals a breach — user must re-login

**Why not sessions:** JWT allows stateless verification. Refresh tokens provide revocation (via `revoked_at` in DB). This hybrid gives best of both worlds.

---

### Programmatic clients — API Keys (v1.2+)

**Key format:** `rlk_<live|test>_<8-hex-prefix>_<48-hex-secret>`

- `rlk_` — Relayon prefix (Stripe-style, greppable in logs/secrets scanners)
- `<live|test>` — environment tag
- `<8-hex-prefix>` — used for O(1) DB lookup (`api_keys.prefix` is `UNIQUE`)
- `<48-hex-secret>` — 24 random bytes, opaque auth material

**Example:** `rlk_live_ab12cd34_f7cebdac923c3e6cee146bb32495e25e6cc20fd81595b65b`

**Storage:**

| Column | Value |
|---|---|
| `prefix` | `rlk_live_ab12cd34` — indexed for lookup |
| `key_hash` | `SHA-256(PEPPER + ":" + rawKey)` — hex encoded |
| `scopes` | `["events:read","workflows:read"]` — Postgres `text[]` |
| `environment` | `live` or `test` |
| `expires_at` | 90 days default, or `NULL` if `neverExpires: true` |
| `revoked_at` | `NULL` until revoked |
| `last_used_at` | Updated on every successful verify (fire-and-forget) |

**Raw key is returned ONCE at creation — never retrievable again.** If lost, revoke and create a new one.

**Verification (timing-safe):**

```typescript
async verify(rawKey: string) {
  const match = rawKey.match(/^rlk_(live|test)_([a-f0-9]{8})_([a-f0-9]{48})$/);
  if (!match) return null;

  const prefix = `rlk_${match[1]}_${match[2]}`;
  const record = await this.prisma.apiKey.findUnique({ where: { prefix } });
  if (!record) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt < new Date()) return null;

  const expected = Buffer.from(record.keyHash, 'hex');
  const actual = Buffer.from(this.hashKey(rawKey), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  // fire-and-forget
  this.prisma.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => undefined);

  return { tenantId: record.tenantId, apiKeyId: record.id, scopes: record.scopes };
}
```

**Why pepper + SHA-256, not bcrypt:**

- bcrypt is ~100ms — too slow for API auth on every request
- SHA-256 of a **high-entropy** random key (~1μs) is secure because the key itself has **384 bits of entropy**
- Pepper (`API_KEY_PEPPER` env var) defends against rainbow tables if the DB leaks
- This is the same pattern Stripe, GitHub, and AWS use for API keys

**Scope enforcement:**

- `JwtOrApiKeyGuard` — hybrid guard. If `X-API-Key` header present, verify key + enforce scopes; else fall back to JWT (dashboard session, no scope check — session has full tenant access).
- `@RequireScopes('events:read')` decorator on any route that should be API-key-accessible. If an API key lacks the scope, returns `403` with a clear message listing missing scopes.
- JWT sessions bypass scope checks entirely — they have full tenant access by design.

**Rotation (v1.5+):**

`POST /api/api-keys/:id/rotate` — creates a new key with the same scopes/environment, and **caps the old key's `expiresAt` at `now + 24h`** (grace window).

- During grace: **both keys work** — lets customers deploy the new key without downtime
- After 24h: old key returns `401` (expired)
- The old key can also be revoked earlier with `DELETE /api/api-keys/:id`

**Revocation:** `DELETE /api/api-keys/:id` sets `revoked_at = now`. The next request with that key returns `401` immediately — no cache TTL.

---

### Webhook sources — HMAC signatures

**Algorithm:** HMAC-SHA256 over source-specific payload

| Source | Header | Signed content |
|---|---|---|
| Stripe | `Stripe-Signature` | `{timestamp}.{body}` |
| GitHub | `X-Hub-Signature-256` | `{body}` |
| Shopify | `X-Shopify-Hmac-Sha256` | `{body}` |
| Slack | `X-Slack-Signature` | `v0:{timestamp}:{body}` |
| Generic | `X-Webhook-Signature` | `{body}` |

**Timestamp tolerance:** 300 seconds (configurable via `WEBHOOK_SIGNATURE_TOLERANCE_SECONDS`). Requests outside the window are rejected.

**Timing-safe comparison:** All signature checks use `crypto.timingSafeEqual()` to prevent timing attacks.

```typescript
export function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
```

**Why this matters:** A naive `a === b` comparison leaks timing information. Attackers can guess signatures byte-by-byte by measuring response times. `timingSafeEqual` runs in constant time regardless of where the first differing byte is.

**Signature secret is encrypted at rest** (v1.3+). Ingress decrypts `workflow.sourceConfig.secret` per request using the master keyring and tenant ID. If the DB leaks, secret is not immediately usable — see [Credential Encryption at Rest](#credential-encryption-at-rest).

---

### Cron triggers — shared secret

**Header:** `X-Cron-Secret`

**Secret size:** 32 random bytes, hex-encoded → 64 character string

**Generation:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Verification:** `timingSafeEqual` against `process.env.CRON_SECRET`.

**Why shared secret, not OAuth:** The cron caller is a trusted operator (you, setting up cron-job.org or Upstash QStash). No need for multi-tenant auth. A shared secret is sufficient and simpler.

**Risk:** If the secret leaks, an attacker can trigger `/internal/process` and `/internal/deliver` repeatedly, causing quota exhaustion. **Mitigation:** Rotate the secret (update both API and Workers env vars, redeploy). **Not mitigated:** Rate limiting on `/internal/*` endpoints — there isn't any (cron shouldn't be rate-limited).

---

## Authorization (Multi-Tenancy)

Every request to `/api/*` is scoped to the authenticated user's `tenantId`. This is enforced at **four layers**:

### Layer 1 — Token payload

- **JWT:** `tenantId` in the payload. `JwtAuthGuard` injects the payload as `req.user`.
- **API Key:** `tenantId` looked up from the `api_keys` row during verify. `JwtOrApiKeyGuard` sets `req.user = { sub, tenantId, scopes }`.

### Layer 2 — Route handlers

Every controller method uses `@CurrentUser()` and passes `user.tenantId` to the service layer:

```typescript
@Get()
list(@CurrentUser() user: JwtUser) {
  return this.workflows.list(user.tenantId);  // ← scoped
}
```

### Layer 3 — Database queries

Every query filters by `tenantId`:

```typescript
async list(tenantId: string) {
  return this.prisma.workflow.findMany({
    where: { tenantId },  // ← always filtered
    orderBy: { createdAt: 'desc' },
  });
}
```

### Layer 4 — Resource ownership checks

For `GET /workflows/:id`, the query includes `tenantId` in the `where`:

```typescript
async get(tenantId: string, id: string) {
  const workflow = await this.prisma.workflow.findFirst({
    where: { id, tenantId },  // ← both must match
  });
  if (!workflow) throw new NotFoundException('Workflow not found');
  return workflow;
}
```

**Result:** A Tenant A user cannot read, update, or delete any Tenant B resource — even if they somehow know the UUID. This applies equally to JWT sessions and API keys.

**Why "not found" not "forbidden":** Returning `403 Forbidden` confirms the resource exists but is protected. Returning `404 Not Found` is ambiguous — attackers can't enumerate resource IDs.

---

## Webhook Signature Verification

Signature verification happens **before** any other middleware runs. If the signature is invalid, the request is rejected with `401` and no further processing occurs.

### Chain order (Express)

```typescript
webhookRouter.post(
  '/:tenantId/:workflowId',
  resolveWorkflow,       // 1. Load workflow config from DB (decrypt secret)
  enforceSignature,      // 2. Verify HMAC — reject if invalid
  enforceIdempotency,    // 3. Check for duplicate (SET NX)
  enforceRateLimit,      // 4. Check rate limit
  handleWebhook,         // 5. Push to queue, return 202
);
```

**Critical:** `enforceSignature` runs **before** `enforceIdempotency`. If it ran after, an attacker could exhaust the idempotency cache by sending garbage signatures.

**Critical:** `resolveWorkflow` runs first because the signature secret comes from the workflow's `sourceConfig.secret` — which is now **decrypted on the fly** with the per-tenant key (see [Credential Encryption at Rest](#credential-encryption-at-rest)). Without the workflow, no secret to verify against.

### Secret validation

The decrypted `sourceConfig.secret` must be a non-empty string. If missing:

```typescript
if (typeof secret !== 'string' || secret.length === 0) {
  throw new SignatureError(
    `Workflow is missing signing secret for source '${opts.sourceType}'`
  );
}
```

**Result:** A workflow with no secret rejects **all** webhooks. **Design choice:** Fail-closed (reject) rather than fail-open (accept).

### Replay attack prevention

- **Timestamp check** (Stripe, Slack): Reject if `|now - timestamp| > tolerance`
- **Idempotency key** (all): Reject if the same event ID was seen in the last 24h
- **Body hash fallback**: If no event ID provided, hash the body and dedupe on that

**Limitation:** Stripe and Slack include timestamps. GitHub, Shopify, and Generic **do not**. For those sources, replay prevention relies **entirely** on the idempotency key.

---

## Rate Limiting

Rate limits are per-workflow, per-minute. Implemented via Redis `INCR` + `EXPIRE`.

### Limits

| Endpoint group | Limit |
|---|---|
| `/webhook/:tenantId/:workflowId` | 300 req/min per workflow |
| `/api/auth/*` | 10 req/min per IP |
| `/api/*` (authenticated) | 60 req/min per user/API key |
| `/internal/*` | **Unlimited** (protected by cron secret) |

### Implementation

```typescript
const windowBucket = Math.floor(Date.now() / 1000 / 60);  // 1-min window
const key = `ratelimit:${workflowId}:${windowBucket}`;

const count = await redis.incr(key);
if (count === 1) {
  await redis.expire(key, 120);  // 60s window + 60s grace
}

if (count > 300) {
  throw new RateLimitError('Rate limit exceeded');
}
```

### Why `INCR` is atomic

Redis `INCR` is single-threaded and atomic. Even under concurrent load, exactly one request gets `count === 1` and sets the TTL. All others just increment. **No race condition.**

### Grace period

The TTL is 120s (not 60s) because:
- Requests arrive throughout the minute
- The counter must survive until the bucket rolls over
- A shorter TTL could reset the counter mid-window, allowing 2x the limit

### Response headers

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1700000060
Retry-After: 45
```

**Why headers:** Well-behaved clients respect rate limits if they can read them. Stripe's own API does this. Relayon matches the convention.

---

## Credential Encryption at Rest

**This is the biggest security upgrade from v1.0.** In v1.0, `sourceConfig.secret` and `destination.config` were **plaintext JSONB in PostgreSQL** — a DB dump would leak every webhook signing secret and destination credential. Starting in **v1.3**, they are encrypted at rest with AES-256-GCM, using **per-tenant derived keys**. In **v1.4**, key rotation was added. In **v1.5**, full-config encryption became an optional toggle.

### Envelope format

**v1.4+ (current):**

```
enc:v2:<kid>:<base64url-iv>:<base64url-authTag>:<base64url-ciphertext>
```

- `enc:v2:` — format marker (v2 = keyring format, includes kid)
- `<kid>` — key ID from `CONNECTOR_ENCRYPTION_KEYS` (e.g., `key-2026-10`)
- `<base64url-iv>` — 12 random bytes (AES-GCM standard nonce size)
- `<base64url-authTag>` — GCM authentication tag (16 bytes)
- `<base64url-ciphertext>` — the encrypted plaintext

**v1.3 legacy (still decrypted for backward compat):**

```
enc:v1:<base64url-iv>:<base64url-authTag>:<base64url-ciphertext>
```

v1 envelopes have **no kid** — decrypt tries every key in the ring. v2 envelopes are the target format; old data is re-encrypted to v2 via the rotation script.

### Algorithm choice: AES-256-GCM

**Why GCM, not CBC:**

- **Authenticated encryption** — GCM produces an auth tag that detects tampering. If someone modifies the ciphertext in the DB, decryption throws. CBC alone does not detect tampering (you'd need HMAC in addition).
- **No padding oracle attacks** — GCM doesn't use padding, so no padding oracle class of bugs.
- **Faster than CBC + HMAC** — single pass.

**Why not libsodium / XChaCha20-Poly1305:**

- AES-256-GCM is available in Node's `crypto` module with zero dependencies
- NIST-approved and FIPS-compatible (relevant for future SOC 2)
- Node's `hkdfSync` + `createCipheriv` cover everything we need

### Per-tenant key derivation (HKDF)

**Each tenant gets a different derived key**, even though they share the same master keyring:

```typescript
function deriveTenantKey(masterKey: Buffer, tenantId: string): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      masterKey,
      Buffer.from(tenantId, 'utf8'),        // salt
      Buffer.from('relayon:connector:v1', 'utf8'), // info
      32,
    ),
  );
}
```

**Why this matters:**

- If an attacker compromises **one** tenant's derived key (e.g., via a hypothetical side channel), they **cannot** decrypt another tenant's ciphertext — the derived keys are cryptographically unrelated.
- The salt (`tenantId`) is public, but that's fine — HKDF's security depends on the **secrecy of the IKM** (master key), not the salt. The salt's purpose is **domain separation** between tenants.
- Same master key + same tenant ID = same derived key (deterministic). This means **no per-tenant key storage** — the key is derived on demand.

### Field scope — what's encrypted

**By default (v1.3+):** Only keys in `SECRET_CONFIG_KEYS` are encrypted. Non-secret fields stay plaintext so the dashboard can render summaries without decrypting.

**`SECRET_CONFIG_KEYS`:**

```typescript
new Set([
  'secret', 'apiKey', 'api_key', 'privateKey', 'private_key',
  'token', 'password', 'webhookUrl', 'webhook_url',
  'connectionString', 'connection_string',
  'mongoUri', 'mongo_uri', 'postgresUrl', 'postgres_url',
])
```

**Full encryption mode (v1.5+):** Setting `FULL_CONFIG_ENCRYPTION=true` on the API switches to `encryptConfigAll()`, which encrypts **every string value** except those in `METADATA_CONFIG_KEYS` (structural metadata needed for routing decisions and UI rendering).

**`METADATA_CONFIG_KEYS`:**

```typescript
new Set([
  'url', 'method', 'table', 'database', 'collection', 'baseId', 'tableName',
  'dataSourceId', 'titleProperty', 'spreadsheetId', 'range', 'to', 'from',
  'subject', 'username', 'onConflict', 'upsertKey', 'ssl', 'typecast',
  'notionVersion', 'environment',
])
```

**When to use full encryption:** Tenants with strict "no plaintext credentials anywhere" requirements (SOC 2 evidence, HIPAA-adjacent). Default mode is fine for most cases because non-secret fields (`url`, `table`) are visible in the dashboard and their exposure has low impact.

### Client redaction (never leaks ciphertext)

**Every API response** returns `config` with secret fields replaced by a fixed mask (`••••••••`). The client never sees ciphertext.

```typescript
export function redactConfig(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (SECRET_CONFIG_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
      out[key] = '••••••••';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactConfig(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}
```

**Round-trip preservation:** If a client `PATCH`es a destination and sends `"apiKey": "••••••••"` back, the service detects the mask and **preserves the existing ciphertext** — the user didn't have to re-enter the secret. This makes the dashboard edit flow friction-free.

### Key rotation (v1.4+)

**The problem:** Once you have data encrypted with `key-2026-01` and you want to rotate to `key-2026-10`, how do you do it without downtime?

**The solution:** Multi-key keyring + kid in the envelope.

**Env var (v1.4+):**

```env
CONNECTOR_ENCRYPTION_KEYS=key-2026-10:<64hex>,key-2026-01:<64hex>
```

- **First key** = current (used for new encryptions)
- **All keys** = available for decryption (matched by kid)
- **Legacy fallback:** If only `CONNECTOR_ENCRYPTION_KEY` (singular, v1.3 format) is set, it's treated as a single-entry keyring with kid `v1-legacy` — old data still decrypts, new data uses `enc:v2:v1-legacy:...`

**Rotation procedure:**

1. Generate a new key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Prepend to `CONNECTOR_ENCRYPTION_KEYS` in **both** API and Workers env: `new-key:<hex>,old-key:<hex>`
3. Redeploy both services (they now encrypt with the new key, decrypt with either)
4. Run the rotation script: `node scripts/rotate-encryption-key.mjs` — iterates all workflows and destinations, decrypts with any matching key, re-encrypts with the **current** key
5. Verify no `Unknown kid` errors in worker logs for 24h
6. Remove the old key from the env var and redeploy

**Why zero-downtime:** During the grace window (steps 2-4), both old and new keys are in the ring. Existing `enc:v2:old-key:...` envelopes still decrypt correctly. New writes use `enc:v2:new-key:...`. There is **no window** during which decryption fails.

**What the rotation script does:**

```javascript
// For each encrypted field:
//   1. Read envelope → extract kid
//   2. Look up kid in keyring → derive tenant key → decrypt
//   3. Re-encrypt with current key
//   4. UPDATE row
// Idempotent — running twice on a rotated row is a no-op
```

### What encryption protects against (and what it doesn't)

**Protects against:**

- **DB dump leaks** — a `pg_dump` of production contains only ciphertext, not usable credentials
- **Stolen backups** — same
- **Insider with read-only DB access** — can't decrypt without the master keyring (which is only in Vercel env vars)

**Does NOT protect against:**

- **Compromised API or Workers process** — the master keyring is in process memory. Any code execution vulnerability that lets an attacker read process.env or read memory gets all keys. **Mitigation:** never `eval()`, never `Function()`, whitelist-based input validation.
- **Malicious server operator** — if you control the deployment, you control the keys. This is by design — it's your platform.
- **End-to-end encryption** — this is **encryption at rest**, not E2E. The server sees plaintext during delivery (it has to, to call Slack/MongoDB/etc).
- **Traffic interception** — the plaintext travels over TLS to the destination; TLS is the protection there, not this layer.

**Honest summary:** This encrypts the "at rest" layer, which was the biggest gap in v1.0. It does not make the platform immune to server compromise, and it is not E2E encryption.

---

## Dry-Run Safety

**v1.5 introduced a critical safety guarantee: validation never writes to the destination.**

### The problem

The dashboard has a "Test connection" button on every destination modal. Naively, this would call the destination's adapter with a sample payload to check connectivity — but that would mean:

- Testing a Slack destination → sends a **real message** to the channel
- Testing an email destination → sends a **real email**
- Testing a MongoDB destination → inserts a **real document**
- Testing a Google Sheets destination → appends a **real row**

This is a data-leak / write-amplification bug that happens in real products. It must never happen here.

### The solution: `__dryRun` flag in every adapter

When the validation endpoint calls workers `/internal/egress/dry-run`, the adapter is invoked with `config.__dryRun = true`. **Every adapter checks this flag** and uses a safe probe instead of the real write:

| Adapter | Dry-run probe | Writes? |
|---|---|---|
| `http` | `HEAD` request (no body) | No |
| `slack` | URL format check only | No |
| `discord` | URL format check only | No |
| `email` | `GET /api-keys` (Resend auth check) | No |
| `sheets` | `GET spreadsheet metadata` | No |
| `airtable` | `GET base tables` | No |
| `notion` | `GET data source` | No |
| `postgres` | `SELECT 1` | No |
| `mongodb` | `ping` command | No |

**Slack and Discord cannot be probed without sending a message.** For those, the dry-run validates URL format only and returns a truthful message: *"config valid — cannot be tested without sending a message."* This is the safest possible check — no message is sent, ever.

### What this means for users

- **Click "Test connection" as many times as you want** — no side effects on the destination
- **Validation is fast** (5s timeout per probe)
- **The green checkmark means the config is syntactically valid and (for most adapters) the credentials reach the destination** — not that a real delivery would succeed
- **The endpoint is tenant-scoped and auth-guarded** — an attacker can't use it to probe internal services (SSRF mitigated by 5s timeout + no response body returned to client)

### What dry-run does NOT do

- **Does not test the actual delivery payload** — that's what the workflow itself does when a real event flows through
- **Does not test Slack/Discord delivery** — impossible without sending a message
- **Does not detect "wrong channel but valid webhook"** — a Slack webhook pointing to a misconfigured channel will still show green; the check only verifies the webhook URL is well-formed and reachable

---

## Secrets Management

Relayon's secrets fall into **four** categories:

### 1. Infrastructure secrets (env vars only)

- `DATABASE_URL` (Neon)
- `MONGODB_URI` (Atlas)
- `UPSTASH_REDIS_TCP_URL` (Upstash)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (own secret)
- `CRON_SECRET`
- `GROQ_API_KEY`
- `IP_HASH_SALT`
- **`CONNECTOR_ENCRYPTION_KEYS` (v1.4+) or `CONNECTOR_ENCRYPTION_KEY` (v1.3)** — the credential encryption master keyring
- `API_KEY_PEPPER` (v1.2+) — the API key hash pepper
- `SENTRY_DSN` (optional)

**Storage:** Vercel Environment Variables (encrypted at rest, AES-256).

**Access:** Only the service that needs it.

- `GROQ_API_KEY` — only on Workers
- `JWT_SECRET` / `API_KEY_PEPPER` — only on API
- `CONNECTOR_ENCRYPTION_KEYS` — on **both** API (encrypt/redact) and Workers (decrypt for delivery). **Same value on both — mismatched keys = `Credential decryption failed` DLQ entries.**
- `CRON_SECRET` — on Workers (verify) and API (used by run-now to call workers)

**Rotation:**

- Infrastructure secrets — manual, quarterly or on-leak
- `CONNECTOR_ENCRYPTION_KEYS` — zero-downtime via keyring (see [Key Rotation](#key-rotation-v14) above)
- `API_KEY_PEPPER` — **breaking change** if rotated without a plan. Old keys' hashes become invalid. Requires a coordinated migration window. Not automated in v1.5.

### 2. Per-workflow secrets (stored in PostgreSQL `sourceConfig`)

- `sourceConfig.secret` (Stripe/GitHub/Shopify/Slack HMAC secret)
- `sourceConfig.privateKey` (Sheets service account key)

**Storage:** PostgreSQL `workflows.source_config` JSONB.

**Encryption at rest (v1.3+):** The secret is stored as `enc:v2:<kid>:...` — **not plaintext**. See [Credential Encryption at Rest](#credential-encryption-at-rest).

**Access:**

- **Ingress** decrypts `sourceConfig.secret` on every webhook to verify HMAC signature. Requires `CONNECTOR_ENCRYPTION_KEYS`.
- **Workers** decrypts `sourceConfig.privateKey` when delivering to Sheets.

**Client response:** `sourceConfig.secret` is returned as `••••••••` in `GET /api/workflows/:id`. Never ciphertext, never plaintext.

**Gap closed from v1.0:** In v1.0, this was plaintext — a DB dump would leak every webhook signing secret. Now it's encrypted.

### 3. Per-destination secrets (stored in PostgreSQL `destination.config`)

- `config.apiKey` (Resend, Airtable, Notion)
- `config.webhookUrl` (Slack, Discord — the URL **is** the secret)
- `config.privateKey` (Sheets)
- `config.connectionString` (PostgreSQL, MongoDB)
- `config.headers` (HTTP destination's custom headers, if they contain auth)

**Storage:** PostgreSQL `destinations.config` JSONB.

**Encryption at rest (v1.3+):** All keys in `SECRET_CONFIG_KEYS` are stored as `enc:v2:<kid>:...`. With `FULL_CONFIG_ENCRYPTION=true`, **all** non-metadata fields are encrypted.

**Access:** Workers decrypts before calling the adapter. Decryption failure → delivery moves to DLQ with `credential_decryption_error` — **never retried with plaintext, never sent to the destination in malformed form.**

**Client response:** `config` fields matching `SECRET_CONFIG_KEYS` are returned as `••••••••`. Never ciphertext, never plaintext.

**Gap closed from v1.0:** Same as above.

### 4. Client-side secrets (user's browser)

- `accessToken` (JWT) — in memory only, never `localStorage`
- `refreshToken` — in `httpOnly` cookie, `SameSite=Strict`, `Secure`

**Why not `localStorage` for access token:** Any XSS on the dashboard page can read `localStorage`. An in-memory token is lost on page refresh (silently re-obtained via refresh token), so an XSS attacker gets the token for at most one tab session — and even then, only until they navigate away.

**Why `httpOnly` for refresh token:** JS can't read it. Combined with `SameSite=Strict`, it's not attached to cross-site requests (CSRF mitigation). Combined with `Secure`, it's only sent over HTTPS.

---

## Input Validation

### Schema validation — Zod (Ingress) + class-validator (API)

**Ingress (`config.ts`):**

```typescript
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  INGRESS_PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: z.string().min(1),
  UPSTASH_REDIS_TCP_URL: z.string().regex(/^rediss?:\/\//),
  IP_HASH_SALT: z.string().min(8),
  WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(300),
});
```

**API (DTOs):**

```typescript
export class CreateWorkflowDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @IsIn(SOURCE_TYPES) sourceType!: SourceTypeValue;
  @IsOptional() @IsObject() sourceConfig?: Record<string, unknown>;
  ...
}
```

**Global ValidationPipe** enforces `whitelist: true` (rejects unknown fields) and `forbidNonWhitelisted: true` (returns 400 on unknown fields).

### Cron expression validation

Cron expressions are user input. The `UpsertScheduleDto` regex is **restrictive on purpose**:

```typescript
@Matches(/^[\d*,\-/ ]+$/, {
  message: 'cronExpression may only contain digits, *, ,, -, / and spaces',
})
```

**This blocks named days/months** (`MON`, `JAN`, `MON-FRI`). The `cron-parser` package supports them, but allowing them means allowing a much larger attack surface in the parser. Restricting to numbers + operators keeps the surface small — verified against the `cron-parser@4.9.0` API.

**Invalid cron at save time** → `400 Bad Request` from `parser.parseExpression()`. **Invalid cron at tick time** (edge case — should not happen) → schedule is deactivated with `isActive: false` and logged. **Never** does an invalid cron result in a crash loop.

### Payload size limit

**Ingress:** 5 MB hard limit (Express `express.json({ limit: '5mb' })`). Requests over limit are rejected with `413`.

**API:** 1 MB implicit (Express default). No relayon routes need larger.

**Workers `/internal/egress/dry-run`:** Rejects `config` payloads over **100 KB** — dry-run is for validation, not for bulk payload testing.

### JSONata sandbox

Workflow authors can write JSONata transform expressions. JSONata is **not Turing-complete** — no user-defined functions, no loops, no I/O. Runaway expressions are unlikely.

**Timeout:** 2 seconds. Even so, a malicious expression can't exfiltrate data — JSONata only transforms the input object it's given.

### No `eval()` anywhere

Relayon uses **zero** `eval()`, `Function()`, or `vm` sandboxing. The transform engine is JSONata (safe by design), and the AI enrichment uses the Groq SDK (no code execution).

**Verified by:** `grep -rn "eval(\|new Function\|require('vm')" apps/` returns zero matches.

---

## Audit Logging

Every privileged action is logged with:

- Actor (user ID, email, API key ID, or `system`)
- Action (`workflow.create`, `dlq.replay`, `api-key.rotate`, etc.)
- Target (resource ID)
- Before/after state (for updates)
- IP hash (not raw IP)
- Timestamp

**Current implementation (v1.5):** API actions are logged to console (JSON structured). Sentry captures unhandled errors. Workers log lifecycle events (event received, enriched, delivered, DLQ'd) with correlation IDs.

**Not implemented:** Persistent audit table in PostgreSQL. **Planned for v2.0** — audit log UI in dashboard with filter/search.

**Why this is acceptable for v1.5:** Vercel captures stdout/stderr logs for **up to 30 days** on Hobby. For a free-tier project, that's enough to investigate incidents. For paid tier, add persistent audit log. This is an honest limitation, not an oversight.

---

## What Relayon Does NOT Do

Honesty is part of security. Here's what's **not** covered, even in v1.5:

### Still not covered

- **End-to-end encryption of webhook payloads** — payloads travel plaintext over TLS and are stored plaintext in MongoDB (30-day TTL). The encryption covers **credentials**, not event data.
- **IP allowlisting** — any IP can call any endpoint (rate limits apply).
- **MFA/TOTP** — login is password-only. No second factor.
- **Session management UI** — users can't see/revoke their own sessions (though rotation + logout work).
- **Persistent audit log** — console logs + Sentry only, no DB table, no UI.
- **SOC 2 / HIPAA / GDPR compliance** — no formal certification. DPA available on request.
- **Automated `API_KEY_PEPPER` rotation** — manual only, breaking change if done wrong.
- **CSRF tokens** — mitigated via `SameSite=Strict` cookies, but no explicit token.
- **Per-tenant DB key isolation at rest** — all tenants' ciphertext is in the same table. Isolation is at the **crypto layer** (HKDF-derived keys), not the storage layer. A DB dump is useless without the master key, but the layout itself isn't per-tenant-partitioned.

### Now covered (previously gaps in v1.0)

- ✅ **Destination credentials encrypted at rest** — AES-256-GCM, per-tenant HKDF keys (v1.3+)
- ✅ **Zero-downtime key rotation** — multi-key keyring, `enc:v2:<kid>:` format (v1.4+)
- ✅ **Optional full-config encryption** — `FULL_CONFIG_ENCRYPTION=true` (v1.5+)
- ✅ **Client never receives ciphertext** — `redactConfig()` on every response (v1.3+)
- ✅ **API keys with scoped auth** — SHA-256+pepper, show-once UX, rotation with grace window (v1.2-v1.5)
- ✅ **Dry-run never writes** — every adapter honors `__dryRun`, safe probes only (v1.5+)

### Mitigations in place

- **Compromised env var (e.g., `GROQ_API_KEY`):** Rotate via Groq console, update Vercel env, redeploy.
- **Compromised `CONNECTOR_ENCRYPTION_KEYS`:** Rotate the keyring (generate new, prepend to env, run rotation script, remove old). If the leak is **active** (attacker has the current key), you can't hide it retroactively — **regenerate all credentials** at the destination (Slack, Resend, etc.) after rotation.
- **Compromised destination secret (e.g., Slack webhook):** Delete destination via dashboard, recreate with new webhook URL.
- **Compromised workflow signing secret:** Update via dashboard (`PATCH /workflows/:id`). Old signature fails immediately — next webhook from the source with old secret gets `401`.
- **Compromised API key:** `DELETE /api/api-keys/:id` — immediate 401 on next request.
- **Compromised user password:** Password reset flow (planned for v2.0; currently admin-managed).

---

## Reporting Vulnerabilities

**Do not open a public issue for security bugs.**

Email: **[zainshahzs110@gmail.com](mailto:zainshahzs110@gmail.com)**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

**Response time:** 48 hours acknowledgment, 7 days fix for critical issues.

### In scope

- Authentication/authorization bypasses (JWT, API key, HMAC, cron secret)
- SQL injection, NoSQL injection
- XSS, CSRF
- Signature bypass in webhook verification
- **Secret leakage via API responses** (ciphertext, plaintext, or mask bypass)
- Rate limit bypasses
- SSRF via destination URLs or the validation endpoint
- **Encryption weaknesses** (envelope forgery, HKDF misuse, kid confusion)
- **Dry-run side effects** (any write that happens during validation)
- **Key rotation failures** (envelopes that become undecryptable, wrong-kid reuse)
- **Timing attacks** on any `timingSafeEqual` comparison

### Out of scope

- Rate limit bypass via distributed IPs (a botnet can bypass any rate limit)
- DoS via legitimate high traffic
- Social engineering
- Self-XSS
- Issues requiring physical access
- Attacks requiring a compromised `CRON_SECRET` or `CONNECTOR_ENCRYPTION_KEYS` (that's a full compromise)
- **The fact that `enc:v2` ciphertext is visible in the DB to someone with DB access** — that's the design (encryption at rest, not end-to-end)
- **The fact that the server sees plaintext during delivery** — that's the design (server has to, to call the destination)

---

## Conclusion

Relayon's security is **layered, honest, and improvable**. Every defense is documented. Every gap is acknowledged. The system assumes breach at each layer and provides multiple independent controls.

**What changed from v1.0:** The biggest security gap — plaintext credentials in PostgreSQL — is **closed**. Credentials are now encrypted at rest with AES-256-GCM and per-tenant HKDF keys, with zero-downtime rotation and an optional full-config mode. API keys were added with scoped auth. Dry-run was built to never write. Everything else is unchanged and still honest.

For a free-tier open-source project, this is what "production-grade security" looks like — not because it's flawless, but because **you can read exactly what it does and doesn't protect against.**

For questions, open an issue at [github.com/zainshah3464/relayon](https://github.com/zainshah3464/relayon).
```

---