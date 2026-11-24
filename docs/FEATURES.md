
# Relayon — Complete Features

<div align="center">

**Your webhooks, relayed right.**

*Serverless-native webhook relay & integration automation platform — receive, enrich with AI, transform, schedule, version, encrypt, and route events to any destination reliably.*

[![Version](https://img.shields.io/badge/version-3.7.0-success?style=for-the-badge)](https://github.com/zainshah3464/relayon/releases)
[![License](https://img.shields.io/badge/license-Proprietary_Source_Visible-blue?style=for-the-badge)](./LICENSE)
[![Live](https://img.shields.io/badge/Live-relayon.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://relayon.vercel.app)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Angular](https://img.shields.io/badge/Angular-19-DD0031?style=flat-square&logo=angular&logoColor=white)](https://angular.dev)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com)
[![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://neon.tech)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?style=flat-square&logo=redis&logoColor=white)](https://upstash.com)
[![Groq](https://img.shields.io/badge/Groq-AI-F55036?style=flat-square)](https://groq.com)

</div>

> **Source snapshot:** [`main` at `f4dd930eafd2ab61381bc1c049bb6cdbb7480235`](https://github.com/zainshah3464/relayon/commit/f4dd930eafd2ab61381bc1c049bb6cdbb7480235) · Audit date **24 November 2026**
> This is a **feature reference**, not a commit-history report. A feature being present in source does not mean it is enabled in every deployment: some features require provider credentials, env vars, DB migrations, external cron, tenant permissions, or third-party accounts.

---

## 📖 Table of Contents

- [Quick Stats](#-quick-stats)
- [Version Overview](#-version-overview)
- [Product Overview](#-product-overview)
- [Core Capabilities](#-core-capabilities)
  - [1. Workflow Management](#1-workflow-management)
  - [2. Webhook Sources & Ingress](#2-webhook-sources--ingress)
  - [3. Atomic Ingest, Idempotency & Rate Limits](#3-atomic-ingest-idempotency--rate-limits)
  - [4. Event Processing Pipeline](#4-event-processing-pipeline)
  - [5. AI Event Enrichment](#5-ai-event-enrichment)
  - [6. Transform Engine](#6-transform-engine)
  - [7. Conditional Routing & Fan-out](#7-conditional-routing--fan-out)
  - [8. Destination Adapters](#8-destination-adapters)
  - [9. Adapter Discovery & External Adapters](#9-adapter-discovery--external-adapters)
  - [10. Destination Validation & Dry-Run](#10-destination-validation--dry-run)
  - [11. Retries, Circuit Breaker & DLQ](#11-retries-circuit-breaker--dlq)
  - [12. Events & Analytics](#12-events--analytics)
  - [13. Quotas & Usage](#13-quotas--usage)
  - [14. Scheduled Workflows](#14-scheduled-workflows)
  - [15. Workflow Versions, Diff & Restore](#15-workflow-versions-diff--restore)
  - [16. Workflow YAML & Git Sync](#16-workflow-yaml--git-sync)
  - [17. Workflow Test Runs & Assertions](#17-workflow-test-runs--assertions)
  - [18. Authentication & Account Lifecycle](#18-authentication--account-lifecycle)
  - [19. Multi-tenancy, Access Control & RLS](#19-multi-tenancy-access-control--rls)
  - [20. API Keys & Rotation](#20-api-keys--rotation)
  - [21. Credential Encryption](#21-credential-encryption)
  - [22. BYOK Integrations](#22-byok-integrations)
  - [23. AI Assistant & RAG](#23-ai-assistant--rag)
  - [24. Billing & Stripe](#24-billing--stripe)
  - [25. Customer Outbound Webhooks (Standard Webhooks & Outbox)](#25-customer-outbound-webhooks-standard-webhooks--outbox)
  - [26. Community & Workflow Templates](#26-community--workflow-templates)
  - [27. Moderation & Social Sharing](#27-moderation--social-sharing)
  - [28. Admin, Impersonation & Time Travel](#28-admin-impersonation--time-travel)
  - [29. Feature Flags](#29-feature-flags)
  - [30. Developer Playground](#30-developer-playground)
  - [31. Local Tunnel & CLI](#31-local-tunnel--cli)
  - [32. Presence & Product Tracking](#32-presence--product-tracking)
  - [33. Dashboard Experience](#33-dashboard-experience)
  - [34. Localization, PWA & SEO](#34-localization-pwa--seo)
  - [35. API, SDK & OpenAPI](#35-api-sdk--openapi)
  - [36. Brand System](#36-brand-system)
  - [37. Self-Hosting (Docker Compose)](#37-self-hosting-docker-compose)
  - [38. Deployment, Observability & CI/CD](#38-deployment-observability--cicd)
- [Adapter Catalog](#-adapter-catalog)
- [API Surface](#-api-surface)
- [Data Stores](#-data-stores)
- [Testing & CI](#-testing--ci)
- [Documentation](#-documentation)
- [Security Summary](#-security-summary)
- [Behavior Boundaries & Limitations](#-behavior-boundaries--limitations)
- [Source Directory](#-source-directory)
- [Version-by-Version History](#-version-by-version-history)
- [License](#-license)

---

## 📊 Quick Stats

| Metric | Value |
|---|---:|
| Current version | **v3.7.0** (final) |
| Version tags | 28 (`v1.0.0` → `v3.7.0`) |
| Published GitHub Releases | 6 (`v1.0.0` → `v1.5.0`) |
| Commits on `main` | 78 |
| Total additions | 143,565 lines |
| Total deletions | 46,092 lines |
| Total diff churn | 189,657 lines |
| Current tree files | 556 |
| Current tree size | 4,256,517 bytes |
| Development span | 33d 13h 24m 33s |
| GitHub Actions runs | 112 (105 ✅ / 7 ❌ historical) |
| Current HEAD | `f4dd930eafd2ab61381bc1c049bb6cdbb7480235` |
| Latest commit | `fix(dashboard): export ConfirmState + annotate state signal (TS4029)` |
| License | Relayon Proprietary Source-Visible License v1.0 |

> **Version-tag caveat:** The repository has 28 version tags through `v3.7.0`, but only `v1.0.0`–`v1.5.0` appear as **formal GitHub Release objects**. `v1.6`–`v3.7` are git tags only.

---

## 🗂 Version Overview

| Version | Theme | Adapters | Key Additions |
|---|---|---:|---|
| **v1.0.0** | Foundation | 4 | 4-app monorepo, JWT multi-tenancy, workflow CRUD, ingress + signature verification, DLQ, analytics |
| **v1.1.0** | Operator experience | 4 | Bulk DLQ replay, YAML export/import, cost analytics, conditional routing |
| **v1.2.0** | Extensibility | 5 | Adapter SDK, time-series charts, API keys, bulk discard, transform preview, Discord |
| **v1.3.0** | Reliability & security | 7 | Schedules, workflow versions, credential encryption, Airtable + Notion |
| **v1.4.0** | Databases & rotation | 9 | PostgreSQL + MongoDB adapters, keyring rotation, schedule run-now |
| **v1.5.0** | Validation & diff | 9 | Destination validation + dry-run, version diff, API-key rotation, bulk schedules |
| **v1.6.0** | Validation persistence | 9 | Persisted validation, pipeline test-run, adapter catalog, rotation audit |
| **v1.7.0** | Dynamic forms | 9+ | Rich field descriptors, dynamic forms, split diff, event replay, dry-run destinations |
| **v1.8.0** | Quotas & RLS | 9+ | Usage quotas, RLS tenant isolation, YAML sync, Git CLI |
| **v1.9.0** | External adapters | 9+ | Quota soft mode, RLS full rollout, CSV export, external/community adapters |
| **v2.0.0** | Billing + testing | 9+ | Stripe test-mode billing, workflow assertions, testing framework (Batches 1–3) |
| **v2.1.0** | Auth expansion | 9+ | OAuth (Google + GitHub), email verification, password reset, strong password |
| **v2.2.0** | i18n | 9+ | EN/UR/AR translations, RTL layout, localized auth emails |
| **v2.3.0** | AI assistant | 9+ | Groq chat assistant, PostgreSQL FTS, RAG ingestion, tool calling |
| **v2.4.0** | Scale | 9+ | Redis Lua atomic ingest, Groq rate limiter |
| **v2.5.0** | PWA | 9+ | Install prompt, offline shell, network status, auto-update |
| **v2.6.0** | Admin phase A | 9+ | Privacy-first tracking, presence, super-admin APIs |
| **v2.7.0** | Community phase B | 9+ | Forum, posts/replies, templates, announcements |
| **v2.8.0** | Moderation phase C | 9+ | Moderation queue, auto-hide, audit, social sharing |
| **v2.9.0** | Admin phase D | 9+ | Tenant detail, impersonation, user search, audit |
| **v3.0.0** | Platform waves | 9+ | Distributed cron, OpenTelemetry, OpenAPI 3.1, SDK, Standard Webhooks, outbox, time travel, feature flags, playground |
| **v3.1.0** | Developer tooling | 9+ | `@relayon/cli` tunnel (ngrok alternative) |
| **v3.2.0** | Self-hosting | 9+ | Docker Compose (Oracle Cloud ARM64 verified), Dockerfiles, Nginx, DB init |
| **v3.3.0** | Onboarding & legal | 9+ | Privacy/Terms pages, interactive guide, onboarding wizard |
| **v3.4.0** | SEO | 9+ | SSR + prerendering, robots/sitemap/SEO service, public header/footer/about |
| **v3.5.0** | BYOK | 9+ | Bring-your-own-key providers, resolver, dashboard integration settings |
| **v3.6.0** | AI refinement | 9+ | Intent detection, improved RAG/chunking/search-docs/workflow tools, license migration |
| **v3.7.0** | UI overhaul | 9+ | Premium design tokens, modal/confirm/toast, Lucide icons, skeleton/empty states, mobile-first |

**Post-v3.7.0** (no new version tag): brand refresh (logo v2.0), `ConfirmState` TS4029 fix.

---

## 🎯 Product Overview

Relayon is a **webhook relay and integration automation platform**. It sits between systems that produce events and systems that need to receive, transform, or store those events.

A source such as Stripe, GitHub, Shopify, Slack, or a generic HTTP producer sends an event to a Relayon workflow endpoint. Relayon:

1. Resolves the workflow.
2. Verifies the source signature (using the original raw request bytes — not re-serialized JSON).
3. Checks usage limits.
4. Protects against duplicate ingestion (idempotency).
5. Enqueues accepted work onto Redis.

Workers then process each event — optionally enrich with AI, transform its payload, apply routing rules, and create **one delivery per selected destination**. Destination work is asynchronous and tracked separately from the original event.

A workflow can also be triggered by a database-backed schedule rather than an external webhook. A manual *run-now* action places a synthetic event into the same processing pipeline.

### Problems Relayon solves

- Repeated implementation of webhook endpoints + source signature verification.
- Duplicate source retries creating duplicate downstream work.
- Different source payloads needing reshaping before consumption.
- Fan-out to multiple destinations with independent failure isolation.
- Transient network/provider failures requiring delayed retry + operator recovery.
- Workflow configuration needing change history, import/export, and testability.
- Scheduled integrations in stateless/serverless environments.
- Tenant credentials needing encryption + controlled key rotation.

### Product boundary

Relayon is **integration and event-delivery infrastructure**. It is **not** the system of record for a customer's payment, order, CRM, or accounting domain. A successful adapter response means the destination *accepted* the request according to that adapter's protocol — it does not prove every downstream business process completed as intended.

---

## 🚀 Core Capabilities

### 1. Workflow Management

**What it does:** A **workflow** is Relayon's central configuration object. It defines how a class of incoming events should be authenticated, processed, and delivered.

**Stored fields:** name, source type/config, optional AI enrichment settings + prompt, optional JSONata transform, optional ordered routing rules, active state, and associated destinations. Each destination stores its adapter type/config and retry behavior.

**User flow:**
1. Open **Workflows** in the dashboard.
2. Create a workflow → select source type.
3. Enter the source signing secret/config.
4. Optionally enable enrichment → add prompt.
5. Save.
6. Add one or more destinations.
7. Configure + validate each destination.
8. Copy the unique ingress URL → register with the source service.

**Backend behavior:**
- Create/update handled by the API — scoped to authenticated tenant.
- Creation writes an **initial version snapshot**.
- Updates write **further snapshots**.
- Workflow create/update/delete emits **platform outbox events**.

**Test & preview:**
- Workflow API exposes **transform preview** and a **test-run** operation.
- A **test run** evaluates a sample payload through the workflow test path — *without* treating it as a live source webhook.
- A separate **assertion service** evaluates JSONata assertions against the test result and reports passed/failed.

**Important distinctions (from source audit):**
- A workflow's saved state **does not prove** its external source has been configured to send to it.
- A **test-run is not the same** as a real destination write.
- Workflow snapshots are **product-level configuration history**, not Git commit history.
- **Destination IDs can change after restore** — they may be recreated from snapshot data.

**Source:** [`workflows.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/workflows/workflows.controller.ts) · [`workflows.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/workflows/workflows.service.ts) · [`testing/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/workflows/testing)

---

### 2. Webhook Sources & Ingress

**What it does:** Receives incoming webhooks, validates signatures, and hands off to async processing fast enough for the source to get an immediate `202 Accepted`.

**Endpoint:**
```
POST https://relayon-ingress.vercel.app/webhook/{tenantId}/{workflowId}
```

**Supported sources & signatures:**

| Source | Header | Verification concept |
|---|---|---|
| **Stripe** | `Stripe-Signature` | Timestamped HMAC-SHA256 over timestamp + raw body |
| **GitHub** | `X-Hub-Signature-256` | HMAC-SHA256 of raw body, `sha256=` format |
| **Shopify** | `X-Shopify-Hmac-Sha256` | HMAC-SHA256 with base64 signature encoding |
| **Slack** | `X-Slack-Signature` | Timestamped HMAC-SHA256 over Slack signing base string |
| **Generic** | `X-Webhook-Signature` | HMAC-SHA256 in hex form |

**Features:**
- **5 signature verifiers** — timing-safe comparison (`crypto.timingSafeEqual`)
- **Timestamp tolerance** for Stripe/Slack — default **300s** (`WEBHOOK_SIGNATURE_TOLERANCE_SECONDS`)
- **Raw body capture** — Express JSON parser's `verify` callback preserves original bytes (essential for signature checks)
- **5 MB JSON body limit** — oversized requests rejected cleanly
- **Quota check** — per-tenant event quota before enqueue
- **Correlation IDs** — assigned at ingress, propagated across all services
- **Privacy** — sensitive headers stripped: `Authorization`, `Cookie`, `Set-Cookie`, `X-API-Key`, `Proxy-Authorization`. Stores a **salted IP hash**, not raw IP.
- **Playground + tunnel routes** — same Express app also hosts `/play/*` and `/tunnel/*`

**Request flow:**
1. Create/propagate correlation ID.
2. Resolve the tenant-owned workflow.
3. Verify source-specific signature.
4. Check tenant event quota.
5. Derive idempotency + rate-limit keys.
6. Strip sensitive headers from event metadata snapshot.
7. Hash client IP with configured salt.
8. Atomic dedup + rate limit + queue insert (see next section).
9. Return `202 Accepted` / duplicate / `429`.

**Boundary:** `202 Accepted` means the event was *queued* — **not** that AI, transformation, or destination delivery has completed.

**Source:** [`ingress/src/app.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress/src/app.ts) · [`routes/webhook.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress/src/routes/webhook.ts) · [`middleware/signature.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress/src/middleware/signature.ts) · [`services/verifiers.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress/src/services/verifiers.ts)

---

### 3. Atomic Ingest, Idempotency & Rate Limits

**What it does:** Prevents source retries from becoming duplicate queue jobs, and enforces per-tenant rate limits — all in one atomic Redis operation.

**Idempotency:**
- Key derived from `X-Idempotency-Key` header or route's correlation-based fallback.
- Key is scoped with tenant + workflow context.
- TTL: **86,400 seconds (24h)**.

**Atomic Redis Lua script (single round trip):**
1. Idempotency `SET ... NX EX` check.
2. Per-tenant / per-minute rate counter increment + expiry.
3. Queue insertion (`LPUSH`) + queue-depth reporting.

**Rate limit:** `RATE_LIMIT_PER_MINUTE` — **default 1,000** (configurable). 

> ⚠️ *Correction vs older docs:* Some older documentation states 300 req/min per workflow. The pinned source defines **1,000/min per tenant** as the default — treat 1,000 as authoritative.

**Expected outcomes:**

| Scenario | Result |
|---|---|
| New key, under limit | Enqueue + `202` |
| Previously seen idempotency key | Duplicate status, **no enqueue** |
| Limit reached | `429` + rate-limit headers |
| Redis failure | Ingress **cannot** claim queued → source retries per its policy |

**Boundary:** This is ingress-level duplicate suppression. It does **not** guarantee exactly-once side effects on downstream destinations.

**Source:** [`ingress/src/lib/redis-batch.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress/src/lib/redis-batch.ts) · [`routes/webhook.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress/src/routes/webhook.ts)

---

### 4. Event Processing Pipeline

**What it does:** Workers turn an accepted queue entry into a persisted event + one delivery job per selected destination.

**Stages:**

| # | Stage | Description |
|---|---|---|
| 1 | **Claim** | Move a bounded batch from incoming queue → processing list |
| 2 | **Load config** | Read workflow + destination config |
| 3 | **Apply controls** | Quotas + optional AI rate limits |
| 4 | **Enrich** | AI enrichment path when enabled |
| 5 | **Transform** | JSONata expression when configured |
| 6 | **Route** | Routing rules when configured |
| 7 | **Persist** | Write event + processing details to MongoDB |
| 8 | **Fan out** | Create destination delivery records/jobs |
| 9 | **Acknowledge** | Remove successfully processed items from processing queue |

**Bounded execution:** `BATCH_SIZE` controls how many items a worker attempts per batch; `TIME_BUDGET_MS` bounds processing time. When near budget, remaining work is **requeued** rather than abandoned — this supports bounded serverless invocations, not a permanently running daemon.

**Event vs delivery status:** Independent lifecycles. One event may be `processed` while destination A is `delivered`, destination B is `pending`, destination C is in the DLQ. This separation allows retrying one destination **without** repeating upstream processing.

**Source:** [`processing/processing.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/processing/processing.service.ts) · [`workers/src/main.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/main.ts)

---

### 5. AI Event Enrichment

**What it does:** Enriches event payloads with AI-generated summaries, classifications, extractions, or translations before transformation and routing.

**Default output shape:**
```json
{ "summary": "...", "category": "...", "severity": "...", "entities": { ... } }
```

Custom prompts per workflow allowed. Worker requests **JSON-mode output** and parses before continuing.

**Provider resolution:**
- **Tenant Groq key** first (BYOK — see §22).
- Then **platform Groq key** from env.
- Model chain: tenant-selected model first, then configured/default fallbacks — candidates: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`.

**Cache & rate limits:**
- Parsed results cached in Redis for **1 hour** (key includes workflow + prompt + payload).
- Separate **Redis/Lua AI limiter** tracks requests + tokens per minute (independent of ingress rate limit).

**Graceful degradation:** If provider key absent/invalid, model fails, or AI limiter rejects — worker **records/skips** the enrichment failure and continues the non-AI path where the processing code permits it. **The event still routes.**

**Boundary:** AI output is enrichment, not authoritative fact. It should not be treated as ground truth without application-side validation.

**Source:** [`groq.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/processing/groq.service.ts) · [`ai-rate-limiter.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/processing/ai-rate-limiter.service.ts)

---

### 6. Transform Engine

**What it does:** Reshapes source payloads into the shape a destination expects — using **JSONata**, never `eval()` or arbitrary JS.

**Features:**
- **JSONata expressions** — powerful, sandbox-safe.
- **2-second timeout** — prevents runaway expressions.
- **Compile-time error surfacing** — errors visible in event logs.
- **Transform preview** — test expressions against a sample payload before saving.

**Boundary:** A valid expression can still produce data a destination rejects. Preview output + validate the destination independently.

**Source:** [`transform.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/processing/transform.service.ts) · [`workflows.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/workflows/workflows.controller.ts)

---

### 7. Conditional Routing & Fan-out

**What it does:** Routes events to different destinations based on **ordered** JSONata rules — **first match wins**.

**Rule format:** `{ when: string, destinationIds: string[] }`

| Scenario | Result |
|---|---|
| **No rules configured** | Route to all enabled workflow destinations |
| **A rule matches** | Route to that rule's `destinationIds` |
| **Rules exist but none match** | `no_rule_matched` — **does not** silently pick a destination |

**Storage:** `workflows.routing_rules` JSONB column in PostgreSQL.

Fan-out creates separate delivery jobs per selected destination; each succeeds/fails independently.

**Source:** [`routing.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/processing/routing.service.ts) · [`processing.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/processing/processing.service.ts)

---

### 8. Destination Adapters

**What it does:** A destination is an outgoing endpoint/system attached to a workflow. 9 built-in adapter types.

| # | Adapter | Main use | Config | Version | Dry-run probe |
|---|---|---|---|---|---|
| 1 | **HTTP** | Send JSON to arbitrary endpoint | URL, method, headers | v1.0 | `HEAD` request |
| 2 | **Slack** | Post to Slack incoming webhook | Webhook URL + message config | v1.0 | URL format only |
| 3 | **Email** | Send notification email | Provider key, sender, recipient | v1.0 | Auth check (no send) |
| 4 | **Google Sheets** | Write to sheet range | Spreadsheet ID, range, service-account JWT | v1.0 | Metadata fetch |
| 5 | **Discord** | Post to Discord webhook | Webhook URL + message config | v1.2 | URL format only |
| 6 | **Airtable** | Create/update records | PAT, base ID, table | v1.3 | Base tables list |
| 7 | **Notion** | Create/write records | Integration token, data-source ID | v1.3 | Data source fetch |
| 8 | **PostgreSQL** | Write/upsert rows | Connection string, table, upsert config | v1.4 | `SELECT 1` |
| 9 | **MongoDB** | Write/upsert documents | Connection string, DB, collection, upsert key | v1.4 | ping |

**Adapter-specific cautions:**
- HTTP endpoints must be trusted + suitable for the payload.
- Slack/Discord probes **cannot** prove a real message was posted without actually sending — validation confirms URL/config shape only.
- Email needs working provider credentials + sender config.
- Database destinations need correct credentials, network access, table/collection permissions, and mapping.
- **Adapter support ≠ identical idempotency or safe-probe semantics** across destinations.

**Source:** [`egress/adapters/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/egress/adapters) · [`types.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/egress/adapters/types.ts)

---

### 9. Adapter Discovery & External Adapters

**What it does:** Auto-discovers built-in adapters via NestJS provider metadata + supports loading community-supplied adapters safely.

**Built-in discovery:** NestJS providers registered by destination type — no central manual switch required.

**External adapter loader:**
- Scans a configured directory.
- Reads `manifest.json`, validates it.
- Verifies resolved entrypoint path.
- Rejects duplicate adapter types.
- Registers via the common interface.

**Sandbox behavior:**
- Adapters declaring `trust: "sandboxed"` run through a **worker-thread runner**.
- Runner removes its global `require` reference.
- Exposes **HTTPS-only** fetch bridge.
- Passes config/payload/context with a **5-second timeout**.

**Boundary:** Sandboxing restricts plugin *execution*, not a substitute for reviewing plugin code, credentials, and outbound network destinations.

**Source:** [`registry.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/egress/adapters/registry.ts) · [`loader/adapter-loader.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/egress/adapters/loader/adapter-loader.service.ts) · [`loader/sandbox-runner.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/egress/adapters/loader/sandbox-runner.ts)

---

### 10. Destination Validation & Dry-Run

**What it does:** Validates destination config before saving — and optionally probes the destination safely (no writes).

**Two-layer check:**
1. **Schema layer** in API (fields, types, required).
2. **Optional worker-side probe** when `WORKERS_URL` + `CRON_SECRET` are configured.

**Non-writing probes per adapter:**

| Adapter | Safe probe |
|---|---|
| HTTP | `HEAD` where supported |
| Email | Validate auth (no send) |
| Google Sheets | Fetch spreadsheet metadata (no append) |
| Airtable | Read base/table metadata |
| Notion | Fetch data-source info (no page) |
| PostgreSQL | `SELECT 1` |
| MongoDB | ping (no insert) |
| Slack/Discord | URL/config shape only — **no message** |

**Graceful fallback:** If workers unreachable → schema-only validation with warning.

**Boundary:** A successful schema check is **not** proof of successful business delivery. A dry-run **must not** create a real record or send a real message as a side effect of validation.

**Source:** [`destinations.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/destinations/destinations.controller.ts) · [`destinations.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/destinations/destinations.service.ts) · [`egress.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/egress/egress.service.ts)

---

### 11. Retries, Circuit Breaker & DLQ

**What it does:** Each destination delivery is claimed + processed independently with retry, backoff, circuit breaker, and dead-letter support.

**Claiming:** Workers collect ready pending jobs + delayed jobs whose retry time arrived. Mongo delivery row is **atomically claimed** to prevent concurrent workers owning the same attempt.

**Default retry schedule:**

| Retry | Delay |
|---:|---:|
| 1 | 10 seconds |
| 2 | 30 seconds |
| 3 | 1 minute |
| 4 | 5 minutes |
| 5 | 15 minutes |

5 attempts default. Destination retry policy can be read from config + bounded; invalid/absent → default policy.

**Circuit breaker:** Tracks repeated destination failures — documented design: **5 failures / 5 minutes** window temporarily avoids calling unhealthy endpoint.

**Recovery paths:**
- Delivery records stuck in `delivering` beyond **5 minutes**.
- Reconstructing DB-pending deliveries if a queue push may have been missed.

**Dead-letter queue (DLQ):**
- Reached when delivery exhausts retries or hits terminal error path.
- Tenant can: **list**, **replay one**, **bulk replay** (capped at **100 unique IDs**), **discard one**, **bulk discard**.
- Operations scoped to tenant + DLQ state.

**Operator sequence (recommended):** Inspect error → fix URL/credentials/permissions → safe validate → replay one → confirm → bulk replay.

**Delivery guarantees:**
- **At-least-once** — `RPOPLPUSH` + atomic Mongo claim + 5-min stuck recovery.
- **Event dedup** — MongoDB unique `correlationId`.
- **Delivery dedup** — `Idempotency-Key: {eventId}:{destinationId}` header to HTTP destinations.
- **Boundary:** failure/recovery can repeat a delivery attempt. At-least-once ≠ exactly-once.

**Source:** [`egress.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/egress/egress.service.ts) · [`retry-policy.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/egress/retry-policy.ts) · [`circuit-breaker.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/egress/circuit-breaker.service.ts) · [`dlq.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/dlq/dlq.service.ts)

---

### 12. Events & Analytics

**What it does:** Tenant-scoped access to event records + operational analytics.

**Events API:**
- List events (`GET /events`)
- Retrieve an event (`GET /events/:id`)
- Replay an event (`POST /events/:id/replay`)

**Event ≠ Delivery:** one event can have multiple destinations, each with its own state.

| View | Shows |
|---|---|
| **Event view** | Received payload, workflow context, processing state |
| **Delivery view** | Target destination, attempt state, result/error, retry/DLQ status |

**Analytics endpoints:**
- `GET /api/analytics/overview`
- `GET /api/analytics/delivery`
- `GET /api/analytics/cost`
- `GET /api/analytics/timeseries?range=24h|7d|30d`

Time-series: accepts `24h`, `7d`, `30d`; falls back to `24h` for unsupported range.

**Boundary:** Analytics are operational summaries + charts — **not** the billing provider's final invoice, **not** a guarantee about downstream business outcomes.

**Source:** [`events.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/events/events.controller.ts) · [`events.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/events/events.service.ts) · [`analytics.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/analytics/analytics.controller.ts)

---

### 13. Quotas & Usage

**What it does:** Tracks three metric types — **events**, **AI tokens**, **deliveries** — grouped by tenant + billing period.

**Storage:** PostgreSQL `usage_counters` table. Service performs a **guarded DB update** (reserves usage only when limit condition permits).

**Modes:**

| Mode | Behavior |
|---|---|
| **Hard** | Requests beyond quota are **rejected** |
| **Soft** | Effective allowance can extend to **2× limit**; original limit still used for warnings |

**Warnings:** Start at **80%** of normal quota.

**Quota snapshot endpoint:** exposes limits + current usage + period-reset info.

**Stripe usage reporting:** For eligible active/trialing subscriptions, usage can be reported to Stripe — depends on valid Stripe config + subscription state. Source code alone does not mean the provider account is enabled in a deployment.

**Source:** [`quota.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/quota/quota.service.ts) · [`quota/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/quota)

---

### 14. Scheduled Workflows

**What it does:** Triggers workflows on cron expressions — **DB-backed** (not in-memory) so it works on serverless.

**Why DB-backed:** Serverless worker processes aren't guaranteed to stay alive. In-memory cron would disappear on cold start. Relayon persists schedule state in PostgreSQL and invokes a worker schedule-tick via external scheduler.

**Schedule fields:** `workflowId`, `cronExpression`, `timezone`, `payloadTemplate`, `isActive`, `lastRunAt`, `nextRunAt`.

**Schedule tick flow:**
1. Workers query active schedules where `nextRunAt` is due.
2. Calculate next run via stored expression + timezone.
3. **Atomic conditional DB update** claims the schedule using due-time predicate.
4. Only the successful claimer proceeds.
5. Push synthetic event into normal incoming queue.
6. Advance `lastRunAt` + `nextRunAt`.
7. Event follows the same processing pipeline as a webhook.

**Features:**
- **Presets + custom** — every 15 min, hourly, daily 9 AM, weekdays, weekly, or custom 5-field cron.
- **Timezone-aware** — IANA names, defaults to UTC.
- **Payload template** — arbitrary JSON injected as `rawPayload.data`.
- **Run-now** — trigger immediately.
- **Bulk pause** all tenant schedules.
- **Bulk resume** recomputes `nextRunAt` to avoid a fire storm.
- **Bulk delete**.
- **Distributed cron safety** — sliding-window limiter + `pg-cron-lock` for multi-instance safety.

**External trigger:** `POST /internal/schedule/tick` (cron sidecar or cron-job.org).

**Boundary:** Timezone matters — a cron in UTC ≠ intended local wall-clock time.

**Source:** [`schedule.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/schedule/schedule.service.ts) · [`schedules.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/schedules/schedules.controller.ts) · [`schedules-bulk.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/schedules/schedules-bulk.controller.ts)

---

### 15. Workflow Versions, Diff & Restore

**What it does:** Immutable snapshots of every workflow configuration change.

**Features:**
- **Immutable snapshots** — every create/update/import/restore writes a new version.
- **50-version cap** — older snapshots trimmed automatically.
- **Restore** — applies earlier snapshot as current config; produces a **new** version (linear history preserved).
- **Line-level diff** — `diff@7` unified patch; green `+`, red `-`, cyan `@@`.
- **Split diff view** — side-by-side comparison.
- **Validation persistence** — result stored per version.
- **Event replay** — replay events through a specific version.

**Diff endpoint:** returns version metadata, identical/not-identical flag, added/removed statistics, and unified patch.

**Restore caveats:**
- Destination records may be **deleted/recreated**.
- **Destination IDs may not survive a restore unchanged.**
- Restore **does not erase** subsequent history.

**Boundary:** This is **product-level config history**, not Git history.

**Source:** [`workflows/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/workflows) · [`workflows.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/workflows/workflows.controller.ts)

---

### 16. Workflow YAML & Git Sync

**What it does:** Represents workflow configs as YAML so teams can version them in Git.

**API operations:**
- Export one workflow → YAML.
- Export all workflows → YAML.
- Import workflow from YAML.
- Choose **create** vs **upsert** on import.

**Local sync script** (root scripts wrap `scripts/relayon-sync.mjs`):
```bash
npm run workflows:pull       # pull current YAML
npm run workflows:validate   # local validation
npm run workflows:push       # push config back
```

**Environment variables:** `RELAYON_API_URL`, `RELAYON_API_TOKEN`, `RELAYON_WORKFLOWS_DIR` (default `./workflows`).

**Validation checks:** `apiVersion: relayon/v1`, `kind: Workflow`, `metadata.name`, `spec.sourceType`, destination array shape, unresolved `${...}` placeholders.

**Boundary:** The script does **not** create Git commits — Git remains the source-control system.

**Source:** [`scripts/relayon-sync.mjs`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/scripts/relayon-sync.mjs) · [`docs/workflow-examples.md`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docs/workflow-examples.md)

---

### 17. Workflow Test Runs & Assertions

**What it does:** Test path separate from public ingress — evaluate a sample payload through the workflow pipeline, then check JSONata assertions.

**Flow:**
1. Submit sample payload.
2. Pipeline runs (enrich → transform → route) — **no real destination write**.
3. Assertions (JSONata) evaluated against output.
4. Return individual pass/fail + aggregate counts.

**Use case:** Check that a transform contains a required field, or that sample data yields expected outcome.

**Boundary:** A test-run does **not** prove an external provider accepts a production write. Use destination validation for safe provider checks, and a controlled real delivery when end-to-end external behavior must be confirmed.

**Source:** [`workflow-test.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/workflows/testing/workflow-test.controller.ts) · [`workflow-test.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/workflows/testing/workflow-test.service.ts)

---

### 18. Authentication & Account Lifecycle

**What it does:** Multi-tenant identity with multiple sign-in paths.

**Account flows:**
- Email/password sign-up + login.
- Email verification + resend.
- Forgot-password + reset-password.
- Strong-password validation (client + server).
- Refresh-token renewal + logout/revocation.
- Google OAuth + GitHub OAuth.
- User locale preference.

**Token lifecycle:**
- **JWT access tokens** — short-lived, default **15 minutes**.
- **Refresh tokens** — longer-lived opaque, default **7 days**, stored **hashed** in PostgreSQL, rotated on use.
- Expiry configurable via env.

**OAuth callback handling:**
- Google + GitHub callback routes validate OAuth state.
- Issue a **short-lived exchange ticket** → dashboard exchanges for a session.
- Avoids placing full session credential in OAuth callback URL.

**Verification / reset tokens:**
- Stored **hashed** with expiry + used-state.
- Password reset **revokes existing refresh-token sessions** — an earlier session is not left active after a credential reset.

**Source:** [`auth.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/auth/auth.controller.ts) · [`auth.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/auth/auth.service.ts) · [`email-verification.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/auth/email-verification.service.ts) · [`password-reset.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/auth/password-reset.service.ts)

---

### 19. Multi-tenancy, Access Control & RLS

**What it does:** Tenant ID = ownership boundary for workflows, destinations, keys, schedules, usage, integrations, and other tenant-scoped data.

**App-level:** Controllers derive tenant context from authenticated user; services use tenant-scoped queries/transactions.

**Roles:** Privileged operations (e.g., BYOK key management) restricted to `owner`/`admin`. **Platform super-admin** separate from tenant roles.

**Row-Level Security (RLS):**
- PostgreSQL RLS policies in `packages/db/prisma/rls/policies.sql`.
- Apply script: `scripts/apply-rls.mjs`.
- CI has a dedicated **RLS enforcement job**.
- Covers every tenant-owned table (v1.9.0 full rollout).
- Integration test: `test/integration/rls.integration.spec.ts`.
- Tenant context helper: `apps/api/src/lib/tenant-context.ts`.

**Boundary:** RLS is **additional** control — application authorization + resource-ownership checks still required. Security controls ≠ certifications (no SOC 2 / HIPAA / GDPR certification implied).

**Source:** [`prisma/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/prisma) · [`rls/policies.sql`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/packages/db/prisma/rls/policies.sql) · [`apply-rls.mjs`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/scripts/apply-rls.mjs)

---

### 20. API Keys & Rotation

**What it does:** Programmatic access to the API with scoped, rotatable keys.

**Format:**
```
rlk_<live|test>_<8-hex-prefix>_<48-hex-secret>
```

**Storage:** identification prefix + hash (with **pepper** — `API_KEY_PEPPER`) — no recoverable raw secret. Raw key **shown once** at creation.

**8 scopes:** `events:read`, `workflows:read`, `workflows:write`, `destinations:read`, `destinations:write`, `dlq:read`, `dlq:write`, `analytics:read`.

**Hybrid guard:** `JwtOrApiKeyGuard` accepts JWT **or** `X-API-Key`.

**Rotation:**
- Creates replacement key with intended scope/env.
- Previous key valid for grace window capped at **24 hours**.
- Rotation history/lineage fields persisted.

**Revocation:** Immediate 401.

**Source:** [`api-keys/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/api-keys) · [`common/guards/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/common/guards)

---

### 21. Credential Encryption

**What it does:** Every destination credential (Slack URL, Stripe secret, DB connection string, etc.) is encrypted at rest with AES-256-GCM.

**Algorithm:** AES-256-GCM authenticated encryption + **HKDF-SHA256 per-tenant key derivation**.

**Versioned envelope:** stores **key identifier**, **IV**, **auth tag**, **ciphertext**. Legacy envelope support retained.

**Key-ring behavior (`CONNECTOR_ENCRYPTION_KEYS`):**
- Comma-separated `kid:hexkey` entries.
- **First key** used for new encryption.
- **All configured keys** available for decryption.
- API + Workers must have compatible key material — API writes, Workers decrypts.

**Redaction & full-config mode:**
- API responses **redact** encrypted secret values.
- `FULL_CONFIG_ENCRYPTION=true` enables broader config encryption.
- Metadata required by UI stays available.

**Boundary:** Do **not** remove an old key just because a new one is added — existing ciphertext may reference the old key ID. Retain old keys until migrated + verified.

**Source:** [`crypto-box.ts` (API)](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/lib/crypto-box.ts) · [`crypto-box.ts` (Workers)](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/lib/crypto-box.ts) · [`rotate-encryption-key.mjs`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/scripts/rotate-encryption-key.mjs)

---

### 22. BYOK Integrations

**What it does:** Bring Your Own Key — tenant configures provider credentials instead of relying on platform key.

**Providers:** Groq, OpenAI, Anthropic, Resend.

**Lifecycle:**
1. Open **Settings → Integrations**.
2. Submit provider + key (optionally preferred model).
3. API validates key with bounded timeout.
4. API encrypts key with tenant context + stores.
5. Dashboard receives provider/model status — not plaintext key.
6. Provider resolution: **tenant key first** → **platform env fallback**.
7. Resolver caches briefly (**60s**); create/update/toggle/delete invalidates cache.

**Roles:** Only owners/admins can manage integration credentials.

**Boundary:** BYOK provider keys ≠ destination credentials. An LLM provider key does not replace a Slack URL or DB connection string.

**Source:** [`integrations.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/integrations/integrations.controller.ts) · [`integrations.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/integrations/integrations.service.ts) · [`provider-resolver.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/integrations/provider-resolver.ts) · [`provider-validators.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/integrations/provider-validators.ts)

---

### 23. AI Assistant & RAG

**What it does:** In-product AI chat with tool calling + documentation RAG — separate from event enrichment.

**LLM:** Groq. Chat sessions + messages persisted.

**Intent categories:** learn, do, list, debug, chat — classified before tool selection.

**Registered tools:**
- `search_docs` — docs search
- `list_workflows`, `get_workflow`, `create_workflow` — workflow info + create
- `delivery_stats` — delivery statistics
- `list_dlq` — DLQ listing

**Tool guidance:** Tool definitions guide the assistant on *when* to call + *what must be present* before making a change. Example: `create_workflow` should wait until the user provided required workflow name, source type, and signing secret.

**RAG implementation (PostgreSQL FTS — NOT vector/embeddings):**

4-tier fallback in `RagService.search`:
1. `websearch_to_tsquery`
2. `plainto_tsquery`
3. Keyword OR matching
4. Full-phrase `ILIKE`

Query allows shared + tenant-specific knowledge rows under tenant filter.

**Transport caveat:** AI status endpoint reports:
- `toolCalling: true`
- `rag: postgres-fts`
- `streaming: simulated`

Do **not** describe this as provider-native token streaming — the status reports simulated.

**Source:** [`ai.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/ai/ai.controller.ts) · [`chat-agent.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/ai/chat-agent.service.ts) · [`rag.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/ai/rag.service.ts) · [`tools/registry.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/ai/tools/registry.ts)

**Ingest endpoint:** `POST /api/ai/ingest`

---

### 24. Billing & Stripe

**What it does:** Stripe test-mode subscription billing.

**Operations:**
- Read tenant billing/subscription status.
- Create Stripe checkout session.
- Create billing portal session for existing customer.
- Validate Stripe webhook signatures (using **raw request body**).
- Process subscription-related webhook events → update tenant fields (customer/subscription/price/status).
- Report quota usage to Stripe for eligible active/trialing subscriptions.

**Storage:** Tenant fields: `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `subscriptionStatus`, `currentPeriodEnd`.

**Boundary:** Billing code present ≠ live checkout enabled. Stripe keys + webhook secret + price IDs must be configured. **Never** expose Stripe secret key to browser or commit to source control.

**Source:** [`billing.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/billing/billing.controller.ts) · [`billing.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/billing/billing.service.ts) · [`billing/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/billing)

---

### 25. Customer Outbound Webhooks (Standard Webhooks & Outbox)

**What it does:** Relayon can send **signed notifications FROM Relayon TO customer-owned webhook endpoints** — a separate direction from the ingress path.

**Endpoint config:** URL, optional description, optional event-type filters, active/inactive, signing secret (generated + encrypted).

**Supported event types:** `workflow.created`, `workflow.updated`, `workflow.deleted`, `event.received`, `delivery.succeeded`, `delivery.failed`, `dlq.entry.created`, `quota.warning`, `quota.exceeded`.

**Transactional outbox:**
- `OutboxService.emit()` persists outbox row in PostgreSQL.
- Can accept an existing Prisma transaction → atomic state change + outbox record.

**Poll and deliver:**
- Poller claims due rows using `FOR UPDATE SKIP LOCKED` + lease.
- Resolves matching active endpoints → signs payload → sends.
- Batch size **10**, fetch timeout **3s**, claim lease **60s**, up to **20 attempts**, retention **7 days**.
- Transient failures rescheduled; terminal failures marked failed.

**Signature (Standard Webhooks spec):**
- Signs `webhook-id.webhook-timestamp.rawBody`.
- Sends `webhook-id`, `webhook-timestamp`, `webhook-signature` headers.
- Receivers should validate raw body + timestamp.

**Boundary:** Outbound platform webhooks ≠ ingress. Outbox → notifies customers about Relayon events. Ingress → receives source webhooks.

**Source:** [`webhook-endpoints.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/webhooks/webhook-endpoints.controller.ts) · [`outbox.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/webhooks/outbox.service.ts) · [`outbox-poller.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/webhooks/outbox-poller.service.ts) · [`standard-webhooks.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/webhooks/standard-webhooks.ts)

---

### 26. Community & Workflow Templates

**What it does:** Forum + workflow template marketplace + announcements.

**Community operations:**
- Browse published posts, open by ID or slug.
- Create posts + replies.
- Mark reply as solution (service checks acting user is post author).
- Like/unlike posts + replies.
- Flag posts/replies for moderation.
- Read announcements.
- Preview + import published workflow templates.

**Workflow templates:** Template post can contain YAML metadata. Service checks post type/status + verifies YAML is present before returning for preview/import. Imported templates should be **reviewed + configured with receiving tenant's own credentials** before activation.

**Rate controls:**
- **5 posts / hour** per user.
- **20 replies / hour** per user.

**Prisma models:** `CommunityPost`, `CommunityReply`, `CommunityLike`, `CommunityFlag`, `AnnouncementShare`.

**Source:** [`community.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/community/community.controller.ts) · [`community.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/community/community.service.ts) · [`templates.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/community/templates.service.ts)

---

### 27. Moderation & Social Sharing

**What it does:** Community content moderation + social sharing.

**Features:**
- **Moderation queue** — pending flags surfaced to admin.
- **Auto-hide** — after **3 pending flags**, a post is auto-hidden.
- **Moderation audit trail** — `ModerationAction` model.
- **Actions:** dismiss flag, remove post/reply, hide, restore, remove.
- **Public post lookup filters hidden/unpublished** — moderated posts not returned as ordinary published content.

**Social sharing:**
- Data model + service support for share metadata by platform.
- Twitter API v2 + share intents for announcements.
- Share DTO in `share.dto.ts`.

**Boundary:** Service support is not proof every external social provider account is configured for automated posting.

**Source:** [`moderation.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/admin/moderation/moderation.service.ts) · [`moderation/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/admin/moderation)

---

### 28. Admin, Impersonation & Time Travel

**What it does:** Super-admin surface for platform operations — distinct from tenant-facing workspace pages.

**Admin service capabilities:**
- Platform overview metrics.
- Tenant listing / search.
- Tenant detail (workspace info + users + workflows + API keys + usage/delivery context + DLQ counts + live presence where available).
- User listing / search.
- Traffic overview.
- Live-session listing.
- Health checks.
- Queue-related info.
- Audit-log listing.

**Impersonation:**
- Super-admin can start impersonation session for support/debugging.
- Records audit entry, issues **short-lived session** scoped to target tenant.
- Service TTL: **15 minutes**.
- Start + end actions recorded separately (audit trail).
- Dashboard shows impersonation banner.

**Time Travel:**
- Reconstructs selected tenant/workflow state at a past timestamp.
- Uses retained **workflow version snapshots** + audit/outbox/usage records.
- **Future timestamps rejected**.

**Boundary:** Time-travel is a **reconstruction/forensics** feature — **not** a full historical DB restore, **not** a guarantee every transient Redis/Mongo value can be recreated for any past instant.

**Admin screens:** `admin-overview`, `admin-tenants`, `admin-tenant-detail`, `admin-users`, `admin-audit`, `admin-health`, `admin-feature-flags`, `admin-moderation`, `admin-announcements`, `time-travel-panel`, `admin-layout`, `impersonation-banner`.

**Source:** [`admin.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/admin/admin.service.ts) · [`impersonation/impersonation.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/admin/impersonation/impersonation.service.ts) · [`time-travel/time-travel.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/admin/time-travel/time-travel.service.ts)

---

### 29. Feature Flags

**What it does:** Platform + tenant-aware feature toggles.

**Storage:** PostgreSQL `FeatureFlag` model, loaded into **in-memory cache**, refreshed every **30 seconds**.

**Flag fields:** `key`, `description`, `isEnabled`, `rolloutPct` (0–100), `tenantOverrides` (JSONB — `{ tenantId: true|false }`).

**Evaluation order:**
1. Tenant override (if present).
2. Global enabled state.
3. Stable rollout bucket from **hash of tenant ID** (for percentage rollout).

**Missing flags default to disabled.**

**Guard/decorator:** `@FeatureFlag(...)` + `FeatureFlagGuard`.

**Source:** [`feature-flag.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/common/feature-flags/feature-flag.service.ts) · [`feature-flags-admin.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/admin/feature-flags/feature-flags-admin.controller.ts)

---

### 30. Developer Playground

**What it does:** Temporary endpoint for capturing arbitrary HTTP requests during development — no workflow required.

**Session flow:**
1. Create playground session via API.
2. Receive capture URL.
3. Send request from test tool / local app.
4. Ingress records request into Redis.
5. Dashboard lists captured requests + subscribes to live stream.
6. Clear session when done.

**Limits:** Session TTL **1 hour**, buffer capped at **100 requests**. Headers sanitized to remove sensitive values.

**Boundary:** Captured request ≠ passed production signature checks ≠ processed as production event. It's a **developer diagnostic tool**.

**Source:** [`playground.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/playground/playground.service.ts) · [`playground.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/playground/playground.controller.ts) · [`routes/play.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress/src/routes/play.ts)

---

### 31. Local Tunnel & CLI

**What it does:** `@relayon/cli` — expose a local dev server to internet via hosted tunnel (ngrok alternative).

**Commands:**
```bash
npx @relayon/cli listen --port 3000
npx @relayon/cli listen --port 3000 --label stripe-dev
npm install -g @relayon/cli
relayon listen --port 3000
```

**Features:**
- **Permanent URLs** per `--label` — same URL across restarts within 24h window.
- **SSE auto-reconnect** — survives Vercel 10s timeout + network drops.
- **Buffered playback** — 200 requests replayed on reconnect.
- **Buffered headers** — sensitive headers stripped (`Authorization`, `Cookie`).
- **Timeout + error reporting** — localhost down = clear message.

**Auth modes:** API key (`RELAYON_API_KEY`) or JWT (`RELAYON_TOKEN`). Self-hosted supported via `--api-url`.

**Ingress routes:** `/t/:sessionId` (capture), `/tunnel/*` (SSE). API tunnel service creates/reuses session. Session TTL **24 hours**.

**Boundary:** Local-development forwarding feature — **not** a replacement for production workflow ingress.

**Source:** [`tunnel.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/tunnel/tunnel.service.ts) · [`tunnel.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/tunnel/tunnel.controller.ts) · [`routes/tunnel.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress/src/routes/tunnel.ts) · [`packages/cli/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/packages/cli)

---

### 32. Presence & Product Tracking

**Live presence:**
- Redis session data with **45-second TTL**.
- Dashboard client heartbeats every **15 seconds**.
- Admin views use this ephemeral info to show live sessions.
- **Not** a persistent activity log — when heartbeats stop and keys expire, session no longer counted.

**Product tracking:**
- `POST` endpoint accepts batches of page/product events (browser beacon / fetch keepalive).
- Writes to PostgreSQL `page_events` table.
- DTO constrains event fields; controller can attach a platform-provided country header and extract tenant context from a validated tenant header.
- Used by admin traffic views + top-page summaries.

**Boundary:** Presence data = ephemeral Redis. Page-event tracking = persisted in PostgreSQL. Different data streams. Review tracking DTO + privacy policy + retention before changing what's collected.

**Source:** [`presence.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/presence/presence.service.ts) · [`tracking.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/tracking/tracking.controller.ts) · [`tracking.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/tracking/tracking.service.ts)

---

### 33. Dashboard Experience

**What it does:** Angular 19 SPA — control plane UI for every feature. Lazy-loaded route components, guest-only auth pages separated from authenticated workspace shell, admin routes use auth guards + server-side authorization.

**Main routes:**

| Route | Purpose |
|---|---|
| `/login`, `/signup` | Auth |
| `/forgot-password`, `/reset-password` | Recovery |
| `/verify-email`, `/auth/oauth-callback` | Activation / OAuth |
| `/privacy`, `/terms`, `/guide`, `/about` | Public info/legal |
| `/dashboard` | Workspace overview |
| `/workflows`, `/workflows/:id` | Workflow list + detail |
| `/events` | Event explorer |
| `/dlq` | Failed delivery management |
| `/analytics` | Usage + delivery analytics |
| `/settings` | API keys, integrations, billing, settings |
| `/community`, `/community/new`, `/community/:slug` | Community + templates |
| `/playground` | Request capture/testing |
| `/admin/...` | Platform administration |

**Shared UI (v3.7.0 rebuild):**
- Premium design tokens.
- **Modal, confirm dialog, toast** system.
- **Lucide icons**.
- **Skeleton loading** + **empty states**.
- Mobile-first responsive layouts.
- **Impersonation banner**.
- **PWA** install/update/offline prompts.
- **Time-series chart** — pure SVG (no Chart.js, no D3).
- Schema-driven forms, password strength, icons, logos, app shell/header/footer.

**Boundary:** These are dashboard capabilities — **server-side API authorization remains the security boundary**.

**Source:** [`app.routes.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/dashboard/src/app/app.routes.ts) · [`features/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/dashboard/src/app/features) · [`shared/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/dashboard/src/app/shared)

---

### 34. Localization, PWA & SEO

**Localization:**
- **Translations:** English (`en`), Urdu (`ur`), Arabic (`ar`) via **Transloco**.
- **RTL:** Urdu + Arabic treated as right-to-left; layout direction auto-switched.
- **Resolution order:** saved preference → authenticated user locale → browser language → English.
- **Localized auth email templates**.
- **Assets:** `en.json`, `ur.json`, `ar.json`.

**Progressive Web App (PWA):**
- Install prompt (`install-prompt.component.ts`).
- Offline banner (`offline-banner.component.ts`).
- Network status (`network-status.service.ts`).
- Auto-update (`app-update.service.ts`, `update-prompt.component.ts`).
- Service-worker cache (`sw-cache.service.ts`).
- Manifest: `manifest.webmanifest`, config: `ngsw-config.json`.
- Icon set: 16/32/72/96/128/144/152/192/384/512, apple-touch-icon, maskable.
- **Boundary:** PWA remains a web app — no separate native iOS/Android applications.

**SEO & SSR (v3.4.0):**
- Server route/config files (`main.server.ts`, `server.ts`, `app.config.server.ts`).
- Angular prerender config.
- `public/robots.txt`, `public/sitemap.xml`.
- SEO service for prerender / SSR / metadata (`core/seo/seo.service.ts`).
- Public header/footer/about/credits.
- **Boundary:** Not every authenticated workspace route is server-rendered — check specific route + deployment behavior before claiming.

**Source:** [`i18n/translations.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/dashboard/src/app/i18n/translations.ts) · [`i18n/language.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/dashboard/src/app/i18n/language.service.ts) · [`core/pwa/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/dashboard/src/app/core/pwa) · [`core/seo/seo.service.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/dashboard/src/app/core/seo/seo.service.ts)

---

### 35. API, SDK & OpenAPI

**Three principal network surfaces:**

| Surface | Production base | Responsibility |
|---|---|---|
| Dashboard/API | `https://relayon-api.vercel.app/api` | Authenticated control-plane |
| Ingress | `https://relayon-ingress.vercel.app` | Webhook / playground / tunnel capture |
| Workers/internal | `https://relayon-workers.vercel.app/internal` | Protected processing / delivery / schedule / dry-run |

**API bootstrap:**
- Swagger UI: `https://relayon-api.vercel.app/api/docs`
- OpenAPI spec: `https://relayon-api.vercel.app/api/openapi.json`
- (Both disable-able via config)

**SDK (`@relayon/sdk`):**
- Generated from OpenAPI 3.1 via `@hey-api/openapi-ts`.
- Bundled with `tsup`.
- Typed endpoint functions + client helpers.
- API key or JWT configuration.
- Accepts a **custom `fetch`** implementation.
- Zero runtime cost beyond `@hey-api/client-fetch` (~5KB).
- Tree-shakeable. Full IDE autocomplete.
- Regenerable after API changes: `npm run sync` + `npm run generate`.

**Naming convention:** `controllerNameMethodName` in camelCase (`workflowsList`, `workflowsCreate`, `workflowsGet`, `authMe`, `dlqBulkReplay`).

**Internal worker routes** (`/internal/*`) protected by shared cron secret — **not** intended as arbitrary public customer endpoints.

**Source:** [`api/src/main.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/main.ts) · [`packages/sdk/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/packages/sdk) · [`packages/sdk/README.md`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/packages/sdk/README.md)

---

### 36. Brand System

**What it does:** Complete logo + icon family for the product.

**Logo v2.0** — hollow-bowl R, 3-stop gradient, depth shadow, rim highlight.

**Logo variants:**
- `logo-mark.svg`
- `logo-mark-mono-dark.svg`
- `logo-mark-mono-light.svg`
- `logo-mark-transparent.svg`
- `logo-wordmark.svg`
- `logo-wordmark-stacked.svg`
- `avatar.svg`

**Favicon set:** 16/32, ico, png, svg.

**PWA icons:** 72/96/128/144/152/192/384/512.

**Apple touch icon:** svg + png.

**Social preview:** `og-image.svg`, `og-image.png`.

**Manifest paths consolidated**, apple-touch-icon reference corrected.

**Source:** [`assets/logo/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/dashboard/src/assets/logo) · [`public/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/dashboard/public) · [`assets/icons/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/dashboard/src/assets/icons)

---

### 37. Self-Hosting (Docker Compose)

**What it does:** Full self-hosted deployment on a single VM — verified on Oracle Cloud **ARM64**.

**Services (10):**
- `postgres`, `redis`, `mongo`
- `migrate` (one-shot migration)
- `api`, `ingress`, `workers`, `dashboard`
- `nginx`, `cron` (sidecar)

**Dockerfiles:** `Dockerfile.api`, `Dockerfile.dashboard`, `Dockerfile.ingress`, `Dockerfile.workers` (multi-stage with `migration` + `production` targets).

**Nginx configs:** `nginx.conf`, `nginx-dashboard.conf`.

**DB init:** `init-db.sql`.

**Cron sidecar:** pings every 60s:
- `/internal/process`
- `/internal/deliver`
- `/internal/schedule/tick`
- `/api/cron/outbox/tick`

**Platform:** `linux/arm64` explicitly set (comment out for x86_64).

**Health checks:** every service.

**Migration stage:** `migrate` service runs `prisma migrate deploy` then exits.

**Environment:** `docker/.env.example`.

**Boundary:** Validate architecture, secrets, storage, backups, TLS, and resource limits for the target host.

**Source:** [`docker-compose.yml`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docker-compose.yml) · [`docker/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docker) · [`DEPLOYMENT.md`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/DEPLOYMENT.md)

---

### 38. Deployment, Observability & CI/CD

**Vercel multi-project model:** 4 projects with different root directories (`apps/dashboard`, `apps/api`, `apps/ingress`, `apps/workers`). Backend projects need access to shared workspace packages + correct Prisma client generation.

**Serverless workers:** Invoked in bounded batches. Processing/delivery/schedule need external cron or scheduled job — serverless worker is not a permanent daemon.

**Docker Compose model:** See §37.

**Health endpoints:**
- API: `GET /api/health`
- Ingress: `GET /health`
- Workers: `GET /internal/health` (internal secret required)

**Sentry:** Optional DSN on all 3 backends (`SENTRY_DSN`).

**OpenTelemetry:** `tracing.ts` in each backend; `OTEL_EXPORTER_OTLP_ENDPOINT`.

**Structured JSON logs:** correlation IDs, stage markers, duration tracking.

**Smoke test:** `npm run smoke` — 10 checks across all services.

**Keep-alive:** GitHub Actions pings production every 12h (prevents Atlas M0 idle pause).

**CI (`.github/workflows/`):**

| Workflow | Trigger | Runs |
|---|---|---|
| `ci.yml` | Push to `main`, PR | typecheck + 4 builds |
| `test.yml` | Push, PR | unit + integration + RLS + mutation |
| `keep-alive.yml` | Every 12h | Production health ping |
| `workflow-validate.yml` | Workflow YAML changes | YAML validation |

**Boundary:** A green CI run is **point-in-time** for that commit — not a permanent guarantee about later changes or external provider uptime.

**Source:** [`docker-compose.yml`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docker-compose.yml) · [`docker/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docker) · [`.github/workflows/`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/.github/workflows) · [`DEPLOYMENT.md`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/DEPLOYMENT.md)

---

## 🔌 Adapter Catalog

**9 built-in adapters** (as of v1.5.0, unchanged):

| # | Adapter | Config | Version | Dry-run probe |
|---|---|---|---|---|
| 1 | **HTTP** | URL + headers | v1.0 | `HEAD` |
| 2 | **Slack** | Webhook URL | v1.0 | URL format only |
| 3 | **Email** | Resend key + from/to | v1.0 | Auth check (no send) |
| 4 | **Google Sheets** | Service-account JWT + spreadsheet/range | v1.0 | Metadata fetch |
| 5 | **Discord** | Webhook URL | v1.2 | URL format only |
| 6 | **Airtable** | PAT + base + table | v1.3 | Base tables list |
| 7 | **Notion** | Integration token + data source | v1.3 | Data source fetch |
| 8 | **PostgreSQL** | Connection string + column mapping + upsert | v1.4 | `SELECT 1` |
| 9 | **MongoDB** | Connection string + upsert key | v1.4 | ping |

**Extensibility:**
- **Adapter SDK** — custom adapters via decorator + registry (v1.2).
- **Rich field descriptors** (v1.7) — dynamic destination forms generated from descriptors.
- **Adapter catalog** (v1.6) — list all adapters + config schemas.
- **External/community adapter loading** (v1.9) — manifest schema + sandbox runner.
- **Example community adapter** — `community-discord/` with `index.js` + `manifest.json`.

**Files:** `apps/workers/src/modules/egress/adapters/*.adapter.ts` — each has `.spec.ts`.

---

## 🌐 API Surface

**80+ endpoints across 3 services.**

### API — Control Plane (`/api/*`)

| Module | Endpoints |
|---|---|
| **Auth** | `POST /auth/signup`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `/verify-email`, `/oauth/exchange`, `/update-locale` |
| **Workflows** | CRUD + `GET /workflows/:id/versions`, `POST /workflows/:id/versions/:versionId/restore`, `POST /workflows/:id/diff`, `POST /workflows/:id/import`, `GET /workflows/:id/export`, `POST /workflows/:id/test-run` |
| **Destinations** | CRUD + `POST /destinations/validate` |
| **Schedules** | `POST/PUT/DELETE /workflows/:id/schedule`, `POST /run-now`, `POST /bulk/pause-all`, `/bulk/resume-all`, `/bulk/delete` |
| **Events** | `GET /events`, `/events/:id`, `POST /events/:id/replay` |
| **DLQ** | `GET /dlq`, `POST /dlq/:id/replay`, `/dlq/replay-bulk`, `/dlq/discard` |
| **Analytics** | `GET /analytics` |
| **API Keys** | `POST /api-keys`, `GET /api-keys`, `DELETE /api-keys/:id`, `POST /api-keys/:id/rotate` |
| **Quota** | `GET /quota`, `POST /usage/export` |
| **Tenants** | `GET /tenants`, `PATCH /tenants/:id`, `POST /tenants/quota` |
| **Billing** | `POST /billing/checkout`, `/billing/webhook` |
| **Integrations** | `POST /integrations`, `GET /integrations`, `DELETE /integrations/:id` |
| **Admin** | `/admin/*` — tenants, users, audit, moderation, announcements, feature flags, health, time-travel, impersonation, social |
| **Community** | `/community/*` (posts, replies, likes, flags), `/announcements/*` |
| **AI** | `POST /ai/chat`, `POST /ai/ingest`, `GET /ai/sessions`, `/ai/sessions/:id` |
| **Webhooks** | `/webhooks/endpoints/*` (outbound CRUD) |
| **Feature flags** | `/admin/feature-flags/*` |
| **Playground** | `/playground/*` |
| **Tunnel** | `/tunnel/*` |
| **Health** | `GET /api/health` |
| **Cron** | `POST /api/cron/outbox/tick` |

### Ingress — Public Edge

| Route | Purpose |
|---|---|
| `POST /webhook/:tenantId/:workflowId` | Receive inbound webhook |
| `/play/*` | Playground capture |
| `/tunnel/*` | Tunnel SSE + capture |
| `GET /health` | Health check |

### Workers — Internal (`/internal/*`)

| Route | Purpose |
|---|---|
| `POST /internal/process` | Batch process incoming |
| `POST /internal/deliver` | Batch deliver pending |
| `POST /internal/schedule/tick` | Process due schedules |
| `POST /internal/schedule/run-now` | Manual trigger |
| `POST /internal/egress/dry-run` | Dry-run destination validation |
| `GET /internal/adapters` | List registered adapters |
| `GET /internal/health` | Health check |

**Auth:** JWT (`Authorization: Bearer …`) or API key (`X-API-Key: rlk_…`) for API. `X-Cron-Secret` for Workers internal. Signature headers for webhooks.

---

## 💾 Data Stores

### PostgreSQL (Neon) — 27 Prisma models

| Category | Models |
|---|---|
| **Identity & tenant** | `Tenant`, `User`, `EmailVerification`, `PasswordReset`, `RefreshToken` |
| **Workflow engine** | `Workflow`, `Destination`, `WorkflowSchedule`, `WorkflowVersion` |
| **Access & usage** | `ApiKey`, `ApiKeyRotation`, `UsageCounter` |
| **AI & knowledge** | `ChatSession`, `ChatMessage`, `KnowledgeChunk` |
| **Analytics/admin** | `PageEvent`, `AdminAuditLog` |
| **Community** | `CommunityPost`, `CommunityReply`, `CommunityLike`, `CommunityFlag`, `ModerationAction`, `AnnouncementShare` |
| **Outbound webhooks** | `WebhookEndpoint`, `OutboxEvent` |
| **Platform extensions** | `FeatureFlag`, `TunnelSession`, `TenantIntegration` |

**Migrations:** 18 applied (v1.0 → v3.5) — see `packages/db/prisma/migrations/`.

### MongoDB (Atlas)

- **Event** — payload, processing state, correlation.
- **Delivery** — per-destination delivery attempts.
- **TTL:** 30 days.

### Redis (Upstash)

- Ingest queue, egress queue, delayed retry set.
- Idempotency keys (24h TTL).
- Rate-limit counters, sliding-window limiter.
- AI cache (1h TTL).
- Live streams, tunnel/playground coordination.
- `pg-cron-lock` (distributed cron).

---

## 🧪 Testing & CI

**Framework (v2.0 Batches 1–3):**

| Tool | Purpose |
|---|---|
| **Vitest** | Unit + integration (`vitest.config.ts`, `vitest.integration.config.ts`) |
| **Playwright** | E2E (`playwright.config.ts`) |
| **Stryker** | Mutation testing (`stryker.config.mjs`) — critical paths: crypto-box, retry-policy, quota |
| **k6** | Load testing — `webhook-ingress.js`, `webhook-sustained.js`, `webhook-burst.js`, `delivery-throughput.js` |
| **Mocks** | Prisma, Stripe (`test/mocks/`) |

**Test locations:**
- **Unit** — `*.spec.ts` colocated with source.
- **Integration** — `test/integration/*.integration.spec.ts` (9 files).
- **E2E** — `test/e2e/*.e2e.spec.ts` (4 files: auth-flow, full-pipeline, quota-ui, tenant-isolation).
- **Load** — `test/load/*.js` (4 files).
- **Fixtures** — `test/fixtures/index.ts`.
- **Setup** — `test/setup/env.ts`, `vitest-setup.ts`.

**Coverage targets:**
- Adapters — each has `.spec.ts` (9).
- Services — auth, quota, schedules, workflows, dlq, api-keys, billing, stripe, crypto-box, ingest, idempotency, signature, verifiers, routing, transform, circuit-breaker, retry-policy.

**CI workflows:**

| Workflow | Trigger | Runs |
|---|---|---|
| `ci.yml` | Push to `main`, PR | typecheck + 4 builds |
| `test.yml` | Push, PR | unit + integration + RLS + mutation |
| `keep-alive.yml` | Every 12h | Production health ping |
| `workflow-validate.yml` | Workflow YAML changes | YAML validation |

**Stats:** 112 runs, 105 ✅, 7 ❌ historical (all recovered).

**Smoke test:** `npm run smoke` — 10 checks.

---

## 📚 Documentation

**12 files in `docs/` + 2 at root:**

| File | Contents |
|---|---|
| `README.md` | Project overview |
| `DEPLOYMENT.md` | 4-project Vercel setup + Docker Compose self-hosting |
| `docs/ARCHITECTURE.md` | System design, data flow, decisions, failure modes |
| `docs/API_REFERENCE.md` | Complete HTTP API |
| `docs/DATABASE.md` | PostgreSQL schema, MongoDB collections, Redis keys |
| `docs/SECURITY.md` | Threat model, auth, encryption, key rotation |
| `docs/TESTING.md` | Test strategy, smoke, per-version manual checklists |
| `docs/TROUBLESHOOTING.md` | 40+ real issues + verified fixes |
| `docs/CONTRIBUTING.md` | Dev setup, adapter guide, safety rejections |
| `docs/CHANGELOG.md` | Full history v1.0 → v1.5 |
| `docs/ROADMAP.md` | Actual shipped vs planned |
| `docs/FAQ.md` | 50+ questions |
| `docs/relayon-guide.md` | Quick user guide |
| `docs/workflow-examples.md` | Workflow YAML examples |

---

## 🔒 Security Summary

| Layer | Control |
|---|---|
| **Signature verification** | 5 verifiers, timing-safe compare, timestamp tolerance (default 300s) |
| **Raw body preservation** | Express `verify` callback preserves original bytes |
| **Idempotency** | Redis `SET NX EX 86400` scoped per tenant/workflow |
| **Rate limiting** | Atomic Lua (default 1,000/min per tenant) |
| **At-rest encryption** | AES-256-GCM + HKDF per-tenant keys, versioned envelope |
| **Key rotation** | Multi-key keyring (`CONNECTOR_ENCRYPTION_KEYS`), zero-downtime |
| **Client redaction** | Encrypted config returns `••••••••` only |
| **API keys** | SHA-256 + pepper, 8 scopes, 24h rotation grace |
| **JWT** | 15m access, 7d refresh (rotated), password reset revokes sessions |
| **OAuth** | State + short-lived exchange ticket (no credential in URL) |
| **Verification/reset tokens** | Hashed, expiring, used-state-tracked |
| **Multi-tenancy** | App-level tenant scoping + PostgreSQL RLS (defense-in-depth) |
| **PII protection** | Sensitive headers stripped, salted IP hash, no raw IPs |
| **Adapter sandbox** | Worker-thread, no `require`, HTTPS-only fetch, 5s timeout |
| **Secrets** | Never committed, never returned to browser |

**Boundary:** These are implementation controls — **not** SOC 2 / HIPAA / GDPR certification.

---

## ⚠️ Behavior Boundaries & Limitations

These apply to **every** claim above:

1. **Feature present ≠ feature configured.** Provider keys, destination credentials, cron jobs, env vars, DB migrations, and permissions may be required.

2. **A safe test ≠ a real write.** Workflow test-run, transform preview, and dry-run do **not** prove every real provider write will succeed.

3. **At-least-once ≠ exactly-once.** Failure/recovery can repeat a delivery attempt. Use destination idempotency support or idempotent receivers where needed.

4. **AI output is not authoritative fact.** Model output can be incomplete, incorrect, or unavailable. Validate before business-critical use.

5. **Outbound platform webhooks ≠ ingress.** Outbox endpoint delivery notifies customer endpoints about Relayon events; ingress receives source webhooks.

6. **RAG is PostgreSQL FTS in this snapshot.** Not vector/embedding search.

7. **Chat streaming is simulated.** The AI status endpoint reports `streaming: simulated`. Do not claim provider-native token streaming.

8. **Time-travel is reconstruction.** Uses retained snapshots/audit records. Not a complete point-in-time restoration of every DB/Redis/Mongo state.

9. **Security controls ≠ certifications.** Encryption, access controls, and RLS are implementation controls — not evidence of SOC 2, HIPAA, or GDPR certification.

10. **Documentation may lag source.** Some older docs still show `v1.5.0`. Prefer pinned source, current OpenAPI, Prisma schema/migrations, and commit/tag history.

11. **Version tags ≠ formal releases.** Repository has tags through `v3.7.0`; only `v1.0.0`–`v1.5.0` appear as formal GitHub Release objects.

12. **Product boundary.** Relayon is integration + event-delivery infrastructure — not a system of record for payment, order, CRM, or accounting.

---

## 📁 Source Directory

| Feature / area | Source |
|---|---|
| Dashboard pages/routes | [`apps/dashboard/src/app`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/dashboard/src/app) |
| API modules | [`apps/api/src/modules`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules) |
| Ingress | [`apps/ingress/src`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress/src) |
| Worker modules | [`apps/workers/src/modules`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules) |
| Prisma schema/migrations | [`packages/db/prisma`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/packages/db/prisma) |
| SDK | [`packages/sdk`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/packages/sdk) |
| CLI tunnel | [`packages/cli`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/packages/cli) |
| Docker deployment | [`docker`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docker) · [`docker-compose.yml`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docker-compose.yml) |
| CI/CD | [`.github/workflows`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/.github/workflows) |
| Tests | [`test`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/test) |
| Scripts | [`scripts`](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/scripts) |

**Related docs:** [README](../README.md) · [Architecture](./ARCHITECTURE.md) · [API reference](./API_REFERENCE.md) · [Database design](./DATABASE.md) · [Security](./SECURITY.md) · [Testing](./TESTING.md) · [Deployment guide](../DEPLOYMENT.md) · [Changelog](./CHANGELOG.md) · [Roadmap](./ROADMAP.md) · [Workflow examples](./workflow-examples.md) · [Quick user guide](./relayon-guide.md)

---

## 📜 Version-by-Version History

> Full table already in [Version Overview](#-version-overview) above. **Quick recap:**
>
> - **v1.0–v1.5** — Foundation → validation & diff (4 adapters → 9 adapters).
> - **v1.6–v1.9** — Validation persistence, dynamic forms, quotas + RLS, external adapters.
> - **v2.0–v2.2** — Billing, auth expansion, i18n.
> - **v2.3–v2.5** — AI assistant, scale, PWA.
> - **v2.6–v2.9** — Admin phases A–D, community, moderation.
> - **v3.0–v3.1** — Platform waves, SDK, Standard Webhooks, time travel, feature flags, playground, CLI tunnel.
> - **v3.2–v3.4** — Self-hosting, onboarding + legal, SEO/SSR.
> - **v3.5–v3.7** — BYOK, AI refinement (intent detection), UI overhaul.
> - **Post-v3.7.0** (tagless): brand refresh, `ConfirmState` TS4029 fix.

**Formal GitHub Releases:** only `v1.0.0`–`v1.5.0` are Release objects. `v1.6.0`–`v3.7.0` are **git tags only** (source-audited).

---

## 📄 License

**Relayon v3.6+ is proprietary source-visible software.**

- ✅ **Free to use + self-host.** Personal or commercial.
- ✅ **Read the source** for auditing, learning, and security review.
- ✅ **Contribute** via Pull Request (contributions assigned to Licensor upon merge).
- ❌ **No modifications** for your own deployment (without written permission).
- ❌ **No forks** to build or promote a competing product.
- ❌ **No resale, sublicensing, or redistribution.**
- ❌ **No AI training** on the source code.
- ❌ **No removal** of copyright headers, license notices, or attribution.

**"Relayon"**, the Relayon logo, and **"Your webhooks, relayed right"** are trademarks of **Zain Shah**. No license — MIT or otherwise — has ever granted any trademark rights.

**Full terms:** [`LICENSE`](./LICENSE)
**Historical license record:** [`LICENSE-MIT-LEGACY`](./LICENSE-MIT-LEGACY)
**Permission requests:** `zainshahzs110@gmail.com` — subject line *"Relayon Permission Request — [Your Name]"*

---

*Prepared from the Relayon `main` source snapshot at `f4dd930eafd2ab61381bc1c049bb6cdbb7480235` on 24 November 2026. Implementation links pinned to this commit for traceability.*

**Copyright (c) 2026 Zain Shah. All Rights Reserved.**

---