
# Changelog

All notable changes to Relayon are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] — v2.0

### Planned

**Testing (top priority — 5 versions shipped with 0 unit tests):**
- Vitest infrastructure + CI integration
- Unit tests for crypto-box (round-trip, tenant separation, kid lookup, v1 fallback)
- Unit tests for API keys (verify, rotate, scope enforcement, timing-safe compare)
- Unit tests for versioning (capture, cap, restore, diff edge cases)
- Unit tests for scheduling (parser validation, atomic claim)
- Unit tests for all 9 adapters (mocked HTTP, request shape, error classification)
- Smoke test extension — version snapshot, API key verify, dry-run validation checks

**Security & compliance:**
- Persistent audit log table in PostgreSQL + dashboard UI
- MFA/TOTP for dashboard login
- Session management UI (view + revoke active sessions)
- `API_KEY_PEPPER` rotation automation (breaking change requires migration path)
- SOC 2 Type I readiness audit

**Platform:**
- Per-destination test endpoint (`POST /destinations/:id/test`)
- Bulk schedule delete-all operation
- `destinationSummary` in dashboard — handle `enc:v2:` prefix (currently shows "Slack/Discord webhook" for v2 envelopes)
- Multi-region deployment (currently `iad1` only)
- Self-hosted Docker option
- i18n support (English + Urdu + Hindi)

---

## [1.5.0] — 2026-10-26

**Validation, full encryption, diff, key rotation, bulk ops.** The "auditable platform" release — every config can be tested before save, every change is diffable, keys rotate without downtime.

### Added

- **Destination validation endpoint** — `POST /api/destinations/validate` with two-layer check:
  - Schema validation (required fields, shape regex, URL format)
  - Optional real dry-run via workers `/internal/egress/dry-run`
  - Per-field error reporting with `{ field, message }` shape
  - Graceful fallback — if workers unreachable, returns `layer: 'schema'` with warning
- **`__dryRun` honor in all 9 adapters** — critical safety: validation **never writes** to the destination
  - HTTP/Slack/Discord: HEAD request (no body, no message)
  - Email: `GET /api-keys` (Resend auth check, no email)
  - Sheets: `GET spreadsheet metadata` (no row append)
  - Airtable: `GET /meta/bases/:id/tables` (no record)
  - Notion: `GET /v1/data_sources/:id` (no page)
  - PostgreSQL: `SELECT 1` (no INSERT)
  - MongoDB: `ping` (no insert)
  - Slack/Discord webhooks cannot be probed without sending — return "config valid, cannot be tested without sending" (safest possible)
- **`encryptConfigAll()` helper** — full-tree encryption with `METADATA_CONFIG_KEYS` whitelist
  - Encrypts every string value except metadata (url, method, table, baseId, etc.)
  - Toggled via `FULL_CONFIG_ENCRYPTION=true` env var on API
  - Default: `false` (only `SECRET_CONFIG_KEYS` encrypted — same as v1.3+)
  - Drop-in — decryptConfig works unchanged, no migration when toggling
- **Version diff endpoint** — `GET /api/workflows/:id/versions/:a/diff/:b`
  - Unified line-level patch via `diff@7` package
  - Returns `{ fromVersion, toVersion, identical, stats: { added, removed }, unified }`
  - Dashboard renders color-coded (green `+`, red `-`, cyan `@@`)
- **API key rotation** — `POST /api/api-keys/:id/rotate`
  - Creates new key with same scopes/environment
  - Caps old key's `expiresAt` at `now + 24h` (grace window)
  - Both keys work during grace; old returns `401` after
  - Lineage tracked via `rotatedFromId` field
- **Bulk schedule operations**
  - `POST /api/schedules/bulk/pause-all` — sets `isActive: false` on all tenant schedules
  - `POST /api/schedules/bulk/resume-all` — recomputes `nextRunAt` (prevents immediate-fire storm on resume)

### Fixed (During Development)

