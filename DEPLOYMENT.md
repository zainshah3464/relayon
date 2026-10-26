# Relayon — Production Deployment Guide

> **Current version:** v1.5.0
>
> Target: Vercel Hobby ($0) + Neon + Upstash + MongoDB Atlas + Groq + Resend (optional).

This guide is written for someone who has never seen Relayon before. If you follow it exactly, you will have a working production deployment in ~20 minutes. If you skip steps, you will spend 3 hours debugging.

---

## Table of Contents

- [0. Prerequisites](#0-prerequisites)
- [1. Local production checks](#1-local-production-checks)
- [2. Database migrations](#2-database-migrations)
- [3. Create 4 Vercel projects](#3-create-4-vercel-projects)
- [4. Environment variable matrix](#4-environment-variable-matrix)
- [5. Deploy order (with back-fill loop)](#5-deploy-order-with-back-fill-loop)
- [6. External cron (3 jobs required)](#6-external-cron-3-jobs-required)
- [7. Smoke test](#7-smoke-test)
- [8. CI](#8-ci)
- [9. Rollback](#9-rollback)
- [10. Limits & upgrade path](#10-limits--upgrade-path)
- [11. Post-deploy checklist](#11-post-deploy-checklist)
- [12. Deploy-delta reference (v1.0 → v1.5)](#12-deploy-delta-reference-v10--v15)

---

## 0. Prerequisites

- GitHub repo pushed to `main`
- Neon PostgreSQL created (use **pooled** connection string with `?sslmode=require`)
- Upstash Redis created (use `rediss://` **TCP URL**, not REST)
- MongoDB Atlas M0 created (`0.0.0.0/0` allowed in Network Access)
- Groq API key created (`GROQ_API_KEY`)
- Vercel account connected to GitHub
- **Node 22.x** installed locally

**Optional but recommended:**
- Sentry account (free tier, optional DSN)
- Resend account if using the Email adapter

---

## 1. Local production checks

Run these **before touching Vercel**. Every one of these passes locally or your deploy will fail.

```bash
npm ci
npm run db:generate
npm run typecheck                    # must show 0 errors in all 4 workspaces
npm run build:dashboard && \
npm run build:api && \
npm run build:ingress && \
npm run build:workers
```

**What `db:generate` does (v1.5):** Regenerates the Prisma client with **two binary targets**:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}
```
- `native` = your local dev machine (Windows / Mac / Linux)
- `rhel-openssl-3.0.x` = Vercel's Amazon Linux 2023 runtime

**Without both targets, Vercel will fail at runtime** with `PrismaClientInitializationError: Query engine library not found`. This is the single most common v1.x deployment bug. See §12.

**If `db:generate` fails on Windows with `EPERM: rename query_engine-windows.dll.node`:** Kill all node processes first (`taskkill /f /im node.exe`), then retry. The DLL is locked by running dev servers.

---

## 2. Database migrations

**Relayon v1.5 has 4 migrations.** All must be applied to a fresh Neon database before the API can start.

```bash
cd packages/db
DATABASE_URL="postgresql://...neon...?sslmode=require" npx prisma migrate deploy
cd ../..
```

**Migrations applied (v1.0 → v1.5):**

| Migration | Version | What it adds |
|---|---|---|
| `init` | v1.0 | Tenants, Users, Workflows, Destinations, RefreshTokens, ApiKeys |
| `add_routing_rules` | v1.1 | `workflows.routing_rules` JSONB column |
| `api_keys_scopes` | v1.2 | Rebuilds `api_keys` with `prefix`, `scopes[]`, `environment`, `revoked_at` |
| `v13_schedules_and_versions` | v1.3 | `workflow_schedules` + `workflow_versions` tables |

**No migration for v1.4 or v1.5** — those versions added adapters, encryption format changes, and endpoints only. Schema is unchanged.

**⚠️ Rule for production:** Use `prisma migrate deploy` (applies pending migrations only). **Never** use `prisma migrate dev` on production — it can generate new migrations and prompt interactively.

**Backup before first migration on an existing DB:**
```bash
pg_dump "$DATABASE_URL" > relayon-pre-deploy-$(date +%Y%m%d).sql
```

---

## 3. Create 4 Vercel projects

From **vercel.com/new → Import Git Repository**, create one project per app. Same repo, four times.

| Vercel Project | Root Directory | Framework Preset | Build Command | Output Directory |
|---|---|---|---|---|
| `relayon-dashboard` | `apps/dashboard` | Angular | `npm run build` | `dist/dashboard/browser` |
| `relayon-api` | `apps/api` | NestJS | auto | auto |
| `relayon-ingress` | `apps/ingress` | Express | auto | auto |
| `relayon-workers` | `apps/workers` | NestJS | auto | auto |

**For API, Ingress, Workers — in Settings → Build & Development:**
- Enable **"Include source files outside of the Root Directory in the Build Step"** ✅
- This is required for `packages/db` (Prisma client) and `packages/shared` to resolve

**For API and Workers — also override Build Command:**

In Vercel → Settings → General → **Build Command**:

```bash
node ./node_modules/prisma/build/index.js generate --schema=./packages/db/prisma/schema.prisma && npm run build
```

**Do NOT use `npx prisma generate`.** Vercel's PATH doesn't include the workspace-local binary, so `npx` fetches `prisma@latest` which removed the `generate` command in v8. Build fails with `CLI.UNKNOWN_COMMAND: No command registered for 'generate'`. This is the second most common v1.x deployment bug. See §12.

**Node version:** 22.x (Settings → General → Node.js Version)

**Region:** Same region as Neon and Upstash (e.g. Singapore, `sin1`). Mixing regions adds 200-400ms latency to every DB query.

---

## 4. Environment variable matrix

**Read carefully.** Different apps need different env vars. Missing one = runtime failure.

| Variable | Dashboard | API | Ingress | Workers | Notes |
|---|---|---|---|---|---|
| `NODE_ENV` | — | `production` | `production` | `production` | **Don't paste from docs — type manually** (tab character bug) |
| `DATABASE_URL` | — | ✅ | ✅ | ✅ | Neon pooled URL + `?sslmode=require` |
| `MONGODB_URI` | — | ✅ | — | ✅ | Atlas M0 URI, URL-encode password |
| `MONGODB_DB_NAME` | — | ✅ | — | ✅ | e.g. `relayon` |
| `UPSTASH_REDIS_TCP_URL` | — | — | ✅ | ✅ | Must be `rediss://...` (TLS) |
| `GROQ_API_KEY` | — | — | — | ✅ | From console.groq.com |
| `GROQ_MODEL` | — | — | — | ✅ | `openai/gpt-oss-120b` |
| `GROQ_TIMEOUT_MS` | — | — | — | `6000` | **Production value** (not 20000) |
| `GROQ_MAX_TOKENS` | — | — | — | `1024` | |
| `GROQ_TEMPERATURE` | — | — | — | `0.2` | |
| `JWT_SECRET` | — | ✅ | — | — | 64 hex |
| `JWT_REFRESH_SECRET` | — | ✅ | — | — | 64 hex — different from JWT_SECRET |
| `JWT_EXPIRES_IN` | — | `15m` | — | — | |
| `JWT_REFRESH_EXPIRES_IN` | — | `7d` | — | — | |
| `API_KEY_PEPPER` | — | ✅ | — | — | **v1.2+** — 32+ char random string. **Never rotate without migration plan** |
| `CONNECTOR_ENCRYPTION_KEYS` | — | ✅ | — | ✅ | **v1.4+** — `kid:hexkey` format. **Must be identical in both API and Workers**. See §12 |
| `IP_HASH_SALT` | — | — | ✅ | — | 32+ char |
| `WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` | — | — | `300` | — | |
| `CRON_SECRET` | — | ✅ | — | ✅ | **v1.4+ on API (for run-now)** — same value in both |
| `WORKERS_URL` | — | ✅ | — | — | **v1.4+** — `https://relayon-workers.vercel.app` |
| `BATCH_SIZE` | — | — | — | `3` | |
| `TIME_BUDGET_MS` | — | — | — | `7000` | |
| `ADAPTER_TIMEOUT_MS` | — | — | — | `6000` | Production value (not 15000) |
| `CORS_ORIGIN` | — | dashboard URL | dashboard URL | — | e.g. `https://relayon.vercel.app` |
| `FULL_CONFIG_ENCRYPTION` | — | optional | — | — | **v1.5+** — `true` / `false` (default). Encrypts **all** non-metadata config fields |
| `SENTRY_DSN` | — | optional | optional | optional | Free tier fine |

### Generate secrets

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run this once per secret that needs a value:
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `API_KEY_PEPPER`
- `CONNECTOR_ENCRYPTION_KEYS` (see format below)
- `IP_HASH_SALT`
- `CRON_SECRET`

### `CONNECTOR_ENCRYPTION_KEYS` format (v1.4+)

Two options. **Pick one.**

**Option A — v1.4+ keyring format (recommended):**
```env
CONNECTOR_ENCRYPTION_KEYS=key-2026-10:<64hex>
```
- Format: `kid:hexkey`, comma-separated for multiple keys
- First key = current encryption key
- All keys = decryption (matched by kid in envelope)
- **Both API and Workers must have the exact same value.**

**Option B — v1.3 legacy format (single key, backward compatible):**
```env
CONNECTOR_ENCRYPTION_KEY=<64hex>
```
- Only one key, no rotation possible
- Still works in v1.5 — the code treats it as a single-entry keyring with kid `v1-legacy`
- **Use this only if you're upgrading from a v1.3 deployment and don't want to change env vars yet.**

**⚠️ Both API and Workers must have the same value.** If they differ, every encrypted credential in the DB becomes undecryptable on delivery (DLQ with "Credential decryption failed"). This is the third most common deployment bug. See §12.

### Common env var mistakes

1. **`NODE_ENV=production`** typed with a leading tab (`\tproduction`) — Vercel dashboard copy-paste. Zod rejects it. **Fix:** delete and retype manually, don't paste.
2. **`CONNECTOR_ENCRYPTION_KEYS` different in API and Workers** — every delivery fails with `Unknown kid`. **Fix:** copy-paste from one project to the other, character-for-character.
3. **`WORKERS_URL` missing on API** — run-now returns `400 "WORKERS_URL and CRON_SECRET must be configured"`. **Fix:** add both to API env, redeploy.
4. **`CORS_ORIGIN` set to wrong domain** — dashboard can't call API. **Fix:** set to exact production dashboard URL, e.g. `https://relayon.vercel.app` (no trailing slash).
5. **`UPSTASH_REDIS_TCP_URL` set to `redis://` instead of `rediss://`** — connection refused. **Fix:** use the TLS URL from Upstash dashboard.
6. **`DATABASE_URL` missing `?sslmode=require`** — connection refused by Neon.

---

## 5. Deploy order (with back-fill loop)

**Not optional.** Follow this order exactly. The reason is that v1.4 added a dependency: **API calls Workers for run-now.** So API needs Workers' URL after Workers is deployed.

### Deploy 1 — API

- Click **Deploy** on `relayon-api` Vercel project
- Wait for green
- Copy the deployed URL, e.g. `https://relayon-api-abc123.vercel.app`
- Verify: `curl https://relayon-api-abc123.vercel.app/api/health` → `{"status":"ok","db":"up"}`

**If API fails to build:**
- Check Build Command includes the `node ./node_modules/prisma/build/index.js generate` prefix
- Check "Include source files outside Root Directory" is enabled
- Check Prisma `binaryTargets` includes `rhel-openssl-3.0.x`

### Deploy 2 — Ingress

- Click **Deploy** on `relayon-ingress`
- Wait for green
- Copy URL, e.g. `https://relayon-ingress-abc123.vercel.app`
- Verify: `curl https://relayon-ingress-abc123.vercel.app/health` → `{"status":"ok"}`

### Deploy 3 — Workers

- Click **Deploy** on `relayon-workers`
- Wait for green
- Copy URL, e.g. `https://relayon-workers-abc123.vercel.app`
- Verify startup log shows **9 adapters** registered:
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
  If less than 9, one adapter class is missing from `EgressModule.providers`.

### Back-fill loop — Set `WORKERS_URL` on API, redeploy API

**This is the v1.4+ step that trips people up.** After Workers is deployed:

1. Go to `relayon-api` → Settings → Environment Variables
2. Add:
   - `WORKERS_URL` = `https://relayon-workers-abc123.vercel.app` (from Deploy 3)
   - `CRON_SECRET` = same value as Workers (already set on API in §4 — verify)
3. Redeploy API (Deployments → latest → ⋯ → Redeploy)

**Why:** The `/api/workflows/:id/schedule/run-now` endpoint proxies to Workers. Without `WORKERS_URL`, it returns `400`.

**Verification:**
```bash
curl -X POST https://relayon-api-abc123.vercel.app/api/workflows/<workflow-id>/schedule/run-now \
  -H "Authorization: Bearer <jwt>"
# Should return {"triggered": true, "correlationId": "..."}
# NOT: {"statusCode": 400, "message": "WORKERS_URL and CRON_SECRET must be configured"}
```

### Deploy 4 — Dashboard

- Update `apps/dashboard/src/environments/environment.prod.ts` with the actual deployed URLs from Deploys 1, 2, 3:
  ```typescript
  export const environment = {
    production: true,
    apiUrl: 'https://relayon-api-abc123.vercel.app',
    ingressUrl: 'https://relayon-ingress-abc123.vercel.app',
    appName: 'Relayon',
    appVersion: '1.5.0',
  };
  ```
- **`npm run build:dashboard` locally first** to catch any typos
- Commit
- Click **Deploy** on `relayon-dashboard`
- Verify: open dashboard URL → login/signup flow renders

### Final — Update CORS, redeploy API + Ingress

1. Go to `relayon-api` env vars → set `CORS_ORIGIN` = actual dashboard URL (e.g. `https://relayon.vercel.app`, no trailing slash)
2. Redeploy API
3. Go to `relayon-ingress` env vars → set `CORS_ORIGIN` = same dashboard URL
4. Redeploy Ingress

**Verify CORS:** Open dashboard in browser, open DevTools → Network → try to sign up. If you see a CORS error, the origin doesn't match.

---

## 6. External cron (3 jobs required)

**Vercel Hobby allows only 1 cron per project, once per day.** Relayon needs 5-minute cadence for processing and delivery, and 5-minute cadence for schedules.

**Therefore external cron is mandatory.** Recommended: **cron-job.org** (free, 1-minute intervals, reliable).

Create **3 jobs**:

| # | Job | Method | URL | Header | Schedule |
|---|---|---|---|---|---|
| 1 | **Process** | POST | `https://relayon-workers-abc123.vercel.app/internal/process` | `X-Cron-Secret: <CRON_SECRET>` | Every 5 min |
| 2 | **Deliver** | POST | `https://relayon-workers-abc123.vercel.app/internal/deliver` | `X-Cron-Secret: <CRON_SECRET>` | Every 5 min |
| 3 | **Schedule Tick** (v1.3+) | POST | `https://relayon-workers-abc123.vercel.app/internal/schedule/tick` | `X-Cron-Secret: <CRON_SECRET>` | Every 5 min |

**Job 3 is v1.3+.** If you're deploying v1.5 and skip this job, scheduled workflows will never fire. `nextRunAt` will advance only when someone calls `/internal/schedule/tick` manually.

**Alternative:** Upstash QStash (1,000 messages/day free, 10 schedules, retries + DLQ, HTTP-based). Better reliability than cron-job.org, still free tier.

**After setting up cron, verify each job:**
- Open cron-job.org → job → check "History"
- Each execution should return HTTP `200`
- The first execution of `/internal/process` may take 10-15 seconds (cold start); subsequent runs are ~200ms

**If cron-job.org silently disables your job:** Their free tier auto-disables after 25 consecutive failures. Check history — 401 means `CRON_SECRET` mismatch, 404 means Workers not deployed.

---

## 7. Smoke test

```bash
CRON_SECRET=<workers-secret> npm run smoke
```

**Expected output:**
```
🔎 Relayon smoke test
   API:     https://relayon-api-abc123.vercel.app
   Ingress: https://relayon-ingress-abc123.vercel.app
   Workers: https://relayon-workers-abc123.vercel.app

✅ API health
✅ Ingress health
✅ Workers health
✅ Signup
✅ Create workflow
✅ Create destination
✅ Send webhook
✅ Process batch
✅ Deliver batch
✅ Event visible in API

🟢 SMOKE PASS — 10/10 checks passed
```

**What it does NOT verify (v1.5 gaps — documented in `docs/TESTING.md`):**
- Scheduled workflows
- Versioning / diff
- Encryption round-trip
- Key rotation
- API key verify / rotate
- Dry-run / validation
- Non-HTTP adapters (Discord, Airtable, Notion, Sheets, Email, PG, Mongo)

**For those, follow the manual checklists in `docs/TESTING.md`.**

---

## 8. CI

**`.github/workflows/ci.yml`** runs on every push to `main` and every PR:

```yaml
- Checkout
- Setup Node 22
- npm ci
- npm run db:generate
- npm run typecheck
- npm run build:dashboard
- npm run build:api
- npm run build:ingress
- npm run build:workers
```

**Duration:** ~60 seconds cold cache.

**What it catches:**
- TypeScript errors
- Build failures
- Missing dependencies
- Prisma schema syntax errors

**What it doesn't catch:**
- Runtime errors (no live server in CI)
- Database issues (no Postgres in CI)
- Integration problems

**Smoke test is not in CI** (would hit production on every push). Run manually after deploying.

**`.github/workflows/keep-alive.yml`** pings production health every 12 hours. Prevents MongoDB Atlas M0 from pausing after 60 days of inactivity.

---

## 9. Rollback

**Vercel rollback (per project):**
1. Vercel → Project → Deployments
2. Find the last good deployment
3. Click **⋯ → Promote to Production**

**Database rollback:** Not automated. If a migration broke the schema, restore from backup:
```bash
pg_restore --dbname="$DATABASE_URL" relayon-pre-deploy-YYYYMMDD.dump
```
Always `pg_dump` before applying a migration on production.

**Env var rollback:** Vercel stores env var history. Settings → Environment Variables → click variable → view history. But you still need to redeploy for changes to take effect.

---

## 10. Limits & upgrade path

**Vercel Hobby**
- Non-commercial use only
- 100 GB bandwidth/month
- 100 GB-hours compute
- 1 concurrent build (4 projects deploy sequentially — ~4-6 min total)
- 1 cron per project, once per day
- **Commercial use → upgrade to Pro ($20/mo)**

**Neon Free**
- 0.5 GB storage
- 191 compute hours/month
- Auto-suspends after 7 days of inactivity
- **Upgrade to Pro ($19/mo): 10 GB storage, always-on, 7-day PITR**

**MongoDB Atlas M0**
- 512 MB storage
- 30-day TTL cleanup on events/deliveries
- 60-day idle pause (mitigated by keep-alive workflow)
- **Upgrade to M2 ($9/mo): 2 GB storage, backup**

**Upstash Redis Free**
- 10,000 commands/day
- 256 MB
- **v1.3+ uses more commands** — scheduled workflows add one LPUSH per due schedule per tick, plus additional LLEN/GET for schedule status. v1.5 estimated ~2,000 events/day on free tier (was ~3,000 on v1.0)
- **Upgrade to Pro ($5/mo) at ~2K events/day**

**Groq Free**
- 14,400 requests/day
- Rate limits during peak hours
- **Upgrade to paid at ~10K enrichments/day**

**Monthly cost summary:**

| Scenario | Services | Total |
|---|---|---|
| **Free (evaluation, <2K events/day)** | All free tiers | **$0** |
| **Small production (~5K events/day)** | Vercel Pro + Upstash Pro | ~$25/mo |
| **Serious production (~50K events/day)** | + Neon Pro + Mongo M2 + Groq paid | ~$60-80/mo |
| **Enterprise (compliance required)** | Vercel Enterprise + SOC 2 audit + pentest | ~$15K-30K setup + ongoing |

---

## 11. Post-deploy checklist

Print this. Check every box. **Any unchecked box = broken production feature.**

### Infrastructure
- [ ] All 4 Vercel projects green
- [ ] API health: `curl https://relayon-api.vercel.app/api/health` → `{"status":"ok","db":"up"}`
- [ ] Ingress health: `curl https://relayon-ingress.vercel.app/health` → `{"status":"ok"}`
- [ ] Workers health: `curl https://relayon-workers.vercel.app/internal/health -H "X-Cron-Secret: ..."` → `{"status":"ok"}`
- [ ] Workers startup log shows **9 adapters registered**
- [ ] 3 cron-job.org jobs are all returning 200 in history

### v1.0 core features
- [ ] Dashboard signup + login works
- [ ] Create workflow (with signing secret)
- [ ] Create HTTP destination
- [ ] Send webhook → 202 → event appears in Events page
- [ ] `/internal/process` + `/internal/deliver` cron → delivery marked `delivered`
- [ ] Analytics page shows event + success rate
- [ ] DLQ: force a failure → entry appears → replay works
- [ ] `npm run smoke` → 🟢 SMOKE PASS

### v1.1 features
- [ ] Bulk DLQ replay: select 3 → "Replay selected" → 3 replayed
- [ ] Workflow YAML export downloads, secrets are `${...}` placeholders
- [ ] Workflow YAML import creates new workflow
- [ ] Cost analytics card visible on `/analytics` with non-zero values
- [ ] Conditional routing rule (`when` + `destinationIds`) routes events correctly

### v1.2 features
- [ ] Analytics time-series chart renders with hover tooltip
- [ ] Range selector (24h / 7d / 30d) updates chart
- [ ] API key create → raw key shown once → DB has only hash
- [ ] API key use: `curl -H "X-API-Key: rlk_live_..." /api/workflows` works
- [ ] API key missing scope → 403
- [ ] API key revoke → 401 immediately
- [ ] Bulk DLQ discard removes entries
- [ ] Transform preview shows valid JSONata result / invalid compile error

### v1.3 features
- [ ] **Encryption at rest**: create a Slack destination → Prisma Studio → `destinations.config` shows `enc:v2:...` (not plaintext)
- [ ] **API redaction**: `GET /api/workflows/:id/destinations` returns `{"webhookUrl": "••••••••"}` (not ciphertext, not plaintext)
- [ ] **Encrypted delivery works**: real Slack webhook delivers successfully
- [ ] **Versioning**: create workflow → rename → edit → `GET /versions` shows v1, v2, v3
- [ ] **Version restore**: restore v1 → new v4 created, destinations recreated
- [ ] **Schedule create**: dashboard → schedule card → `*/15 * * * *` → Save → `nextRunAt` shows ~15 min future
- [ ] **Schedule tick**: after cron runs, check `next_run_at` in Prisma Studio advanced

### v1.4 features
- [ ] **v1 to v2 migration**: existing `enc:v1:` data still decrypts after deploy (create a new destination in v1.5, check envelope shows `enc:v2:`)
- [ ] **`CONNECTOR_ENCRYPTION_KEYS` plural format**: env vars show `key-2026-10:<hex>` not a single hex
- [ ] **PG adapter**: create Postgres destination → send webhook → row inserted in target table
- [ ] **Mongo adapter**: create Mongo destination → send webhook → doc inserted with `_relayon` metadata
- [ ] **Run-now works**: schedule card → "Run now" → `{"triggered": true, "correlationId": "..."}` (requires `WORKERS_URL` on API)
- [ ] **Run-now preserves nextRunAt**: check schedule `next_run_at` unchanged after run-now

### v1.5 features
- [ ] **Destination validate**: "Test connection" on HTTP → green with real latency (not 0ms for httpbin)
- [ ] **Dry-run Slack does NOT send a message**: click Test connection on Slack destination → verify no message appears in the Slack channel
- [ ] **Dry-run failing case**: HTTP destination pointed at `https://httpbin.org/status/500` → shows `✗ Validation failed`
- [ ] **Version diff**: two versions selected → "Compute diff" → colored output with `+`/`-`/`@@`
- [ ] **API key rotate**: Settings → API Keys → Rotate → new raw key shown → old key expires at +24h
- [ ] **Bulk schedule pause**: `POST /api/schedules/bulk/pause-all` → all schedules `is_active: false`
- [ ] **Bulk schedule resume**: recomputes `next_run_at` in the future (not past)
- [ ] **Full config encryption (optional)**: `FULL_CONFIG_ENCRYPTION=true` → re-save a destination → all non-metadata fields show `enc:v2:`

### Observability
- [ ] Sentry (if configured) shows the smoke test's user signup — no errors
- [ ] Vercel Function logs show 200s for API / Ingress / Workers health pings
- [ ] keep-alive workflow runs every 12h without failures

---

## 12. Deploy-delta reference (v1.0 → v1.5)

For anyone upgrading an existing v1.0 deployment or debugging a v1.5 deploy. **This is the list of things that changed between versions at the deployment level.**

| Item | v1.0 | v1.5 | Impact |
|---|---|---|---|
| **Migrations** | 1 (`init`) | 4 | Must apply all 3 new ones before API starts |
| **Prisma binaryTargets** | `native` | `native` + `rhel-openssl-3.0.x` | Missing this = `Query engine library not found` on Vercel |
| **Prisma build command** | `postinstall` or `npx` | Absolute path `node ./node_modules/prisma/build/index.js` | `npx` fetches prisma@8 which removed generate |
| **`API_KEY_PEPPER`** | n/a | **Required** (API only) | Missing = API key creation fails |
| **`CONNECTOR_ENCRYPTION_KEYS`** | n/a | **Required** (API + Workers, identical) | Missing = encryption fails, delivery DLQs with "credential_decryption_error" |
| **`WORKERS_URL`** | n/a | **Required** (API) | Missing = run-now returns 400 |
| **`CRON_SECRET`** | Workers only | Workers **+ API** | Same value on both |
| **`FULL_CONFIG_ENCRYPTION`** | n/a | Optional (API) | Default `false` — use only for strict compliance |
| **Cron jobs** | 2 (`process`, `deliver`) | **3** (add `/internal/schedule/tick`) | Missing job 3 = schedules never fire |
| **Adapters** | 4 | **9** | 5 new: Discord, Airtable, Notion, Postgres, MongoDB |
| **Redis command usage** | ~3K events/day free limit | ~2K events/day free limit | v1.3+ schedules + versioning add commands |
| **Dashboard env URLs** | `apiUrl`, `ingressUrl` | + `appVersion: '1.5.0'` | Cosmetic |
| **Express default export** | Yes (v1.0 fix) | Yes (still) | Don't add `app.listen()` at module top level |
| **`environment.prod.ts` fileReplacements** | Optional | **Required** | Without it, dashboard calls `localhost` in production |

**Common failure signatures and their fixes:**

| Error message | Root cause | Fix |
|---|---|---|
| `PrismaClientInitializationError: Query engine library not found` | `binaryTargets` missing `rhel-openssl-3.0.x` | Add to `schema.prisma`, run `db:generate`, commit, redeploy |
| `CLI.UNKNOWN_COMMAND: No command registered for 'generate'` | `npx prisma generate` fetched `prisma@8` | Use absolute path build command (see §3) |
| `Cannot find module '@prisma/client'` | "Include source files outside Root Directory" disabled | Enable in Settings → Build & Development |
| `No exports found in module main.js` | `app.listen()` called at module top level | Export default handler; only listen when `!process.env.VERCEL` |
| `{"statusCode":401,"message":"Invalid or expired token"}` on validate | Fake/masked token in curl | Get real JWT (see `docs/TROUBLESHOOTING.md`) |
| `Cannot PUT /api/workflows/:id/schedule` (404) | `SchedulesModule` not in `app.module.ts` | Import module (see §12 v1.4 fix) |
| `WORKERS_URL and CRON_SECRET must be configured` | Missing env vars on API | Add both, redeploy API (§5 back-fill loop) |
| Delivery DLQ with `Unknown kid "..."` | Old key removed from keyring before rotation | Re-add key, run rotation script, then remove (§12) |
| `Unsupported state or unable to authenticate data` | API and Workers have different encryption keys | Copy `CONNECTOR_ENCRYPTION_KEYS` from one to the other, redeploy both |

---

## Need help?

See `docs/TROUBLESHOOTING.md` for 40+ issues with symptoms, causes, and verified fixes. See `docs/TESTING.md` for feature-specific manual verification checklists. See `docs/SECURITY.md` for the encryption and API key threat model.

If you're stuck on deployment specifically, open an issue at [github.com/zainshah3464/relayon/issues](https://github.com/zainshah3464/relayon/issues) with:
- Which Vercel project failed
- The exact error message from the build log
- Output of `npm run typecheck` and `npm run build:api` (or whichever app)
- Your environment (Windows / Mac / Linux)
```

---