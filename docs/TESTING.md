# Relayon — Testing

> **Testing strategy, smoke tests, and CI for a 4-app monorepo.**
>
> **Current version:** v1.5.0

Relayon ships with a **layered test strategy** — from unit to end-to-end. Every layer exists for a specific reason, and every layer has gaps documented.

---

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Pyramid](#test-pyramid)
- [Unit Tests](#unit-tests)
- [Smoke Test](#smoke-test)
- [Feature-Specific Manual Tests](#feature-specific-manual-tests)
- [Manual End-to-End Tests](#manual-end-to-end-tests)
- [CI/CD](#cicd)
- [What's Not Tested](#whats-not-tested)
- [Running Tests](#running-tests)

---

## Testing Philosophy

**1. Test the contracts, not the implementations.** A test that verifies "signature verification returns 401 on wrong HMAC" is valuable. A test that verifies "internal function X is called with Y" is fragile and worthless.

**2. Test the failure modes.** The happy path is easy. The retries, the DLQ, the stuck recovery — those are the hard parts. Every guarantee documented in `ARCHITECTURE.md` has at least one test.

**3. Integration tests beat unit tests when possible.** A test that runs against a real Postgres beats a test that mocks Prisma. Mock-based tests pass when the mock passes, and fail when the real API changes.

**4. The smoke test is the only guarantee that production works.** Unit tests run in a fake environment. Smoke tests run against the real Vercel deployment with real Neon/Upstash/Groq. **Only the smoke test catches production-specific bugs** (like the `prisma: command not found` that unit tests would miss).

**5. Every new feature gets a test, or it doesn't ship.** No exceptions.

**6. Honesty about coverage beats inflated metrics.** If the tests for a feature are manual, say so. If a guarantee is backed by architecture (not by a test), say so.

---

## Test Pyramid

```
         ┌───────────────────────────┐
         │   Smoke (scripts/smoke)   │  ~30s, 1 run per deploy
         │   Real production APIs    │
         └─────────────┬─────────────┘
                       │
         ┌─────────────▼─────────────┐
         │   Feature Manual Tests    │  per release, see below
         │   v1.1 → v1.5 checklists  │
         └─────────────┬─────────────┘
                       │
         ┌─────────────▼─────────────┐
         │   E2E (Manual)            │  ~10 min, before releases
         │   Full user journey       │
         └─────────────┬─────────────┘
                       │
         ┌─────────────▼─────────────┐
         │   Unit + Integration      │  NOT IMPLEMENTED
         │   Vitest (planned v2.0)   │
         └───────────────────────────┘
```

**Counts (v1.5):**
- Unit tests: **0** — unchanged from v1.0; still deferred
- Smoke tests: **10** checks — unchanged from v1.0
- Feature manual tests: **~25** checks across v1.1-v1.5 (documented below)
- Manual E2E: **13** steps (unchanged core journey, documented below)

**Why still no unit tests in v1.5:**

Honest answer: **v1.0 → v1.5 shipped 5 versions in 5 days.** The tradeoff each version made was the same: integration coverage (via smoke test + manual feature checks) over unit coverage. Adding 50 unit tests to a 20,000-line codebase would have taken 2 weeks and caught maybe 5 bugs. Instead, we shipped 9 adapters, encrypted credentials, key rotation, scheduled workflows, versioning, validation, dry-run — all manually verified against real infrastructure.

**Why this is defensible:** A passing unit test tells you the code behaves as designed. A passing smoke test + manual feature check tells you the code **actually works in production** against the real Neon, Upstash, MongoDB, Groq, Slack, Resend, Google Sheets, Airtable, Notion, PostgreSQL, MongoDB — all real APIs.

**Why this is also a risk:** Refactoring a pure function with no unit test will silently break behavior. We've mitigated this by keeping the codebase small per module and testing via real delivery on every feature. But it is a real risk that v2.0 will address.

**What v1.5 specifically shipped without automated test coverage:**
- Scheduled workflows (cron tick, run-now)
- Versioning (snapshot, restore, diff)
- Encryption at rest (encrypt, decrypt, rotation)
- 5 new adapters (Discord, Airtable, Notion, PostgreSQL, MongoDB)
- API key rotation
- Destination validation (dry-run)
- Full-config encryption toggle
- Bulk schedule operations

**Every one of these was verified by a manual checklist before shipping.** The checklists are documented in [Feature-Specific Manual Tests](#feature-specific-manual-tests).

---

## Unit Tests

**Status:** Planned for **v2.0**. Was planned for v1.1 originally, but every release prioritized shipping the next feature over building test infrastructure.

**Framework:** Vitest + `@testing-library/node`

**Coverage targets (v2.0 scope):**

**v1.0 features:**
- Signature verifiers (5 sources × happy + invalid + timing tolerance)
- Idempotency middleware (first call, duplicate, expired TTL)
- Rate limiter (under limit, over limit, window boundary)
- Circuit breaker (open, closed, half-open states)
- JSONata transform (valid, invalid, timeout)
- Groq enrichment (cache hit, cache miss, error fallback)

**v1.3-v1.5 features:**
- `crypto-box` — encrypt/decrypt round-trip, HKDF tenant separation, kid lookup, v1 envelope fallback, malformed envelope rejection
- Key rotation script — idempotency, kid swap
- `RoutingService.decide()` — no rules, rule matched, no rule matched, JSONata error
- Cron parser wrapper — valid expression, invalid expression, timezone handling
- `ApiKeysService.verify()` — valid, revoked, expired, wrong secret, malformed format, timing-safe compare
- `ApiKeysService.rotate()` — grace window behavior, old key expiry cap
- `WorkflowVersionsService.capture()` — version increment, cap at 50
- `WorkflowVersionsService.restore()` — destination recreation, new version capture
- `WorkflowVersionsService.diff()` — identical, added lines, removed lines
- Destination adapters — each with mocked HTTP response, verify request shape and error handling

**Example shape:**

```typescript
describe('verifyStripeSignature', () => {
  it('accepts a valid signature within tolerance', () => {
    const now = Math.floor(Date.now() / 1000);
    const body = '{"type":"test"}';
    const sig = hmac('whsec_test', `${now}.${body}`);
    expect(verifyStripe({ body, sig, tolerance: 300 })).toBe(true);
  });

  it('rejects a signature outside tolerance', () => {
    const old = Math.floor(Date.now() / 1000) - 600;
    const body = '{"type":"test"}';
    const sig = hmac('whsec_test', `${old}.${body}`);
    expect(verifyStripe({ body, sig, tolerance: 300 })).toBe(false);
  });

  it('rejects a tampered body', () => {
    const now = Math.floor(Date.now() / 1000);
    const sig = hmac('whsec_test', `${now}.{"type":"real"}`);
    expect(verifyStripe({ body: '{"type":"fake"}', sig, tolerance: 300 })).toBe(false);
  });
});

describe('crypto-box', () => {
  it('encrypts and decrypts round-trip', () => {
    const plaintext = 'https://hooks.slack.com/services/T00/B00/XXX';
    const env = encryptValue(plaintext, 'tenant-a');
    expect(env.startsWith('enc:v2:')).toBe(true);
    expect(decryptValue(env, 'tenant-a')).toBe(plaintext);
  });

  it('rejects decryption with wrong tenant', () => {
    const env = encryptValue('secret', 'tenant-a');
    expect(() => decryptValue(env, 'tenant-b')).toThrow();
  });

  it('decrypts legacy v1 envelopes', () => {
    // envelope created with old single-key format
    const v1Env = makeV1Envelope('secret', 'tenant-a');
    expect(decryptValue(v1Env, 'tenant-a')).toBe('secret');
  });
});
```

**Where they'll live (v2.0):**
- `packages/shared/src/__tests__/` — signature verifiers
- `apps/api/src/lib/__tests__/` — crypto-box
- `apps/api/src/modules/api-keys/__tests__/` — verify, rotate
- `apps/api/src/modules/workflows/__tests__/` — versions, diff, restore
- `apps/workers/src/modules/processing/__tests__/` — routing, transform
- `apps/workers/src/modules/egress/__tests__/` — each adapter with mocked fetch

**Why the delay:** Every release prioritized shipping the next high-value feature (adapters, encryption, scheduling, validation) over building test infrastructure. This is a defensible tradeoff for a solo developer shipping to free-tier infrastructure — but it is a tradeoff, not a free lunch. v2.0 closes it.

---

## Smoke Test

**File:** `scripts/smoke-test.mjs`

**Purpose:** Verify that production is working after every deploy. Runs against the **live** Vercel URLs (not localhost).

**Usage:**
```bash
CRON_SECRET=<your-secret> npm run smoke
```

**What it does (10 checks — unchanged from v1.0):**

| # | Check | What it verifies |
|---|---|---|
| 1 | API health | `relayon-api.vercel.app/api/health` returns `{status: ok, db: up}` |
| 2 | Ingress health | `relayon-ingress.vercel.app/health` returns `{status: ok}` |
| 3 | Workers health | `relayon-workers.vercel.app/internal/health` with cron secret returns `{status: ok}` |
| 4 | Signup | New user created via API, tenant auto-provisioned |
| 5 | Create workflow | Workflow created with `sourceType: 'generic'` and a test secret |
| 6 | Create destination | HTTP destination pointing at `https://httpbin.org/post` |
| 7 | Send webhook | Signed webhook accepted with `202` |
| 8 | Process batch | `/internal/process` returns `{processed: 1, egressJobsQueued: 1}` |
| 9 | Deliver batch | `/internal/deliver` returns `{delivered: 1}` |
| 10 | Verify event in API | `GET /api/events?workflowId=...` returns the event |

**What it does NOT verify (v1.5 feature gaps):**

- Scheduled workflow fires (schedule cron tick)
- Run-now button enqueues correctly
- Version snapshot captured on workflow update
- Version restore recreates destinations
- Version diff returns unified patch
- Destination credentials are encrypted in DB (needs Prisma Studio, not HTTP)
- Key rotation preserves decryptability (needs two-key env, not one-shot)
- API key verify + scope enforcement
- API key rotation grace window
- Bulk schedule pause/resume
- Destination validation / dry-run
- PG / MongoDB / Discord / Airtable / Notion / Sheets / Email adapters (only HTTP is tested)

**Why the smoke test wasn't extended:** Extending it to cover v1.5 features would require:
- A second API key (for API key verify test)
- A fake encrypted secret to inspect via DB (needs Prisma Studio access, not HTTP)
- A scheduled workflow with `nextRunAt` set to past (needs DB write)
- A test PG and MongoDB instance
- Real Slack, Resend, Sheets, Airtable, Notion credentials — 5 new third-party secrets to manage

Every one of these would add operational complexity (managing 5 more secrets in GitHub Actions) for marginal signal. The smoke test's job is **"is the happy path alive after deploy"** — not "every feature works." Feature correctness is verified manually per release.

**What should be added to smoke test in v2.0:**
- A version snapshot + restore check
- An API key verify + scope check
- A dry-run validation check (no writes — safe to run in CI)

**Sample output:**

```
🔎 Relayon smoke test
   API:     https://relayon-api.vercel.app
   Ingress: https://relayon-ingress.vercel.app
   Workers: https://relayon-workers.vercel.app

✅ API health — {"status":"ok","db":"up"}
✅ Ingress health — {"status":"ok","checks":{"db":"up","redis":"up"}}
✅ Workers health — {"status":"ok","checks":{"postgres":"up","redis":"up","mongo":"up"}}
✅ Signup
✅ Create workflow
✅ Create destination
✅ Send webhook — {"status":"accepted","correlationId":"..."}
✅ Process batch — {"processed":1,"succeeded":1,"egressJobsQueued":1}
✅ Deliver batch — {"processed":1,"delivered":1}
✅ Event visible in API — count=1

🟢 SMOKE PASS — 10/10 checks passed
```

**On failure:**
- Exits with code `1`
- Prints the failing check and its response body
- Does **not** clean up test data (creates orphan tenant — accepted tradeoff for simplicity)

**Why no cleanup:** Smoke tests run 1-2 times per day. Orphan tenants accumulate slowly (100/month). Manual cleanup quarterly is fine. Cleanup logic adds complexity and another failure point.

---

## Feature-Specific Manual Tests

Each version shipped with its own manual verification checklist. These are the tests that **would be unit/integration tests in v2.0** — for now, they are executed by hand before tagging a release.

### v1.1 — Reliability & Operator Experience

Manual verification performed before tagging v1.1.0:

| # | Check |
|---|---|
| 1 | Bulk DLQ replay: 3 entries selected → 3 replayed |
| 2 | Bulk DLQ cap: 101 IDs → `400` rejection |
| 3 | YAML export downloads and secrets are `${...}` placeholders |
| 4 | YAML import creates workflow (placeholders replaced) |
| 5 | YAML import rejects unresolved placeholders with clear message |
| 6 | Cost analytics returns non-zero values when events exist |
| 7 | Cost UI shows total + per-destination table |
| 8 | Conditional routing: rule `$exists(data.amount) and data.amount > 100` routes only matching events |

### v1.2 — Extensibility, Observability & Security

| # | Check |
|---|---|
| 1 | `/analytics` renders SVG time-series (no chart library in bundle) |
| 2 | 7d / 30d range buttons re-render with daily buckets |
| 3 | Chart hover shows tooltip with events/delivered/DLQ |
| 4 | Settings → API Keys tab renders empty state |
| 5 | Create API key with `events:read` — raw shown once, then hidden |
| 6 | Prisma Studio: `api_keys.key_hash` populated, `prefix` matches |
| 7 | `curl -H "X-API-Key: rlk_..." /api/events` works, `last_used_at` updated |
| 8 | API key without `workflows:write` scope → `403` on `POST /api/workflows` |
| 9 | Revoked key → `401` immediately |
| 10 | DLQ bulk discard: 3 selected → 3 removed |
| 11 | Transform preview shows transformed JSON for valid expression |
| 12 | Transform preview shows compile error for invalid JSONata |
| 13 | Discord adapter delivery works end-to-end (manual webhook) |

### v1.3 — Scheduling, Versioning, Encryption, New Adapters

| # | Check |
|---|---|
| 1 | Encryption: create destination → DB shows `enc:v2:` (or `enc:v1:` for pre-v1.4 data) |
| 2 | Redaction: API response returns `••••••••` for secrets |
| 3 | Encrypted destination delivers successfully (proves decrypt works) |
| 4 | Legacy plaintext destination still delivers (backward compat) |
| 5 | Wrong encryption key → `Credential decryption failed` DLQ entry |
| 6 | Version capture: create + rename + edit → `GET /versions` returns v1, v2, v3 |
| 7 | Version restore: restore v1 → workflow reverts, new v4 created |
| 8 | Version cap: 51 edits → only latest 50 retained |
| 9 | Schedule create: `*/15 * * * *` → `nextRunAt` 15 min future |
| 10 | Schedule tick returns `{due: 0}` when nothing due |
| 11 | Force `nextRunAt` to past via Prisma Studio → tick returns `{enqueued: 1}` |
| 12 | Scheduled event reaches delivery (`relayon.schedule.trigger` payload type) |
| 13 | Concurrent ticks: second returns `{skipped: N}` (atomic claim works) |
| 14 | Airtable adapter creates a record |
| 15 | Notion adapter creates a page (integration shared with database) |

### v1.4 — Database Adapters & Key Rotation

| # | Check |
|---|---|
| 1 | Old `enc:v1:` data still decrypts (backward compat preserved) |
| 2 | New destination encrypted with `enc:v2:key-2026-10:...` |
| 3 | Key rotation script rotates all rows; reports counts |
| 4 | Post-rotation: all envelopes use current kid |
| 5 | PG adapter inserts row (with `columns` mapping) |
| 6 | PG adapter `onConflict` upserts correctly |
| 7 | PG adapter rejects SQL injection attempts in `table`/`column` names |
| 8 | Mongo adapter inserts with `_relayon` metadata |
| 9 | Mongo adapter `upsertKey` updates same doc on repeat |
| 10 | Run-now button enqueues immediately, `lastRunAt` updated |
| 11 | Run-now preserves `nextRunAt` (cron stays scheduled) |
| 12 | 9 adapters registered in worker log at startup |

### v1.5 — Validation, Diff, Key Rotation, Bulk Ops

| # | Check |
|---|---|
| 1 | Schema validate: empty `config` for `http` → `ok: false` with `url` error |
| 2 | Shape validate: `url: "ftp://x"` → `ok: false` ("must start with http") |
| 3 | Dry-run HTTP success: real latency returned (~200-500ms, not 0ms) |
| 4 | Dry-run HTTP failure: `https://httpbin.org/status/500` → `ok: false` |
| 5 | PG dry-run: `SELECT 1` succeeds without inserting |
| 6 | Mongo dry-run: `ping` succeeds without inserting |
| 7 | Validation with workers down → `ok: true, layer: schema` + warning |
| 8 | **Dry-run Slack: no message sent to channel** (critical safety) |
| 9 | Version diff identical: same version → `identical: true`, empty unified |
| 10 | Version diff real: v1→v2 → `stats.added > 0`, unified has `+`/`-` lines |
| 11 | Diff UI renders green/red/cyan lines |
| 12 | API key rotate: new raw key returned, old `expiresAt` = +24h |
| 13 | Rotate grace: old key works within 24h |
| 14 | Rotate grace expiry: old key returns `401` after `expiresAt` passes |
| 15 | Bulk pause-all: `updated: N`, all schedules `isActive: false` |
| 16 | Bulk resume-all: `updated: N`, `nextRunAt` recomputed (not in past) |
| 17 | Full encryption toggle: `FULL_CONFIG_ENCRYPTION=true` → all non-metadata fields `enc:v2:` |

**These checklists are not automated.** They are executed by hand before tagging. Documenting them here means v2.0 can translate each row into a real test case without re-discovering what to test.

---

## Manual End-to-End Tests

**Purpose:** Full user journey. Not automated because it requires human judgment (is the UI nice? is the message readable?).

**When to run:** Before every tagged release (v1.x.0). Not on every deploy.

**Prerequisites:** All 4 Vercel projects deployed and healthy.

### Test Sequence (13 steps — same core journey as v1.0)

**Setup:**
1. Open `https://relayon.vercel.app` in browser
2. Sign up with a new email → should land on dashboard
3. Verify sidebar shows correct tenant name

**Workflow creation:**
4. Navigate to `/workflows` → click "New workflow"
5. Create workflow named "Manual Test" with `sourceType: stripe`, `secret: whsec_test123`, enrichment ON
6. Copy the webhook URL from workflow detail page

**Webhook send:**
7. Use `test-webhook.js` (or curl with signature) to POST to the webhook URL → expect `202`
8. Navigate to `/events` → verify event appears with `status: processed`

**Delivery:**
9. Add HTTP destination to workflow: `https://httpbin.org/post`
10. Trigger `/internal/process` and `/internal/deliver` via cron secret
11. Refresh `/events` → click event → verify drawer shows:
    - Raw payload (original)
    - Enriched payload (Groq summary + category + severity)
    - Deliveries section with `delivered` badge + HTTP 200

**Analytics:**
12. Navigate to `/analytics` → verify:
    - Events (24h) increments
    - Success rate shows 100%
    - Destination breakdown shows HTTP destination with latency
    - (v1.2+) Time-series chart renders with hover

**DLQ (optional):**
13. Update destination URL to `https://httpbin.org/status/500` via Prisma Studio, trigger 3 events, verify DLQ page shows entry, replay it, verify it succeeds after fixing URL

**Passing criterion:** All 13 steps complete without errors. Any failure must be investigated before release.

---

## CI/CD

**File:** `.github/workflows/ci.yml`

**Triggers:** Every push to `main`, every pull request to `main`

**Jobs (unchanged from v1.0):**

```yaml
jobs:
  typecheck-and-build:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Node 22
      - npm ci
      - npm run db:generate
      - npm run typecheck       # ← all workspaces (api, dashboard, ingress, workers)
      - npm run build:dashboard
      - npm run build:api
      - npm run build:ingress
      - npm run build:workers
```

**Duration:** ~60 seconds (cold cache, grew from ~48s due to v1.3-v1.5 source additions)

**What it catches:**
- TypeScript errors in any workspace (caught `pg-format` types, `diff@7` ESM issue, schedule DTO regex — all in CI before merge)
- Build failures in any app
- Missing dependencies (via `npm ci`)
- Prisma schema syntax errors (via `db:generate`)

**What it doesn't catch:**
- Runtime errors (no live server in CI)
- Database issues (no Postgres in CI — uses fake `DATABASE_URL`)
- Integration problems (mocked at build time)
- Encryption round-trip failures
- Schedule tick correctness
- Dry-run safety (does a real Slack message get sent?)

**Why no integration tests in CI:** Would require Docker containers for Postgres + Redis + MongoDB. Vercel's free tier is the integration test environment — the smoke test runs against real deployed services, which is higher signal than any CI mock.

**Concurrency:** Cancels in-progress runs on new push to the same branch. Prevents queue buildup.

**Keep-alive workflow:** `.github/workflows/keep-alive.yml` pings health endpoints every 12h. Prevents MongoDB Atlas M0 from pausing on idle (60-day limit).

---

## What's Not Tested

Honesty requires documenting the gaps. **This section is longer in v1.5** because we shipped 5 versions without adding automated tests.

### Not tested (v1.5 reality)

**v1.0 gaps still open:**
- **Unit-level logic** — no Vitest tests. Any pure function that doesn't touch infrastructure is untested. **Risk:** Refactoring breaks behavior silently.
- **AI enrichment quality** — smoke test verifies "Groq is called", not "the summary is good". **Risk:** Prompt changes could degrade output without detection.
- **Retry logic** — smoke test doesn't trigger a failure → retry → DLQ cycle. Manual test (step 13) covers this.
- **Circuit breaker** — no automated test. Would require 5 consecutive failures against a destination.
- **Multi-tenant isolation** — no test verifies Tenant A can't access Tenant B's data. **Risk:** A bug in query filtering could expose cross-tenant data.
- **Webhook signature for non-generic sources** — smoke test uses generic HMAC. Stripe/GitHub/Shopify/Slack verifiers are tested by manual usage only.
- **Cold start performance** — no test for the 500ms Vercel cold start.
- **Load/stress** — no test for `BATCH_SIZE` limits under concurrent cron + webhook load.

**v1.1-v1.5 gaps:**
- **Encryption correctness** — no automated round-trip test. Manual DB inspection after each release confirmed `enc:v2:` envelopes but no regression guard exists.
- **Key rotation safety** — script is manually verified per release. No test proves that removing a key from the ring after rotation doesn't break decryptability.
- **Schedule atomicity** — manual concurrent-tick test exists (v1.3 checklist #13) but is not automated.
- **Version diff correctness** — manual verification only. No test for edge cases (empty snapshots, unicode, very large diffs).
- **Dry-run safety across all 9 adapters** — manual verification per adapter (v1.5 checklist #8 for Slack specifically). **Critical risk:** a future adapter added without honoring `__dryRun` would silently write during validation.
- **PG adapter SQL injection resistance** — manually verified (v1.4 checklist #7) by attempting injection in `table` name. Not a fuzz test.
- **Mongo adapter upsert correctness** — manual verification only. No test for compound keys, dotted paths, arrays.
- **API key pepper rotation** — no test. No automated migration path.
- **Full-config encryption toggle** — no test verifies that non-metadata fields are actually encrypted and metadata fields are not.
- **Cross-version encryption compat** — manual test confirms `enc:v1:` still decrypts after v1.4 upgrade, but no regression guard ensures v1.3 data stays readable.

### Why these gaps exist

**Priority inversion.** For a solo-developer MVP on free tier, the priority ordering was:

1. Ship the product (highest priority)
2. Verify it works end-to-end in production (smoke test + manual checklist)
3. Add unit tests as bugs are found
4. Add integration tests when failures cost time

**Yeh the ROI:** Adding 50 unit tests to a 20,000-line codebase would take 2 weeks and catch maybe 5 bugs. Adding 5 version-specific manual checklists took ~2 hours each and caught **every production regression** across v1.1-v1.5. The checklists won — **but they are not a substitute for automated tests**, and v2.0 must close the gap.

**What happens when a regression ships:** It's caught by a user or by the smoke test. That's a bad place to catch it. v2.0's test investment is specifically to prevent that.

### v2.0 roadmap (was v1.1, deferred 5 times)

The original v1.1 plan had unit tests. That got deferred to v1.2, then v1.3, then v1.4, then v1.5. **v2.0 is where this stops.** Automated test additions will ship **before** any new feature:

- **Vitest infrastructure** — config, coverage reporting, CI integration
- **crypto-box tests** — round-trip, tenant separation, kid lookup, v1 fallback, malformed rejection
- **API key tests** — verify, rotate, scope enforcement, timing-safe compare
- **Versioning tests** — capture, cap, restore, diff (edge cases)
- **Schedule tests** — parser validation, atomic claim (using a real Postgres in CI)
- **Adapter tests** — each with mocked HTTP response (17 adapters × 5 scenarios)
- **Multi-tenant isolation tests** — attempts to access cross-tenant resources must return 404
- **Smoke test extension** — add version snapshot + API key verify + dry-run validation checks

**Target:** 60%+ line coverage on `apps/api/src/lib/`, `apps/api/src/modules/api-keys/`, `apps/api/src/modules/workflows/`, `apps/workers/src/modules/egress/adapters/`.

**Non-target:** Coverage on dashboard UI components. Those are validated by the manual E2E test.

---

## Running Tests

### Local

```bash
# Typecheck across all workspaces
npm run typecheck

# Build all 4 apps (catches build-time errors)
npm run build:dashboard && npm run build:api && npm run build:ingress && npm run build:workers

# Smoke test against production
CRON_SECRET=<secret> npm run smoke

# Smoke test against local (after starting dev servers)
API_URL=http://localhost:3001 \
INGRESS_URL=http://localhost:3002 \
WORKERS_URL=http://localhost:3003 \
CRON_SECRET=<secret> \
npm run smoke
```

### Manual feature verification (per release)

```bash
# Before tagging any release:
# 1. Run smoke test against production
CRON_SECRET=<secret> npm run smoke

# 2. Execute the relevant feature checklist from this doc
#    (v1.5 checklist = 17 rows, ~20 minutes)

# 3. Execute the 13-step manual E2E
#    (~10 minutes)

# 4. If all pass → tag release
git tag v1.5.0
git push --tags
```

### In CI

GitHub Actions runs `typecheck + 4 builds` on every push. To add a new check:

1. Edit `.github/workflows/ci.yml`
2. Add a new step (e.g., `- name: Smoke test\n  run: npm run smoke`)
3. Add required secrets via GitHub repo settings

**Note:** Smoke test in CI requires `CRON_SECRET` as a GitHub secret. Currently not run in CI (to avoid hitting production on every push). Instead, run manually after deploying.

**v2.0 plan:** Add a `test` job that runs Vitest against a Postgres service container in CI, gates merges on coverage threshold.

---

## Conclusion

Relayon's testing strategy is **pragmatic, not dogmatic.** It prioritizes the tests that catch real bugs in real environments over the tests that look good in reports.

**v1.5 honest reality:** After 5 versions in 5 days, test coverage has not kept pace with feature count. Smoke test is still 10 checks (unchanged). Unit tests are still zero. But every feature shipped was manually verified against real infrastructure via documented checklists — and the two production bugs that occurred were both caught by the smoke test and manual E2E.

The smoke test is the single highest-signal check. If it passes, the happy path is working. If it fails, you know exactly where to look.

**What v2.0 must fix:** Automated tests for encryption, key rotation, API keys, versioning, scheduling, and every adapter. The manual checklists in this doc are the specification for those tests. Ship tests before shipping v2.0 features.

For test-related issues or to contribute a test, open a PR at [github.com/zainshah3464/relayon](https://github.com/zainshah3464/relayon).
```

---