- **`diff@7` ESM import failure** — `diff@7` is ESM-first; NestJS CommonJS build rejects `import { createTwoFilesPatch } from 'diff'`. **Fix:** `const { createTwoFilesPatch } = require('diff') as {...}` with type assertion.
- **`pg-format` types missing** — no `@types/pg-format` package exists on npm. **Fix:** Added `declare module 'pg-format'` in `apps/workers/src/types.d.ts`.
- **`__dryRun` gap in initial plan** — the original v1.5 plan only honored `__dryRun` in the HTTP adapter. This would have caused:
  - Testing a Slack destination → real message sent to channel
  - Testing an Email destination → real email sent
  - Testing a MongoDB destination → real document inserted
  **Fix:** Added `__dryRun` check to all 9 adapters with distinct safe probes per type. **This was the single most important v1.5 safety decision.**
- **Schedules bulk routes conflict** — `@Controller('workflows/:workflowId/schedule')` conflicts with `bulk/pause-all` (routed as `:workflowId='bulk'`). **Fix:** Separate `SchedulesBulkController` on `@Controller('schedules')` root.
- **API app.module.ts needed SchedulesBulkController registration** — after creating the bulk controller, forgot to register it in `SchedulesModule`. **Fix:** Added to `controllers` array.
- **Workers dry-run endpoint route prefix** — `EgressController` is on `@Controller()` root (no prefix), so endpoint is `POST /internal/egress/dry-run` (not `/internal/egress/egress/dry-run`). Verified against route map.

### Known Limitations

- **Dry-run does not test actual delivery payload** — it verifies config validity, not "a real delivery would succeed." A Slack webhook pointing to a misconfigured channel still shows green.
- **Slack/Discord cannot be dry-run tested** — API design limitation; no safe probe exists without sending a message.
- **`FULL_CONFIG_ENCRYPTION` is API-only toggle** — Workers doesn't need to know (it decrypts whatever's there), but there's no UI to flip it per-tenant. Global env var only.
- **`API_KEY_PEPPER` rotation is a breaking change** — rotating it invalidates all issued keys. No migration path yet — planned for v2.0.
- **Version diff is line-based, not semantic** — a whitespace change in a config object shows as a diff even if functionally equivalent.
- **0ms latency readings on dry-run** — some HTTP destinations return sub-1ms (cached DNS, immediate HEAD rejection). Real delivery latency will differ. Not a bug, but notable.

### Performance

- **Validation endpoint** — ~200-500ms for real dry-run (network bound); ~5ms for schema-only
- **Version diff** — ~10-50ms for typical 2KB snapshots
- **API key rotate** — ~15ms (single DB transaction)

### Deployment

- **No new migrations** — `encryptConfigAll`, `validate`, `diff`, `rotate`, `bulk ops` are all code-only
- **No new env vars required** — `FULL_CONFIG_ENCRYPTION` is optional (default `false`), `WORKERS_URL` + `CRON_SECRET` already set in v1.4

---

## [1.4.0] — 2026-10-25

**Database adapters, key rotation, run-now.** The "enterprise delivery" release — 9 adapters total, zero-downtime credential rotation, manual schedule trigger.

### Added

- **PostgreSQL destination adapter** — `pg` + `pg-format` for SQL-safe dynamic identifiers
  - Connection pooling per destination (max 3 connections)
  - Column mapping via dot-path (`"data.amount": "amount_cents"`)
  - Upsert support via `onConflict` (single column, regex-validated)
  - Fallback: single `payload` JSONB column if no columns mapped
  - Retryable classification: `ECONNRESET`, `ETIMEDOUT`, serialization failures, deadlocks, `too_many_connections`
- **MongoDB destination adapter** — native `mongodb` driver
  - Client cache per destination, idle-swept after 60s
  - `_relayon` metadata enrichment on every document (`eventId`, `correlationId`, `destinationId`, `attemptNumber`, `deliveredAt`)
  - Upsert key support via `upsertKey` (comma-separated dot-paths)
  - `serverSelectionTimeoutMS` 5s, `maxPoolSize` 3
