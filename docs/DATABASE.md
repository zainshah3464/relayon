# Relayon — Database Design

> **Complete reference for Relayon's data layer — PostgreSQL + MongoDB + Redis.**
>
> **Current version:** v1.5.0

Relayon uses **three data stores**, each chosen for a specific workload characteristic:

| Store | Purpose | Why this store |
|---|---|---|
| **PostgreSQL** (Neon) | Transactional, ACID-critical data | Foreign keys, `FOR UPDATE` locks, atomic transactions |
| **MongoDB** (Atlas M0) | Append-only logs + event payloads | TTL indexes, `Mixed` types for arbitrary payloads |
| **Redis** (Upstash) | Ephemeral state (queues, cache, rate limits) | Sub-millisecond reads, atomic operations |

---

## Table of Contents

- [Design Principles](#design-principles)
- [PostgreSQL Schema](#postgresql-schema)
  - [ERD](#erd)
  - [Tables](#tables)
  - [Indexes](#postgresql-indexes)
  - [Migrations](#migrations)
  - [Prisma Configuration](#prisma-configuration)
- [MongoDB Collections](#mongodb-collections)
  - [events](#events)
  - [deliveries](#deliveries)
  - [Indexes and TTL](#mongodb-indexes)
- [Redis Keys](#redis-keys)
- [Data Flow Between Stores](#data-flow-between-stores)
- [Backup Strategy](#backup-strategy)
- [Common Queries](#common-queries)

---

## Design Principles

1. **PostgreSQL is the source of truth for "who/what"** — tenants, users, workflows, destinations, schedules, versions, API keys. If PostgreSQL loses a row, money and trust are lost.

2. **MongoDB is the source of truth for "when/did"** — events, deliveries. If MongoDB loses a row, a dashboard is slightly wrong. Never money.

3. **Redis is the source of truth for "now"** — queue position, rate limit counter, cache. Lost Redis = lost work, but no data corruption (idempotency keys and MongoDB unique constraints prevent duplicates on retry).

4. **No database is a "cache" of another.** There's no join between PostgreSQL and MongoDB. The `workflowId` in an `events` document is a foreign-key-by-convention, not enforced by either database.

5. **Every table/collection has an ownership boundary.** No table is written by two services. `Workflow` is written by the API (via Prisma). `Event` is written by Workers (via Mongoose). The API only **reads** `Event`.

---

## PostgreSQL Schema

### ERD

```
┌────────────────┐
│    Tenant      │
│────────────────│
│ id (PK)        │
│ name           │
│ slug (UQ)      │
│ plan           │
│ quota_events   │
│ quota_tokens   │
└───────┬────────┘
        │ 1
        │
        │ N
┌───────▼────────┐         ┌───────────────────┐
│     User       │◄────────│  RefreshToken     │
│────────────────│  1:N    │───────────────────│
│ id (PK)        │         │ id (PK)           │
│ tenant_id (FK) │         │ user_id (FK)      │
│ email (UQ)     │         │ tenant_id (FK)    │
│ password_hash  │         │ token_hash (UQ)   │
│ role           │         │ expires_at        │
└────────────────┘         │ revoked_at        │
                           └───────────────────┘

┌────────────────┐
│   Workflow     │
│────────────────│
│ id (PK)        │
│ tenant_id (FK) │  ◄─── belongs to Tenant
│ name           │
│ source_type    │  (enum: stripe | github | shopify | slack | generic)
│ source_config  │  (JSON: { secret: "enc:v2:..." })
│ enrichment_*   │
│ transform_*    │
│ routing_rules  │  (JSON array — v1.1+)
│ is_active      │
└───────┬────────┘
        │ 1
        │
        │ N
┌───────▼────────┐
│  Destination   │
│────────────────│
│ id (PK)        │
│ workflow_id(FK)│
│ type (String)  │  (http | slack | email | sheets | discord |
│                │   airtable | notion | postgres | mongodb)
│ name           │
│ config         │  (JSON: type-specific, secrets enc:v2:)
│ enabled        │
│ retry_policy   │  (JSON: { max_attempts, backoff_ms[] })
└────────────────┘

┌────────────────┐
│   ApiKey       │  (v1.2+ — full schema with scopes/rotation)
│────────────────│
│ id (PK)        │
│ tenant_id (FK) │
│ name           │
│ prefix (UQ)    │
│ key_hash (UQ)  │
│ scopes[]       │
│ environment    │
│ last_used_at   │
│ expires_at     │
│ revoked_at     │
└────────────────┘

┌────────────────────┐
│ WorkflowSchedule   │  (v1.3+ — 1:1 with Workflow)
│────────────────────│
│ id (PK)            │
│ workflow_id (FK,UQ)│
│ cron_expression    │
│ timezone           │
│ payload_template   │
│ is_active          │
│ last_run_at        │
│ next_run_at        │
└────────────────────┘

┌────────────────────┐
│ WorkflowVersion    │  (v1.3+ — 1:N with Workflow, cap 50)
│────────────────────│
│ id (PK)            │
│ workflow_id (FK)   │
│ tenant_id (FK)     │
│ version (int)      │
│ snapshot (JSON)    │
│ message            │
│ created_by         │
└────────────────────┘
```

---

### Tables

#### `tenants`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `name` | `text` | NOT NULL | Display name |
| `slug` | `text` | UNIQUE | URL-safe; auto-generated from `name` at signup; conflicts get random suffix |
| `plan` | `text` | NOT NULL | `free` (default) — `pro`/`enterprise` reserved for future |
| `quota_events_per_month` | `int4` | NOT NULL | Default 10000 (free tier) |
| `quota_ai_tokens_per_month` | `int4` | NOT NULL | Default 100000 |
| `current_period_start` | `timestamptz` | NOT NULL | Billing period start |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | Auto-managed |

**Why `slug`:** Exposed in dashboard for human identification. The webhook URL uses UUID, but slug is friendlier in logs.

---

#### `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `tenant_id` | `uuid` | FK → tenants CASCADE | |
| `email` | `text` | UNIQUE, NOT NULL | |
| `password_hash` | `text` | NOT NULL | bcrypt cost 12 |
| `name` | `text` | NOT NULL | |
| `role` | `text` | NOT NULL | `owner` (default) — `admin`/`viewer` reserved |
| `last_login_at` | `timestamptz` | NULL | Updated on login |
| `created_at`, `updated_at` | `timestamptz` | NOT NULL | |

**Why `email` is globally unique:** Not per-tenant. One email = one account. Simpler login flow (no tenant selection at login). Multi-tenant-per-user is deferred to v2.0 (`tenant_members` table).

---

#### `refresh_tokens`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | FK → users CASCADE | |
| `tenant_id` | `uuid` | FK → tenants CASCADE | Denormalized for tenant-scoped revocation queries |
| `token_hash` | `text` | UNIQUE | SHA-256 of raw token (raw never stored) |
| `expires_at` | `timestamptz` | NOT NULL | 7 days after creation |
| `revoked_at` | `timestamptz` | NULL | Set on rotation or logout |
| `created_at` | `timestamptz` | NOT NULL | |

**Why hash, not raw:** If the database is compromised, raw refresh tokens can't be reused. Compromised hashes are useless.

**Why rotation:** Every refresh call revokes the old token and issues a new one. If a stolen token is reused, the second use fails (it was already revoked).

---

#### `workflows`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `tenant_id` | `uuid` | FK → tenants CASCADE | |
| `name` | `text` | NOT NULL | |
| `source_type` | `enum` | NOT NULL | `stripe` \| `github` \| `shopify` \| `slack` \| `generic` |
| `source_config` | `jsonb` | NOT NULL, default `{}` | Type-specific config; `secret` encrypted as `enc:v2:...` |
| `enrichment_enabled` | `bool` | NOT NULL | Default `false` |
| `enrichment_prompt` | `text` | NULL | Custom LLM prompt |
| `transform_expression` | `text` | NULL | JSONata expression (2s timeout at runtime) |
| `routing_rules` | `jsonb` | NOT NULL, default `[]` | **v1.1+** — array of `{ when: string, destinationIds: string[] }` |
| `is_active` | `bool` | NOT NULL | Default `true` |
| `created_at`, `updated_at` | `timestamptz` | NOT NULL | |

**`source_config` shape per type:**
```json
// stripe, github, shopify, slack
{ "secret": "enc:v2:key-2026-10:..." }

// generic
{ "secret": "enc:v2:...", "header": "x-webhook-signature", "encoding": "hex" | "base64" }
```

**`routing_rules` shape (v1.1+):**
```json
[
  { "when": "$exists(data.amount) and data.amount > 100", "destinationIds": ["dest-uuid-1"] },
  { "when": "type = 'payment_intent.succeeded'", "destinationIds": ["dest-uuid-2"] }
]
```
Empty array = route to all destinations. First matching rule wins.

---

#### `destinations`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `workflow_id` | `uuid` | FK → workflows CASCADE | |
| `type` | `text` | NOT NULL | **Not enum** — see note below |
| `name` | `text` | NOT NULL | |
| `config` | `jsonb` | NOT NULL, default `{}` | Type-specific; secret fields `enc:v2:...` |
| `enabled` | `bool` | NOT NULL | Default `true` |
| `retry_policy` | `jsonb` | NOT NULL | `{ max_attempts, backoff_ms[] }` |
| `created_at`, `updated_at` | `timestamptz` | NOT NULL | |

**Why `type` is `text` not `enum` (v1.5 reality):** Each version added new adapters — Discord (v1.2), Airtable/Notion (v1.3), Postgres/MongoDB (v1.4). An enum would mean a migration per adapter. As `String`, new adapters register via `@DestinationAdapter` decorator with zero DB change. API DTO enforces `@IsIn(DESTINATION_TYPES)` at the boundary.

**Valid `type` values (v1.5):**
`http` · `slack` · `email` · `sheets` · `discord` · `airtable` · `notion` · `postgres` · `mongodb`

**Default `retry_policy`:**
```json
{
  "max_attempts": 5,
  "backoff_ms": [10000, 30000, 60000, 300000, 900000]
}
```

**`config` shape per type (v1.5 — 9 adapters):**
```json
// http
{ "url": "https://...", "method": "POST", "headers": {...} }

// slack / discord
{ "webhookUrl": "enc:v2:key-2026-10:..." }

// email (Resend)
{ "apiKey": "enc:v2:...", "to": ["a@x.com"], "from": "Relayon <noreply@y.com>" }

// sheets (service account)
{
  "spreadsheetId": "1abc...",
  "range": "Sheet1!A:Z",
  "serviceAccountEmail": "xxx@xxx.iam.gserviceaccount.com",
  "privateKey": "enc:v2:..."
}

// airtable (v1.3+)
{
  "apiKey": "enc:v2:...",
  "baseId": "appXXXXXXXXXXXXXX",
  "tableName": "Leads",
  "typecast": true
}

// notion (v1.3+)
{
  "apiKey": "enc:v2:...",
  "dataSourceId": "uuid",
  "titleProperty": "Name"
}

// postgres (v1.4+)
{
  "connectionString": "enc:v2:...",
  "table": "events",
  "columns": { "type": "event_type", "data.amount": "amount_cents" },
  "onConflict": "id",
  "ssl": true
}

// mongodb (v1.4+)
{
  "connectionString": "enc:v2:...",
  "database": "mydb",
  "collection": "events",
  "upsertKey": "orderId"
}
```

**Encryption scope:** Only keys in `SECRET_CONFIG_KEYS` (`secret`, `apiKey`, `privateKey`, `webhookUrl`, `connectionString`, etc.) are encrypted by default. Setting `FULL_CONFIG_ENCRYPTION=true` on the API switches to `encryptConfigAll` — every non-metadata field encrypted. See [SECURITY.md](./SECURITY.md).

---

#### `api_keys` (v1.2 — full schema with scopes + rotation)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `tenant_id` | `uuid` | FK → tenants CASCADE | |
| `name` | `text` | NOT NULL | e.g., "CI pipeline" |
| `prefix` | `text` | UNIQUE, NOT NULL | e.g., `rlk_live_ab12cd34` — O(1) lookup at verify time |
| `key_hash` | `text` | UNIQUE, NOT NULL | SHA-256 of `{PEPPER}:{rawKey}` |
| `scopes` | `text[]` | NOT NULL, default `[]` | Postgres array — e.g., `["events:read","workflows:read"]` |
| `environment` | `text` | NOT NULL, default `'live'` | `live` \| `test` |
| `last_used_at` | `timestamptz` | NULL | Updated on every successful verify (fire-and-forget) |
| `expires_at` | `timestamptz` | NULL | NULL = no expiry (`neverExpires: true`) |
| `revoked_at` | `timestamptz` | NULL | Set on revoke; verify rejects revoked keys |
| `created_at` | `timestamptz` | NOT NULL | |

**Valid scopes (v1.5):**
`events:read` · `workflows:read` · `workflows:write` · `destinations:read` · `destinations:write` · `dlq:read` · `dlq:write` · `analytics:read`

**Key format:** `rlk_<live|test>_<8-hex-prefix>_<48-hex-secret>` — Stripe-style. Raw key returned **once** at creation. Never retrievable again.

**Rotation (v1.5):** `POST /api/api-keys/:id/rotate` creates a new key and caps the old key's `expiresAt` at `now + 24h`. Both keys work during the grace window.

**Why pepper + SHA-256, not bcrypt:** bcrypt is ~100ms — too slow for API auth on every request. SHA-256 of a high-entropy key (~1μs) is secure because the key itself has 384 bits of entropy. Pepper defends against rainbow tables if the DB leaks. See [SECURITY.md](./SECURITY.md) for details.

---

#### `workflow_schedules` (v1.3)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `workflow_id` | `uuid` | FK → workflows CASCADE, UNIQUE | 1:1 with workflow |
| `cron_expression` | `text` | NOT NULL | 5-field; digits + `*`,`,`,`-`,`/`, space only |
| `timezone` | `text` | NOT NULL, default `'UTC'` | IANA tz name |
| `payload_template` | `jsonb` | NOT NULL, default `{}` | Injected as `rawPayload.data` in synthetic event |
| `is_active` | `bool` | NOT NULL, default `true` | Pausable without deleting |
| `last_run_at` | `timestamptz` | NULL | Updated on each tick enqueue |
| `next_run_at` | `timestamptz` | NOT NULL | Indexed with `is_active` — the atomic claim predicate |
| `created_at`, `updated_at` | `timestamptz` | NOT NULL | |

**Atomic claim query (serverless-safe):**
```typescript
await prisma.workflowSchedule.updateMany({
  where: { id: schedule.id, nextRunAt: { lte: now } },
  data: { lastRunAt: now, nextRunAt: computedFuture },
});
```
If `count !== 1`, another worker already advanced this row → skip.

**Why DB-backed, not in-memory:** Vercel functions are stateless — `@nestjs/schedule` loses its registry on every cold start. See [ARCHITECTURE.md § Scheduled Workflows](./ARCHITECTURE.md#scheduled-workflows).

---

#### `workflow_versions` (v1.3)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `workflow_id` | `uuid` | FK → workflows CASCADE | |
| `tenant_id` | `uuid` | FK → tenants CASCADE | Denormalized for tenant-scoped queries |
| `version` | `int4` | NOT NULL | Sequential, starts at 1 |
| `snapshot` | `jsonb` | NOT NULL | Full workflow + destinations snapshot (encrypted configs inside) |
| `message` | `text` | NULL | Human label — `"Initial version"`, `"Configuration updated"`, `"Restored from vN"`, `"Imported from YAML"` |
| `created_by` | `uuid` | NULL | Actor user ID |
| `created_at` | `timestamptz` | NOT NULL | |

**Unique constraint:** `@@unique([workflowId, version])` — protects against duplicate version numbers under concurrent writes.

**Cap:** 50 versions per workflow. Older versions trimmed after each capture (query: `findMany({ orderBy: { version: 'desc' }, skip: 50 }).deleteMany()`).

**Restore semantics:** Destinations are deleted and recreated — their UUIDs are **not** stable across versions. The restore itself produces a new version (`"Restored from vN"`), so history stays linear — never branches.

---

### PostgreSQL Indexes

| Table | Index | Columns | Why |
|---|---|---|---|
| `users` | `users_tenant_id_idx` | `tenant_id` | Fast tenant→users join |
| `refresh_tokens` | `refresh_tokens_user_id_idx` | `user_id` | List user's sessions |
| `refresh_tokens` | `refresh_tokens_expires_at_idx` | `expires_at` | Cleanup expired tokens |
| `workflows` | `workflows_tenant_id_idx` | `tenant_id` | List tenant's workflows |
| `destinations` | `destinations_workflow_id_idx` | `workflow_id` | List workflow's destinations |
| `api_keys` | `api_keys_tenant_id_idx` | `tenant_id` | List tenant's keys |
| `api_keys` | `api_keys_prefix_key` | `prefix` (UNIQUE) | Fast lookup at verify — this is the hot path |
| `api_keys` | `api_keys_key_hash_key` | `key_hash` (UNIQUE) | Defense-in-depth (timing-safe compare after prefix lookup) |
| `workflow_schedules` | `workflow_schedules_is_active_next_run_at_idx` | `(is_active, next_run_at)` | **Hot path** — atomic claim query |
| `workflow_schedules` | `workflow_schedules_workflow_id_key` | `workflow_id` (UNIQUE) | 1:1 enforcement |
| `workflow_versions` | `workflow_versions_workflow_id_version_key` | `(workflow_id, version)` (UNIQUE) | Duplicate version guard + ordered listing |
| `workflow_versions` | `workflow_versions_tenant_id_workflow_id_version_idx` | `(tenant_id, workflow_id, version)` | Tenant-scoped version list |

---

### Migrations

Relayon uses **Prisma Migrate** — versioned SQL migrations stored in `packages/db/prisma/migrations/`.

**Current migrations (v1.5):**

| Migration | Version | Change |
|---|---|---|
| `20261018152226_init` | v1.0 | Initial schema — `Tenant`, `User`, `Workflow`, `Destination`, `RefreshToken`, `ApiKey` (basic), all enums |
| `add_routing_rules` | v1.1 | Adds `workflows.routing_rules` JSONB column (default `[]`) |
| `api_keys_scopes` | v1.2 | Rebuilds `api_keys`: adds `prefix`, `scopes[]`, `environment`, `revoked_at`; renames `key` → `key_hash` |
| `v13_schedules_and_versions` | v1.3 | Adds `workflow_schedules` + `workflow_versions` tables |
| *(none)* | v1.4 | No migration — PG/MongoDB adapters + `enc:v2:` envelope are data-layer changes only |
| *(none)* | v1.5 | No migration — validation, dry-run, `encryptConfigAll`, api-key rotate, bulk schedules are code-only |

**Commands:**

```bash
# Create a new migration (dev only)
cd packages/db
npx prisma migrate dev --name add_xyz

# Apply pending migrations (production — safe, idempotent)
cd packages/db
DATABASE_URL="postgresql://...neon...?sslmode=require" npx prisma migrate deploy
cd ../..

# Reset database (dev only — DESTRUCTIVE)
cd packages/db
npx prisma migrate reset --force

# Visual schema explorer
npx prisma studio
```

**Migration workflow:**
1. Edit `packages/db/prisma/schema.prisma`
2. Run `npm run db:migrate` (creates + applies migration in dev)
3. Commit the new migration file to Git
4. `npm run db:deploy` runs on next production deploy (via Vercel build, before API starts)

**Idempotency:** All migrations are wrapped in transactions. `prisma migrate deploy` is safe to run multiple times.

**⚠️ Rule:** Never run `prisma migrate dev` (generates files) on production. Always `prisma migrate deploy` (applies only). Always `pg_dump` before `db:deploy` on production.

---

### Prisma Configuration

**Generator block (v1.5 — critical for Vercel):**

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}
```

**Why `rhel-openssl-3.0.x`:** Vercel's Node runtime is Amazon Linux 2023. Without this target, the Prisma query engine binary is missing at runtime → every request fails with `PrismaClientInitializationError: Query engine library not found`.

**Why `native`:** Local dev (Windows/Mac/Linux) needs its own target to run migrations and queries without a Docker container.

**Version pinning (v1.5 — exact, not caret):**

- Root `dependencies.prisma`: **`6.19.3`** (exact)
- `@prisma/client`: `^6.2.0` in api/workers/ingress workspaces

**Generate command (CI and Vercel build):**

```bash
node ./node_modules/prisma/build/index.js generate --schema=./packages/db/prisma/schema.prisma
```

**Never use `npx prisma generate`.** During early v1.0 deployment, `npx` couldn't find the local binary (workspace `.bin` not in PATH), so it fetched `prisma@latest` — which was `8.0.0-rc.x`, a new CLI that removed the `generate` command. Build failed with `CLI.UNKNOWN_COMMAND`. The absolute-path invocation is the fix.

---

## MongoDB Collections

### `events`

One document per received webhook, capturing the full processing lifecycle.

**Schema:**
```typescript
{
  _id: ObjectId,
  correlationId: string,          // unique, indexed
  tenantId: string,               // indexed
  workflowId: string,             // indexed
  sourceType: string,
  rawPayload: unknown,            // original webhook body
  headers: Record<string, string>,// sanitized (auth headers removed)
  ipHash: string | null,          // SHA-256(salt + IP)
  userAgent: string | null,
  idempotencyKey: string | null,
  receivedAt: Date,               // indexed (compound)
  processedAt: Date | null,
  enrichedPayload: unknown | null,
  transformedPayload: unknown | null,
  enrichment: {
    enabled: boolean,
    cached: boolean,
    model: string | null,
    durationMs: number,
    error: string | null
  } | null,
  status: 'received' | 'processing' | 'processed' | 'failed',  // indexed
  error: { stage: string, code: string, message: string } | null,
  ttlExpiresAt: Date              // indexed with TTL
}
```

**Write path:** Only Workers writes. API reads.
**Retention:** 30 days via `ttlExpiresAt` TTL index.

**`rawPayload.type` markers:**
- `'relayon.schedule.trigger'` — fired by cron tick (v1.3)
- `'relayon.schedule.manual'` — fired by Run-now button (v1.4)
- `'relayon.dry_run'` — sent during `/internal/egress/dry-run` (never persisted) (v1.5)
- Anything else — real webhook from source

---

### `deliveries`

One document per (event, destination) pair. Tracks attempt history and current state.

**Schema:**
```typescript
{
  _id: ObjectId,
  tenantId: string,               // indexed
  eventId: string,                // indexed (references events._id)
  correlationId: string,          // indexed
  destinationId: string,          // indexed
  destinationType: string,
  status: 'pending' | 'delivering' | 'delivered' | 'dlq',  // indexed
  attemptCount: number,
  nextAttemptAt: Date,            // indexed (for delayed queue scan)
  lastAttemptAt: Date | null,
  lastResponse: {
    statusCode: number,
    bodySnippet: string,          // first 500 chars
    latencyMs: number
  } | null,
  attempts: Array<{
    at: Date,
    statusCode: number | null,
    latencyMs: number,
    error: string | null
  }>,
  error: { code: string, message: string } | null,
  dlqReason: string | null,
  dlqAt: Date | null,
  createdAt: Date,
  deliveredAt: Date | null,
  ttlExpiresAt: Date              // indexed with TTL
}
```

**Write path:** Workers writes. API reads + updates (replay, bulk replay, bulk discard — the only API-writes-to-MongoDB exception, documented in [ARCHITECTURE.md](./ARCHITECTURE.md)).

**Retention:** 30 days via TTL.

---

### MongoDB Indexes

**`events`:**
```javascript
{ correlationId: 1 }              // unique
{ tenantId: 1, receivedAt: -1 }   // tenant event listing
{ workflowId: 1, receivedAt: -1 } // workflow filtering
{ tenantId: 1, status: 1 }        // status filtering
{ ttlExpiresAt: 1 }               // TTL: expire after 0s
```

**`deliveries`:**
```javascript
{ tenantId: 1, status: 1 }        // DLQ listing
{ destinationId: 1, status: 1 }   // destination health
{ status: 1, lastAttemptAt: 1 }   // stuck recovery scan
{ status: 1, nextAttemptAt: 1 }   // delayed queue recovery scan
{ ttlExpiresAt: 1 }               // TTL: expire after 0s
```

**TTL behavior:** MongoDB runs a background thread every 60s. Expired documents are deleted lazily. This is **not** immediate — a document with `ttlExpiresAt = T` may live up to `T + 60s`.

---

## Redis Keys

All keys are prefixed by purpose. Namespacing prevents collisions.

| Pattern | Type | TTL | Written By | Read By |
|---|---|---|---|---|
| `queue:events:incoming` | List | None | Ingress, Workers (schedule) | Workers |
| `queue:events:processing` | List | None | Workers | Workers |
| `queue:egress:pending` | List | None | Workers | Workers |
| `queue:egress:delayed` | ZSet | None | Workers | Workers |
| `idempotency:{workflowId}:{key}` | String | 86400s | Ingress | Ingress |
| `ratelimit:{workflowId}:{bucket}` | String | 120s | Ingress | Ingress |
| `circuit:dest:{destinationId}` | String | 300s | Workers | Workers |
| `groq:enrich:{hash}` | String | 3600s | Workers | Workers |

**`{key}` in idempotency:** Either `X-Event-Id` header or `sha256(body)`. `SET NX EX 86400` — if key exists, webhook is a duplicate.

**`{bucket}` in ratelimit:** `Math.floor(Date.now() / 60000)` — auto-rolls every minute. `INCR` per request, reject at 300.

**`{hash}` in groq:enrich:** `sha256(payload + prompt)` — prompt change naturally invalidates cache.

**Memory footprint estimate:**
- 1000 events in-flight × 2 KB avg = 2 MB
- 100 cached enrichments × 500 bytes = 50 KB
- Rate limit + idempotency keys: 1 KB × active workflows

Upstash free tier (256 MB, 10K commands/day) is enough for **~50K daily events** with conservative headroom.

---

## Data Flow Between Stores

### Webhook path (v1.0)

```
┌──────────┐
│ Ingress  │
└────┬─────┘
     │ 1. Read workflow (Prisma → PostgreSQL)
     │ 2. Check idempotency (Redis GET)
     │ 3. Check rate limit (Redis INCR)
     │ 4. Write event to queue (Redis LPUSH)
     ▼
┌──────────┐
│ Workers  │
└────┬─────┘
     │ 5. Pop from queue (Redis RPOPLPUSH)
     │ 6. Read workflow config (Prisma → PostgreSQL, batched)
     │ 7. Groq enrichment (HTTP, cache in Redis)
     │ 8. Write Event doc (Mongoose → MongoDB)
     │ 9. Write Delivery docs (Mongoose → MongoDB)
     │10. Push egress job (Redis LPUSH)
     ▼
┌──────────┐
│  Egress  │
└────┬─────┘
     │11. Pop from queue (Redis RPOP)
     │12. Atomic claim Delivery (Mongoose findOneAndUpdate)
     │13. Read destination config (Prisma → PostgreSQL)
     │14. Decrypt credentials (crypto-box → decryptConfig)
     │15. Call adapter (HTTP/Slack/Email/Sheets/Discord/Airtable/Notion/PG/Mongo)
     │16. Update Delivery status (Mongoose)
     │17. ZADD to delayed queue on retry (Redis)
     ▼
┌──────────┐
│Dashboard │
└──────────┘
     │18. Read events (API → MongoDB)
     │19. Read deliveries (API → MongoDB)
     │20. Replay DLQ (API → MongoDB update)
     │21. Read workflows (API → PostgreSQL)
```

### Scheduled workflow path (v1.3+)

```
┌──────────────┐
│ External Cron│ (cron-job.org, every 5 min)
└──────┬───────┘
       │ POST /internal/schedule/tick
       ▼
┌──────────┐
│ Workers  │
└────┬─────┘
     │ 1. SELECT due schedules (Prisma → PostgreSQL)
     │ 2. Atomic claim via updateMany (nextRunAt guard)
     │ 3. Compute nextRunAt (cron-parser)
     │ 4. LPUSH synthetic event → queue:events:incoming
     ▼
   (same pipeline as webhook — enrichment, transform, routing, delivery)
```

### Manual run-now path (v1.4+)

```
┌──────────┐
│Dashboard │ → click "Run now" → POST /api/workflows/:id/schedule/run-now
└────┬─────┘
     │
     ▼
┌──────────┐
│   API    │ → forward to workers POST /internal/schedule/run-now
└────┬─────┘
     │
     ▼
┌──────────┐
│ Workers  │ → LPUSH synthetic event (type: 'relayon.schedule.manual')
└──────────┘ → API updates lastRunAt (nextRunAt untouched)
```

### Destination dry-run path (v1.5+)

```
┌──────────┐
│Dashboard │ → click "Test connection" → POST /api/destinations/validate { dryRun: true }
└────┬─────┘
     │
     ▼
┌──────────┐
│   API    │ → schema check → forward to workers POST /internal/egress/dry-run
└────┬─────┘
     │
     ▼
┌──────────┐
│ Workers  │ → load adapter → add __dryRun: true → adapter.send()
└──────────┘    → safe probe per adapter (HEAD / auth check / SELECT 1 / ping)
                → NO writes to the destination
```

**Key insight:** Every read for a write happens via the **owning service's database**. The API never writes events (only Workers does). The API **does** write to MongoDB for DLQ replay/bulk-discard and schedule run-now signals — the only exceptions, documented.

---

## Backup Strategy

### Free tier limitations

- **Neon Free:** No automatic backups. Manual `pg_dump` required.
- **MongoDB Atlas M0:** No automated backups. Manual `mongodump` required.
- **Upstash Free:** No backups. Ephemeral by design.

### Recommended manual backup (weekly)

**PostgreSQL:**
```bash
pg_dump "$DATABASE_URL" \
  --no-owner --no-acl --format=custom \
  --file="relayon-pg-$(date +%Y%m%d).dump"
```

**MongoDB:**
```bash
mongodump --uri="$MONGODB_URI" --out="relayon-mongo-$(date +%Y%m%d)"
```

**Restore:**
```bash
pg_restore --dbname="$DATABASE_URL" relayon-pg-20261022.dump
mongorestore --uri="$MONGODB_URI" relayon-mongo-20261022/
```

### Production upgrades

- **Neon Pro** ($19/mo): 7-day PITR, daily backups
- **MongoDB M2** ($9/mo): Daily snapshots, 7-day retention
- **Upstash Pro**: Not needed (Redis is ephemeral)

---

## Common Queries

### Find all pending deliveries for a tenant

```javascript
db.deliveries
  .find({ tenantId: "tenant-uuid", status: "pending" })
  .sort({ nextAttemptAt: 1 })
  .limit(100);
```

### Count events by status in the last 24h

```javascript
db.events.aggregate([
  { $match: {
      tenantId: "tenant-uuid",
      receivedAt: { $gte: new Date(Date.now() - 86400000) }
  }},
  { $group: { _id: "$status", count: { $sum: 1 } } }
]);
```

### Find stuck deliveries (in `delivering` > 5 min)

```javascript
db.deliveries.find({
  status: "delivering",
  lastAttemptAt: { $lt: new Date(Date.now() - 300000) }
});
```

### Top destinations by success rate (24h)

```javascript
db.deliveries.aggregate([
  { $match: { tenantId: "tenant-uuid",
              createdAt: { $gte: new Date(Date.now() - 86400000) } } },
  { $group: {
      _id: "$destinationId",
      total: { $sum: 1 },
      delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } }
  }},
  { $addFields: {
      successRate: { $divide: ["$delivered", "$total"] }
  }},
  { $sort: { successRate: -1 } }
]);
```

### Find due schedules (v1.3+ — the atomic claim query)

```sql
SELECT id, workflow_id, cron_expression, timezone, next_run_at
FROM workflow_schedules
WHERE is_active = true
  AND next_run_at <= NOW()
ORDER BY next_run_at
LIMIT 25;
```

### Version history for a workflow (v1.3+)

```sql
SELECT version, message, created_by, created_at
FROM workflow_versions
WHERE tenant_id = $1 AND workflow_id = $2
ORDER BY version DESC
LIMIT 50;
```

---

## Conclusion

Relayon's data layer is **boring by design**. Three well-understood stores, each doing one job well. No ORM gymnastics, no dual-write transactions, no event sourcing ceremony. The complexity is in the **operational guarantees** (TTL, unique constraints, atomic claims), not the data model.

For schema changes or migration issues, open an issue at [github.com/zainshah3464/relayon](https://github.com/zainshah3464/relayon).
```

---