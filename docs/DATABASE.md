# Relayon — Database Design

> **Complete reference for Relayon's data layer — PostgreSQL + MongoDB + Redis.**

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

1. **PostgreSQL is the source of truth for "who/what"** — tenants, users, workflows, destinations. If PostgreSQL loses a row, money and trust are lost.

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
│ source_config  │  (JSON: { secret: "whsec_..." })
│ enrichment_*   │
│ transform_*    │
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
│ type           │  (enum: http | slack | email | sheets | postgres | mongodb)
│ name           │
│ config         │  (JSON: type-specific)
│ enabled        │
│ retry_policy   │  (JSON: { max_attempts, backoff_ms[] })
└────────────────┘

┌────────────────┐
│   ApiKey       │  (schema exists, UI not yet built)
│────────────────│
│ id (PK)        │
│ tenant_id (FK) │
│ name           │
│ key_hash (UQ)  │
│ last_used_at   │
│ expires_at     │
└────────────────┘
```

---

### Tables

#### `tenants`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | `gen_random_uuid()` |
| `name` | `text` | NOT NULL | Display name |
| `slug` | `text` | UNIQUE | URL-safe; auto-generated from `name` at signup |
| `plan` | `enum` | NOT NULL | `free` \| `pro` \| `enterprise` |
| `quota_events_per_month` | `int4` | NOT NULL | Default 10000 (free tier) |
| `quota_ai_tokens_per_month` | `int4` | NOT NULL | Default 100000 |
| `current_period_start` | `timestamptz` | NOT NULL | Billing period start |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | Auto-managed |

**Why `slug`:** Used in URLs (`/webhook/:tenantId/:workflowId` actually uses UUID, but slug is exposed in dashboard for human identification).

---

#### `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `tenant_id` | `uuid` | FK → tenants CASCADE | |
| `email` | `text` | UNIQUE, NOT NULL | |
| `password_hash` | `text` | NOT NULL | bcrypt cost 12 |
| `name` | `text` | NOT NULL | |
| `role` | `enum` | NOT NULL | `owner` \| `admin` \| `viewer` |
| `last_login_at` | `timestamptz` | NULL | Updated on login |
| `created_at`, `updated_at` | `timestamptz` | NOT NULL | |

**Why `email` is globally unique:** Not per-tenant. One email = one account. Simpler login flow (no tenant selection at login). If a user needs access to multiple tenants, add them to a `tenant_members` table later.

---

#### `refresh_tokens`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | FK → users CASCADE | |
| `tenant_id` | `uuid` | FK → tenants CASCADE | |
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
| `source_config` | `jsonb` | NOT NULL, default `{}` | Type-specific config |
| `enrichment_enabled` | `bool` | NOT NULL | Default `false` |
| `enrichment_prompt` | `text` | NULL | Custom LLM prompt |
| `transform_expression` | `text` | NULL | JSONata expression |
| `is_active` | `bool` | NOT NULL | Default `true` |
| `created_at`, `updated_at` | `timestamptz` | NOT NULL | |

**`source_config` shape per type:**
```json
// stripe, github, shopify, slack
{ "secret": "whsec_..." }

// generic
{ "secret": "...", "header": "x-webhook-signature", "encoding": "hex" | "base64" }
```

---

#### `destinations`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `workflow_id` | `uuid` | FK → workflows CASCADE | |
| `type` | `enum` | NOT NULL | `http` \| `slack` \| `email` \| `sheets` \| `postgres` \| `mongodb` |
| `name` | `text` | NOT NULL | |
| `config` | `jsonb` | NOT NULL, default `{}` | Type-specific |
| `enabled` | `bool` | NOT NULL | Default `true` |
| `retry_policy` | `jsonb` | NOT NULL | `{ max_attempts, backoff_ms[] }` |
| `created_at`, `updated_at` | `timestamptz` | NOT NULL | |

**Default `retry_policy`:**
```json
{
  "max_attempts": 5,
  "backoff_ms": [10000, 30000, 60000, 300000, 900000]
}
```