- **Versioned key rotation** — `enc:v2:<kid>:<iv>:<tag>:<ct>` envelope format
  - `CONNECTOR_ENCRYPTION_KEYS=kid1:hexkey1,kid2:hexkey2` multi-key keyring
  - First key = current encryption; all keys = decryption
  - `enc:v1:` (v1.3 legacy) backward compat — brute-force try each key in reverse
  - **v1.3 → v1.4 migration path:** if only `CONNECTOR_ENCRYPTION_KEY` (singular) is set, treated as single-entry keyring with kid `v1-legacy` — zero env change required
  - Rotation script `scripts/rotate-encryption-key.mjs` — idempotent, re-encrypts all workflows + destinations with current key
- **Schedule run-now** — `POST /api/workflows/:id/schedule/run-now`
  - Forwards to Workers `POST /internal/schedule/run-now`
  - Enqueues synthetic event with `rawPayload.type = 'relayon.schedule.manual'`
  - `nextRunAt` untouched — cron stays scheduled
  - `lastRunAt` updated to now
- **Version Compare UI** — side-by-side snapshot view in version drawer (superseded by v1.5 diff view)

### Fixed (During Development)

- **`CONNECTOR_ENCRYPTION_KEY` (v1.3) → `_KEYS` (v1.4) migration** — strict requirement of plural key would break local dev and prod for existing encrypted data. **Fix:** Backward compat in `loadKeyring()` — if `_KEYS` missing but `_KEY` present, treat as single-entry keyring with kid `v1-legacy`.
- **Postgres adapter dead code from plan** — initial plan had an unused `const sql = format('INSERT INTO %I (%I) VALUES (%L)', table, colNames, values.map((_, i) => \`$${i + 1}\`))` block that would have built a malformed query with `'$1'` string literals wrapped by `%L`. **Fix:** Removed the dead code — only `finalSql` (built with `%I` for identifiers + `$N` for parameterized values) is used.
- **`SchedulesModule` not imported in API `app.module.ts`** — v1.3 shipped `SchedulesController` but the module was never wired into the root. Every `PUT /api/workflows/:id/schedule` returned 404. **Caught during v1.4 verification.** **Fix:** Added `SchedulesModule` to `AppModule.imports` array. This was the classic NestJS "module wiring isn't typechecked" gotcha — TypeScript build passed, routes just never registered at runtime.
- **`destinationSummary` doesn't recognize `enc:v2:` prefix** — dashboard function checks `.startsWith('enc:v1:')` and shows "Slack/Discord webhook" for v2 envelopes. **Not fixed in v1.4** — accepted as cosmetic. Planned for v2.0.
- **`WORKERS_URL` + `CRON_SECRET` missing on API** — run-now requires both env vars. **Fix:** Added to `DEPLOYMENT.md` env matrix; run-now throws `BadRequestException` with clear message if either is missing.

### Known Limitations

- **Rotation requires both keys in env during grace window** — remove old key too early and existing `enc:v2:old-key:...` envelopes become undecryptable with `Unknown kid` DLQ entries.
- **No automatic key expiry** — rotation is manual (edit env, redeploy, run script, remove old key). No cron-based auto-rotation.
- **Postgres/MongoDB connection strings cannot be probed without credentials** — validation via `/api/destinations/validate` wasn't added until v1.5. In v1.4, you find out if a connection string is wrong when the first delivery fails.
- **Compare UI is side-by-side, not diff-based** — no line-level highlighting until v1.5.

### Performance

- **PG adapter** — ~50-200ms per insert (network bound); connection reuse saves ~30ms on subsequent inserts
- **MongoDB adapter** — ~30-100ms per insert; client cache saves ~200ms cold-start on subsequent inserts
- **Run-now** — ~200ms round-trip API → Workers → Redis LPUSH

### Deployment

