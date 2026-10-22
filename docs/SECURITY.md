
# Relayon — Security

> **Threat model, auth flow, and defense-in-depth for a multi-tenant webhook platform.**

Security in Relayon is layered. No single control is trusted to prevent all attacks. Each layer assumes the one above it might fail.

---

## Table of Contents

- [Threat Model](#threat-model)
- [Authentication](#authentication)
- [Authorization (Multi-Tenancy)](#authorization-multi-tenancy)
- [Webhook Signature Verification](#webhook-signature-verification)
- [Rate Limiting](#rate-limiting)
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
2. **Secret leakage** — Database URLs, JWT secrets, Groq API keys, destination credentials
3. **Availability** — Prevent DoS through rate limits and circuit breakers
4. **Correctness** — Prevent duplicate deliveries, lost events, financial double-charges

### Trust boundaries

```
Untrusted zone (public internet)
    │
    ├── Webhook sources (Stripe, GitHub, Shopify, Slack)
    │       │ Verified via HMAC
    │       ▼
    ├── Dashboard users (browser)
    │       │ Verified via JWT
    │       ▼
    ├── Cron triggers (GitHub Actions, cron-job.org)
    │       │ Verified via X-Cron-Secret
    │       ▼
    └── Trusted zone (Relayon services)
            ├── Ingress → Redis → Workers
            ├── Workers → PostgreSQL, MongoDB, Redis
            └── API → PostgreSQL, MongoDB
```

**No cross-boundary trust.** A compromised Ingress cannot access destination credentials (only Workers reads those). A compromised API cannot push to queues (only Ingress and Workers do).

---

## Authentication

### Dashboard users — JWT

**Algorithm:** HMAC-SHA256 (`HS256`)

**Access token:**
- Expiry: 15 minutes
- Payload: `{ sub, email, role, tenantId, iat, exp }`
- Verified on every `/api/*` request via `JwtAuthGuard`

**Refresh token:**
- Expiry: 7 days
- **Opaque** — random 48-byte string, not a JWT
- Stored as `SHA-256(token)` in PostgreSQL
- **Rotation on every use** — old token revoked, new one issued

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

---

### Cron triggers — shared secret

**Header:** `X-Cron-Secret`

**Secret size:** 32 random bytes, base64-encoded → ~64 character string

**Generation:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Verification:** `timingSafeEqual` against `process.env.CRON_SECRET`.

**Why shared secret, not OAuth:** The cron caller is a trusted operator (you, setting up GitHub Actions). No need for multi-tenant auth. A shared secret is sufficient and simpler.

**Risk:** If the secret leaks, an attacker can trigger `/internal/process` repeatedly, causing quota exhaustion. **Mitigation:** Rotate the secret if leaked. **Not mitigated:** Rate limiting on `/internal/*` endpoints — there isn't any (cron shouldn't be rate-limited).

---

## Authorization (Multi-Tenancy)

Every request to `/api/*` is scoped to the authenticated user's `tenantId`. This is enforced at **three layers**:

### Layer 1 — JWT payload

The JWT includes `tenantId`. `JwtAuthGuard` injects the payload as `req.user`.

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

**Result:** A Tenant A user cannot read, update, or delete any Tenant B resource — even if they somehow know the UUID.

**Why "not found" not "forbidden":** Returning `403 Forbidden` confirms the resource exists but is protected. Returning `404 Not Found` is ambiguous — attackers can't enumerate resource IDs.

---

## Webhook Signature Verification

Signature verification happens **before** any other middleware runs. If the signature is invalid, the request is rejected with `401` and no further processing occurs.

### Chain order (Express)

```typescript
webhookRouter.post(
  '/:tenantId/:workflowId',
  resolveWorkflow,       // 1. Load workflow config from DB
  enforceSignature,      // 2. Verify HMAC — reject if invalid
  enforceIdempotency,    // 3. Check for duplicate (SET NX)
  enforceRateLimit,      // 4. Check rate limit
  handleWebhook,         // 5. Push to queue, return 202
);
```

**Critical:** `enforceSignature` runs **before** `enforceIdempotency`. If it ran after, an attacker could exhaust the idempotency cache by sending garbage signatures.

**Critical:** `resolveWorkflow` runs first because the signature secret comes from the workflow's `sourceConfig.secret`. Without the workflow, no secret to verify against.

### Secret validation

The `sourceConfig.secret` must be a non-empty string. If missing:

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
| `/api/*` (authenticated) | 60 req/min per user |
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

## Secrets Management

Relayon's secrets fall into three categories:

### 1. Infrastructure secrets (env vars only)

- `DATABASE_URL` (Neon)
- `MONGODB_URI` (Atlas)
- `UPSTASH_REDIS_TCP_URL` (Upstash)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (own secret)
- `CRON_SECRET`
- `GROQ_API_KEY`
- `IP_HASH_SALT`
- `SENTRY_DSN` (optional)

**Storage:** Vercel Environment Variables (encrypted at rest, AES-256).
**Access:** Only the service that needs it. `GROQ_API_KEY` is only on Workers. `JWT_SECRET` is only on API.
**Rotation:** Manual. Rotate quarterly, or immediately if leaked.

### 2. Per-workflow secrets (stored in PostgreSQL `sourceConfig`)

- `sourceConfig.secret` (Stripe/GitHub/Shopify/Slack HMAC secret)
- `sourceConfig.privateKey` (Sheets service account key)

**Storage:** PostgreSQL `workflows.source_config` JSONB.
**Encryption at rest:** Neon encrypts the underlying disk. But the column itself is **plaintext** — any DB read gets the secret.
**Access:** Ingress reads `sourceConfig.secret` to verify signatures. Workers reads `sourceConfig.privateKey` for Sheets.

**Risk:** A database breach leaks all workflow secrets. **Mitigation (future):** Encrypt `sourceConfig` at the application layer with a per-tenant key derived from `JWT_SECRET`. Not implemented in v1.0.

### 3. Per-destination secrets (stored in PostgreSQL `destination.config`)

- `config.apiKey` (Resend)
- `config.webhookUrl` (Slack — the URL **is** the secret)
- `config.privateKey` (Sheets)
- `config.headers` (HTTP destination's custom headers)

**Storage:** PostgreSQL `destinations.config` JSONB.
**Access:** Workers reads this when delivering.

**Risk:** Same as per-workflow secrets — plaintext at rest. **Not mitigated in v1.0.**

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

### Payload size limit

**Ingress:** 5 MB hard limit (Express `express.json({ limit: '5mb' })`). Requests over limit are rejected with `413`.

**API:** 1 MB implicit (Express default). No relayon routes need larger.

### JSONata sandbox

Workflow authors can write JSONata transform expressions. JSONata is **not Turing-complete** — no user-defined functions, no loops, no I/O. Runaway expressions are unlikely.

**Timeout:** 2 seconds. Even so, a malicious expression can't exfiltrate data — JSONata only transforms the input object it's given.

### No `eval()` anywhere

Relayon uses **zero** `eval()`, `Function()`, or `vm` sandboxing. The transform engine is JSONata (safe by design), and the AI enrichment uses the Groq SDK (no code execution).

---

## Audit Logging

Every privileged action is logged with:

- Actor (user ID, email, or `system`)
- Action (`workflow.create`, `dlq.replay`, etc.)
- Target (resource ID)
- Before/after state (for updates)
- IP hash (not raw IP)
- Timestamp

**Current implementation:** API actions are logged to console (JSON structured). Sentry captures errors.

**Not implemented:** Persistent audit table in PostgreSQL. **Planned for v1.1** — audit log UI in dashboard.

**Why this is acceptable for v1.0:** Vercel captures stdout/stderr logs for 30 days. For a free-tier MVP, that's enough to investigate incidents. For paid tier, add persistent audit log.

---

## What Relayon Does NOT Do

Honesty is part of security. Here's what's **not** covered:

### Not covered

- **Encryption of `sourceConfig`/`destination.config` at application layer** — plaintext at rest in PostgreSQL. Anyone with DB access sees secrets.
- **End-to-end encryption of webhook payloads** — payloads are stored plaintext in MongoDB.
- **IP allowlisting** — any IP can call any endpoint (rate limits apply).
- **MFA/TOTP** — login is password-only. No second factor.
- **Session management UI** — users can't see/revoke their own sessions (though rotation + logout work).
- **Persistent audit log** — only console logs, no UI.
- **SOC 2 / HIPAA / GDPR compliance** — no formal certification. DPA available on request.
- **Secret rotation automation** — all rotation is manual.
- **CSRF tokens** — mitigated via `SameSite=Strict` cookies, but no explicit token.

### Mitigations in place

- **Compromised env var (e.g., `GROQ_API_KEY`):** Rotate via Groq console, update Vercel env, redeploy.
- **Compromised destination secret (e.g., Slack webhook):** Delete destination via dashboard, recreate with new webhook URL.
- **Compromised workflow secret:** Update via dashboard (PATCH `/workflows/:id`), old signature fails immediately.
- **Compromised user password:** Change via profile (planned for v1.1; currently admin-reset).

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

- Authentication/authorization bypasses
- SQL injection, NoSQL injection
- XSS, CSRF
- Signature bypass in webhook verification
- Secret leakage via API responses
- Rate limit bypasses
- SSRF via destination URLs

### Out of scope

- Rate limit bypass via distributed IPs (a botnet can bypass any rate limit)
- DoS via legitimate high traffic
- Social engineering
- Self-XSS
- Issues requiring physical access
- Attacks requiring a compromised `CRON_SECRET` (that's a full compromise)

---

## Conclusion

Relayon's security is **layered, honest, and improvable**. Every defense is documented. Every gap is acknowledged. The system assumes breach at each layer and provides multiple independent controls.

For a free-tier open-source project, this is what "production-grade security" looks like — not because it's flawless, but because **you can read exactly what it does and doesn't protect against.**

For questions, open an issue at [github.com/zainshah3464/relayon](https://github.com/zainshah3464/relayon).
```

---