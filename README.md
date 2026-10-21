# Relayon

**Your webhooks, relayed right.**

Serverless-native webhook relay platform — receive events, enrich with AI, transform, and route to any destination reliably. Built entirely on Vercel's free tier.

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](#)
[![Angular](https://img.shields.io/badge/Angular-19-DD0031?style=flat-square&logo=angular&logoColor=white)](#)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white)](#)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](#)

---

## What It Does

Every SaaS company writes the same integration code: **Stripe webhook → Slack, Shopify order → Sheets, GitHub PR → Jira**. It's repetitive, error-prone, and expensive (Zapier charges $200–500/month for the same thing).

**Relayon turns that into configuration, not code.**

```
Webhook arrives → Signature verified → AI enriches → Transform → Route to N destinations
                                                                   ↓
                                            Retries with backoff → DLQ → Replay
```

---

## Features

### Ingress
- **5 signature verifiers** — Stripe, GitHub, Shopify, Slack, Generic HMAC
- **Redis idempotency** — duplicate webhooks safely deduplicated (24h TTL)
- **Rate limiting** — per-workflow (300 req/min)
- **Payload capture** — raw body preserved for signature verification

### AI Enrichment
- **Groq LLM** — summarize, classify, extract, translate (configurable per workflow)
- **Redis cache** — identical payloads served from cache (1h TTL)
- **Graceful degradation** — event routes even if Groq fails

### Delivery
- **4 adapters** — HTTP, Slack, Email (Resend), Google Sheets
- **Exponential backoff** — 10s → 30s → 1m → 5m → 15m (configurable)
- **Dead Letter Queue** — after max retries, replayable via dashboard
- **Circuit breaker** — pause unhealthy destinations (5 failures / 5 min)
- **At-least-once semantics** — `RPOPLPUSH`, atomic Mongo claim, stuck recovery
- **Idempotency-Key headers** — destination-side dedup

### Dashboard
- **Workflow builder** — create/edit pipelines in UI (no curl)
- **Event explorer** — full lifecycle of every webhook
- **DLQ manager** — inspect failures, replay with one click
- **Analytics** — events, success rate, latency per destination
- **Multi-tenant** — JWT auth, refresh token rotation, role-based access

### Observability
- **Sentry** — optional error tracking (free tier)
- **Structured JSON logs** — correlation IDs across all services
- **Health endpoints** — DB, Redis, Mongo checks per service

---

## Architecture

**4 apps, one monorepo, independently deployable on Vercel:**

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Dashboard   │    │     API      │    │   Ingress    │    │   Workers    │
│  (Angular)   │◄──►│  (NestJS)    │    │  (Express)   │    │  (NestJS)    │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │                   │
       └───────────────────┴───────────────────┴───────────────────┘
                                    │
        ┌───────────┬───────────────┼──────────────┬─────────────┐
        ▼           ▼               ▼              ▼             ▼
   PostgreSQL   MongoDB          Redis          Groq        Sentry
   (Neon)      (Atlas M0)      (Upstash)       (AI)       (errors)
```

**Data flow:**

1. **Ingress** verifies signature → pushes to `queue:events:incoming`
2. **Workers** pop event → Groq enrichment → JSONata transform → `queue:egress:pending`
3. **Egress** delivers to each destination with retry/backoff
4. **DLQ** on exhaustion → replay via **Dashboard**

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Angular 19 (standalone, signals), Tailwind CSS, RxJS |
| **API** | NestJS 11, Prisma ORM, JWT (access + refresh) |
| **Ingress** | Express 5, ioredis, zod validation |
| **Workers** | NestJS 11, Groq SDK, JSONata, Mongoose |
| **Databases** | PostgreSQL (Neon) + MongoDB (Atlas) + Redis (Upstash) |
| **AI** | Groq (`openai/gpt-oss-120b`) |
| **Deploy** | Vercel Hobby (4 projects) |

---

## Running Locally

### 1. Install

```bash
git clone https://github.com/zainshah3464/relayon.git
cd relayon
npm install --workspaces
```

### 2. Environment

Each app has its own `.env.example`:

```bash
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example apps/api/.env.local
cp apps/ingress/.env.example apps/ingress/.env.local
cp apps/workers/.env.example apps/workers/.env.local
```

Fill in:
- **PostgreSQL** — [Neon](https://neon.tech) (free)
- **MongoDB** — [Atlas M0](https://cloud.mongodb.com) (free)
- **Redis** — [Upstash](https://console.upstash.com) (free, `rediss://` URL)
- **Groq** — [console.groq.com](https://console.groq.com) (free tier)

Generate JWT/cron secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Migrate & Run

```bash
npm run db:generate
npm run db:deploy
```

Then in **4 terminals**:

```bash
npm run dev:api        # :3001
npm run dev:ingress    # :3002
npm run dev:workers    # :3003
npm run dev:dashboard  # :4200
```

Dashboard: **http://localhost:4200**

---

## Testing

```bash
npm run typecheck     # TypeScript across all workspaces
npm run test          # Unit tests
npm run smoke         # End-to-end smoke test (needs production URLs)
```

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full step-by-step guide.

**Summary:**
- 4 Vercel projects (dashboard, api, ingress, workers)
- External cron (cron-job.org or QStash) for `/internal/process` and `/internal/deliver`
- Total cost: **$0/month** on free tiers

---

## Why This Project

**Serverless constraints as architecture, not limitation:**
- Stateless functions with Redis queues (no persistent workers)
- External cron on Vercel Hobby (which only allows 1 cron/day)
- Redis-based idempotency (no DB round-trip for dedup)
- Groq caching to stay within free-tier rate limits

**Reliability is the product:**
- At-least-once delivery proven with `RPOPLPUSH` + atomic claims
- Circuit breaker prevents cascading failures
- DLQ makes every failure recoverable
- Graceful degradation when AI fails

**Built for the real world:**
- Multi-tenant from day one (not bolted on)
- Sentry-ready observability
- Documented limits and upgrade paths
- No fake features — every capability is tested end-to-end

---

## License

MIT — see [LICENSE](./LICENSE).

---

**Zain Shah** · [GitHub](https://github.com/zainshah3464) · [Email](mailto:zainshahzs110@gmail.com)

> *Your webhooks, relayed right.*
```