- **No migration** — v1.4 is data-layer only. `enc:v1:` data stays readable, new data uses `enc:v2:`.
- **New env var:** `CONNECTOR_ENCRYPTION_KEYS` (plural) — replaces v1.3's `CONNECTOR_ENCRYPTION_KEY` (singular). Both must be present in **both** API and Workers.
- **API-only env vars:** `WORKERS_URL` and `CRON_SECRET` (for run-now endpoint).

---

## [1.3.0] — 2026-10-24

**Scheduled workflows, versioning, credential encryption, new adapters.** The "time-driven + auditable" release — the platform can now be triggered by cron, every config change is versioned, and credentials are encrypted at rest.

### Added

- **Scheduled workflows** — DB-backed cron, serverless-safe
  - `workflow_schedules` table with `cronExpression`, `timezone`, `payloadTemplate`, `isActive`, `lastRunAt`, `nextRunAt`
  - `POST /internal/schedule/tick` — called by external cron every 5 min
  - Atomic claim via `updateMany` with `nextRunAt <= now` predicate — no duplicate enqueue under concurrent ticks
  - `cron-parser@4.9.0` pinned (v5 broke API with `CronExpressionParser.parse`)
  - `UpsertScheduleDto` regex: digits + `*`,`,`,`-`,`/`, space only — blocks named days/months to reduce parser attack surface
  - Invalid cron at save: `400 Bad Request`. Invalid cron at tick: schedule deactivated + logged (never crashes loop)
- **Workflow versioning** — immutable snapshots on every mutation
  - `workflow_versions` table, 50-version cap per workflow
  - Captured on `create`, `update`, `importYaml`, `restore`
  - `GET /versions`, `GET /versions/:v`, `POST /versions/:v/restore`
  - Restore recreates destinations (UUIDs not stable), captures new version — history stays linear
- **Credential encryption at rest** — AES-256-GCM with HKDF per-tenant keys
  - `crypto-box.ts` in both API and Workers (identical content)
  - `enc:v1:<iv>:<tag>:<ct>` envelope format
  - `SECRET_CONFIG_KEYS` field list — only secret fields encrypted, metadata stays plaintext for UI
  - `redactConfig()` — client receives `••••••••` for secrets, never ciphertext
  - `decryptConfig()` on delivery — failure moves delivery to DLQ with `credential_decryption_error`
- **Airtable adapter** — `api.airtable.com/v0/{baseId}/{tableName}`, `typecast` optional
- **Notion adapter** — `api.notion.com/v1/pages` with `data_source_id` parent, `Notion-Version: 2026-03-11`
- **Schedule card + Version drawer in dashboard** — `WorkflowScheduleCardComponent`, `WorkflowVersionsDrawerComponent`

### Fixed (During Development)

