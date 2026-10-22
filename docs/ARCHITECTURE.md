# Relayon — Architecture

> **Deep dive into the system design, data flow, and engineering decisions behind Relayon.**

This document explains *why* Relayon is built the way it is — not just what it does. It's written for engineers who want to understand the system's tradeoffs before evaluating or contributing to it.

---

## Table of Contents

- [System Overview](#system-overview)
- [The 4 Apps](#the-4-apps)
- [End-to-End Data Flow](#end-to-end-data-flow)
- [Event Lifecycle](#event-lifecycle)
- [Key Design Decisions](#key-design-decisions)
- [Reliability Guarantees](#reliability-guarantees)
- [Failure Modes & Recovery](#failure-modes--recovery)
- [Serverless Constraints as Architecture](#serverless-constraints-as-architecture)
- [Scaling Path](#scaling-path)

---

## System Overview

Relayon is a **serverless-native integration platform** that sits between webhook sources (Stripe, GitHub, Shopify, Slack) and destinations (HTTP endpoints, Slack, Email, Google Sheets).

**Core promise:** *Receive events reliably → enrich with AI → transform → route to N destinations → never lose an event.*

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

**Responsibility:** UI for tenants to manage workflows, inspect events, replay DLQ entries, and view analytics.

**Why Angular:** Standalone components + signals give React-like reactivity with stronger typing. `HttpClient` interceptors make JWT refresh transparent. Enforced DI prevents prop-drilling across deep component trees.

**Stateless:** No server-side rendering. Pure static SPA served by Vercel's CDN. All API calls go to `relayon-api.vercel.app` and `relayon-ingress.vercel.app`.

**Bundle:** ~310 KB initial (87 KB gzipped), lazy-loaded feature chunks.

---

### 2. API (NestJS 11)

**Responsibility:** The **control plane**. Everything the dashboard reads/writes goes through here.

- Auth (signup, login, refresh, logout, me)
- Tenants (multi-tenant config)
- Workflows (CRUD)
- Destinations (CRUD)
- Events (read-only, MongoDB-backed)
- DLQ (read + replay + discard)
- Analytics (aggregations)

**Why NestJS:** Decorator-driven DI gives clean module boundaries. Global pipes (validation), guards (JWT), and filters (Sentry) apply uniformly. Guards enforce tenant isolation on every route.

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

**Responsibility:** The **data plane's engine**. Consumes from Redis, enriches, transforms, and delivers.

**Two processing loops:**
- `POST /internal/process` — pops from `queue:events:incoming`, runs AI enrichment + JSONata transform, writes to MongoDB, fans out to `queue:egress:pending`
- `POST /internal/deliver` — pops from `queue:egress:pending`, calls the destination adapter, retries on failure via `queue:egress:delayed` (ZSET), moves to DLQ on exhaustion

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

---

## End-to-End Data Flow

### Happy Path

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
       ├─ INSERT Event doc into MongoDB
       └─ Fan-out: one Delivery doc + egress job per destination
       │
       ▼
7. Workers /internal/deliver:
       ├─ RPOP queue:egress:pending
       ├─ Atomic claim: findOneAndUpdate (status: pending → delivering)
       ├─ Call adapter (HTTP/Slack/Email/Sheets)
       ├─ Success → status: delivered
       └─ Failure → ZADD queue:egress:delayed (score = now + backoff)
       │
       ▼
8. Dashboard shows event + delivery in UI
```

### Delivery Retry Path

```
Attempt 1 fails (503) → backoff 10s → ZADD queue:egress:delayed
Wait 10s → Cron pulls from delayed ZSET → Attempt 2
Attempt 2 fails → backoff 30s → ...
Attempt 5 fails → status: dlq, dlqReason: "Max retry attempts exhausted"
Dashboard shows DLQ entry → user clicks Replay → status: pending → picked up next cycle
```

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

## Key Design Decisions

### 1. Two databases — PostgreSQL + MongoDB

**Decision:** Split transactional data (PostgreSQL) from event/delivery logs (MongoDB).

**Why:**
- **PostgreSQL** — ACID guarantees for money-related data. Foreign keys, `FOR UPDATE` locks, atomic transactions. Tenants, users, workflows, destinations live here.
- **MongoDB** — Append-only high-volume logs. 30-day TTL indexes auto-delete old events. `Mixed` types store arbitrary webhook payloads. No schema migration when payload shape changes.

**Tradeoff:** Two databases = two connection pools = higher cold start time. But separating them means a MongoDB write failure doesn't corrupt transactional state. And TTL-based cleanup in MongoDB is free — no cron needed.

---

### 2. Redis queues instead of a message broker

**Decision:** Use Upstash Redis lists (LPUSH/RPOP/RPOPLPUSH) + sorted sets (ZADD/ZRANGEBYSCORE) instead of Kafka, RabbitMQ, or SQS.

**Why:**
- **Cost:** Free tier — 10K commands/day. Kafka/RabbitMQ start at $20-50/month.
- **Simplicity:** Redis primitives map directly to queue semantics. No separate broker to manage.
- **Serverless-friendly:** Redis over HTTP/TCP works from stateless functions. Kafka clients assume long-lived connections.

**Tradeoff:** Redis doesn't have Kafka's durability guarantees. If Upstash loses an LPUSH before it's persisted, the event is lost. **Mitigation:** Ingress returns `500` if `LPUSH` fails — the source retries.

---

### 3. `RPOPLPUSH` for at-least-once delivery

**Decision:** Use `RPOPLPUSH` (atomic move) to move events from `incoming` to `processing` queues.

**Why:** If the worker crashes mid-processing, the event stays in `processing` queue — it's not lost. A recovery scan re-queues stale `processing` entries after 5 minutes.

**Sequence:**
```
LPUSH incoming <event>     (Ingress writes)
    ↓
RPOPLPUSH incoming processing  (Worker reads + claims atomically)
    ↓
[process event, write to MongoDB]
    ↓
LREM processing 0 <event>   (Worker acks on success)
```

If the worker crashes between `RPOPLPUSH` and `LREM`, the event **stays in `processing` queue** but isn't acked. On next run, `recoverStuck()` (in egress for deliveries, similar pattern for events) re-queues it.

**Tradeoff:** At-least-once means a **duplicate is possible** if the crash happens *after* the MongoDB write but *before* `LREM`. Duplicate delivery is prevented by:
- Event-level: MongoDB `correlationId` has `unique: true` — duplicate insert fails, logged as "duplicate skip"
- Delivery-level: HTTP adapter sends `Idempotency-Key: {eventId}:{destinationId}` header — destination should dedupe
- Ingress-level: Redis idempotency `SET NX` on body-hash prevents duplicates from the source

**Result:** Duplicates are possible but rare, and every layer where they could occur has a dedup mechanism.

---

### 4. Graceful AI degradation

**Decision:** If Groq fails, the event still processes and delivers — just without enrichment.

**Why:** AI is a **nice-to-have**, not a **critical path**. The core promise is "event reaches destination." If an LLM API is down (which happens), blocking the event violates the promise.

**Implementation:** `ProcessingService.processOne()` wraps `groq.enrich()` in try/catch. On error:
- `enrichedPayload = null`
- `enrichment.error = <message>`
- Execution continues to transform + delivery

**Tradeoff:** Silent data loss is impossible (event still delivered), but enrichment failure is invisible to the source. **Mitigation:** Enrichment errors are surfaced in the dashboard's event detail drawer with a red badge.

---

### 5. Circuit breaker for unhealthy destinations

**Decision:** Pause a destination for 5 minutes after 5 consecutive failures.

**Why:** If Slack's API is down, we don't want to burn through Redis commands and Groq tokens retrying. Circuit breaker preserves quota and provides signal (the DLQ fills up, alerting the user).

**Implementation:** `circuit:dest:{id}` key in Redis. `INCR` on failure, `DEL` on success, `EXPIRE 300` on first increment. `isOpen()` checks `count >= 5`.

**Tradeoff:** A destination that fails once for a transient reason (deploy in progress) can pause real deliveries for 5 minutes. **Mitigation:** Configurable via env var `CIRCUIT_OPEN_DURATION_SEC` (default 300s).

---

### 6. `npx prisma generate` is banned

**Decision:** Prisma generate runs via `node ./node_modules/prisma/build/index.js generate` in Vercel build command.

**Why:** During deployment, `npx` couldn't find the local `prisma` binary (workspace `node_modules/.bin` not in `PATH`), so it fetched `prisma@latest` — which is now `8.0.0-rc.25` (a new CLI that **doesn't have a `generate` command**). Build failed with `CLI.UNKNOWN_COMMAND`.

**Fix:**
1. Pin `prisma` to exact version (`6.19.3`) in root `dependencies`
2. Use absolute path: `node ./node_modules/prisma/build/index.js generate --schema=./packages/db/prisma/schema.prisma`
3. Never trust `npx` in CI/build — always use local binary paths

**Tradeoff:** Ugly command. **Mitigation:** Documented in `DEPLOYMENT.md` and this file so future engineers don't repeat it.

---

## Reliability Guarantees

| Guarantee | Mechanism |
|---|---|
| **At-least-once delivery** | `RPOPLPUSH` + `LREM` after ack; 5-min stuck recovery |
| **Event-level idempotency** | MongoDB unique `correlationId` |
| **Ingress dedup** | Redis `SET NX EX 86400` on body-hash |
| **Delivery dedup** | HTTP adapter sends `Idempotency-Key` header |
| **Retry with backoff** | ZSET `queue:egress:delayed` with score = `now + backoff` |
| **DLQ** | `status: 'dlq'` after max retries; replayable from UI |
| **Circuit breaker** | `circuit:dest:{id}` counter with 5-min TTL |
| **Graceful AI degradation** | Try/catch around Groq; event still processes |
| **Atomic destination claim** | MongoDB `findOneAndUpdate` (only one worker wins) |
| **Stuck recovery** | Scan for `status: 'delivering'` with `lastAttemptAt < now - 5min` |

---

## Failure Modes & Recovery

### PostgreSQL down

- **Ingress:** Fails fast with `500` (can't resolve workflow). Source retries.
- **Workers:** `/internal/process` returns `500`. Cron will retry in 2 hours.
- **API:** All routes return `500`. Dashboard shows error toast.

**Recovery:** Automatic — Prisma reconnects on next query. Neon has connection pooling.

---

### MongoDB down

- **Workers:** `/internal/process` fails to log the event → error return. Event stays in `processing` queue, `recoverStuck` re-queues it.
- **API:** Events/DLQ endpoints return `500`. Workflows/destinations still work (they're in PostgreSQL).

**Recovery:** Atlas reconnects automatically. If down >5 min, stuck events are re-queued.

---

### Redis down

- **Ingress:** `500` on all webhooks (can't LPUSH). Source retries.
- **Workers:** `/internal/process` and `/internal/deliver` return `500`.

**Recovery:** Upstash auto-recovers within ~1 min. Events continue once up.

**Risk:** Events accepted by Ingress but stuck in Redis if Redis dies mid-operation. This is why **Ingress returns 500 on LPUSH failure** — the source is responsible for retry.

---

### Groq down

- **Workers:** `groq.enrich()` throws → caught → `enrichment.error` set → event still processes.

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

## Serverless Constraints as Architecture

Vercel Hobby has three **hard limits** that shaped Relayon's design:

### Constraint 1 — Cron runs once per day (Hobby)

**Impact:** Can't rely on Vercel Cron for the 2-hour processing cadence.

**Solution:** External cron (GitHub Actions, cron-job.org, or Upstash QStash) hits `/internal/process` and `/internal/deliver` every 2 hours.

**Tradeoff:** GitHub Actions is best-effort (10-60 min delay possible). For tighter SLA, upgrade to Vercel Pro ($20/mo) and use native crons.

---

### Constraint 2 — Functions are stateless, 10-60s duration limit

**Impact:** Can't run a persistent worker process. Can't keep a WebSocket open.

**Solution:** Every function invocation is a **batch of N events** (default `BATCH_SIZE=3`, `TIME_BUDGET_MS=7000`). State lives in Redis + MongoDB, not in memory. Cold starts are cached (`cachedServer` in Workers `main.ts`).

**Tradeoff:** Cold starts add 1-2s per invocation. Mitigated by batching and by keeping Workers `main.ts` minimal.

---

### Constraint 3 — Monorepo build with `npm ci`

**Impact:** `postinstall` scripts can't find workspace binaries in `PATH`.

**Solution:** Move `prisma generate` from `postinstall` to `buildCommand`; use absolute paths (`node ./node_modules/prisma/build/index.js`).

**Tradeoff:** Ugly build config. Documented above.

---

## Scaling Path

Relayon is designed to **degrade gracefully**, not scale infinitely on free tier. Here's the honest scaling path:

### At 10K events/month (current free tier)

- All services on free tier
- No changes needed

### At 100K events/month

**Bottleneck:** Upstash Redis 10K commands/day (≈ 300K/month), Groq 14.4K requests/day.

**Actions:**
- Upgrade Upstash ($5/mo → 1M commands/month)
- Cache Groq responses more aggressively (TTL 1h → 6h)
- Consider pre-computing common enrichments

### At 1M events/month

**Bottleneck:** Neon PostgreSQL connection limits, MongoDB M0 512MB storage.

**Actions:**
- Neon Pro ($19/mo → 500 connections, 10GB storage)
- MongoDB M2 ($9/mo → 2GB storage, better throughput)
- Add read replica for API
- Move Workers to Fly.io for persistent execution (no cold starts)

### At 10M events/month

**Bottleneck:** Vercel function invocations, single-region latency.

**Actions:**
- Migrate Ingress to dedicated infrastructure (AWS Lambda + API Gateway, or bare-metal Go/Rust)
- Sharded MongoDB or ClickHouse for analytics
- Multi-region Workers
- Kafka or Pulsar for the queue (Redis becomes cache-only)

**No code changes required** at any step — only infrastructure. The interfaces (HTTP, Redis, MongoDB) are stable.

---

## Conclusion

Relayon's architecture is **deliberately boring**. No microservices mesh, no service discovery, no custom RPC. Four apps, three databases, two queues. The complexity is in the *reliability primitives* (`RPOPLPUSH`, DLQ, circuit breakers, graceful degradation), not in the topology.

This is what "production-grade on free tier" looks like: **honest tradeoffs, documented failure modes, and every guarantee backed by a specific mechanism.**

For questions or corrections, open an issue at [github.com/zainshah3464/relayon](https://github.com/zainshah3464/relayon).
```

---


## ✅ Ab Yeh Karo

**Step 1** — `docs/` folder banao project root mein:
```cmd
cd F:\projects\relayon
mkdir docs
```

**Step 2** — Do files banao:
- `docs/ARCHITECTURE.md` — upar wala content paste
- `docs/API_REFERENCE.md` — upar wala content paste

**Step 3** — README mein link add karo (optional):
```markdown
## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Deployment Guide](./DEPLOYMENT.md)
```

**Step 4** — Commit + Push:
```cmd
git add docs/
git commit -m "docs: add architecture and API reference"
git push
```

---

## 📋 Ab Batao — Next Files Chahiye?

Jab yeh 2 files add ho jayein, bataao — main **next 3 files** dunga:

1. **`docs/DATABASE.md`** — Schema, ERD, indexes, migrations guide
2. **`docs/SECURITY.md`** — Threat model, auth flow, RLS, secret management
3. **`docs/TESTING.md`** — Testing strategy, smoke tests, CI setup

**Bhai, yeh files aapke GitHub repo ko "production-grade open-source project" se "documented production-grade open-source project" bana dengi — aur interviewers yahi dekhte hain.** 🚀💪