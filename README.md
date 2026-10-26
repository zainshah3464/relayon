
<div align="center">

# ⚡ Relayon

**Your webhooks, relayed right.**

*Serverless-native webhook relay platform — receive, enrich with AI, transform, schedule, version, encrypt, and route events to any destination reliably. Built entirely on free-tier infrastructure.*

[![Live Demo](https://img.shields.io/badge/Live-relayon.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://relayon.vercel.app)
[![Version](https://img.shields.io/badge/version-1.5.0-success?style=for-the-badge)](https://github.com/zainshah3464/relayon/releases)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](./LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Angular](https://img.shields.io/badge/Angular-19-DD0031?style=flat-square&logo=angular&logoColor=white)](https://angular.dev)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com)
[![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://neon.tech)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?style=flat-square&logo=redis&logoColor=white)](https://upstash.com)
[![Groq](https://img.shields.io/badge/Groq-AI-F55036?style=flat-square)](https://groq.com)

[**Live Demo**](https://relayon.vercel.app) · [**Documentation**](#-documentation) · [**API Reference**](./docs/API_REFERENCE.md) · [**Roadmap**](./docs/ROADMAP.md)

</div>

---

## 📖 Table of Contents

<details open>
<summary><strong>Click to expand</strong></summary>

- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [Live in Production](#-live-in-production)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Data Flow](#-data-flow)
- [Quick Start](#-quick-start)
- [Testing](#-testing)
- [Documentation](#-documentation)
- [Deployment](#-deployment)
- [Why This Project](#-why-this-project)
- [Security](#-security)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Contact](#-contact)

</details>

---

## 🎯 The Problem

Every SaaS company writes the **same integration code** over and over:

```typescript
// 1. Receive Stripe webhook
// 2. Verify signature
// 3. Extract data
// 4. Send to Slack
// 5. Log to Google Sheets
// 6. Update the database
// 7. Retry on failure
// 8. Handle dead letters manually
// 9. Repeat for Shopify, GitHub, Stripe, Slack...
```

This is:
- **Repetitive** — every company solves it from scratch
- **Error-prone** — missing retries, silent failures, duplicate deliveries
- **Expensive** — Zapier charges **$200–500/month** for the same functionality
- **Vendor-locked** — no way to self-host or export your workflows

---

## ✨ The Solution

**Relayon turns that into configuration, not code.**

```
┌─────────────────┐
│  Webhook Source │  ← Stripe, GitHub, Shopify, Slack, or any HTTP
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              RELAYON PIPELINE                       │
├─────────────────────────────────────────────────────┤
│  1. Verify signature (HMAC-SHA256, timing-safe)    │
│  2. Deduplicate (Redis idempotency, 24h TTL)       │
│  3. Rate limit (300 req/min per workflow)          │
│  4. Enrich with AI (Groq GPT-OSS-120B, cached)     │
│  5. Transform (JSONata expressions)                │
│  6. Conditional routing (JSONata rules)            │
│  7. Fan out to N destinations (retry + DLQ)        │
│  8. Circuit-break unhealthy destinations           │
│  9. Encrypt credentials at rest (AES-256-GCM)      │
│ 10. Version every config change (snapshot + diff)  │
│ 11. Fire on cron schedules (DB-backed, serverless) │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Destinations: 9 adapters                          │
│  HTTP · Slack · Email · Google Sheets · Discord    │
│  Airtable · Notion · PostgreSQL · MongoDB          │
└─────────────────────────────────────────────────────┘
```

Configure once. Every event flows through reliably — from webhooks **or** from cron schedules.

---

## 🌐 Live in Production

**v1.5.0 is deployed and running on Vercel's free tier:**

| Service | URL | Status |
|---|---|---|
| **Dashboard** | [`relayon.vercel.app`](https://relayon.vercel.app) | ✅ Live |
| **API** | [`relayon-api.vercel.app`](https://relayon-api.vercel.app/api/health) | ✅ Live |
| **Ingress** | [`relayon-ingress.vercel.app`](https://relayon-ingress.vercel.app/health) | ✅ Live |
| **Workers** | [`relayon-workers.vercel.app`](https://relayon-workers.vercel.app/internal/health) | ✅ Live |

**Total infrastructure cost: $0/month.**

<table>
<tr>
<td align="center"><strong>Login Page</strong><br/><br/>
<a href="https://relayon.vercel.app/login"><img src="./docs/screenshots/login.png" width="400" alt="Relayon login"/></a>
</td>
<td align="center"><strong>Dashboard</strong><br/><br/>
<a href="https://relayon.vercel.app/dashboard"><img src="./docs/screenshots/dashboard.png" width="400" alt="Relayon dashboard"/></a>
</td>
</tr>
<tr>
<td align="center"><strong>Workflow Detail + Schedule + Versions</strong><br/><br/>
<img src="./docs/screenshots/workflow.png" width="400" alt="Workflow detail with schedule card and version history button"/>
</td>
<td align="center"><strong>Event Explorer</strong><br/><br/>
<img src="./docs/screenshots/events.png" width="400" alt="Event explorer"/>
</td>
</tr>
<tr>
<td align="center"><strong>Analytics + Time-Series Chart</strong><br/><br/>
<img src="./docs/screenshots/analytics.png" width="400" alt="Analytics with SVG time-series chart"/>
</td>
<td align="center"><strong>Version Diff View</strong><br/><br/>
<img src="./docs/screenshots/diff.png" width="400" alt="Line-level version diff"/>
</td>
</tr>
</table>

> **Note:** Screenshots not yet captured. If you visit the live demo, feel free to open a PR with screenshots.

---

## 🚀 Features

### Ingress — Webhook Reception

- **5 signature verifiers** — Stripe, GitHub, Shopify, Slack, Generic HMAC
- **Timing-safe comparison** — prevents timing attacks (`crypto.timingSafeEqual`)
- **Timestamp tolerance** — configurable window (default 300s) for Stripe/Slack
- **Redis idempotency** — `SET NX EX 86400` on body-hash or `X-Event-Id` header
- **Rate limiting** — 300 req/min per workflow
- **5 MB payload limit** — rejects oversized requests cleanly
- **Correlation IDs** — traceable across all services

### AI Enrichment — Intelligence Layer

- **Groq LLM** — `openai/gpt-oss-120b` for summarize, classify, extract, translate
- **1-hour Redis cache** — identical payloads served from cache
- **Graceful degradation** — event still processes if Groq is down
- **Custom prompts** — per-workflow enrichment instructions
- **JSON-mode output** — strict validation, no hallucinated fields

### Transform — Data Reshaping

- **JSONata expressions** — powerful, safe, no `eval()`
- **2-second timeout** — prevents runaway expressions
- **Compile-time errors** — surfaced clearly in event logs
- **Preview endpoint** (v1.2+) — test expressions against sample payloads before saving

### Conditional Routing (v1.1+)

- **JSONata rules** — `{ when: string, destinationIds: string[] }`
- **First-match wins** — first rule whose expression evaluates to `true` routes the event
- **Empty rules = route to all** — default behavior for existing workflows
- **No rule matched → no delivery** — but event still marked processed (debuggable via logs)

### Delivery — Multi-Destination Routing

- **9 adapters** (up from 4 in v1.0):
  - **HTTP** — webhook with custom headers
  - **Slack** — webhook URL
  - **Email** — Resend API
  - **Google Sheets** — service account JWT
  - **Discord** (v1.2+) — webhook URL
  - **Airtable** (v1.3+) — PAT + base + table
  - **Notion** (v1.3+) — integration token + data source
  - **PostgreSQL** (v1.4+) — connection string + column mapping + upsert
  - **MongoDB** (v1.4+) — connection string + upsert key
- **Exponential backoff** — 10s → 30s → 1m → 5m → 15m (configurable per destination)
- **Dead Letter Queue** — after max retries, replayable via dashboard (single or bulk)
- **Circuit breaker** — pause unhealthy destinations (5 failures / 5 min)
- **At-least-once semantics** — `RPOPLPUSH` + atomic Mongo claim + 5-min stuck recovery
- **Idempotency-Key headers** — `{eventId}:{destinationId}` sent to HTTP destinations
- **`__dryRun` safety** (v1.5+) — validation never writes to destination; every adapter uses a safe probe

### Scheduled Workflows (v1.3+)

- **DB-backed cron** — `workflow_schedules` table, not in-memory (Vercel-friendly)
- **Atomic claim** — `updateMany` with `nextRunAt <= now` predicate prevents duplicates under concurrent ticks
- **Presets + custom** — every 15 min, hourly, daily at 9 AM, weekdays, weekly, or custom 5-field cron
- **Timezone-aware** — IANA tz names, defaults to UTC
- **Payload template** — arbitrary JSON injected as `rawPayload.data`
- **Run-now** (v1.4+) — trigger immediately without waiting for next tick
- **Bulk pause/resume** (v1.5+) — pause all schedules, resume recomputes `nextRunAt` to avoid fire storm

### Workflow Versioning (v1.3+)

- **Immutable snapshots** — every create/update/import/restore produces a new version
- **50-version cap** — older versions trimmed automatically
- **Restore** — recreate workflow from snapshot, produces new version (history stays linear)
- **Line-level diff** (v1.5+) — `diff@7` unified patch, color-coded in dashboard (green `+`, red `-`, cyan `@@`)

### Credential Encryption (v1.3+)

- **AES-256-GCM** — authenticated encryption, tamper detection
- **HKDF per-tenant keys** — compromise of one tenant's key doesn't expose another's
- **Key rotation** (v1.4+) — multi-key keyring, `enc:v2:<kid>:` envelope, zero-downtime rotation via script
- **Client redaction** — API responses always return `••••••••`, never ciphertext, never plaintext
- **Full-config mode** (v1.5+) — `FULL_CONFIG_ENCRYPTION=true` encrypts every non-metadata field

### API Keys (v1.2+)

- **Stripe-style format** — `rlk_<live|test>_<8hex-prefix>_<48hex-secret>`
- **SHA-256 + pepper** — fast enough for API auth, pepper defends against rainbow tables
- **Show-once UX** — raw key returned only at creation, never retrievable again
- **8 scopes** — `events:read`, `workflows:read`, `workflows:write`, `destinations:read`, `destinations:write`, `dlq:read`, `dlq:write`, `analytics:read`
- **Hybrid guard** — `JwtOrApiKeyGuard` accepts JWT or `X-API-Key` header
- **Rotation** (v1.5+) — grace window (old key valid for 24h), zero downtime

### Destination Validation (v1.5+)

- **Two-layer check** — schema validation + optional real dry-run via workers
- **Safe probes per adapter** — HEAD request (HTTP), auth check (Email), metadata (Sheets), ping (Mongo), `SELECT 1` (PG), URL format only (Slack/Discord)
- **Graceful fallback** — if workers unreachable, schema-only validation with warning
- **Per-field errors** — `{ field: string, message: string }[]`

### Dashboard — Control Plane

- **Workflow builder** — create pipelines via UI (no curl needed)
- **Schedule card** (v1.3+) — add/edit/pause/resume schedule, Run-now button
- **Version history drawer** (v1.3+) — list versions, view snapshot, restore, diff
- **Event explorer** — cursor-paginated list, filter by status, full lifecycle view
- **DLQ manager** — inspect failures, replay with one click, bulk replay/discard
- **Analytics** — events 24h/7d, success rate, pending count, DLQ count, per-destination breakdown
- **Time-series charts** (v1.2+) — pure SVG, zero chart-library dependency, hover tooltips
- **API Keys tab** (v1.2+) — create, list, revoke, rotate
- **Destination validation** (v1.5+) — "Test connection" button with green/red inline result
- **Multi-tenant** — JWT auth, refresh token rotation, role-based access
- **Responsive** — mobile sidebar toggle, adaptive layouts

### Observability — Production Ops

- **Sentry integration** — optional DSN, captures exceptions in all 3 backends
- **Structured JSON logs** — correlation IDs, stage markers, duration tracking
- **Health endpoints** — `/api/health`, `/health`, `/internal/health` with dependency checks
- **Adapter list endpoint** — `/internal/adapters` returns registered adapters (debug)
- **Smoke test** — `scripts/smoke-test.mjs` with 10 checks across all services
- **Per-feature manual checklists** — documented in `docs/TESTING.md` for v1.1-v1.5 features

---

## 🏛 Architecture

**4 apps, 1 monorepo, 3 data stores, deployed as 4 independent Vercel projects.**

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│    Dashboard     │  │       API        │  │     Ingress      │  │     Workers      │
│   (Angular 19)   │◄─┤   (NestJS 11)    │  │   (Express 5)    │  │   (NestJS 11)    │
│                  │  │                  │  │                  │  │                  │
│ Control plane    │  │  Auth, CRUD      │  │  Webhook front   │  │  AI, transforms  │
│ User interface   │  │  Analytics       │  │  Signature verify│  │  Delivery        │
│                  │  │  Schedules       │  │                  │  │  Schedules       │
│                  │  │  Versions        │  │                  │  │  Dry-run         │
│                  │  │  API keys        │  │                  │  │  Encryption      │
└──────────────────┘  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
                               │                     │                     │
                               ▼                     ▼                     ▼
                      ┌─────────────────────────────────────────────────────────┐
                      │              Shared Data Layer                          │
                      ├─────────────────────────────────────────────────────────┤
                      │  PostgreSQL (Neon)   — tenants, users, workflows,       │
                      │                        destinations, schedules,        │
                      │                        versions, api_keys              │
                      │  MongoDB (Atlas M0)  — events, deliveries (TTL 30d)     │
                      │  Redis (Upstash)     — queues, cache, rate limits       │
                      └─────────────────────────────────────────────────────────┘
                                                │
                                ┌───────────────┼───────────────┐
                                ▼               ▼               ▼
                         ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                         │    Groq     │ │  Sentry     │ │  External   │
                         │  (AI/LLM)   │ │  (errors)   │ │ Destinations│
                         └─────────────┘ └─────────────┘ └─────────────┘
```

### Why 4 apps, not a monolith?

Vercel serverless functions have **10s duration limits** and **cold starts**. A monolith would:
- Load ALL dependencies for every request (slow cold start)
- Handle webhook parsing AND AI AND delivery in one invocation (10s timeout)

Splitting into 4 apps:
- **Ingress** — minimal deps (Express + ioredis), fast cold start (~500ms)
- **API** — NestJS + Prisma, medium cold start (~800ms)
- **Workers** — full AI stack + 9 adapters, slow cold start (~1200ms), but batching amortizes it
- **Dashboard** — static SPA, CDN-served, zero cold starts

Each app is **optimized for its workload**.

---

## 🛠 Tech Stack

<table>
<tr>
<td width="50%" valign="top">

### Frontend
- **Angular 19** (standalone, signals)
- **TypeScript 5.7** (strict)
- **Tailwind CSS** + custom design tokens
- **RxJS** for reactive streams
- **Pure SVG** for time-series charts (no Chart.js, no D3)

### Backend — Control Plane
- **NestJS 11** (modular DI)
- **Prisma ORM** (PostgreSQL)
- **Mongoose** (MongoDB reads)
- **JWT** + refresh token rotation
- **API keys** (SHA-256 + pepper, scoped)
- **class-validator** (DTO validation)

### Backend — Data Plane
- **Express 5** (webhook ingress)
- **NestJS 11** (workers)
- **ioredis** (Redis client)
- **Zod** (env validation)
- **crypto-box** (AES-256-GCM + HKDF)

</td>
<td width="50%" valign="top">

### Data Stores
- **PostgreSQL** — Neon (free tier)
- **MongoDB** — Atlas M0 (free tier)
- **Redis** — Upstash (free tier)

### AI & Integrations
- **Groq** — `openai/gpt-oss-120b` (LLM)
- **JSONata** — Transform + routing expressions
- **diff@7** — Unified line-level diffs
- **Resend** — Email delivery
- **Google Sheets API** — Service account JWT
- **Airtable / Notion** — REST APIs
- **pg / pg-format** — SQL-safe identifiers
- **mongodb** — Native driver

### Infrastructure
- **Vercel Hobby** — 4 projects, $0/month
- **Sentry** — Error tracking (optional)
- **GitHub Actions** — CI + cron + keep-alive

</td>
</tr>
</table>

---

## 🔄 Data Flow

### Webhook path

```
1. Webhook arrives  →  Stripe POST /webhook/{tenantId}/{workflowId}
                       │
                       ▼
2. Ingress          →  ├─ Verify HMAC signature (decrypt secret first — v1.3+)
                       ├─ Check idempotency (Redis SET NX)
                       ├─ Enforce rate limit (Redis INCR)
                       ├─ LPUSH to queue:events:incoming
                       └─ Return 202 Accepted

3. Workers          →  ├─ RPOPLPUSH incoming → processing
                       ├─ Load workflow config (batched)
                       ├─ Groq AI enrichment (cached 1h)
                       ├─ JSONata transform (2s timeout)
                       ├─ Conditional routing (JSONata rules — v1.1+)
                       ├─ INSERT Event doc (MongoDB)
                       ├─ Fan out: 1 Delivery doc per destination
                       └─ LPUSH to queue:egress:pending

4. Egress           →  ├─ RPOP from egress queue
                       ├─ Atomic claim (findOneAndUpdate)
                       ├─ Decrypt destination config (v1.3+)
                       ├─ Call adapter (HTTP/Slack/Email/Sheets/Discord/
                       │               Airtable/Notion/PG/Mongo)
                       ├─ Success → status: 'delivered'
                       └─ Failure → ZADD to delayed queue (backoff)

5. Dashboard        →  Read events, deliveries, DLQ
                       Replay failed deliveries
                       View analytics + charts
                       Manage schedules, versions, API keys
```

### Scheduled workflow path (v1.3+)

```
1. External cron hits POST /internal/schedule/tick every 5 min
                       │
                       ▼
2. Workers tick     →  ├─ SELECT due schedules (isActive AND nextRunAt <= now)
                       ├─ Atomic claim via updateMany (nextRunAt guard)
                       ├─ Compute nextRunAt from cron-parser
                       ├─ LPUSH synthetic event → queue:events:incoming
                       └─ Same pipeline as webhook (enrich, transform, route, deliver)

3. Run-now button   →  POST /api/workflows/:id/schedule/run-now
                       → API forwards to Workers /internal/schedule/run-now
                       → Workers LPUSH synthetic event (type: 'relayon.schedule.manual')
                       → nextRunAt untouched (cron stays scheduled)
```

### Destination validation path (v1.5+)

```
1. "Test connection"  →  POST /api/destinations/validate { dryRun: true }
                       │
                       ▼
2. API              →  ├─ Schema validation (required keys, shape regex)
                       ├─ Forward to Workers /internal/egress/dry-run
                       │
                       ▼
3. Workers          →  ├─ Load adapter by type
                       ├─ Add __dryRun: true to config
                       ├─ Call adapter.send()
                       └─ Safe probe per adapter (never writes):
                           HTTP → HEAD request
                           Slack/Discord → URL format only (can't test without sending)
                           Email → auth check (no email sent)
                           Sheets → metadata fetch (no row appended)
                           Airtable → base tables list (no record)
                           Notion → data source fetch (no page)
                           PostgreSQL → SELECT 1 (no INSERT)
                           MongoDB → ping (no insert)
```

**Reliability guarantees:**
- At-least-once delivery (`RPOPLPUSH` + `LREM` after ack)
- Event deduplication (MongoDB unique `correlationId`)
- Delivery deduplication (`Idempotency-Key` header)
- Retry with exponential backoff (5 attempts default, configurable per destination)
- Dead Letter Queue (permanent failures, replayable individually or in bulk)
- Circuit breaker (unhealthy destinations paused 5 min after 5 consecutive failures)
- Stuck recovery (5-minute scan for orphaned deliveries)
- Atomic schedule claim (no duplicate fires under concurrent ticks)
- Encryption at rest with per-tenant HKDF keys
- Zero-downtime key rotation via multi-key keyring

---

## ⚡ Quick Start

### Prerequisites

- **Node.js 22+**
- Free accounts on [Neon](https://neon.tech), [MongoDB Atlas](https://cloud.mongodb.com), [Upstash](https://console.upstash.com), [Groq](https://console.groq.com)

### 1. Clone & install

```bash
git clone https://github.com/zainshah3464/relayon.git
cd relayon
npm install
```

### 2. Environment

```bash
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example apps/api/.env.local
cp apps/ingress/.env.example apps/ingress/.env.local
cp apps/workers/.env.example apps/workers/.env.local
```

Fill in the values from your free-tier accounts. Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run once per secret: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `IP_HASH_SALT`, `CRON_SECRET`, **`API_KEY_PEPPER`** (v1.2+), **`CONNECTOR_ENCRYPTION_KEYS`** (v1.4+).

**⚠️ v1.3+ note:** `CONNECTOR_ENCRYPTION_KEY` (v1.3, single) or `CONNECTOR_ENCRYPTION_KEYS` (v1.4+, plural) must be **identical** in `apps/api/.env.local` and `apps/workers/.env.local`. Mismatched keys → every delivery fails with `Credential decryption failed` DLQ.

### 3. Migrate & run

```bash
npm run db:generate
npm run db:deploy
```

Then in **4 separate terminals**:

```bash
npm run dev:api        # :3001
npm run dev:ingress    # :3002
npm run dev:workers    # :3003
npm run dev:dashboard  # :4200
```

**Dashboard:** [http://localhost:4200](http://localhost:4200)
**Sign up, create a workflow, send a webhook, add a schedule.** Done in 3 minutes.

**Expected workers startup log:**

```
[AdapterRegistry] Adapter registered: http → HttpAdapter
[AdapterRegistry] Adapter registered: slack → SlackAdapter
[AdapterRegistry] Adapter registered: email → EmailAdapter
[AdapterRegistry] Adapter registered: sheets → SheetsAdapter
[AdapterRegistry] Adapter registered: discord → DiscordAdapter
[AdapterRegistry] Adapter registered: airtable → AirtableAdapter
[AdapterRegistry] Adapter registered: notion → NotionAdapter
[AdapterRegistry] Adapter registered: postgres → PostgresAdapter
[AdapterRegistry] Adapter registered: mongodb → MongoDbAdapter
```

If you see less than 9 adapters, one is missing from `EgressModule.providers`.

---

## 🧪 Testing

```bash
# Type check across all workspaces
npm run typecheck

# Build all 4 apps (catches build-time errors)
npm run build:dashboard && npm run build:api && \
npm run build:ingress && npm run build:workers

# Smoke test against production
CRON_SECRET=<your-secret> npm run smoke
```

**Current coverage (v1.5 — honest):**
- ✅ Smoke test: 10 checks across all services (unchanged from v1.0)
- ✅ Manual feature checklists: **~25 checks** across v1.1-v1.5 features (see [docs/TESTING.md](./docs/TESTING.md#feature-specific-manual-tests))
- ✅ Manual E2E: 13-step documented flow
- ⏳ **Unit tests: 0** — 5 versions shipped without any. This is documented as **v2.0's non-negotiable P0 blocker** (see [Roadmap](./docs/ROADMAP.md))

**Why no unit tests?** Each version prioritized shipping the next feature. The checklists in `docs/TESTING.md` are the specification for the tests v2.0 will add. **Any test PR is prioritized over feature PRs until v2.0's testing goal is met.**

**CI:** GitHub Actions runs `typecheck + 4 builds` on every push to `main`. Smoke test runs manually after deploy (not in CI — would hit production on every push).

---

## 📚 Documentation

Full documentation set — **11 deep-dive files**:

| File | Contents |
|---|---|
| [**Architecture**](./docs/ARCHITECTURE.md) | System design, data flow, key engineering decisions, failure modes |
| [**API Reference**](./docs/API_REFERENCE.md) | Complete HTTP API for all 3 services (80+ endpoints) |
| [**Database**](./docs/DATABASE.md) | PostgreSQL schema, MongoDB collections, Redis keys, migrations |
| [**Security**](./docs/SECURITY.md) | Threat model, auth flow, encryption at rest, key rotation, honest gaps |
| [**Testing**](./docs/TESTING.md) | Test strategy, smoke test, per-version manual checklists, untested areas |
| [**Troubleshooting**](./docs/TROUBLESHOOTING.md) | 40+ real issues and verified fixes from v1.0-v1.5 |
| [**Contributing**](./docs/CONTRIBUTING.md) | Dev setup, adapter guide, safety rejections, commit convention |
| [**Changelog**](./docs/CHANGELOG.md) | Full history v1.0 → v1.5, every real bug fixed, honest limitations |
| [**Roadmap**](./docs/ROADMAP.md) | Actual shipped vs planned, v2.0 test-first commitment, explicit non-goals |
| [**FAQ**](./docs/FAQ.md) | 50+ questions honestly answered, including "why no unit tests" |
| [**Deployment Guide**](./DEPLOYMENT.md) | 4-project Vercel setup, encryption env vars, 3 cron jobs, deploy-delta reference |

---

## 🚢 Deployment

See [**DEPLOYMENT.md**](./DEPLOYMENT.md) for the full guide. Summary:

| Step | Action |
|---|---|
| 1 | Create 4 Vercel projects (dashboard, api, ingress, workers) from same repo |
| 2 | Set Root Directory for each (`apps/dashboard`, `apps/api`, etc.) |
| 3 | Enable **"Include source files outside Root Directory"** for backends |
| 4 | Add environment variables per service (**includes `CONNECTOR_ENCRYPTION_KEYS` from v1.4, identical on API + Workers**) |
| 5 | Deploy in order: **API → Ingress → Workers → Dashboard** |
| 6 | **Back-fill `WORKERS_URL` on API**, redeploy API (required for v1.4 run-now) |
| 7 | Set up **external cron (3 jobs)**: `/internal/process`, `/internal/deliver`, `/internal/schedule/tick` every 5 min |
| 8 | Run smoke test against live URLs |

**Total deployment time:** ~20 minutes (up from 15 in v1.0 — encryption keys + back-fill loop + third cron add steps).
**Total cost:** **$0/month** on free tiers.

---

## 💡 Why This Project

### Serverless constraints as architecture, not limitation

Vercel Hobby has **4 hard limits** that shaped Relayon's design:

1. **Cron runs once per day** → external cron (cron-job.org, QStash)
2. **Functions are stateless** → Redis queues for state, DB-backed schedules (not in-memory)
3. **10s function duration** → batch processing with time budgets
4. **Cold starts 200-1500ms** → 4 separate apps, each optimized for its workload

These aren't compromises — they're **the design**.

### Reliability is the product

- **At-least-once delivery** proven with `RPOPLPUSH` + atomic Mongo claims
- **Circuit breaker** prevents cascading failures
- **DLQ** makes every failure recoverable
- **Graceful degradation** when AI fails
- **Atomic schedule claim** prevents duplicate fires under concurrent ticks
- **`__dryRun` safety** prevents validation from writing to production destinations

### Security at rest

**The v1.0 → v1.3 gap is closed.** In v1.0, credentials were plaintext in PostgreSQL. In v1.5:
- AES-256-GCM authenticated encryption
- HKDF per-tenant derived keys (compromise of one tenant doesn't expose another)
- Zero-downtime key rotation via multi-key keyring
- Client-side redaction (never returns ciphertext)
- Optional full-config encryption (`FULL_CONFIG_ENCRYPTION=true`)

A DB dump without the master keyring is useless ciphertext.

### Honest about gaps

- **0 unit tests across 5 versions** — documented, not hidden. v2.0 is where this stops.
- **No MFA/TOTP** — password-only login, documented gap.
- **No SOC 2 / HIPAA / GDPR** — honest limitation, not marketing.
- **Every version's `Known Limitations` section is as long as its `Added` section** — see [CHANGELOG](./docs/CHANGELOG.md).

### Not a toy project

- **~30,000+ lines** of TypeScript across 4 apps
- **11 documentation files** with deep engineering dives
- **9 destination adapters**, each with `__dryRun` safety
- **Real production deployment** at `relayon.vercel.app`
- **MIT licensed** — fork, modify, self-host, sell

---

## 🔒 Security

Relayon takes security seriously — and is honest about what it does and doesn't cover:

**Implemented:**
- ✅ Multi-tenant isolation (application + database layer)
- ✅ JWT auth with refresh token rotation
- ✅ **API keys** with scoped access + rotation (v1.2-v1.5)
- ✅ HMAC signature verification (timing-safe)
- ✅ Encrypted connections (HTTPS, `rediss://`, `sslmode=require`)
- ✅ Rate limiting on all endpoints
- ✅ Secrets in encrypted env vars (Vercel)
- ✅ IP hashing (raw IPs never stored)
- ✅ Zero `eval()` / zero dynamic code execution
- ✅ **Credentials encrypted at rest** — AES-256-GCM + HKDF per-tenant keys (v1.3+)
- ✅ **Zero-downtime key rotation** — multi-key keyring (v1.4+)
- ✅ **Client redaction** — `••••••••` on every API response, never ciphertext
- ✅ **Dry-run safety** — validation never writes to destination (v1.5+)

**Known limitations:**
- ⚠️ **Webhook payloads stored plaintext in MongoDB** — encryption covers *credentials*, not payloads. Server has to read payloads to transform and deliver them. By design, documented in [SECURITY.md](./docs/SECURITY.md).
- ⚠️ No MFA/TOTP for dashboard login. Password-only. (v2.0 P1)
- ⚠️ No SOC 2 / HIPAA / GDPR certification
- ⚠️ No automated backups on free tier (manual `pg_dump` / `mongodump`)
- ⚠️ No persistent audit log table — console logs only (v2.0 planned)
- ⚠️ `API_KEY_PEPPER` rotation is a breaking change — no migration path yet (v2.0 planned)

See [**docs/SECURITY.md**](./docs/SECURITY.md) for the full threat model, encryption details, and key rotation runbook.

**Report vulnerabilities privately:** `zainshahzs110@gmail.com` (do not open public issue).

---

## 🗺 Roadmap

### v1.0-v1.5 — **All shipped** ✅

| Version | Highlights |
|---|---|
| **v1.0** | Full MVP — 4 apps, AI enrichment, 4 adapters, DLQ, dashboard, $0 deploy |
| **v1.1** | Bulk DLQ replay, YAML export/import, cost analytics, conditional routing |
| **v1.2** | Adapter SDK, time-series charts (SVG), API keys, transform preview |
| **v1.3** | Scheduled workflows, versioning, credential encryption, Airtable+Notion |
| **v1.4** | PostgreSQL + MongoDB adapters, key rotation, run-now, compare UI |
| **v1.5** | Destination validation, dry-run safety, version diff, API key rotation, bulk schedules |

**5 versions in 5 days.** Every version deployed and manually verified.

### v2.0 — Q1-Q2 2027 (Testing first)

- **Unit tests (Vitest)** — **non-negotiable P0 blocker**. Every other feature ships AFTER tests are complete.
- Persistent audit log table + dashboard UI
- MFA / TOTP
- `API_KEY_PEPPER` rotation automation
- Smoke test expansion (versioning, API key verify, dry-run checks)
- Linear, PagerDuty, Opsgenie adapters (12 total)

### v3.0 — 2028 (Conditional on enterprise demand)

- SAML SSO
- Row-level security (RLS)
- SOC 2 Type I compliance
- Multi-region deployment
- Self-hosted Docker / Helm

See [**docs/ROADMAP.md**](./docs/ROADMAP.md) for the full reality check (planned vs actually shipped), v2.0 ordering rationale, and explicit non-goals (visual builder, mobile apps, blockchain, WebSockets — all documented as "not planned, here's why").

---

## 🤝 Contributing

Contributions welcome! See [**docs/CONTRIBUTING.md**](./docs/CONTRIBUTING.md) for the full guide.

**High-priority contributions (v1.5 → v2.0):**
- **Unit tests — any test, any file.** Top priority until v2.0's testing goal is met.
- New destination adapters (Linear, PagerDuty, Opsgenie, Kafka, S3)
- New signature verifiers (Twilio, SendGrid, Slack Events API)
- Documentation improvements
- Bug reports with reproduction steps

**Quick workflow:**
1. Fork the repo
2. Create a branch (`feat/your-feature`)
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/)
4. Open a PR — reviewed within 48 hours

**Safety rules (hard rejections):**
- Adapter PRs **must honor `__dryRun`** (validation must never write to destination)
- Encryption changes must preserve `enc:v1:` backward compat
- No `eval()` / `Function()` / `vm`
- No `timingSafeEqual` bypasses
- No hardcoded secrets (even in tests)

**First time?** Look for issues labeled [`good first issue`](https://github.com/zainshah3464/relayon/labels/good%20first%20issue).

---

## 📄 License

**MIT License** — see [LICENSE](./LICENSE).

You can use Relayon for personal or commercial purposes. Attribution appreciated but not required.

---

## 📬 Contact

**Zain Shah**

[![GitHub](https://img.shields.io/badge/GitHub-zainshah3464-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/zainshah3464)
[![Email](https://img.shields.io/badge/Email-zainshahzs110@gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white)](mailto:zainshahzs110@gmail.com)
[![Live](https://img.shields.io/badge/Live-relayon.vercel.app-000000?style=flat-square&logo=vercel&logoColor=white)](https://relayon.vercel.app)

**Open to:** Full-stack engineering roles, contract work, collaborations.

---

<div align="center">

### ⭐ If Relayon helped you, please give it a star — it means a lot!

<br />

**Built with precision. Deployed on free tier. Powered by TypeScript.**

*Made with ❤️ in Pakistan*

<br />
<br />

[⬆ Back to top](#-relayon)

</div>
```

---