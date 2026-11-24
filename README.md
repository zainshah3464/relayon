<div align="center">

# ⚡ Relayon

### Your webhooks, relayed right.

**A reliable event-delivery and workflow orchestration platform.**

Receive events, verify and deduplicate requests, enrich and transform payloads, route to multiple destinations, schedule workflows, and recover failed deliveries — all through one operational control plane.

<br/>

[![Version](https://img.shields.io/badge/version-v3.7.0-6D5DFB?style=for-the-badge)](https://github.com/zainshah3464/relayon)
[![Live](https://img.shields.io/badge/Live-relayon.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://relayon.vercel.app)
[![License](https://img.shields.io/badge/license-proprietary_source--visible-8B5CF6?style=for-the-badge)](./LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Angular](https://img.shields.io/badge/Angular-19-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com)
[![Groq](https://img.shields.io/badge/Groq-AI-F55036?style=for-the-badge)](https://groq.com)

<br/>

[**Open Dashboard**](https://relayon.vercel.app) ·
[**Documentation**](#-documentation) ·
[**API Reference**](./docs/API_REFERENCE.md) ·
[**Architecture**](./docs/ARCHITECTURE.md) ·
[**Security**](./docs/SECURITY.md)

<br/>

*Designed for explicit failure handling, observable execution, and maintainable integrations.*

</div>

---

## 📖 Contents

<details open>
<summary><strong>Navigate this README</strong></summary>

- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [Capabilities](#-capabilities)
- [Screenshots](#-screenshots)
- [Architecture](#-architecture)
- [Data flow](#-data-flow)
- [Technology](#-technology)
- [Destination adapters](#-destination-adapters)
- [Reliability model](#-reliability-model)
- [Security model](#-security-model)
- [Getting started](#-getting-started)
- [Development commands](#-development-commands)
- [Testing & quality](#-testing--quality)
- [Repository layout](#-repository-layout)
- [Documentation](#-documentation)
- [Deployment](#-deployment)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License & usage](#-license--usage)
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
// 9. Repeat for Shopify, GitHub, Slack...
```

This is:

- **Repetitive** — every company solves it from scratch
- **Error-prone** — missing retries, silent failures, duplicate deliveries, replay storms
- **Expensive** — Zapier-class tools charge **$200–500/month** for the same functionality
- **Vendor-locked** — no self-hosting, no workflow export, no source visibility

A production integration commonly needs to account for:

- Invalid, missing, or replayed signatures
- Duplicate webhook deliveries from upstream providers
- Slow or unavailable destination systems
- Transient failures, rate limits, and retry storms
- Payload shape differences between producers and consumers
- Credentials that must never appear in API responses or logs
- Events that fail repeatedly and need investigation or replay
- Scheduled jobs that must remain correct across stateless instances
- Configuration changes that need traceability and rollback

**The engineering objective is not to claim that failures never happen. It is to make failures bounded, visible, recoverable, and safe to retry.**

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
│  1. Verify signature (HMAC-SHA256, timing-safe)     │
│  2. Deduplicate (Redis idempotency, 24h TTL)        │
│  3. Rate limit (atomic Lua, per-tenant)             │
│  4. Enrich with AI (Groq, cached 1h)                │
│  5. Transform (JSONata expressions)                 │
│  6. Conditional routing (JSONata rules)             │
│  7. Fan out to N destinations (retry + DLQ)         │
│  8. Circuit-break unhealthy destinations            │
│  9. Encrypt credentials at rest (AES-256-GCM)       │
│ 10. Version every config change (snapshot + diff)   │
│ 11. Fire on cron schedules (DB-backed, serverless)  │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Destinations: 9 adapters                           │
│  HTTP · Slack · Email · Google Sheets · Discord     │
│  Airtable · Notion · PostgreSQL · MongoDB           │
└─────────────────────────────────────────────────────┘
```

Configure once. Every event flows through reliably — from webhooks **or** from cron schedules.

---

## ✨ Capabilities

### 1. Webhook ingress

- Provider-aware signature verification (Stripe, GitHub, Shopify, Slack, generic HMAC)
- HMAC verification with **timing-safe comparison** (`crypto.timingSafeEqual`)
- Timestamp tolerance for providers that sign timestamps (default **300s**)
- Redis-backed idempotency (`SET NX EX 86400`, scoped per tenant/workflow)
- Per-tenant rate limiting via **atomic Lua** (default 1,000/min, configurable)
- 5 MB payload limit
- Correlation IDs for cross-service tracing
- Fast acknowledgement — ingress accepts valid work and hands processing to the queue rather than running the entire workflow inline

### 2. Event processing

- Optional AI enrichment (Groq; summarize, classify, extract, translate)
- Redis-backed caching for eligible enrichment results (**1-hour TTL**)
- JSONata payload transformations (**2-second timeout**)
- Conditional routing rules to select destination sets
- Fan-out to destinations selected by the workflow
- **Graceful degradation** — event still processes if AI provider is unavailable

### 3. Delivery orchestration

- Multiple destinations per workflow
- Adapter-based destination integration (9 built-in)
- Configurable retry behavior and delayed delivery
- Exponential backoff (**10s → 30s → 1m → 5m → 15m**)
- Dead-letter handling after retry exhaustion
- Individual and bulk recovery operations
- Circuit breaker for repeatedly failing destinations (**5 failures / 5 min**)
- Delivery idempotency headers for downstream consumers (`Idempotency-Key: {eventId}:{destinationId}`)
- Safe destination validation using adapter-specific probes

### 4. Scheduled workflows

- **Database-backed schedules** rather than process-local timers
- Preset schedules and custom cron expressions
- IANA timezone support
- Configurable payload templates
- Manual **run-now** execution
- Bulk pause/resume with `nextRunAt` recomputation (fire-storm protection)
- **Atomic due-schedule claiming** to reduce duplicate execution across concurrent ticks
- Distributed cron safety via `pg-cron-lock`

### 5. Workflow lifecycle & versioning

- Workflow create / update / export / import
- **Immutable configuration snapshots** (up to 50 versions per workflow)
- Version history and configuration inspection
- Restore from an earlier snapshot (produces a new version — history stays linear)
- **Line-level configuration diffs** (`diff@7` unified patch)
- Split diff view (side-by-side)
- Event replay through a specific version

### 6. Credentials & API access

- **AES-256-GCM** authenticated encryption for destination credentials
- **HKDF per-tenant key derivation** — compromise of one tenant does not expose another
- Keyring-based encryption-key rotation (**zero-downtime**)
- Secret redaction in client-facing responses (`••••••••`)
- Scoped API keys with **show-once** creation flow
- Key revocation and rotation (24h grace window)
- JWT dashboard authentication with refresh-token rotation
- OAuth (Google + GitHub) via state + short-lived exchange ticket
- Email verification, password reset, strong-password validation

### 7. Operational dashboard

Angular dashboard provides the control plane for day-to-day operation:

- Workflow creation + configuration
- Destination management + validation
- Event exploration + lifecycle inspection
- Delivery status + failure investigation
- Dead-letter inspection + replay
- Analytics + time-series views (pure SVG charts)
- Schedule management + manual execution
- Workflow version history, restore, and diff
- API key management
- **BYOK integrations** (bring-your-own-key for AI + email providers)
- Community + workflow template marketplace
- Admin console (tenant detail, impersonation, audit, feature flags, time-travel, moderation)
- PWA install + offline shell + auto-update
- i18n (English, Urdu, Arabic) with RTL layout
- Responsive layouts with v3.7.0 premium design tokens
- AI assistant (tool-calling chat with PostgreSQL FTS RAG)

### 8. Platform & developer capabilities

- Separate API, ingress, worker, and dashboard applications
- Shared packages via npm workspaces
- OpenAPI 3.1 spec + auto-generated `@relayon/sdk`
- `@relayon/cli` — local tunnel (ngrok alternative)
- YAML workflow sync script (`workflows:pull` / `validate` / `push`)
- Workflow test runs + JSONata assertions
- Playground — capture arbitrary HTTP requests without a workflow
- Customer outbound webhooks (Standard Webhooks 1.0.0 + transactional outbox)
- Standard Webhooks signing for external consumers
- Feature flags with per-tenant rollout buckets
- Health endpoints, structured logs, Sentry, OpenTelemetry, smoke checks

---

## 📸 Screenshots

> All screenshots live in [`docs/screenshots/`](./docs/screenshots/). If an image is missing, please open a PR with a fresh capture.

<table>
<tr>
<td width="50%" align="center"><strong>Login</strong><br/><br/>
<a href="https://relayon.vercel.app/login"><img src="./docs/screenshots/login.png" alt="Relayon login"/></a>
</td>
<td width="50%" align="center"><strong>Sign Up</strong><br/><br/>
<a href="https://relayon.vercel.app/signup"><img src="./docs/screenshots/signup.png" alt="Relayon signup"/></a>
</td>
</tr>

<tr>
<td align="center"><strong>Dashboard overview</strong><br/><br/>
<a href="https://relayon.vercel.app/dashboard"><img src="./docs/screenshots/dashboard.png" alt="Dashboard overview"/></a>
</td>
<td align="center"><strong>Workflows list</strong><br/><br/>
<img src="./docs/screenshots/workflows.png" alt="Workflows list"/>
</td>
</tr>

<tr>
<td align="center"><strong>Workflow detail + schedule + versions</strong><br/><br/>
<img src="./docs/screenshots/workflow-detail.png" alt="Workflow detail with schedule and version history"/>
</td>
<td align="center"><strong>Version diff view</strong><br/><br/>
<img src="./docs/screenshots/workflow-diff.png" alt="Line-level version diff"/>
</td>
</tr>

<tr>
<td align="center"><strong>Schedule editor</strong><br/><br/>
<img src="./docs/screenshots/workflow-schedule.png" alt="Schedule editor with cron presets"/>
</td>
<td align="center"><strong>Version history drawer</strong><br/><br/>
<img src="./docs/screenshots/workflow-versions.png" alt="Version history drawer"/>
</td>
</tr>

<tr>
<td align="center"><strong>Event explorer</strong><br/><br/>
<img src="./docs/screenshots/events.png" alt="Event explorer"/>
</td>
<td align="center"><strong>Event detail + lifecycle</strong><br/><br/>
<img src="./docs/screenshots/event-detail.png" alt="Event detail with delivery lifecycle"/>
</td>
</tr>

<tr>
<td align="center"><strong>Analytics + time-series</strong><br/><br/>
<img src="./docs/screenshots/analytics.png" alt="Analytics with SVG time-series chart"/>
</td>
<td align="center"><strong>Dead-letter queue (DLQ)</strong><br/><br/>
<img src="./docs/screenshots/dlq.png" alt="DLQ manager with replay and discard"/>
</td>
</tr>

<tr>
<td align="center"><strong>Settings → API keys</strong><br/><br/>
<img src="./docs/screenshots/settings-api-keys.png" alt="API keys settings"/>
</td>
<td align="center"><strong>Settings → Integrations (BYOK)</strong><br/><br/>
<img src="./docs/screenshots/settings-integrations.png" alt="BYOK integrations settings"/>
</td>
</tr>

<tr>
<td align="center"><strong>Settings → Billing</strong><br/><br/>
<img src="./docs/screenshots/settings-billing.png" alt="Billing settings"/>
</td>
<td align="center"><strong>Settings → Outbound webhooks</strong><br/><br/>
<img src="./docs/screenshots/settings-webhooks.png" alt="Outbound webhook endpoints"/>
</td>
</tr>

<tr>
<td align="center"><strong>Community & templates</strong><br/><br/>
<img src="./docs/screenshots/community.png" alt="Community and workflow templates"/>
</td>
<td align="center"><strong>AI assistant</strong><br/><br/>
<img src="./docs/screenshots/ai-chat.png" alt="AI assistant chat panel"/>
</td>
</tr>

<tr>
<td align="center"><strong>Playground</strong><br/><br/>
<img src="./docs/screenshots/playground.png" alt="Playground request capture"/>
</td>
<td align="center"><strong>Admin overview</strong><br/><br/>
<img src="./docs/screenshots/admin-overview.png" alt="Admin overview"/>
</td>
</tr>

<tr>
<td align="center"><strong>Admin → Tenant detail</strong><br/><br/>
<img src="./docs/screenshots/admin-tenants.png" alt="Admin tenant detail"/>
</td>
<td align="center"><strong>Admin → Moderation</strong><br/><br/>
<img src="./docs/screenshots/admin-moderation.png" alt="Moderation queue"/>
</td>
</tr>

<tr>
<td align="center"><strong>Interactive guide</strong><br/><br/>
<img src="./docs/screenshots/guide.png" alt="Interactive product guide"/>
</td>
<td align="center"><strong>CLI tunnel (terminal)</strong><br/><br/>
<img src="./docs/screenshots/tunnel-cli.png" alt="Relayon CLI tunnel terminal output"/>
</td>
</tr>
</table>

**Full screenshot list** (for `docs/screenshots/`):
`login.png` · `signup.png` · `dashboard.png` · `workflows.png` · `workflow-detail.png` · `workflow-schedule.png` · `workflow-versions.png` · `workflow-diff.png` · `events.png` · `event-detail.png` · `analytics.png` · `dlq.png` · `settings-api-keys.png` · `settings-integrations.png` · `settings-billing.png` · `settings-webhooks.png` · `community.png` · `ai-chat.png` · `playground.png` · `admin-overview.png` · `admin-tenants.png` · `admin-moderation.png` · `guide.png` · `tunnel-cli.png`

---

## 🏛 Architecture

### Level 1 — System at a glance

**4 apps, 1 monorepo, 3 data stores, N external integrations — each app independently deployable.**

```
                         ┌──────────────────────┐
                         │      Dashboard       │
                         │      Angular 19      │
                         │   UI / Control Plane │
                         └──────────┬───────────┘
                                    │ HTTPS
                                    ▼
                         ┌──────────────────────┐
                         │         API          │
                         │       NestJS 11      │
                         │ Auth · CRUD · Admin  │
                         └──────────┬───────────┘
                                    │
                ┌───────────────────┴───────────────────┐
                │                                       │
                ▼                                       ▼
      ┌──────────────────┐                    ┌──────────────────┐
      │       Ingress    │                    │      Workers     │
      │     Express 5    │                    │     NestJS 11    │
      │ Verify·Limit·Enq │                    │ Process·Route    │
      └────────┬─────────┘                    │ Deliver·Schedule │
               │                              └────────┬─────────┘
               └──────────────┬─────────────────────── ┘
                              ▼
                ┌───────────────────────────────┐
                │         Shared Data            │
                │  PostgreSQL (Neon) / Prisma    │
                │  MongoDB (Atlas)   / Mongoose  │
                │  Redis    (Upstash) / ioredis  │
                └──────────────┬────────────────┘
                               │
                ┌──────────────┼────────────────┐
                ▼              ▼                ▼
           ┌─────────┐   ┌──────────┐     ┌──────────────┐
           │  Groq   │   │  Sentry  │     │  External    │
           │  (LLM)  │   │ (errors) │     │  Destinations│
           └─────────┘   └──────────┘     └──────────────┘
```

### Level 2 — Control plane vs data plane

```
┌─────────────────────────────────────────────────────────────────┐
│                         CONTROL PLANE                            │
│  Manage users · tenants · workflows · destinations · schedules  │
│  versions · api keys · analytics · billing · admin              │
├─────────────────────────────────────────────────────────────────┤
│   apps/dashboard (Angular 19)   ←→   apps/api (NestJS 11)       │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ (writes config, reads state)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                          DATA PLANE                              │
│  Receive · verify · dedupe · enrich · transform · route · deliver│
├─────────────────────────────────────────────────────────────────┤
│   apps/ingress (Express 5)   →   apps/workers (NestJS 11)       │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                          DATA STORES                             │
│  PostgreSQL  ·  MongoDB  ·  Redis                                │
└─────────────────────────────────────────────────────────────────┘
```

**Why this split matters:** the public webhook path stays minimal (verify + enqueue) so producers get a fast acknowledgement. Heavy processing (AI, transforms, retries) runs asynchronously with bounded budgets — appropriate for serverless execution limits.

### Application responsibilities

| Application | Runtime | Responsibility |
|---|---|---|
| `apps/dashboard` | Angular 19 | User interface and operational control plane |
| `apps/api` | NestJS 11 | Authentication, tenant-aware APIs, configuration, analytics, schedules, versions, API keys, admin |
| `apps/ingress` | Express 5 | Webhook reception, verification, idempotency, rate limiting, queue handoff |
| `apps/workers` | NestJS 11 | Event processing, enrichment, transformation, routing, delivery, retries, schedules, adapter execution |

### Shared packages & infrastructure

| Component | Role |
|---|---|
| PostgreSQL | Relational application data + workflow configuration |
| Prisma | PostgreSQL data access + schema migrations |
| MongoDB | Event + delivery records used by processing and operational views |
| Redis | Queues, delayed work, idempotency, caching, rate-limit state |
| Shared packages | Reusable types, utilities, DB integration across workspaces |
| External providers | AI enrichment + configured destination APIs |

For component-level design, queue semantics, failure handling, and operational details, see [Architecture](./docs/ARCHITECTURE.md).

### Why 4 apps, not a monolith?

Serverless functions have **10s duration limits** and **cold starts**. A monolith would:

- Load ALL dependencies for every request (slow cold start)
- Handle webhook parsing **and** AI **and** delivery in one invocation (10s timeout)

Splitting into 4 apps lets each be optimized for its workload:

- **Ingress** — minimal deps (Express + ioredis), fast cold start (~500ms)
- **API** — NestJS + Prisma, medium cold start (~800ms)
- **Workers** — full AI stack + 9 adapters, slow cold start (~1200ms), but batching amortizes it
- **Dashboard** — static SPA, CDN-served, zero cold starts

---

## 🔄 Data flow

### Webhook-triggered path

```
1. Webhook arrives  →  Stripe POST /webhook/{tenantId}/{workflowId}
                       │
                       ▼
2. Ingress          →  ├─ Verify HMAC signature (raw body — timing-safe)
                       ├─ Check idempotency (Redis SET NX)
                       ├─ Enforce rate limit (atomic Lua)
                       ├─ Strip sensitive headers (Authorization, Cookie, …)
                       ├─ Hash IP with salt (no raw IPs stored)
                       ├─ LPUSH to queue:events:incoming
                       └─ Return 202 Accepted

3. Workers          →  ├─ RPOPLPUSH incoming → processing
                       ├─ Load workflow config (batched)
                       ├─ Optional Groq AI enrichment (cached 1h)
                       ├─ Optional JSONata transform (2s timeout)
                       ├─ Optional conditional routing (JSONata rules)
                       ├─ Persist event + delivery records (MongoDB)
                       ├─ Fan out: 1 Delivery doc per destination
                       └─ LPUSH to queue:egress:pending

4. Egress           →  ├─ RPOP from egress queue
                       ├─ Atomic claim (findOneAndUpdate)
                       ├─ Decrypt destination config (HKDF per-tenant)
                       ├─ Call adapter (HTTP/Slack/Email/Sheets/Discord/
                       │                Airtable/Notion/PG/Mongo)
                       ├─ Success → status: 'delivered'
                       └─ Failure → ZADD to delayed queue (backoff)

5. Dashboard        →  Read events, deliveries, DLQ
                       Replay failed deliveries
                       View analytics + charts
                       Manage schedules, versions, API keys
```

### Scheduled workflow path

```
1. External cron hits POST /internal/schedule/tick
                       │
                       ▼
2. Workers tick     →  ├─ SELECT due schedules (isActive AND nextRunAt <= now)
                       ├─ Atomic claim (updateMany with nextRunAt guard)
                       ├─ Compute nextRunAt via cron-parser
                       ├─ LPUSH synthetic event → queue:events:incoming
                       └─ Same pipeline as webhook (enrich, transform, route, deliver)

3. Run-now button   →  POST /api/workflows/:id/schedule/run-now
                       → API forwards to Workers /internal/schedule/run-now
                       → Workers LPUSH synthetic event (type: relayon.schedule.manual)
                       → nextRunAt untouched (cron stays scheduled)
```

### Destination validation path

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
                           HTTP        → HEAD request
                           Slack       → URL/config shape only (no message)
                           Discord     → URL/config shape only (no message)
                           Email       → auth check (no send)
                           Sheets      → metadata fetch (no append)
                           Airtable    → base tables list (no record)
                           Notion      → data source fetch (no page)
                           PostgreSQL  → SELECT 1 (no INSERT)
                           MongoDB     → ping (no insert)
```

### Event lifecycle — visual

```
┌────────────────────┐
│   Event Producer   │
│ Stripe / GitHub /  │
│ Shopify / HTTP etc.│
└──────────┬─────────┘
           │ HTTPS webhook
           ▼
┌──────────────────────────┐
│        INGRESS           │
│ Resolve workflow         │
│ Verify signature         │
│ Idempotency check        │
│ Rate limit               │
│ Enqueue accepted event   │
└──────────┬───────────────┘
           │ accepted work
           ▼
┌──────────────────────────┐
│       REDIS QUEUES       │
│ Incoming / processing    │
│ Pending / delayed        │
└──────────┬───────────────┘
           │ worker claims work
           ▼
┌──────────────────────────┐
│        WORKERS           │
│ Load config              │
│ Optional AI enrichment   │
│ JSONata transform        │
│ Conditional routing      │
│ Persist + fan-out        │
└──────────┬───────────────┘
           │ fan-out
           ▼
┌──────────────────────────┐
│   DESTINATION ADAPTERS   │
│ HTTP · Slack · Email     │
│ Sheets · Discord · Airtable│
│ Notion · PostgreSQL · Mongo│
└──────────┬───────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
Delivered     Retry / DLQ
                  │
                  ▼
            Inspect / Replay
```

### Lifecycle principles

1. **Acknowledge separately from execution.** Ingress does not wait for every downstream integration to finish.
2. **Persist and track work.** Events and delivery attempts have operational state.
3. **Isolate destinations.** A failure at one destination does not silently erase the state of other deliveries.
4. **Retry deliberately.** Delayed retries and bounded attempts avoid uncontrolled hot loops.
5. **Make terminal failures actionable.** Dead-lettered work remains inspectable and can be replayed.

---

## 🧰 Technology

| Area | Technologies |
|---|---|
| Language | **TypeScript 5.7** |
| Frontend | **Angular 19** (standalone, signals), RxJS, Tailwind CSS, Lucide Angular |
| API services | **NestJS 11** (modular DI) |
| Webhook ingress | **Express 5** |
| Relational persistence | **PostgreSQL** + Prisma 6 |
| Event persistence | **MongoDB** + Mongoose |
| Queue & cache | **Redis** + ioredis |
| Validation | Zod, class-validator, DTO validation |
| Transformation | JSONata |
| Encryption | Node.js crypto, **AES-256-GCM**, **HKDF-SHA256** |
| AI integration | Groq-compatible LLM integration |
| Testing | **Vitest**, **Playwright**, **Supertest**, **Stryker**, **k6** |
| Tooling | npm workspaces, GitHub Actions |
| Deployment | **Vercel** (4 projects, free tier), **Docker Compose** (self-host) |
| Observability | Sentry, OpenTelemetry, structured JSON logs |

Exact package versions and scripts are maintained in the root and workspace `package.json` files.

---

## 🔌 Destination adapters

Relayon includes **nine built-in destination adapter types**:

| Adapter | Typical use | Config | Dry-run probe |
|---|---|---|---|
| **HTTP** | Deliver JSON to an HTTP endpoint with configured headers | URL, method, headers | `HEAD` request |
| **Slack** | Send workflow notifications to Slack | Webhook URL, message config | URL shape only |
| **Email** | Send email through Resend | Provider key, sender, recipient | Auth check (no send) |
| **Google Sheets** | Append or map event data into a spreadsheet | Spreadsheet ID, range, service-account JWT | Metadata fetch |
| **Discord** | Send messages to a Discord webhook | Webhook URL, message config | URL shape only |
| **Airtable** | Create/update records in Airtable | PAT, base ID, table | Base tables list |
| **Notion** | Write structured content to a Notion data source | Integration token, data-source ID | Data source fetch |
| **PostgreSQL** | Persist mapped event data in a relational table | Connection string, table, upsert config | `SELECT 1` |
| **MongoDB** | Persist event data in a MongoDB collection | Connection string, DB, collection, upsert key | ping |

**Extensibility:**

- **Adapter SDK** — custom adapters via decorator + registry
- **Rich field descriptors** — dynamic destination forms generated from descriptors
- **Adapter catalog** — list all adapters + config schemas
- **External/community adapter loading** — manifest schema + sandboxed runner (worker-thread, no `require`, HTTPS-only fetch, 5s timeout)

**Safety requirement:** validation must not accidentally create production records or send real messages. Adapter changes must preserve the repository's dry-run contract.

---

## 🛡 Reliability model

Relayon is designed to make asynchronous delivery **recoverable and observable**.

| Mechanism | Purpose |
|---|---|
| Idempotency checks | Reduce duplicate event acceptance |
| Queue-based handoff | Separate ingress acknowledgement from processing |
| Atomic work claims | Reduce concurrent duplicate processing |
| Delayed retry queue | Retry transient failures without tight loops |
| Exponential backoff | 10s → 30s → 1m → 5m → 15m (configurable per destination) |
| Dead-letter queue | Retain work that exhausts retry policy |
| Replay operations | Allow operators to retry eligible failed work (single or bulk) |
| Circuit breaker | Pause unhealthy destinations (5 failures / 5 min) |
| Stuck-work recovery | Recover eligible work left in an in-progress state (5-min scan) |
| Correlation identifiers | Connect logs and lifecycle records across services |
| Atomic schedule claim | Prevent duplicate fires under concurrent ticks |
| Zero-downtime key rotation | Multi-key keyring for credential re-encryption |

### Delivery semantics

**Relayon's delivery model is at-least-once, not exactly-once.**

A worker can perform a destination side effect and fail before its acknowledgement is durably recorded. A retry may therefore cause the destination to receive the same logical event again.

For that reason:

- Use the supplied idempotency metadata where supported.
- Make destination handlers idempotent when possible.
- Do not assume network retries imply exactly-once side effects.
- Treat DLQ replay as a new delivery attempt, not proof the original attempt never reached the destination.

See [Troubleshooting](./docs/TROUBLESHOOTING.md) for operational failure patterns and [Testing](./docs/TESTING.md) for validation guidance.

---

## 🔐 Security model

Security controls are applied across authentication, tenant access, webhook verification, secrets, and service-to-service operations.

### Implemented security mechanisms

- **JWT authentication** + refresh-token rotation (hashed refresh values, revoked on password reset)
- **Scoped API keys** with show-once creation, SHA-256 + pepper, 24h rotation grace
- **Tenant-aware authorization** — tenant ID is ownership boundary; owner/admin gating for sensitive operations
- **Row-Level Security** (PostgreSQL) as defense-in-depth below the application
- **HMAC signature verification** for Stripe, GitHub, Shopify, Slack, generic
- **Timing-safe signature comparison** (`crypto.timingSafeEqual`)
- **Rate limiting** + request validation
- **AES-256-GCM** authenticated encryption for protected credentials
- **HKDF-SHA256** per-tenant key derivation
- **Keyring-based encryption-key rotation** with zero-downtime migration
- **Secret redaction** in client-facing responses (`••••••••`)
- **OAuth state protection** + short-lived exchange ticket (no credentials in callback URL)
- **Email verification + password reset tokens** hashed, expiring, used-state tracked
- **Secret-protected internal worker endpoints** (cron secret)
- **Adapter sandbox** — worker-thread, no `require`, HTTPS-only fetch, 5s timeout
- **Sensitive header stripping** on ingress (Authorization, Cookie, Set-Cookie, X-API-Key, Proxy-Authorization)
- **Salted IP hashing** — raw IPs never stored
- **TLS-based connections** to supported external services
- **Zero `eval()`** / zero dynamic code execution

### Important boundaries

Security controls have explicit scope:

- **Webhook payloads are stored plaintext in MongoDB** — encryption covers *credentials*, not payloads. Server must read payloads to transform and deliver them.
- **Database row-level security is not universal** across every table in every deployment.
- **External adapter isolation** is not hardened OS/container isolation — it's a worker-thread sandbox with restricted globals.
- **No MFA / TOTP** for dashboard login (password-only).
- **`API_KEY_PEPPER` rotation** is a breaking change — no migration path yet.
- **No automated backups** on free tier (manual `pg_dump` / `mongodump`).
- **No persistent audit-log table** for every action — console logs + targeted `AdminAuditLog` entries.

**Relayon is not represented as SOC 2, ISO 27001, HIPAA, or GDPR certified.** Controls are implementation, not certification.

Before deploying, review: [Security](./docs/SECURITY.md) · [Deployment](./DEPLOYMENT.md) · [Database](./docs/DATABASE.md).

To report a security vulnerability, use the private reporting contact — do **not** open a public issue.

---

## 🚀 Getting started

This guide describes a local development setup. Production deployment has additional infrastructure, secrets, networking, and operational requirements.

### Prerequisites

- **Node.js 20 or later** (Node.js 22 is a suitable baseline)
- npm
- **PostgreSQL** (Neon free tier or local Docker)
- **MongoDB** (Atlas M0 free tier or local)
- **Redis** (Upstash free tier or local)
- Provider credentials only for integrations you intend to exercise (Groq AI, Resend email, destination APIs)

### 1. Clone the repository

```bash
git clone https://github.com/zainshah3464/relayon.git
cd relayon
npm install
```

### 2. Configure environment files

```bash
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example apps/api/.env.local
cp apps/ingress/.env.example apps/ingress/.env.local
cp apps/workers/.env.example apps/workers/.env.local
```

On **Windows PowerShell**, use `Copy-Item`:

```powershell
Copy-Item packages/db/.env.example packages/db/.env
Copy-Item apps/api/.env.example apps/api/.env.local
Copy-Item apps/ingress/.env.example apps/ingress/.env.local
Copy-Item apps/workers/.env.example apps/workers/.env.local
```

**Generate cryptographic secret material** with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run once per secret: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `IP_HASH_SALT`, `CRON_SECRET`, `API_KEY_PEPPER`, `CONNECTOR_ENCRYPTION_KEYS`.

> ⚠️ **Critical:** `CONNECTOR_ENCRYPTION_KEYS` must be **identical** in `apps/api/.env.local` and `apps/workers/.env.local`. Mismatched keys → every delivery fails with `Credential decryption failed` DLQ.

Do not commit real secrets. Values shared between API and Workers — especially credential-encryption keyring configuration — must be configured consistently.

### 3. Generate the database client and apply migrations

```bash
npm run db:generate
npm run db:deploy
```

For local schema development, consult the database guide before choosing between migration commands and deployment commands.

### 4. Start the services

Run each command in a **separate terminal** from the repository root:

```bash
npm run dev:api
npm run dev:ingress
npm run dev:workers
npm run dev:dashboard
```

Default local ports:

| Service | Local URL |
|---|---|
| Dashboard | `http://localhost:4200` |
| API | `http://localhost:3001` |
| Ingress | `http://localhost:3002` |
| Workers | `http://localhost:3003` |

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

### 5. Verify your local setup

```bash
npm run typecheck
npm run lint
npm run build:dashboard
npm run build:api
npm run build:ingress
npm run build:workers
```

Use the [Troubleshooting Guide](./docs/TROUBLESHOOTING.md) if startup, migration, connectivity, or worker processing fails.

**A process starting successfully does not by itself prove that the complete event pipeline is healthy.**

---

## 🧪 Development commands

Run commands from the repository root unless a script explicitly says otherwise.

| Command | Purpose |
|---|---|
| `npm run dev:dashboard` | Start the Angular dashboard |
| `npm run dev:api` | Start the API service |
| `npm run dev:ingress` | Start webhook ingress |
| `npm run dev:workers` | Start background workers |
| `npm run typecheck` | Type-check workspaces that expose the script |
| `npm run lint` | Run workspace lint scripts where configured |
| `npm run build:dashboard` | Build dashboard |
| `npm run build:api` | Build API |
| `npm run build:ingress` | Build ingress |
| `npm run build:workers` | Build workers |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:deploy` | Apply deployable database migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:rls` | Apply the repository's RLS SQL script |
| `npm run workflows:validate` | Validate workflow YAML via sync utility |
| `npm run workflows:pull` | Pull workflow configuration |
| `npm run workflows:push` | Push workflow configuration |
| `npm run sdk:build` | Build the SDK workspace |
| `npm run sdk:publish` | Publish `@relayon/sdk` |
| `npm run smoke` | Smoke test against a live stack |

### Testing commands

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Integration tests
npm run test:integration

# Browser end-to-end tests
npm run test:e2e

# Complete unit + integration + E2E sequence
npm run test:all

# Mutation testing (critical paths)
npm run test:mutation
npm run test:mutation:critical

# Load testing
npm run test:load
npm run test:load:sustained
npm run test:load:burst
npm run test:load:delivery

# Smoke checks
npm run smoke
```

Test availability and coverage vary by workspace. In particular, a workspace script may be a placeholder; the existence of a root command does not prove every application has meaningful automated tests. Review [TESTING.md](./docs/TESTING.md) for the current test inventory, supported commands, manual checks, and known gaps.

**Do not treat a build or typecheck as a substitute for behavioral tests.**

---

## 🧪 Testing & quality

**Current test infrastructure (v3.7.0):**

| Tool | Purpose |
|---|---|
| **Vitest** | Unit + integration tests |
| **Playwright** | End-to-end browser tests |
| **Supertest** | HTTP integration tests |
| **Stryker** | Mutation testing — critical paths: crypto-box, retry-policy, quota |
| **k6** | Load testing — webhook ingress, sustained, burst, delivery throughput |
| **Smoke test** | 10-check production health verification |

**Coverage targets (from commit history):**

- **Adapters** — each of 9 built-in adapters has a `.spec.ts`
- **Services** — auth, quota, schedules, workflows, dlq, api-keys, billing, stripe, crypto-box, ingest, idempotency, signature, verifiers, routing, transform, circuit-breaker, retry-policy

**Test locations:**

- **Unit** — `*.spec.ts` colocated with source
- **Integration** — `test/integration/*.integration.spec.ts`
- **E2E** — `test/e2e/*.e2e.spec.ts` (auth-flow, full-pipeline, quota-ui, tenant-isolation)
- **Load** — `test/load/*.js`
- **Fixtures** — `test/fixtures/index.ts`
- **Setup** — `test/setup/env.ts`, `vitest-setup.ts`

**CI (`.github/workflows/`):**

| Workflow | Trigger | What it runs |
|---|---|---|
| `ci.yml` | Push to `main`, PR | Typecheck + 4 builds |
| `test.yml` | Push, PR | Unit + integration + RLS + mutation (critical) |
| `keep-alive.yml` | Every 12h | Production health ping (prevents Atlas M0 idle pause) |
| `workflow-validate.yml` | Workflow YAML changes | YAML validation |

> **A green CI run is point-in-time for that commit — not a permanent guarantee about later changes or external provider uptime.**

---

## 📁 Repository layout

```
relayon/
├── apps/
│   ├── dashboard/       # Angular control-plane UI
│   ├── api/             # NestJS control-plane API
│   ├── ingress/         # Express webhook ingress
│   └── workers/         # Event processing and delivery workers
│
├── packages/
│   ├── db/              # Prisma schema, migrations, DB package
│   ├── sdk/             # @relayon/sdk — typed API client
│   ├── cli/             # @relayon/cli — tunnel
│   └── shared/          # Shared types and utilities
│
├── docs/
│   ├── API_REFERENCE.md
│   ├── ARCHITECTURE.md
│   ├── CHANGELOG.md
│   ├── CODE_OF_CONDUCT.md
│   ├── CONTRIBUTING.md
│   ├── DATABASE.md
│   ├── FAQ.md
│   ├── FEATURES.md
│   ├── ROADMAP.md
│   ├── SECURITY.md
│   ├── TESTING.md
│   ├── TROUBLESHOOTING.md
│   ├── workflow-examples.md
│   ├── relayon-guide.md
│   └── screenshots/     # see Screenshots section for exact filenames
│
├── scripts/             # Operational, sync, and smoke-test scripts
├── test/                # Integration, E2E, and load-test assets
├── docker/              # Dockerfiles, Nginx configs, DB init
├── DEPLOYMENT.md
├── docker-compose.yml
├── LICENSE
├── LICENSE-MIT-LEGACY
├── package.json
└── README.md
```

The tree is a high-level orientation map; consult the repository for the complete current file structure.

---

## 📚 Documentation

The documentation set is organized by audience and operational concern.

| Document | What it covers |
|---|---|
| [**Architecture**](./docs/ARCHITECTURE.md) | Service boundaries, event lifecycle, queues, design decisions, failure handling |
| [**API Reference**](./docs/API_REFERENCE.md) | HTTP APIs, request/response contracts, authentication, endpoint behavior |
| [**Database**](./docs/DATABASE.md) | PostgreSQL schema, MongoDB collections, Redis data structures, migrations |
| [**Features**](./docs/FEATURES.md) | Product capability inventory and feature-level behavior |
| [**Security**](./docs/SECURITY.md) | Threat model, authentication, credential encryption, key rotation, limitations |
| [**Testing**](./docs/TESTING.md) | Test strategy, automated checks, manual validation, known gaps |
| [**Troubleshooting**](./docs/TROUBLESHOOTING.md) | Common failures, diagnostic steps, root causes, fixes |
| [**Contributing**](./docs/CONTRIBUTING.md) | Dev setup, engineering expectations, contribution workflow |
| [**Code of Conduct**](./docs/CODE_OF_CONDUCT.md) | Community standards and reporting process |
| [**FAQ**](./docs/FAQ.md) | Product, architecture, setup, and operational questions |
| [**Changelog**](./docs/CHANGELOG.md) | Version history and notable changes |
| [**Roadmap**](./docs/ROADMAP.md) | Project direction, shipped scope, documented non-goals |
| [**Deployment**](./DEPLOYMENT.md) | Environment configuration, service deployment, migrations, operational setup |
| [**Workflow examples**](./docs/workflow-examples.md) | YAML workflow samples + patterns |
| [**Quick guide**](./docs/relayon-guide.md) | End-user walkthrough |

For implementation work, prefer the API reference and architecture guide over assumptions based on this overview.

---

## 🚢 Deployment

Relayon's applications are independently deployable. The repository has deployment configuration and documentation for its service layout.

### Vercel multi-project model

| Step | Action |
|---|---|
| 1 | Create **4 Vercel projects** (dashboard, api, ingress, workers) from same repo |
| 2 | Set **Root Directory** for each (`apps/dashboard`, `apps/api`, `apps/ingress`, `apps/workers`) |
| 3 | Enable **"Include source files outside Root Directory"** for backends |
| 4 | Add environment variables per service (includes `CONNECTOR_ENCRYPTION_KEYS` identical on API + Workers) |
| 5 | Deploy in order: **API → Ingress → Workers → Dashboard** |
| 6 | **Back-fill `WORKERS_URL` on API**, redeploy API (required for `run-now` and destination dry-run) |
| 7 | Set up **external cron (3 jobs)**: `/internal/process`, `/internal/deliver`, `/internal/schedule/tick` every 5 min |
| 8 | Run smoke test against live URLs |

### Docker Compose model

Full self-hosted deployment on a single VM — verified on Oracle Cloud **ARM64**:

- **10 services:** `postgres`, `redis`, `mongo`, `migrate` (one-shot), `api`, `ingress`, `workers`, `dashboard`, `nginx`, `cron` (sidecar)
- **Cron sidecar** pings every 60s: `/internal/process`, `/internal/deliver`, `/internal/schedule/tick`, `/api/cron/outbox/tick`
- **Migration stage** runs `prisma migrate deploy` then exits
- **Health checks** on every service
- **Platform:** `linux/arm64` explicitly set (comment out for x86_64)

### Production checklist

A production deployment should account for:

1. **Four application deployments**: dashboard, API, ingress, workers
2. **PostgreSQL, MongoDB, Redis** provisioning and connectivity
3. **Environment variables** scoped to the service that consumes them
4. **Shared encryption configuration** between services that encrypt and decrypt credentials
5. **Internal worker endpoint authentication** and network exposure
6. **Database migrations** and required database policy scripts
7. **Worker processing, delivery, schedule, and outbox tick** execution
8. **Health checks, logs, monitoring, backups, and recovery procedures**

> **Do not assume a free-tier provider plan is an availability, throughput, backup, or SLA guarantee.** Provider limits and pricing can change independently of Relayon.

**Use the complete [Deployment Guide](./DEPLOYMENT.md)** for the actual environment matrix, service configuration, deployment order, scheduled invocations, and operational checks.

**Health endpoints:**
- API: `GET /api/health`
- Ingress: `GET /health`
- Workers: `GET /internal/health` (internal secret required)

---

## 💡 Why This Project

### Serverless constraints as architecture, not limitation

Serverless platforms have **hard limits** that shaped Relayon's design:

1. **Cron runs limited times per day** → external cron (cron-job.org, QStash, GitHub Actions)
2. **Functions are stateless** → Redis queues for state, DB-backed schedules (not in-memory)
3. **Function duration limits** → batch processing with time budgets
4. **Cold starts** → 4 separate apps, each optimized for its workload

These aren't compromises — they're **the design**.

### Reliability is the product

- **At-least-once delivery** proven with `RPOPLPUSH` + atomic Mongo claims
- **Circuit breaker** prevents cascading failures
- **DLQ** makes every failure recoverable
- **Graceful degradation** when AI fails
- **Atomic schedule claim** prevents duplicate fires under concurrent ticks
- **`__dryRun` safety** prevents validation from writing to production destinations

### Security at rest

**The v1.0 → v1.3 gap is closed.** In v1.0, credentials were plaintext in PostgreSQL. In v3.7:

- AES-256-GCM authenticated encryption
- HKDF per-tenant derived keys
- Zero-downtime key rotation via multi-key keyring
- Client-side redaction
- Optional full-config encryption (`FULL_CONFIG_ENCRYPTION=true`)

A DB dump without the master keyring is useless ciphertext.

### Honest about gaps

- **Every version's `Known Limitations` section is as long as its `Added` section** — see [CHANGELOG](./docs/CHANGELOG.md)
- **No MFA / TOTP** — password-only login, documented gap
- **No SOC 2 / HIPAA / GDPR** — honest limitation, not marketing
- **Payloads stored plaintext in MongoDB** — encryption covers credentials, not payloads (by design)
- **`API_KEY_PEPPER` rotation** is breaking — no migration path yet

### Not a toy project

- **4 production apps** across **~556 tracked files** / **~4.2 MB** of source
- **28 version tags** (`v1.0.0 → v3.7.0`), **78 commits on `main`**
- **~143K additions** across the repo history
- **11+ deep documentation files** with engineering dives
- **9 destination adapters**, each with `__dryRun` safety
- **Full test suite** — Vitest, Playwright, Stryker, k6
- **Real production deployment** at `relayon.vercel.app`
- **Self-hostable** via Docker Compose (ARM64-verified)

---

## 🗺 Roadmap

### v1.0 → v3.7 — **All shipped** ✅

| Version | Theme | Highlights |
|---|---|---|
| **v1.0** | Foundation | 4-app monorepo, JWT multi-tenancy, workflow CRUD, ingress + signature verification, 4 adapters, DLQ, analytics |
| **v1.1** | Operator experience | Bulk DLQ replay, YAML export/import, cost analytics, conditional routing |
| **v1.2** | Extensibility | Adapter SDK, time-series charts (SVG), API keys, bulk discard, transform preview, Discord |
| **v1.3** | Reliability & security | Schedules, workflow versions, credential encryption, Airtable + Notion |
| **v1.4** | Databases & rotation | PostgreSQL + MongoDB adapters, keyring rotation, schedule run-now |
| **v1.5** | Validation & diff | Destination validation + dry-run, version diff, API-key rotation, bulk schedules |
| **v1.6** | Validation persistence | Persisted validation, pipeline test-run, adapter catalog, rotation audit |
| **v1.7** | Dynamic forms | Rich field descriptors, dynamic forms, split diff, event replay, dry-run destinations |
| **v1.8** | Quotas & RLS | Usage quotas, RLS tenant isolation, YAML sync, Git CLI |
| **v1.9** | External adapters | Quota soft mode, RLS full rollout, CSV export, external/community adapters |
| **v2.0** | Billing + testing | Stripe test-mode billing, workflow assertions, testing framework |
| **v2.1** | Auth expansion | OAuth (Google + GitHub), email verification, password reset, strong password |
| **v2.2** | i18n | EN/UR/AR translations, RTL layout, localized auth emails |
| **v2.3** | AI assistant | Groq chat assistant, PostgreSQL FTS, RAG ingestion, tool calling |
| **v2.4** | Scale | Redis Lua atomic ingest, Groq rate limiter |
| **v2.5** | PWA | Install prompt, offline shell, network status, auto-update |
| **v2.6** | Admin phase A | Privacy-first tracking, presence, super-admin APIs |
| **v2.7** | Community phase B | Forum, posts/replies, templates, announcements |
| **v2.8** | Moderation phase C | Moderation queue, auto-hide, audit, social sharing |
| **v2.9** | Admin phase D | Tenant detail, impersonation, user search, audit |
| **v3.0** | Platform waves | Distributed cron, OpenTelemetry, OpenAPI 3.1, SDK, Standard Webhooks, outbox, time travel, feature flags, playground |
| **v3.1** | Developer tooling | `@relayon/cli` tunnel (ngrok alternative) |
| **v3.2** | Self-hosting | Docker Compose (Oracle Cloud ARM64 verified), Dockerfiles, Nginx, DB init |
| **v3.3** | Onboarding & legal | Privacy/Terms pages, interactive guide, onboarding wizard |
| **v3.4** | SEO | SSR + prerendering, robots/sitemap/SEO service, public header/footer/about |
| **v3.5** | BYOK | Bring-your-own-key providers, resolver, dashboard integration settings |
| **v3.6** | AI refinement | Intent detection, improved RAG/chunking/search-docs/workflow tools, license migration |
| **v3.7** | UI overhaul | Premium design tokens, modal/confirm/toast, Lucide icons, skeleton/empty states, mobile-first |

**Post-v3.7.0** (tagless): brand refresh (logo v2.0), `ConfirmState` TS4029 fix.

### Post-v3.7.0 — In consideration

- **Persistent audit log table** + full dashboard UI
- **MFA / TOTP** for dashboard login
- **`API_KEY_PEPPER` rotation** automation with migration path
- **Additional adapters** — Linear, PagerDuty, Opsgenie, Kafka, S3
- **Expanded smoke test** — versioning, API key verify, dry-run checks

### Conditional on enterprise demand

- SAML SSO
- SOC 2 Type I compliance path
- Multi-region deployment
- Self-hosted Helm charts (beyond current Docker Compose)
- Pluggable external adapter marketplace

See [**docs/ROADMAP.md**](./docs/ROADMAP.md) for the full reality check (planned vs actually shipped), ordering rationale, and explicit non-goals (visual builder, mobile apps, blockchain, WebSockets — all documented as "not planned, here's why").

---

## 🤝 Contributing

Contributions should preserve the platform's reliability, security, and operational contracts.

Before opening a pull request:

1. Read [**CONTRIBUTING.md**](./docs/CONTRIBUTING.md)
2. Read the repository [**Code of Conduct**](./docs/CODE_OF_CONDUCT.md)
3. Review the relevant architecture and security documentation
4. Keep changes focused and include tests or reproducible verification where applicable
5. Run the relevant typecheck, lint, build, and test commands
6. Document configuration changes, migration requirements, and operational impact

### High-priority contributions

- **Unit tests — any test, any file** (ongoing priority)
- **New destination adapters** (Linear, PagerDuty, Opsgenie, Kafka, S3)
- **New signature verifiers** (Twilio, SendGrid, Slack Events API)
- **Documentation improvements** (especially screenshots — see Screenshots section)
- **Bug reports with reproduction steps**

### Engineering expectations (hard rejections)

- Adapter PRs **must honor `__dryRun`** (validation must never write to destination)
- Encryption changes must preserve `enc:v1:` backward compat
- No `eval()` / `Function()` / `vm` / dynamic code execution
- No `timingSafeEqual` bypasses
- No hardcoded secrets (even in tests)
- Preserve tenant boundaries and authorization checks
- Never log credentials, tokens, encryption keys, or sensitive payload data unnecessarily
- Keep webhook verification timing-safe
- Preserve idempotency and retry semantics
- Keep API and SDK contracts synchronized when applicable
- Add or update migration and operational documentation when behavior changes
- **Be explicit about limitations; do not claim guarantees that tests or implementation do not establish**

### Pull requests

Use a focused branch and a descriptive commit/PR message. Include:

- The problem being solved
- The implementation approach
- Relevant tests and their results
- Any migration or environment-variable changes
- Compatibility, security, and rollback considerations

**First time?** Look for issues labeled [`good first issue`](https://github.com/zainshah3464/relayon/labels/good%20first%20issue).

---

## 📄 License & usage

**Relayon is distributed under the Relayon Proprietary Source-Visible License v1.0. It is not MIT-licensed or open source under a permissive license.**

The source is publicly visible, but **visibility does not grant unrestricted rights** to modify, redistribute, resell, or create derivative products.

### ✅ You MAY
- Use the hosted Relayon platform for free
- Self-host Relayon on servers you own
- Create unlimited webhook workflows
- Use it for personal or commercial purposes
- Read the source code for auditing, learning, and security review
- Contribute improvements via Pull Request (contributions assigned to Licensor upon merge)

### ❌ You MAY NOT (without written permission)
- **Modify** the source code for your own deployment
- **Fork** to build or promote a competing webhook relay / iPaaS product
- **Resell, sublicense, or redistribute** the software (modified or unmodified)
- **Train machine-learning models** on the source code (including code-generation LLMs)
- **Remove** copyright headers, license notices, or attribution
- **Use "Relayon"**, the Relayon logo, or the tagline **"Your webhooks, relayed right"** in a way that suggests endorsement

The license describes the permitted use, restrictions, written-permission process, contribution assignment, and third-party component terms.

- **Full terms:** [`LICENSE`](./LICENSE)
- **Historical license record (v1.0–v1.5 MIT):** [`LICENSE-MIT-LEGACY`](./LICENSE-MIT-LEGACY)

**Permission requests:** `zainshahzs110@gmail.com` — subject line *"Relayon Permission Request — [Your Name]"*

**Report security vulnerabilities privately** — do not open a public issue.

---

## 📬 Contact

**Zain Shah**

[![GitHub](https://img.shields.io/badge/GitHub-zainshah3464-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/zainshah3464)
[![Email](https://img.shields.io/badge/Email-zainshahzs110@gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white)](mailto:zainshahzs110@gmail.com)
[![Live](https://img.shields.io/badge/Live-relayon.vercel.app-000000?style=flat-square&logo=vercel&logoColor=white)](https://relayon.vercel.app)

- **GitHub:** [@zainshah3464](https://github.com/zainshah3464)
- **Repository:** [github.com/zainshah3464/relayon](https://github.com/zainshah3464/relayon)
- **Website:** [relayon.vercel.app](https://relayon.vercel.app)
- **Email:** [zainshahzs110@gmail.com](mailto:zainshahzs110@gmail.com)

**Open to:** Full-stack engineering roles, contract work, collaborations.

---

<div align="center">

### ⭐ If Relayon helped you, please give it a star — it means a lot!

<br/>

**Relayon v3.7.0**

*Receive deliberately. Process asynchronously. Deliver reliably.*

*Built with precision. Deployed on free tier. Powered by TypeScript.*

*Made with ❤️ in Pakistan*

<br/>

[⬆ Back to top](#-relayon)

</div>
```

---