- **`workflow-detail.component.ts` was never updated in v1.2** — the new `WorkflowScheduleCardComponent` and `WorkflowVersionsDrawerComponent` files existed on disk but were never imported in `workflow-detail.component.ts`. Angular rendered nothing for them. Version history button missing, scheduled trigger card missing, Airtable/Notion not in dropdown. **Caught because the last v1.2 commit only pushed `package.json` — the actual component file was never committed.** **Fix:** Full replace of `workflow-detail.component.ts` with imports + template wiring + Airtable/Notion form fields.
- **Encryption scope confusion** — initial test tried `Authorization: Bearer secret-token-123` as an HTTP destination header but the encryption only applies to keys in `SECRET_CONFIG_KEYS` (`url`, `method`, `headers` are NOT in the list for HTTP — by design, HTTP URLs aren't secrets). **Fix:** Documented the scope clearly in `SECURITY.md` — only specific config fields are encrypted, non-secret fields stay plaintext so dashboard can render summaries without decrypting.
- **Prisma EPERM lock from v1.0** — re-encountered when regenerating after adding `WorkflowSchedule` + `WorkflowVersion` models. **Fix:** Kill all node processes first (same as v1.0 fix).
- **`cron-parser@5` API break** — pinned to `4.9.0` in both API and Workers workspaces.

### Known Limitations

- **`enc:v1:` has no key ID** — no key rotation possible without cracking every envelope. **Fixed in v1.4** with `enc:v2:<kid>` format.
- **Encryption covers only `SECRET_CONFIG_KEYS`** — non-secret fields stay plaintext. Full-config encryption added in v1.5 via `FULL_CONFIG_ENCRYPTION=true`.
- **No version diff yet** — restore overwrites, but you can't see what changed between two versions. **Fixed in v1.5.**
- **No manual schedule trigger** — cron tick waits for `nextRunAt`. **Fixed in v1.4** with run-now button.
- **`destinationSummary` assumes `enc:v1:` prefix** — future v2 envelopes will show wrong text. **Not fixed until v2.0.**

### Deployment

- **Migration:** `v13_schedules_and_versions` — adds `workflow_schedules` + `workflow_versions` tables
- **New env vars:** `CONNECTOR_ENCRYPTION_KEY` (64 hex) — **must be identical in API and Workers**
- **Third external cron job:** `POST /internal/schedule/tick` every 5 min (in addition to existing `/internal/process` and `/internal/deliver`)

---

## [1.2.0] — 2026-10-23

**Extensibility, observability, security.** The "platform" release — adapter SDK, raw SVG charts, scoped API keys.

### Added

- **Custom Destination SDK** — `@DestinationAdapter({ type, displayName, configSchema })` decorator
  - `AdapterRegistry` uses NestJS `DiscoveryService` + `Reflector` for auto-discovery at bootstrap
  - Adding a new adapter = 1 new file + 1 line in `EgressModule.providers` — zero registry edits
  - Duplicate type detection with warning log
- **Time-series charts** — raw SVG, **zero dependencies** (no Chart.js, no D3)
  - `app-time-series-chart` component with signal inputs
  - Backend uses MongoDB `$dateTrunc` aggregation for hourly/daily bucketing
  - Hover tooltip, Y-axis grid, X-axis labels, range selector (24h / 7d / 30d)
  - Empty buckets filled with zeros for continuous series
- **API keys management**
  - `rlk_<live|test>_<8-hex-prefix>_<48-hex-secret>` format (Stripe-style)
  - `api_keys` table with `prefix` (unique, indexed), `key_hash` (SHA-256 + pepper), `scopes[]`, `environment`, `expiresAt`, `revokedAt`, `lastUsedAt`
  - Show-once UX — raw key returned only in create response
  - `JwtOrApiKeyGuard` — hybrid guard accepts JWT or `X-API-Key` header
  - `@RequireScopes()` decorator for scope enforcement
  - Timing-safe verification via `crypto.timingSafeEqual`
  - 8 scopes: `events:read`, `workflows:read`, `workflows:write`, `destinations:read`, `destinations:write`, `dlq:read`, `dlq:write`, `analytics:read`
- **Bulk DLQ discard** — `POST /api/dlq/bulk-discard` (mirror of `bulk-replay`, atomic `deleteMany`)
- **Transform preview** — `POST /api/workflows/:id/preview-transform` (JSONata compile + eval with 2s timeout)
- **Discord adapter** — reference implementation of the SDK
- **Settings API Keys tab** — create, list, revoke keys in dashboard

### Fixed (During Development)

- **`@types/jsonata` does not exist on npm** — attempted install failed with `ETARGET`. **Fix:** Removed — jsonata ships its own types.
- **`jsonata` package missing in API workspace** — `preview-transform` endpoint needed it. **Fix:** `npm install jsonata --workspace=api`.
- **Chart axis labels rendered as `Invalid Date`** — MongoDB `$dateTrunc` returns `Date` objects, but the pipeline was passing ISO strings to the frontend which Angular's `| date` pipe couldn't parse. **Fix:** Backend converts to ISO strings before response; frontend `new Date(p.ts)` for axis computation.
- **`api_keys.prefix` collision possible** — 8 hex = 4 bytes = 32 bits, ~4 billion combinations. Extremely rare but theoretically possible under high volume. **Not fixed** — no retry logic. If it ever collides, the DB unique constraint on `prefix` will reject the insert with `409`. Accepted as-is.

### Known Limitations

- **Time-series bucketing is fixed to hour (24h) or day (7d/30d)** — no custom bucketing window.
- **Charts have no legend for empty series** — a series with 0 points shows a flat line at y=0. Cosmetic.
- **API keys cannot create other API keys** — only JWT sessions can. By design.
- **API key rotation not implemented yet** — you have to revoke and create a new one manually. **Fixed in v1.5.**
- **`API_KEY_PEPPER` change invalidates all issued keys** — no migration path. Documented as hard limitation.

### Deployment

- **Migration:** `api_keys_scopes` — rebuilds `api_keys` table (adds `prefix`, `scopes[]`, `environment`, `revoked_at`; renames `key` → `key_hash`)
- **New env var:** `API_KEY_PEPPER` (32+ char random string) — **must be stable forever**

---

## [1.1.0] — 2026-10-23

**Reliability & operator experience.** The "production-ops" release — bulk DLQ, workflow portability, cost visibility, conditional routing.

### Added

- **Bulk DLQ replay** — `POST /api/dlq/bulk-replay` with `{ ids: string[] }` (max 100)
  - Atomic `updateMany` scoped to `tenantId + status='dlq'`
  - Per-ID success/failure feedback in response
  - Duplicate ID deduplication
  - Dashboard checkbox UI + "Replay selected" button
- **Workflow YAML export/import**
  - `GET /api/workflows/:id/export` — `application/x-yaml`, `Content-Disposition: attachment`
  - Secrets redacted to `${VAR}` placeholders — safe for Git versioning
  - `POST /api/workflows/import` — rejects unresolved placeholders with clear error
  - `apiVersion: relayon/v1` + `kind: Workflow` — same shape as K8s manifests
- **Cost analytics** — `GET /api/analytics/cost`
  - 30-day window aggregation
  - Per-destination: total attempts, retries, retry rate, delivered, DLQ, estimated Redis cost
  - Groq cost estimated from payload size (1 token ≈ 4 bytes)
  - Notes array documents assumptions
- **Conditional routing** — `routingRules` JSONB column on `workflows`
  - Array of `{ when: string, destinationIds: string[] }` where `when` is a JSONata boolean expression
  - Empty array = route to all destinations
  - First matching rule wins
  - `RoutingService.decide()` — clean separation, testable
  - No rule matched → event marked processed but no deliveries (per design)

### Fixed (During Development)

- **`jsonata` missing from API workspace** — routing rules needed it. **Fix:** `npm install jsonata --workspace=api`.
- **`routingRules` was missing from `Workflow` Prisma model** — initial plan assumed it existed. **Fix:** Added `routingRules Json @default("[]")` + `add_routing_rules` migration.
- **Bulk replay returned `_id` as string vs ObjectId mismatch** — MongoDB queries with string `_id` auto-cast to ObjectId, but the `validIds` set used string comparison. **Fix:** Consistent `String(d._id)` conversion before comparison.
- **YAML export included raw secrets** — initial implementation didn't redact `secret`, `apiKey`, `privateKey`, `webhookUrl`. **Fix:** Added `SECRET_KEYS` set + `redactConfig()` walk.
- **`routingRules` empty array caused events to route to zero destinations** — `parseRules()` returned `[]` for empty array, which the routing service interpreted as "no rule matched." **Fix:** Explicit early return when `rules.length === 0` → route to all destinations.

### Known Limitations

- **No rule builder UI** — `routingRules` must be set via API or Prisma Studio. UI planned for v2.0.
- **JSONata expressions not validated at save time** — a bad expression fails silently during processing (rule skipped). **Mitigated** by logging each rule error, but not user-facing.
- **Cost analytics are estimates** — not invoiced amounts. Actual Groq/Redis bills may differ.
- **No bulk DLQ discard yet** — only replay. **Fixed in v1.2.**
- **No workflow YAML import UI** — API only in v1.1. **Fixed in v1.2 frontend.**

### Deployment

- **Migration:** `add_routing_rules` — adds `workflows.routing_rules` JSONB column, default `[]`
- **New dependency:** `js-yaml` + `@types/js-yaml` in API workspace

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
- **No unit tests** — smoke test is the primary coverage. *(Still true in v1.5 — 5 versions shipped without adding any.)*
- **Encryption at rest** for `sourceConfig` and `destination.config` not implemented (plaintext in PostgreSQL). *(Fixed in v1.3 — AES-256-GCM + HKDF per-tenant keys.)*
- **No MFA/TOTP** for dashboard login. *(Still true in v1.5.)*
- **Single-region deployment** — all services in `iad1` (US East). *(Still true in v1.5.)*

---

## Commit History

**v1.0.0** was built across 15 commits:

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

**v1.1-v1.5** each shipped with a single squashed commit per version plus follow-up fixes. Key highlighted commits:

| Version | Commit | Description |
|---|---|---|
| v1.1 | `feat(v1.1): bulk DLQ, YAML export/import, cost analytics, conditional routing` | Reliability & operator release |
| v1.2 | `feat(v1.2): adapter SDK, time-series charts, API keys, bulk DLQ discard, transform preview` | Platform release |
| v1.3 | `feat(v1.3): scheduled workflows, versioning, credential encryption, Airtable+Notion adapters` | Time-driven + auditable release |
| v1.3 | `feat(v1.3): wire schedule card, version drawer, airtable/notion into workflow detail UI` | The missing UI wiring (found via screenshot) |
| v1.4 | `feat(v1.4): postgres+mongodb adapters, key ring rotation, schedule run-now` | Enterprise delivery release |
| v1.4 | `fix(v1.4): import SchedulesModule in app.module.ts` | The 404-causing omission |
| v1.5 | `feat(v1.5): destination validation + dry-run, version diff, api key rotation, bulk schedules, full encryption helper` | Auditable platform release |

---

## Versioning Policy

- **MAJOR** (`2.0.0`) — Breaking changes to public API or data schema
- **MINOR** (`1.1.0`) — New features, backward compatible
- **PATCH** (`1.0.1`) — Bug fixes, security patches

Security fixes are **backported to the last two minor versions** whenever feasible.

**Note on v1.4 encryption format change:** `enc:v1` → `enc:v2` was shipped in a MINOR version because:
- v1.3 data stays decryptable (backward compat preserved)
- No API surface change
- No forced migration (rotation is opt-in via script)

This is the "additive change" pattern — new format is added, old format is preserved, migration is opt-in. By contrast, a MAJOR change would have *required* everyone to re-encrypt before upgrading.

---

## How to Read This Changelog

**If you're upgrading from a previous version:**
- Read the "Fixed" section carefully — some may require env var changes
- Check "Breaking Changes" in the target version
- Follow `DEPLOYMENT.md` for redeploy steps
- If upgrading from v1.3 → v1.4, the `CONNECTOR_ENCRYPTION_KEY` → `CONNECTOR_ENCRYPTION_KEYS` migration is **backward compatible** — no forced env change (single-key `_KEY` is treated as a single-entry keyring with kid `v1-legacy`)

**If you're evaluating Relayon for the first time:**
- Start with "Added" in `[1.5.0]` to see the current feature set
- Skim "Known Limitations" in each version to know what's NOT supported
- Check `ROADMAP.md` for what's coming
- Read `docs/TESTING.md` for honest test coverage (5 versions, 0 unit tests — v2.0 is where that stops)

**If you're a recruiter or interviewer:**
- **The velocity is real:** 5 versions (v1.0 → v1.5) shipped in 5 days. Every version was deployed and manually verified.
- **The honesty is real:** Known Limitations sections are as long as Added sections. Bugs are documented, not hidden.
- **The tradeoff is documented:** Testing was deferred at every version. v2.0 is where it stops. This is a conscious prioritization decision, not an oversight.
- **The safety focus is real:** v1.5's `__dryRun` in all 9 adapters was the single most important design decision — it prevents a class of production incidents that real iPaaS products have shipped with.
```

---