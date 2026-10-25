# Relayon — Architecture

> **Deep dive into the system design, data flow, and engineering decisions behind Relayon.**
>
> **Current version:** v1.5.0

This document explains *why* Relayon is built the way it is — not just what it does. It's written for engineers who want to understand the system's tradeoffs before evaluating or contributing to it.

---

## Table of Contents

- [System Overview](#system-overview)
- [The 4 Apps](#the-4-apps)
- [End-to-End Data Flow](#end-to-end-data-flow)
- [Event Lifecycle](#event-lifecycle)
- [Destinations & Adapters](#destinations--adapters)
- [Scheduled Workflows](#scheduled-workflows)
- [Workflow Versioning](#workflow-versioning)
- [Credential Encryption](#credential-encryption)
- [API Keys & Rotation](#api-keys--rotation)
- [Key Design Decisions](#key-design-decisions)
- [Reliability Guarantees](#reliability-guarantees)
- [Failure Modes & Recovery](#failure-modes--recovery)
- [Serverless Constraints as Architecture](#serverless-constraints-as-architecture)
- [Scaling Path](#scaling-path)

---

## System Overview

Relayon is a **serverless-native integration platform** that sits between webhook sources (Stripe, GitHub, Shopify, Slack) and destinations (HTTP, Slack, Email, Google Sheets, Discord, Airtable, Notion, PostgreSQL, MongoDB).

**Core promise:** *Receive events reliably → enrich with AI → transform → route to N destinations → never lose an event. Or trigger the same pipeline on a cron.*

The system is split into **4 independently deployable apps** that communicate via **Redis queues** and **PostgreSQL/MongoDB** — no direct HTTP calls between them.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Dashboard   │    │     API      │    │   Ingress    │    │   Workers    │
│  (Angular)   │◄──►│  (NestJS)    │    │  (Express)   │    │  (NestJS)    │
│    :4200     │    │    :3001     │    │    :3002     │    │    :3003     │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │                   │
       └───────────────────┴───────────────────┴───────────────────┘
                                    │
        ┌───────────┬───────────────┼──────────────┬─────────────┐
        ▼           ▼               ▼              ▼             ▼
   PostgreSQL   MongoDB          Redis          Groq        Sentry
   (Neon)      (Atlas M0)      (Upstash)       (AI)       (errors)
```

Each app deploys as a **separate Vercel project** — same GitHub repo, different Root Directory. They share code via `npm workspaces` (`packages/db`, `packages/shared`).

---

## The 4 Apps

### 1. Dashboard (Angular 19)

**Responsibility:** UI for tenants to manage workflows, inspect events, replay DLQ entries, view analytics, edit schedules, browse version history, diff versions, manage API keys, and validate destination configs before saving.

**Why Angular:** Standalone components + signals give React-like reactivity with stronger typing. `HttpClient` interceptors make JWT refresh transparent. Enforced DI prevents prop-drilling across deep component trees.

**Stateless:** No server-side rendering. Pure static SPA served by Vercel's CDN. All API calls go to `relayon-api.vercel.app` and `relayon-ingress.vercel.app`.

**Bundle (v1.5):** ~120 KB initial (compressed), ~340 KB total across lazy-loaded feature chunks. Workflow detail is the largest chunk (~110 KB) due to the schedule card, version drawer, and destination modal.

---

### 2. API (NestJS 11)

**Responsibility:** The **control plane**. Everything the dashboard reads/writes goes through here.

- Auth (signup, login, refresh, logout, me)
- Tenants (multi-tenant config)
- Workflows (CRUD + YAML export/import + version history + diff + restore)
- Destinations (CRUD + validation + dry-run)
- Events (read-only, MongoDB-backed)
- DLQ (read + single replay + **bulk replay/discard**)
- Analytics (overview + delivery + cost + time-series)
- **API keys (create + list + revoke + rotate)**
- **Schedules (upsert + delete + run-now + bulk pause/resume)**

**Why NestJS:** Decorator-driven DI gives clean module boundaries. Global pipes (validation), guards (JWT or API key), and filters (Sentry) apply uniformly. `JwtOrApiKeyGuard` enforces tenant isolation on every route while supporting both session auth and programmatic API access.

**Data stores:** PostgreSQL (via Prisma) for transactional data; MongoDB (via Mongoose) for read-only access to events/deliveries written by Workers.

---

### 3. Ingress (Express 5)

**Responsibility:** The **data plane's front door**. Receives webhooks from external sources.

**Critical constraint:** Must respond in **<500ms**, even under load. Every millisecond adds latency to the source's retry timer.

**What it does (in order):**
1. Resolves workflow from PostgreSQL (per `:tenantId/:workflowId` in URL)
2. Verifies HMAC signature (Stripe/GitHub/Shopify/Slack/Generic)
3. Checks idempotency (Redis `SET NX EX 86400`)
4. Enforces rate limit (Redis `INCR` per workflow per minute)
5. Pushes to `queue:events:incoming`
6. Returns `202 Accepted`

**What it does NOT do:** No AI, no transforms, no deliveries. Kept minimal so cold starts stay fast (~500ms) and p99 latency stays low.

---

### 4. Workers (NestJS 11)

**Responsibility:** The **data plane's engine**. Consumes from Redis, enriches, transforms, and delivers. Also runs scheduled workflows and handles destination dry-runs.

**Processing loops:**
- `POST /internal/process` — pops from `queue:events:incoming`, runs AI enrichment + JSONata transform, applies conditional routing, writes to MongoDB, fans out to `queue:egress:pending`
- `POST /internal/deliver` — pops from `queue:egress:pending`, calls the destination adapter, retries on failure via `queue:egress:delayed` (ZSET), moves to DLQ on exhaustion
- `POST /internal/schedule/tick` — claims due schedules atomically, enqueues synthetic events
- `POST /internal/schedule/run-now` — manually triggers a schedule (bypasses nextRunAt)
- `POST /internal/egress/dry-run` — runs an adapter against a synthetic payload without writing to the destination

**Why NestJS:** Same DI patterns as API, but Workers has its own `main.ts` that exports a serverless handler for Vercel. Cron secret guards protect `/internal/*` routes.

**Vercel handler pattern:**
```typescript
export default async function handler(req, res) {
  if (!cachedServer) {
    const app = await createApp();
    cachedServer = app.getHttpAdapter().getInstance();
  }
  return cachedServer(req, res);
}
```

**Adapter registry (v1.5):** 9 adapters — HTTP, Slack, Email, Sheets, Discord, Airtable, Notion, PostgreSQL, MongoDB. All auto-discovered via `@DestinationAdapter` decorator.

---

## End-to-End Data Flow

### Happy Path (Webhook)

```
1. Stripe sends POST /webhook/:tenantId/:workflowId
       │
       ▼
2. Ingress verifies signature (HMAC-SHA256, timing-safe)
       │
       ▼
3. Idempotency check: Redis SET NX on body-hash
       │ (new event)
       ▼
4. Rate limit: Redis INCR (max 300/min per workflow)
       │
       ▼
5. LPUSH to queue:events:incoming, return 202
       │
       ▼
6. Workers /internal/process:
       ├─ RPOPLPUSH queue:events:incoming → queue:events:processing
       ├─ Load workflow config (batch: 1 DB query for N events)
       ├─ Groq AI enrichment (optional, cached 1h in Redis)
       ├─ JSONata transform (optional, 2s timeout)
       ├─ Conditional routing rules evaluated (optional)
       ├─ INSERT Event doc into MongoDB
       └─ Fan-out: one Delivery doc + egress job per selected destination
       │
       ▼
7. Workers /internal/deliver:
       ├─ RPOP queue:egress:pending
       ├─ Atomic claim: findOneAndUpdate (status: pending → delivering)
       ├─ Decrypt destination config (per-tenant HKDF key)
       ├─ Call adapter (HTTP/Slack/Email/Sheets/Discord/Airtable/Notion/PG/Mongo)
       ├─ Success → status: delivered
       └─ Failure → ZADD queue:egress:delayed (score = now + backoff)
       │
       ▼
8. Dashboard shows event + delivery in UI
```

### Scheduled Workflow Path (v1.3+)

```
1. External cron hits POST /internal/schedule/tick every 5 min
       │
       ▼
2. Workers /internal/schedule/tick:
       ├─ SELECT schedules WHERE isActive AND nextRunAt <= now LIMIT 25
       ├─ For each due schedule (atomic claim via updateMany):
       │   ├─ Compute nextRunAt from cron-expression (cron-parser)
       │   ├─ UPDATE lastRunAt = now, nextRunAt = future
       │   └─ LPUSH synthetic event into queue:events:incoming
       │       (rawPayload.type = 'relayon.schedule.trigger')
       │
       ▼
3. Same pipeline as webhook — enrichment → transform → routing → delivery
```

**Idempotency:** The atomic `updateMany` with `nextRunAt <= now` predicate ensures only one worker claims a schedule per tick, even if multiple workers run concurrently.

### Manual Run-Now Path (v1.4+)

```
1. User clicks "Run now" in dashboard
       │
       ▼
2. API POST /api/workflows/:id/schedule/run-now
       │
       ▼
3. API forwards to workers POST /internal/schedule/run-now
       │
       ▼
4. Workers:
       ├─ Load schedule
       ├─ Verify workflow is active
       ├─ LPUSH synthetic event with rawPayload.type = 'relayon.schedule.manual'
       └─ Return { correlationId, enqueuedAt }
       │
       ▼
5. API updates lastRunAt (leaves nextRunAt untouched — cron stays scheduled)
       │
       ▼
6. Same pipeline as webhook
```

### Delivery Retry Path

```
Attempt 1 fails (503) → backoff 10s → ZADD queue:egress:delayed
Wait 10s → Cron pulls from delayed ZSET → Attempt 2
Attempt 2 fails → backoff 30s → ...
Attempt 5 fails → status: dlq, dlqReason: "Max retry attempts exhausted"
Dashboard shows DLQ entry → user clicks Replay → status: pending → picked up next cycle
```

### Destination Dry-Run Path (v1.5+)

```
1. User clicks "Test connection" in destination modal
       │
       ▼
2. API POST /api/destinations/validate { type, config, dryRun: true }
       │
       ├─ Schema validation (required fields, shape regex)
       │
       ├─ (if dryRun) forward to workers POST /internal/egress/dry-run
       │       │
       │       ▼
       │   Workers:
       │       ├─ Load adapter by type
       │       ├─ Add __dryRun: true to config
       │       └─ Call adapter.send() with validation payload
       │           ├─ HTTP/Slack/Discord: HEAD request (no body)
       │           ├─ Email: GET /api-keys (auth check, no email)
       │           ├─ Sheets: GET spreadsheet metadata (no row)
       │           ├─ Airtable: GET /meta/bases/:id/tables (no record)
       │           ├─ Notion: GET /v1/data_sources/:id (no page)
       │           ├─ PostgreSQL: SELECT 1 (no INSERT)
       │           └─ MongoDB: ping (no insert)
       │
       ▼
3. API returns { ok, layer, errors, warnings, dryRun: { success, latencyMs, detail } }
```

**Critical safety:** Every adapter honours `__dryRun` so the validate endpoint **never writes real data** during a "test" — no Slack message sent, no email delivered, no row inserted.

---

## Event Lifecycle

Every event moves through an explicit state machine:

```
              ┌──────────┐
   webhook →  │ received │  (logged in MongoDB when process starts)
              └────┬─────┘
                   │
                   ▼
              ┌───────────┐
              │processing │
              └─────┬─────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   ┌─────────┐           ┌────────┐
   │processed│           │ failed │
   └────┬────┘           └────────┘
        │
        ▼
   ┌──────────┐
   │delivering│  (per delivery)
   └────┬─────┘
        │
   ┌────┴────┬─────────┐
   ▼         ▼         ▼
┌─────────┐┌───────┐┌─────┐
│delivered││pending││ dlq │
└─────────┘└───┬───┘└─────┘
               │ (retry)
               ▼
         ┌──────────┐
         │delivering│ (next attempt)
         └──────────┘
```

**Key insight:** Event status and delivery status are **independent**. An event can be `processed` (AI + transform succeeded) but all its deliveries can be in `dlq`. This separation makes debugging straightforward — you know whether the problem is in processing or delivery.

---

## Destinations & Adapters

Relayon supports **9 destination types**, all behind a common `DeliveryAdapter` interface:

| Type | Display Name | Required Config | Idempotency-Key | Dry-Run Probe |
|---|---|---|---|---|
| `http` | HTTP Webhook | `url` | ✅ | HEAD request |
| `slack` | Slack | `webhookUrl` | — | Config validation only¹ |
| `email` | Email (Resend) | `apiKey`, `to`, `from` | — | Auth check (GET /api-keys) |
| `sheets` | Google Sheets | `spreadsheetId`, `range`, `serviceAccountEmail`, `privateKey` | — | Spreadsheet metadata |
| `discord` | Discord | `webhookUrl` | — | Config validation only¹ |
| `airtable` | Airtable | `apiKey`, `baseId`, `tableName` | — | Base tables list |
| `notion` | Notion | `apiKey`, `dataSourceId`, `titleProperty` | — | Data source fetch |
| `postgres` | PostgreSQL | `connectionString`, `table` | — | `SELECT 1` |
| `mongodb` | MongoDB | `connectionString`, `database`, `collection` | — | `ping` |

¹ Slack/Discord webhooks cannot be tested without sending a message. Dry-run validates URL format only — safest possible check.

**Adapter discovery:** Each adapter is registered automatically via `@DestinationAdapter({ type, displayName, configSchema })` decorator. The `AdapterRegistry` uses NestJS `DiscoveryService` at bootstrap to build the map. **Adding a new adapter = 1 new file, zero registry edits.**

**Connection pooling:** PostgreSQL adapter maintains a `pg.Pool` per destination (max 3 connections). MongoDB adapter caches `MongoClient` instances per destination, sweeping idle clients after 60s.

**Config decryption:** Every adapter receives decrypted config. `EgressService.processJob()` calls `decryptConfig(destination.config, tenantId)` before invoking the adapter — failures move the delivery to DLQ with `credential_decryption_error`.

---

## Scheduled Workflows

**Design pattern:** DB-backed cron, not in-memory scheduler. Vercel functions are stateless — `@nestjs/schedule` would lose its registry on every cold start.

**Storage:** `workflow_schedules` table in PostgreSQL with `cronExpression`, `timezone`, `payloadTemplate`, `isActive`, `lastRunAt`, `nextRunAt`.

**Claim protocol (atomic):**

```typescript
const due = await prisma.workflowSchedule.findMany({
  where: { isActive: true, nextRunAt: { lte: now } },
  take: 25,
});

for (const s of due) {
  const nextRunAt = computeNextRun(s.cronExpression, s.timezone);
  const claimed = await prisma.workflowSchedule.updateMany({
    where: { id: s.id, nextRunAt: { lte: now } },  // ← atomic guard
    data: { lastRunAt: now, nextRunAt },
  });
  if (claimed.count !== 1) continue;  // another worker won
  await redis.lpush(INCOMING_QUEUE, syntheticEvent(s));
}
```

**Why the atomic guard matters:** If two workers both read the same schedule with `nextRunAt <= now`, only one will successfully `updateMany` because the second call re-checks `nextRunAt <= now` — after the first update, the predicate fails. No duplicates.

**Cron evaluation:** `cron-parser@4.9.0` (pinned — v5 broke the API). Timezone-aware via the `tz` option. Invalid expressions throw `BadRequestException` at save time; at tick time they mark the schedule `isActive: false` and log the error.

**Validation:** `UpsertScheduleDto` regex allows only digits, `*`, `,`, `-`, `/`, and spaces — blocks cron names (`MON`, `JAN`) to keep the parser surface small.

---

## Workflow Versioning

**Storage:** `workflow_versions` table — one row per state change.

**Capture trigger:** Called from `WorkflowsService.create()`, `.update()`, `.importYaml()`, and `WorkflowVersionsService.restore()`. Every mutation produces a new immutable snapshot.

**Snapshot shape:**
```json
{
  "name": "...",
  "sourceType": "stripe",
  "sourceConfig": {...},
  "enrichmentEnabled": true,
  "enrichmentPrompt": null,
  "transformExpression": null,
  "routingRules": [],
  "isActive": true,
  "destinations": [{ type, name, config, enabled, retryPolicy }]
}
```

**Cap:** 50 versions per workflow. Older versions are trimmed after each capture.

**Restore semantics:** Destinations are deleted and recreated (their UUIDs are not stable across versions). The restore itself produces a new version (`Restored from vN`), so history stays linear — never branchy.

**Diff:** `GET /api/workflows/:id/versions/:a/diff/:b` returns `{ fromVersion, toVersion, identical, stats: { added, removed }, unified }`. The `unified` field is a standard unified-diff patch from the `diff@7` package — the same format as `git diff`. The dashboard renders it with color-coded lines (green `+`, red `-`, cyan `@@`).

---

## Credential Encryption

**Envelope format (v1.4+):**

```
enc:v2:<kid>:<base64url-iv>:<base64url-authTag>:<base64url-ciphertext>
```

- `<kid>` — key ID from `CONNECTOR_ENCRYPTION_KEYS`, e.g. `key-2026-10`
- Algorithm: AES-256-GCM (authenticated encryption)
- IV: 12 random bytes per encryption
- Auth tag: standard GCM tag

**Backward compat:** Legacy `enc:v1:<iv>:<tag>:<ct>` envelopes (v1.3 format) are still decrypted by trying every key in the keyring — kid field is absent, so we brute-force try each key.

**Key ring:** `CONNECTOR_ENCRYPTION_KEYS=kid1:hexkey1,kid2:hexkey2`. **First key = current** (used for new encryptions). All keys available for decryption.

**Per-tenant derivation:** Master key → HKDF-SHA256(salt=tenantId, info='relayon:connector:v1') → 32-byte tenant key. Compromise of one tenant's derived key does not expose another tenant's ciphertext.

**Field scope:** By default, only keys in `SECRET_CONFIG_KEYS` (e.g., `secret`, `apiKey`, `webhookUrl`, `connectionString`, `privateKey`) are encrypted. Non-secret fields (`url`, `table`, `method`) stay plaintext so the dashboard can render summaries without decrypting.

**Full encryption mode (v1.5):** Setting `FULL_CONFIG_ENCRYPTION=true` switches to `encryptConfigAll` — every string value encrypted except those in `METADATA_CONFIG_KEYS` (structural metadata needed for rendering).

**Client redaction:** `redactConfig()` replaces encrypted values with `••••••••` before sending to the dashboard — the client never sees ciphertext.

**Rotation:** `scripts/rotate-encryption-key.mjs` iterates all workflows and destinations, decrypts with any matching key, re-encrypts with the current key. Idempotent — re-running on already-rotated rows is a no-op.

---

## API Keys & Rotation

**Key format:** `rlk_<live|test>_<8-hex-prefix>_<48-hex-secret>` — Stripe-style prefix for identification, opaque secret for auth.

**Storage:** `api_keys` table — `prefix` (unique, indexed for fast lookup), `key_hash` (SHA-256 of pepper + raw key), `scopes` (array), `environment`, `expiresAt`, `revokedAt`, `lastUsedAt`.

**Verification** (timing-safe):
```typescript
const expectedHash = record.keyHash;
const actualHash = sha256(`${PEPPER}:${rawKey}`);
if (!timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(actualHash, 'hex'))) {
  throw new UnauthorizedException();
}
```

**Scopes enforced via decorator:**
```typescript
@Get()
@RequireScopes('events:read')
list() { ... }
```

`JwtOrApiKeyGuard` checks: if `X-API-Key` header present → verify API key + enforce scopes; else fall back to JWT (dashboard session, no scope check).

**Rotation (v1.5):** `POST /api/api-keys/:id/rotate` — creates a new key with same scopes, caps old key's `expiresAt` at `now + 24h` (grace window). During grace, both keys work. After grace, old key returns 401 (verify rejects expired). This lets customers deploy new keys without downtime.

**Why pepper + SHA-256, not bcrypt:** bcrypt is slow (~100ms) — too slow for API auth on every request. SHA-256 of a high-entropy random key is fast (~1μs) and secure because the key itself has 384 bits of entropy. Pepper defends against rainbow tables if the DB leaks.

---

## Key Design Decisions

### 1. Two databases — PostgreSQL + MongoDB

**Decision:** Split transactional data (PostgreSQL) from event/delivery logs (MongoDB).

**Why:**
- **PostgreSQL** — ACID guarantees for money-related data. Foreign keys, `FOR UPDATE` locks, atomic transactions. Tenants, users, workflows, destinations, schedules, versions, API keys live here.
- **MongoDB** — Append-only high-volume logs. 30-day TTL indexes auto-delete old events. `Mixed` types store arbitrary webhook payloads. No schema migration when payload shape changes.

**Tradeoff:** Two databases = two connection pools = higher cold start time. But separating them means a MongoDB write failure doesn't corrupt transactional state. TTL-based cleanup in MongoDB is free — no cron needed.

---

### 2. Redis queues instead of a message broker

**Decision:** Use Upstash Redis lists (`LPUSH`/`RPOP`/`RPOPLPUSH`) + sorted sets (`ZADD`/`ZRANGEBYSCORE`) instead of Kafka, RabbitMQ, or SQS.

**Why:**
- **Cost:** Free tier — 10K commands/day. Kafka/RabbitMQ start at $20-50/month.
- **Simplicity:** Redis primitives map directly to queue semantics.
- **Serverless-friendly:** Redis over HTTP/TCP works from stateless functions.

**Tradeoff:** Redis doesn't have Kafka's durability guarantees. **Mitigation:** Ingress returns `500` if `LPUSH` fails — the source retries.

---

### 3. `RPOPLPUSH` for at-least-once delivery

**Decision:** Use `RPOPLPUSH` (atomic move) to move events from `incoming` to `processing` queues.

**Why:** If the worker crashes mid-processing, the event stays in `processing` — it's not lost. A recovery scan re-queues stale entries after 5 minutes.

**Duplicate prevention** (3 layers):
- **Event level:** MongoDB `correlationId` unique index — duplicate insert fails
- **Delivery level:** HTTP adapter sends `Idempotency-Key: {eventId}:{destinationId}` header
- **Ingress level:** Redis `SET NX` on body-hash prevents source-side duplicates

**Result:** Duplicates possible but rare, and every layer where they could occur has a dedup mechanism.

---

### 4. Graceful AI degradation

**Decision:** If Groq fails, the event still processes and delivers — just without enrichment.

**Why:** AI is a **nice-to-have**, not a **critical path**. The core promise is "event reaches destination." An LLM outage shouldn't block deliveries.

**Implementation:** `ProcessingService.processOne()` wraps `groq.enrich()` in try/catch. On error: `enrichedPayload = null`, `enrichment.error = message`, execution continues.

**Tradeoff:** Enrichment failure is invisible to the source. **Mitigation:** Surfaced in dashboard's event detail drawer with a red badge.

---

### 5. Circuit breaker for unhealthy destinations

**Decision:** Pause a destination for 5 minutes after 5 consecutive failures.

**Why:** If Slack is down, we don't want to burn through Redis commands and Groq tokens retrying.

**Implementation:** `circuit:dest:{id}` key in Redis. `INCR` on retryable failure, `DEL` on success, `EXPIRE 300` on first increment. `isOpen()` checks `count >= 5`.

**Tradeoff:** A destination that fails once for a transient reason can pause for 5 minutes. **Mitigation:** Configurable via env var.

---

### 6. `npx prisma generate` is banned

**Decision:** Prisma generate runs via `node ./node_modules/prisma/build/index.js generate` in the Vercel build command.

**Why:** During deployment, `npx` couldn't find the local `prisma` binary (workspace `node_modules/.bin` not in `PATH`), so it fetched `prisma@latest` — which is now `8.0.0-rc.25` (a new CLI that **removed the `generate` command**). Build failed with `CLI.UNKNOWN_COMMAND`.

**Fix:**
1. Pin `prisma` to exact version (`6.19.3`) in root `dependencies`
2. Use absolute path: `node ./node_modules/prisma/build/index.js generate --schema=./packages/db/prisma/schema.prisma`
3. Never trust `npx` in CI/build — always use local binary paths

**Tradeoff:** Ugly command. **Mitigation:** Documented in `DEPLOYMENT.md` and this file.

---

### 7. `__dryRun` honour in every adapter

**Decision:** Every adapter checks `ctx.config.__dryRun === true` and uses a **safe probe** instead of the real write.

**Why:** The `POST /api/destinations/validate` endpoint is called from the dashboard's "Test connection" button. If adapters didn't honour `__dryRun`, testing a Slack destination would send a real message to the channel, and testing a MongoDB destination would insert a real document. That's a **data-leak / write-amplification bug**.

**Implementation:** Each adapter has a distinct safe probe:
- HTTP/Slack/Discord: HEAD request (no body, no message)
- Email: GET /api-keys (auth check only)
- Sheets: GET spreadsheet metadata (no append)
- Airtable: GET base tables (no record)
- Notion: GET data source (no page)
- PostgreSQL: SELECT 1
- MongoDB: ping command

**Tradeoff:** Slack/Discord **cannot be probed without sending**. For those, we validate URL format only and return "config valid — cannot be tested without sending a message." Safest possible behaviour.

---

### 8. Envelope format evolution (`enc:v1` → `enc:v2`)

**Decision:** When adding key rotation (v1.4), introduce `enc:v2:<kid>:...` with key ID embedded in the envelope. Keep v1 decryption working.

**Why:** To support multiple keys simultaneously (zero-downtime rotation), the envelope must carry the kid. Without it, decrypting requires brute-forcing every key.

**Backward compat:** `decryptValue()` switches on prefix. v2 → look up kid in keyring. v1 → try all keys in reverse (oldest last). This means old encrypted data **never breaks** — you can migrate gradually with the rotation script.

---

## Reliability Guarantees

| Guarantee | Mechanism |
|---|---|
| **At-least-once delivery** | `RPOPLPUSH` + `LREM` after ack; 5-min stuck recovery |
| **Event-level idempotency** | MongoDB unique `correlationId` |
| **Ingress dedup** | Redis `SET NX EX 86400` on body-hash |
| **Delivery dedup** | HTTP adapter sends `Idempotency-Key` header |
| **Retry with backoff** | ZSET `queue:egress:delayed` with score = `now + backoff` |
| **DLQ** | `status: 'dlq'` after max retries; replayable individually or in bulk |
| **Circuit breaker** | `circuit:dest:{id}` counter with 5-min TTL |
| **Graceful AI degradation** | Try/catch around Groq; event still processes |
| **Atomic destination claim** | MongoDB `findOneAndUpdate` (only one worker wins) |
| **Stuck recovery** | Scan for `status: 'delivering'` with `lastAttemptAt < now - 5min` |
| **Schedule claim** | PostgreSQL `updateMany` with `nextRunAt <= now` predicate |
| **Versioning** | Immutable snapshot per mutation; 50-version cap |
| **Encryption at rest** | AES-256-GCM, HKDF per-tenant keys, kid-aware envelopes |
| **Credential rotation** | Multi-key keyring; zero-downtime via grace window |
| **Config validation** | Two-layer (schema + real dry-run) before save |

---

## Failure Modes & Recovery

### PostgreSQL down

- **Ingress:** Fails fast with `500` (can't resolve workflow). Source retries.
- **Workers:** `/internal/process` returns `500`. Cron retries next cycle.
- **API:** All routes return `500`.
- **Scheduler:** `/internal/schedule/tick` returns `500`.

**Recovery:** Automatic — Prisma reconnects on next query. Neon has connection pooling.

---

### MongoDB down

- **Workers:** `/internal/process` fails to log → error return. Event stays in `processing` queue, `recoverStuck` re-queues it.
- **API:** Events/DLQ endpoints return `500`. Workflows/destinations still work.

**Recovery:** Atlas reconnects automatically. If down >5 min, stuck events re-queued.

---

### Redis down

- **Ingress:** `500` on all webhooks. Source retries.
- **Workers:** `/internal/process` and `/internal/deliver` return `500`.
- **Scheduler:** `/internal/schedule/tick` returns `500` — schedules wait until Redis recovers.

**Recovery:** Upstash auto-recovers within ~1 min.

**Risk:** Events accepted by Ingress but stuck in Redis if Redis dies mid-operation. This is why **Ingress returns 500 on LPUSH failure** — the source is responsible for retry.

---

### Groq down

- **Workers:** `groq.enrich()` throws → caught → `enrichment.error` set → event still processes and delivers.

**Recovery:** None needed. Events deliver without enrichment.

---

### Destination down (e.g., Slack outage)

- **First 5 failures:** Circuit breaker counts up.
- **After 5:** Circuit opens for 5 min.
- **During open:** Deliveries re-queue with 60s backoff.
- **After 5 min:** Circuit closes. Next delivery attempts real call.
- **After max_attempts:** Delivery moves to DLQ.

**Recovery:** User fixes destination config → clicks Replay in DLQ → `status: pending` → delivered on next cron.

---

### Encryption key unavailable

- **Workers:** `decryptConfig()` throws `Unknown kid "..."` → delivery moves to DLQ with `credential_decryption_error`.
- **Root cause:** A key was removed from `CONNECTOR_ENCRYPTION_KEYS` but envelopes encrypted with it still exist.

**Recovery:** Re-add the missing key to the env var and redeploy. Or run rotation script while the old key is still present.

---

### Schedule never fires

- **Cause 1:** `nextRunAt` in the future — check the DB.
- **Cause 2:** External cron not hitting `/internal/schedule/tick` — check cron-job.org history.
- **Cause 3:** Schedule `isActive: false` — check dashboard.
- **Cause 4:** Invalid cron expression at save time — validation should have rejected it.

---

## Serverless Constraints as Architecture

Vercel Hobby has three **hard limits** that shaped Relayon's design:

### Constraint 1 — Cron runs once per day (Hobby)

**Impact:** Can't rely on Vercel Cron for the 5-minute schedule tick cadence.

**Solution:** External cron (cron-job.org, 5-min interval) hits `/internal/schedule/tick`, `/internal/process`, and `/internal/deliver`. Three separate cron jobs.

**Tradeoff:** External dependency. **Mitigation:** Cron-job.org has 25-failure auto-disable, email alerts on failure.

---

### Constraint 2 — Functions are stateless, 10-60s duration limit

**Impact:** Can't run a persistent worker. Can't keep WebSocket open. Can't hold `@nestjs/schedule` registry in memory.

**Solution:** Every invocation is a **batch of N events** (default `BATCH_SIZE=3`, `TIME_BUDGET_MS=7000`). State lives in Redis + PostgreSQL + MongoDB. Cold starts cached via `cachedServer` in Workers `main.ts`. Schedules in DB, not memory.

**Tradeoff:** Cold starts add 1-2s. **Mitigation:** Batching amortizes it.

---

### Constraint 3 — Monorepo build with `npm ci`

**Impact:** `postinstall` scripts can't find workspace binaries in `PATH`.

**Solution:** Prisma generate via `postinstall` with absolute path + `fs.existsSync` guard (dashboard doesn't have Prisma, skip gracefully).

**Tradeoff:** Ugly build config. Documented.

---

## Scaling Path

Relayon is designed to **degrade gracefully**, not scale infinitely on free tier.

### At 10K events/month (current free tier)

All services on free tier. No changes.

### At 100K events/month

**Bottleneck:** Upstash 10K commands/day, Groq 14.4K/day.

**Actions:**
- Upgrade Upstash ($5/mo)
- Cache Groq responses more aggressively (TTL 1h → 6h)
- Consider pre-computing common enrichments

### At 1M events/month

**Bottleneck:** Neon connection limits, MongoDB M0 512MB.

**Actions:**
- Neon Pro ($19/mo)
- MongoDB M2 ($9/mo)
- Read replica for API
- Move Workers to Fly.io (no cold starts)

### At 10M events/month

**Bottleneck:** Vercel function invocations, single-region latency.

**Actions:**
- Ingress to dedicated infrastructure
- Sharded MongoDB or ClickHouse for analytics
- Multi-region Workers
- Kafka or Pulsar for the queue

**No code changes required** — only infrastructure. Interfaces stable.

---

## Conclusion

Relayon's architecture is **deliberately boring**. Four apps, three databases, two queues. The complexity is in the *reliability primitives* (`RPOPLPUSH`, DLQ, circuit breakers, graceful degradation, kid-aware encryption, atomic schedule claims), not the topology.

This is what "production-grade on free tier" looks like: **honest tradeoffs, documented failure modes, and every guarantee backed by a specific mechanism.**

For questions or corrections, open an issue at [github.com/zainshah3464/relayon](https://github.com/zainshah3464/relayon).
```

---