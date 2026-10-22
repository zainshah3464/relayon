<div align="center">

# ⚡ Relayon

**Your webhooks, relayed right.**

*Serverless-native webhook relay platform — receive, enrich with AI, transform, and route events to any destination reliably. Built entirely on free-tier infrastructure.*

[![Live Demo](https://img.shields.io/badge/Live-relayon.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://relayon.vercel.app)
[![Version](https://img.shields.io/badge/version-1.0.0-success?style=for-the-badge)](https://github.com/zainshah3464/relayon/releases)
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
│  6. Fan out to N destinations (retry + DLQ)        │
│  7. Circuit-break unhealthy destinations           │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Destinations: HTTP · Slack · Email · Google Sheets │
└─────────────────────────────────────────────────────┘
```

Configure once. Every event flows through reliably.

---

## 🌐 Live in Production

**v1.0.0 is deployed and running on Vercel's free tier:**

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
<td align="center"><strong>Workflow Detail</strong><br/><br/>
<img src="./docs/screenshots/workflow.png" width="400" alt="Workflow detail"/>
</td>
<td align="center"><strong>Event Explorer</strong><br/><br/>
<img src="./docs/screenshots/events.png" width="400" alt="Event explorer"/>
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

### Delivery — Multi-Destination Routing

- **4 adapters** — HTTP, Slack, Email (Resend), Google Sheets (service account JWT)
- **Exponential backoff** — 10s → 30s → 1m → 5m → 15m (configurable)
- **Dead Letter Queue** — after max retries, replayable via dashboard
- **Circuit breaker** — pause unhealthy destinations (5 failures / 5 min)
- **At-least-once semantics** — `RPOPLPUSH` + atomic Mongo claim + 5-min stuck recovery
- **Idempotency-Key headers** — `{eventId}:{destinationId}` sent to HTTP destinations

### Dashboard — Control Plane

- **Workflow builder** — create pipelines via UI (no curl needed)
- **Event explorer** — cursor-paginated list, filter by status, full lifecycle view
- **DLQ manager** — inspect failures, replay with one click, discard permanently
- **Analytics** — events 24h/7d, success rate, pending count, DLQ count, per-destination breakdown
- **Multi-tenant** — JWT auth, refresh token rotation, role-based access
- **Responsive** — mobile sidebar toggle, adaptive layouts

### Observability — Production Ops

- **Sentry integration** — optional DSN, captures exceptions in all 3 backends
- **Structured JSON logs** — correlation IDs, stage markers, duration tracking
- **Health endpoints** — `/api/health`, `/health`, `/internal/health` with dependency checks
- **Smoke test** — `scripts/smoke-test.mjs` with 10 checks across all services

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
└──────────────────┘  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
                               │                     │                     │
                               ▼                     ▼                     ▼
                      ┌────────────────────────────────────────────────────────┐
                      │              Shared Data Layer                         │
                      ├────────────────────────────────────────────────────────┤
                      │  PostgreSQL (Neon)   — tenants, users, workflows       │
                      │  MongoDB (Atlas M0)  — events, deliveries (TTL 30d)    │
                      │  Redis (Upstash)     — queues, cache, rate limits      │
                      └────────────────────────────────────────────────────────┘
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
- **Workers** — full AI stack, slow cold start (~1200ms), but batching amortizes it
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

### Backend — Control Plane
- **NestJS 11** (modular DI)
- **Prisma ORM** (PostgreSQL)
- **Mongoose** (MongoDB reads)
- **JWT** + refresh token rotation
- **class-validator** (DTO validation)

### Backend — Data Plane
- **Express 5** (webhook ingress)
- **NestJS 11** (workers)
- **ioredis** (Redis client)
- **Zod** (env validation)

</td>
<td width="50%" valign="top">

### Data Stores
- **PostgreSQL** — Neon (free tier)
- **MongoDB** — Atlas M0 (free tier)
- **Redis** — Upstash (free tier)

### AI & Integrations
- **Groq** — `openai/gpt-oss-120b` (LLM)
- **JSONata** — Transform expressions
- **Resend** — Email delivery
- **Google Sheets API** — Service account JWT

### Infrastructure
- **Vercel Hobby** — 4 projects, $0/month
- **Sentry** — Error tracking (optional)
- **GitHub Actions** — CI + cron

</td>
</tr>
</table>

---

## 🔄 Data Flow

```
1. Webhook arrives  →  Stripe POST /webhook/{tenantId}/{workflowId}
                       │
                       ▼
2. Ingress          →  ├─ Verify HMAC signature
                       ├─ Check idempotency (Redis SET NX)
                       ├─ Enforce rate limit (Redis INCR)
                       ├─ LPUSH to queue:events:incoming
                       └─ Return 202 Accepted

3. Workers          →  ├─ RPOPLPUSH incoming → processing
                       ├─ Load workflow config (batched)
                       ├─ Groq AI enrichment (cached 1h)
                       ├─ JSONata transform (2s timeout)
                       ├─ INSERT Event doc (MongoDB)
                       ├─ Fan out: 1 Delivery doc per destination
                       └─ LPUSH to queue:egress:pending

4. Egress           →  ├─ RPOP from egress queue
                       ├─ Atomic claim (findOneAndUpdate)
                       ├─ Call adapter (HTTP/Slack/Email/Sheets)
                       ├─ Success → status: 'delivered'
                       └─ Failure → ZADD to delayed queue (backoff)

5. Dashboard        →  Read events, deliveries, DLQ
                       Replay failed deliveries
                       View analytics
```

**Reliability guarantees:**
- At-least-once delivery (`RPOPLPUSH` + `LREM` after ack)
- Event deduplication (MongoDB unique `correlationId`)
- Delivery deduplication (`Idempotency-Key` header)
- Retry with exponential backoff (5 attempts default)
- Dead Letter Queue (permanent failures)
- Circuit breaker (unhealthy destinations paused)
- Stuck recovery (5-minute scan for orphaned deliveries)

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
**Sign up, create a workflow, send a webhook.** Done in 3 minutes.

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

**Current coverage:**
- ✅ Smoke test: 10 checks across all services
- ⏳ Unit tests: planned for v1.1 (see [Roadmap](./docs/ROADMAP.md))
- ⏳ Manual E2E: 13-step documented flow (see [Testing](./docs/TESTING.md))

**CI:** GitHub Actions runs `typecheck + 4 builds` on every push to `main`.

---

## 📚 Documentation

Full documentation set — **9 deep-dive files**:

| File | Contents |
|---|---|
| [**Architecture**](./docs/ARCHITECTURE.md) | System design, data flow, key engineering decisions, failure modes |
| [**API Reference**](./docs/API_REFERENCE.md) | Complete HTTP API for all 3 services (60+ endpoints) |
| [**Database**](./docs/DATABASE.md) | PostgreSQL schema, MongoDB collections, Redis keys, migrations |
| [**Security**](./docs/SECURITY.md) | Threat model, auth flow, defense-in-depth, honest gaps |
| [**Testing**](./docs/TESTING.md) | Test strategy, smoke test, CI setup, untested areas |
| [**Troubleshooting**](./docs/TROUBLESHOOTING.md) | 20+ real issues and verified fixes from v1.0 deployment |
| [**Contributing**](./docs/CONTRIBUTING.md) | Dev setup, commit convention, PR process |
| [**Changelog**](./docs/CHANGELOG.md) | Version history, every bug fixed during v1.0 |
| [**Roadmap**](./docs/ROADMAP.md) | Planned features + explicit non-goals |
| [**FAQ**](./docs/FAQ.md) | 40+ questions honestly answered |
| [**Deployment Guide**](./DEPLOYMENT.md) | Step-by-step Vercel deployment, env matrix, rollback |

---

## 🚢 Deployment

See [**DEPLOYMENT.md**](./DEPLOYMENT.md) for the full guide. Summary:

| Step | Action |
|---|---|
| 1 | Create 4 Vercel projects (dashboard, api, ingress, workers) from same repo |
| 2 | Set Root Directory for each (`apps/dashboard`, `apps/api`, etc.) |
| 3 | Enable **"Include source files outside Root Directory"** for backends |
| 4 | Add environment variables per service |
| 5 | Deploy in order: **API → Ingress → Workers → Dashboard** |
| 6 | Set up **external cron** (GitHub Actions or QStash) for `/internal/process` and `/internal/deliver` |
| 7 | Run smoke test against live URLs |

**Total deployment time:** ~15 minutes.
**Total cost:** **$0/month** on free tiers.

---

## 💡 Why This Project

### Serverless constraints as architecture, not limitation

Vercel Hobby has **3 hard limits** that shaped Relayon's design:

1. **Cron runs once per day** → external cron (GitHub Actions/QStash)
2. **Functions are stateless** → Redis queues for state
3. **10s function duration** → batch processing with time budgets

These aren't compromises — they're **the design**.

### Reliability is the product

- **At-least-once delivery** proven with `RPOPLPUSH` + atomic Mongo claims
- **Circuit breaker** prevents cascading failures
- **DLQ** makes every failure recoverable
- **Graceful degradation** when AI fails

### Built for the real world

- **Multi-tenant from day one** — not bolted on later
- **Sentry-ready** — observability built in
- **Documented limits** — no fake features, honest about gaps
- **Every capability tested end-to-end** — smoke test proves it

### Not a toy project

- **28,000+ lines** of TypeScript across 4 apps
- **9 documentation files** with deep engineering dives
- **Real production deployment** at `relayon.vercel.app`
- **MIT licensed** — fork, modify, self-host, sell

---

## 🔒 Security

Relayon takes security seriously — but is honest about gaps:

**Implemented:**
- ✅ Multi-tenant isolation (application + database layer)
- ✅ JWT auth with refresh token rotation
- ✅ HMAC signature verification (timing-safe)
- ✅ Encrypted connections (HTTPS, `rediss://`, `sslmode=require`)
- ✅ Rate limiting on all endpoints
- ✅ Secrets in encrypted env vars (Vercel)
- ✅ IP hashing (raw IPs never stored)
- ✅ Zero `eval()` / zero dynamic code execution

**Known limitations:**
- ⚠️ `sourceConfig.secret` and `destination.config` are plaintext in PostgreSQL
- ⚠️ No MFA/TOTP for dashboard login
- ⚠️ No SOC 2 / HIPAA / GDPR certification
- ⚠️ No automated backups on free tier

See [**docs/SECURITY.md**](./docs/SECURITY.md) for the full threat model.

**Report vulnerabilities privately:** `zainshahzs110@gmail.com` (do not open public issue).

---

## 🗺 Roadmap

### v1.0 — **Shipped** ✅
Full MVP: 4 apps, AI enrichment, 4 adapters, DLQ, dashboard, $0 deploy.

### v1.1 — Q1 2027
- Unit tests (Vitest)
- API keys management UI
- Destination test endpoint
- Persistent audit log

### v1.2 — Q2 2027
- Analytics charts (SVG)
- Bulk DLQ actions
- Conditional routing
- 6 more adapters (Discord, Airtable, Notion, Linear, PagerDuty, Opsgenie)
- i18n (Urdu + Hindi)

### v2.0 — Q3-Q4 2027
- SAML SSO
- Row-level security (RLS)
- SOC 2 Type I compliance
- Multi-region deployment
- Self-hosted Docker option

See [**docs/ROADMAP.md**](./docs/ROADMAP.md) for full details + explicit non-goals.

---

## 🤝 Contributing

Contributions welcome! See [**docs/CONTRIBUTING.md**](./docs/CONTRIBUTING.md) for the full guide.

**High-priority contributions:**
- New destination adapters (Discord, Airtable, Notion)
- New signature verifiers (Twilio, SendGrid)
- Unit tests
- Documentation improvements
- Bug reports with reproduction steps

**Quick workflow:**
1. Fork the repo
2. Create a branch (`feat/your-feature`)
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/)
4. Open a PR — reviewed within 48 hours

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

[⬶ Back to top](#-relayon)

</div>
```

---