
# Changelog

All notable changes to Relayon are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Unit tests (Vitest) for signature verifiers, retry policy, circuit breaker
- Persistent audit log table in PostgreSQL
- Dashboard charts (SVG time-series for events and deliveries)
- API keys management UI
- Destination test endpoint (`POST /destinations/:id/test`)
- Bulk DLQ replay (multi-select)
- Conditional routing (if/else based on payload)
- PostgreSQL/MongoDB destination adapters
- i18n support (English + Urdu + Hindi)

---

## [1.0.0] — 2026-10-22

**First stable production release.** Live at [relayon.vercel.app](https://relayon.vercel.app).

This release represents the complete MVP — all 7 development phases shipped, deployed to Vercel, and verified end-to-end in production.

### Added

#### Core Platform
- **4-app monorepo** — Dashboard (Angular 19), API (NestJS 11), Ingress (Express 5), Workers (NestJS 11)
- **Multi-tenancy** — JWT auth with refresh token rotation, role-based access (owner/admin/viewer)
- **Workflow CRUD** — Create, read, update, delete webhook pipelines via dashboard or API
- **Destination management** — Attach N destinations per workflow, toggle enabled, delete

#### Ingress (Webhook Reception)
- **5 signature verifiers** — Stripe, GitHub, Shopify, Slack, Generic HMAC
- **Timing-safe comparison** for all signatures (`crypto.timingSafeEqual`)
- **Timestamp tolerance** — configurable window (default 300s) for Stripe and Slack
- **Redis idempotency** — `SET NX EX 86400` on body hash or `X-Event-Id` header
- **Rate limiting** — 300 req/min per workflow via Redis `INCR`
- **5 MB payload limit** with clean `413` response
- **Correlation IDs** — every request gets a UUID traceable across all services

#### Processing (AI + Transform)
- **Groq AI enrichment** — summarize, classify, extract, translate via `openai/gpt-oss-120b`
- **1-hour Redis cache** — identical payloads served from cache, avoiding Groq quota burn
- **Graceful degradation** — if Groq fails, event still processes and delivers
- **JSONata transform** — 2-second timeout, compile-time error handling
- **Batch processing** — configurable `BATCH_SIZE` (default 3) and `TIME_BUDGET_MS` (default 7000ms) for Vercel Hobby limits

#### Delivery
- **4 destination adapters** — HTTP, Slack, Email (Resend), Google Sheets (service account JWT)
- **Exponential backoff retry** — 10s → 30s → 1m → 5m → 15m (configurable per destination)
- **Dead Letter Queue** — `status: 'dlq'` after max attempts, replayable via dashboard
- **Circuit breaker** — pause unhealthy destinations (5 failures / 5 min)
- **At-least-once delivery** — `RPOPLPUSH` + atomic Mongo claim + 5-min stuck recovery
- **Idempotency-Key headers** — `{eventId}:{destinationId}` sent to HTTP destinations
- **Adapter timeout** — 15s default, configurable via `ADAPTER_TIMEOUT_MS`

#### Data Layer
- **PostgreSQL (Prisma)** — Tenants, Users, RefreshTokens, Workflows, Destinations, ApiKeys
- **MongoDB (Mongoose)** — Events, Deliveries (both with 30-day TTL indexes)
- **Redis (Upstash)** — 4 queues (incoming, processing, egress pending, egress delayed), idempotency, rate limits, circuit breaker, Groq cache

#### Dashboard
- **Login/Signup** — JWT auth with automatic token refresh
- **Workflows list** — create + list, filtered by tenant
- **Workflow detail** — webhook URL copy, destination CRUD (type-specific forms)
- **Events explorer** — cursor-paginated list, filter by status, detail drawer with raw + enriched payload + delivery attempts
- **DLQ manager** — inspect failures, replay with one click, discard permanently
- **Analytics** — events 24h/7d, success rate, pending count, DLQ count, per-destination breakdown
- **Settings** — tenant name rename
- **Responsive** — mobile sidebar toggle, adaptive layouts

#### Observability
- **Sentry integration** — optional DSN, captures exceptions in API/Ingress/Workers
- **Structured JSON logs** — correlation IDs, stage markers, duration tracking
- **Health endpoints** — `/api/health`, `/health`, `/internal/health` with dependency checks
- **Smoke test** — `scripts/smoke-test.mjs` with 10 checks across all 3 live domains

#### Documentation
- **README.md** — overview, features, architecture, live URLs
- **DEPLOYMENT.md** — 4-project Vercel setup, env matrix, deploy order, rollback
- **docs/ARCHITECTURE.md** — system design, data flow, key decisions, failure modes
- **docs/API_REFERENCE.md** — complete HTTP API for all 3 services
- **docs/DATABASE.md** — schema, indexes, migrations, common queries
- **docs/SECURITY.md** — threat model, auth flow, defense-in-depth, gaps
- **docs/TESTING.md** — test strategy, smoke test, CI setup, untested areas
- **docs/CONTRIBUTING.md** — dev setup, commit convention, PR process
- **docs/CHANGELOG.md** — this file
- **docs/TROUBLESHOOTING.md** — common issues and fixes
- **docs/ROADMAP.md** — planned features

### Fixed (During Development)

The following bugs were found and fixed during the v1.0 development cycle. Documented here for future reference:

- **Prisma EPERM on Windows** — `npm run db:generate` failed with `EPERM: operation not permitted, rename query_engine-windows.dll.node` because dev servers were holding the file lock. **Fix:** Kill all node processes before regenerating.
- **Groq timeout parsing** — `config.get<number>('GROQ_TIMEOUT_MS')` returned a string at runtime, causing `GroqError: timeout must be an integer`. **Fix:** Use `parseInt(config.get<string>(...), 10)`.
- **NODE_ENV tab character** — Vercel env var copy-pasted from a doc included a leading `\t`, causing Zod enum validation to fail. **Fix:** Manually re-type env values in Vercel dashboard; add `.trim().pipe(z.enum(...))` to schema.
- **Vercel serverless "No exports found"** — Workers and Ingress called `app.listen()` which crashes in Vercel's serverless runtime. **Fix:** Export default handler (`export default app`), skip `listen()` when `process.env.VERCEL` is set.
- **Prisma not found in Vercel build** — `postinstall: prisma generate` failed with `prisma: command not found` because Vercel's `PATH` didn't include workspace `node_modules/.bin`. **Fix:** Move `prisma` to root `dependencies`, use `node ./node_modules/prisma/build/index.js generate --schema=...` in build command.
- **npx pulled Prisma 8 RC** — `npx prisma generate` fetched `prisma@latest` (`8.0.0-rc.25`) which removed the `generate` command. **Fix:** Remove `npx`, pin exact version `6.19.3` in both root and workspace `package.json`.
- **Dashboard SPA 404 on refresh** — Angular SPA router 404'd on direct URL access. **Fix:** Add `rewrites` in `vercel.json` (`/(.*)` → `/index.html`).
- **CORS failure on production** — Dashboard at `relayon.vercel.app` couldn't call API with `CORS_ORIGIN=relayon-dashboard.vercel.app`. **Fix:** Update env var to match actual deployed dashboard URL.
- **`@types/jsonata` does not exist** — Attempting to install caused `ETARGET`. **Fix:** Remove it (jsonata ships its own types).
- **`INestApplication` typo** — Used `INestApplication` instead of `NestApplication` in workers `main.ts`. **Fix:** Correct the type name.

### Security

- **Timing-safe signature comparison** for all 5 webhook sources
- **Refresh token rotation** — old token revoked on every refresh
- **Bcrypt cost 12** for password hashing
- **JWT secret rotation** — old refresh tokens become unusable after secret change
- **Rate limiting** on auth endpoints (10 req/min per IP)
- **Sensitive header sanitization** — `Authorization`, `Cookie`, `X-Api-Key`, `Proxy-Authorization` stripped from webhook payloads before queueing
- **IP hashing** — SHA-256 + salt; raw IPs never stored
- **Zero `eval()` / zero dynamic code execution** anywhere in the codebase

### Performance

- **Cold starts** — Ingress ~500ms, API ~800ms, Workers ~1200ms (first invocation only)
- **Warm requests** — 30-100ms across all services
- **Dashboard bundle** — 310 KB initial (87 KB gzipped), lazy-loaded feature chunks
- **Lighthouse** — Not yet run against production; planned for v1.0.1

### Deployment

- **Vercel Hobby** — 4 separate projects from 1 GitHub repo
- **Total cost** — $0/month on free tiers (Vercel + Neon + Atlas M0 + Upstash + Groq + Sentry free)
- **Build time** — ~90 seconds per project (first build), ~15 seconds (cached)
- **Live URLs**:
  - Dashboard: `https://relayon.vercel.app`
  - API: `https://relayon-api.vercel.app`
  - Ingress: `https://relayon-ingress.vercel.app`
  - Workers: `https://relayon-workers.vercel.app`

### Known Limitations

- **Cron interval** — Vercel Hobby allows only 1 cron/day. External cron required (GitHub Actions, cron-job.org, or QStash).
- **No automated backups** on free tier. Manual `pg_dump` / `mongodump` required.
- **No unit tests** — smoke test is the primary coverage.
- **Encryption at rest** for `sourceConfig` and `destination.config` not implemented (plaintext in PostgreSQL).
- **No MFA/TOTP** for dashboard login.
- **Single-region deployment** — all services in `iad1` (US East).

---

## Commit History

`v1.0.0` was built across 15 commits:

| Commit | Description |
|---|---|
| `ea7f037` | feat: Relayon v1.0 — full webhook relay platform |
| `9990485` | docs: update README with full project overview |
| `7561769` | docs: add MIT license |
| `359b49a` | fix(vercel): skip app.listen() on serverless + export ingress app |
| `960e7e7` | fix: add vercel.json for ingress and workers serverless deployment |
| `ec24f07` | fix: parseInt for Groq timeout, move prisma to dependencies |
| `2358136` | fix(workers): export default handler for Vercel serverless |
| `6d6a252` | fix(workers): correct NestApplication type; fix(ingress): defensive NODE_ENV trim |
| `c697666` | chore: trigger dashboard rebuild |
| `d0fe6d5` | fix(vercel): root postinstall delegates to db workspace for prisma generate |
| `e0fe619` | fix(vercel): use npx prisma generate in root postinstall with schema path |
| `8de2e83` | fix(vercel): pin prisma 6.19.3 in root deps, remove npx, regenerate lockfile |
| `d86eba7` | fix(vercel): move prisma generate from postinstall to build command |
| ... | (docs commits) |

---

## Versioning Policy

- **MAJOR** (`2.0.0`) — Breaking changes to public API or data schema
- **MINOR** (`1.1.0`) — New features, backward compatible
- **PATCH** (`1.0.1`) — Bug fixes, security patches

Security fixes are **backported to the last two minor versions** whenever feasible.

---

## How to Read This Changelog

**If you're upgrading from a previous version:**
- Read the "Fixed" section carefully — some may require env var changes
- Check "Breaking Changes" in the target version
- Follow `DEPLOYMENT.md` for redeploy steps

**If you're evaluating Relayon for the first time:**
- Start with "Added" in `[1.0.0]` to see the feature set
- Skim "Known Limitations" to know what's NOT supported
- Check `ROADMAP.md` for what's coming
```

---