**`config` shape per type:**
```json
// http
{ "url": "https://...", "method": "POST", "headers": {...} }

// slack
{ "webhookUrl": "https://hooks.slack.com/services/..." }

// email (Resend)
{ "apiKey": "re_...", "to": ["a@x.com"], "from": "Relayon <noreply@y.com>" }

// sheets (service account)
{
  "spreadsheetId": "1abc...",
  "range": "Sheet1!A:Z",
  "serviceAccountEmail": "xxx@xxx.iam.gserviceaccount.com",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n..."
}
```

---

#### `api_keys` (schema ready, UI planned)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `tenant_id` | `uuid` | FK → tenants CASCADE | |
| `name` | `text` | NOT NULL | e.g., "Production Ingress" |
| `key_hash` | `text` | UNIQUE | SHA-256 of raw key |
| `last_used_at` | `timestamptz` | NULL | |
| `expires_at` | `timestamptz` | NULL | NULL = no expiry |
| `created_at` | `timestamptz` | NOT NULL | |

**Status:** Table exists; API endpoints not yet exposed. Planned for v1.1.

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

---

### Migrations

Relayon uses **Prisma Migrate** — versioned SQL migrations stored in `packages/db/prisma/migrations/`.

**Current migrations:**
- `20261018152226_init` — Initial schema (all tables above)

**Commands:**

```bash
# Create a new migration (dev only)
cd packages/db
npx prisma migrate dev --name add_xyz

# Apply pending migrations (production)
cd packages/db
DATABASE_URL="..." npx prisma migrate deploy

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
4. `npm run db:deploy` runs on next production deploy (via Vercel build)

**Idempotency:** All migrations are wrapped in transactions. `prisma migrate deploy` is safe to run multiple times.

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

**Write path:** Workers writes. API reads + updates (replay).
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
{ ttlExpiresAt: 1 }               // TTL: expire after 0s
```

**TTL behavior:** MongoDB runs a background thread every 60s. Expired documents are deleted lazily. This is **not** immediate — a document with `ttlExpiresAt = T` may live up to `T + 60s`.

---

## Redis Keys

All keys are prefixed by purpose. Namespacing prevents collisions.

| Pattern | Type | TTL | Written By | Read By |
|---|---|---|---|---|
| `queue:events:incoming` | List | None | Ingress | Workers |
| `queue:events:processing` | List | None | Workers | Workers |
| `queue:egress:pending` | List | None | Workers | Workers |
| `queue:egress:delayed` | ZSet | None | Workers | Workers |
| `idempotency:{workflowId}:{key}` | String | 86400s | Ingress | Ingress |
| `ratelimit:{workflowId}:{bucket}` | String | 120s | Ingress | Ingress |
| `circuit:dest:{destinationId}` | String | 300s | Workers | Workers |
| `groq:enrich:{hash}` | String | 3600s | Workers | Workers |

**Memory footprint estimate:**
- 1000 events in-flight × 2 KB avg = 2 MB
- 100 cached enrichments × 500 bytes = 50 KB
- Rate limit + idempotency keys: 1 KB × active workflows

Upstash M0 free tier (256 MB) is enough for **~50K daily events** with conservative headroom.

---

## Data Flow Between Stores

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
     │14. Call adapter (HTTP/Slack/Email/Sheets)
     │15. Update Delivery status (Mongoose)
     │16. ZADD to delayed queue on retry (Redis)
     ▼
┌──────────┐
│Dashboard │
└──────────┘
     │17. Read events (API → MongoDB)
     │18. Read deliveries (API → MongoDB)
     │19. Replay DLQ (API → MongoDB update)
     │20. Read workflows (API → PostgreSQL)
```

**Key insight:** Every read for a write happens via the **owning service's database**. The API never writes events (only Workers does). The API **does** write to MongoDB for DLQ replay — the only exception, documented.

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

---

## Conclusion

Relayon's data layer is **boring by design**. Three well-understood stores, each doing one job well. No ORM gymnastics, no dual-write transactions, no event sourcing ceremony. The complexity is in the **operational guarantees** (TTL, unique constraints, atomic claims), not the data model.

For schema changes or migration issues, open an issue at [github.com/zainshah3464/relayon](https://github.com/zainshah3464/relayon).
```

---