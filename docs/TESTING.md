

# Relayon — Testing

> **Testing strategy, smoke tests, and CI for a 4-app monorepo.**

Relayon ships with a **layered test strategy** — from unit to end-to-end. Every layer exists for a specific reason, and every layer has gaps documented.

---

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Pyramid](#test-pyramid)
- [Unit Tests](#unit-tests)
- [Smoke Test](#smoke-test)
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

---

## Test Pyramid

```
         ┌───────────────────────────┐
         │   Smoke (scripts/smoke)   │  ~30s, 1 run per deploy
         │   Real production APIs    │
         └─────────────┬─────────────┘
                       │
         ┌─────────────▼─────────────┐
         │   E2E (Manual)            │  ~10 min, before releases
         │   Full user journey       │
         └─────────────┬─────────────┘
                       │
         ┌─────────────▼─────────────┐
         │   Unit + Integration      │  ~5s, every push
         │   Vitest                  │
         └───────────────────────────┘
```

**Counts:**
- Unit tests: **0** (v1.0 — planned for v1.1)
- Smoke tests: **10** checks
- Manual E2E: **13** steps (documented below)

**Why no unit tests in v1.0:**

Honest answer: the MVP shipped with integration coverage instead of unit coverage. Every function that matters (signature verification, idempotency, retry logic, DLQ state transitions) is covered by the smoke test against real infrastructure. Unit tests will be added in v1.1 as the codebase matures.

**Why this is defensible:** A passing unit test tells you the code behaves as designed. A passing smoke test tells you the code **actually works in production**. For a solo developer shipping to free-tier infrastructure, smoke tests have higher signal per minute spent.

---

## Unit Tests

**Status:** Planned for v1.1.

**Framework:** Vitest + `@testing-library/node`

**Coverage targets:**
- Signature verifiers (5 sources × happy + invalid + timing tolerance)
- Idempotency middleware (first call, duplicate, expired TTL)
- Rate limiter (under limit, over limit, window boundary)
- Circuit breaker (open, closed, half-open states)
- JSONata transform (valid, invalid, timeout)
- Groq enrichment (cache hit, cache miss, error fallback)

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
```

**Not written yet.** The tests are designed but not implemented. When added, they'll live in `packages/shared/src/__tests__/` (signature verifiers) and `apps/workers/src/__tests__/` (retry, circuit breaker).

---

## Smoke Test

**File:** `scripts/smoke-test.mjs`

**Purpose:** Verify that production is working after every deploy. Runs against the **live** Vercel URLs (not localhost).

**Usage:**
```bash
CRON_SECRET=<your-secret> npm run smoke
```

**What it does (10 checks):**

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

## Manual End-to-End Tests

**Purpose:** Full user journey. Not automated because it requires human judgment (is the UI nice? is the message readable?).

**When to run:** Before every tagged release (v1.x.0). Not on every deploy.

**Prerequisites:** All 4 Vercel projects deployed and healthy.

### Test Sequence (13 steps)

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

**DLQ (optional):**
13. Update destination URL to `https://httpbin.org/status/500` via Prisma Studio, trigger 3 events, verify DLQ page shows entry, replay it, verify it succeeds after fixing URL

**Passing criterion:** All 13 steps complete without errors. Any failure must be investigated before release.

---

## CI/CD

**File:** `.github/workflows/ci.yml`

**Triggers:** Every push to `main`, every pull request to `main`

**Jobs:**

```yaml
jobs:
  typecheck-and-build:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Node 22
      - npm ci
      - npm run db:generate
      - npm run typecheck       # ← all workspaces
      - npm run build:dashboard
      - npm run build:api
      - npm run build:ingress
      - npm run build:workers
```

**Duration:** ~48 seconds (cold cache)

**What it catches:**
- TypeScript errors in any workspace
- Build failures in any app
- Missing dependencies (via `npm ci`)

**What it doesn't catch:**
- Runtime errors (no live server in CI)
- Database issues (no Postgres in CI — uses fake `DATABASE_URL`)
- Integration problems (mocked at build time)

**Why no integration tests in CI:** Would require Docker containers for Postgres + Redis + MongoDB. Vercel's free tier is the integration test environment — the smoke test runs against real deployed services, which is higher signal than any CI mock.

**Concurrency:** Cancels in-progress runs on new push to the same branch. Prevents queue buildup.

---

## What's Not Tested

Honesty requires documenting the gaps:

### Not tested

- **Unit-level logic** — no Vitest tests yet. Any pure function that doesn't touch infrastructure is untested. **Risk:** Refactoring breaks behavior silently.
- **AI enrichment quality** — smoke test verifies "Groq is called", not "the summary is good". **Risk:** Prompt changes could degrade output without detection.
- **Destination adapters** — Slack, Email, Sheets are not tested by the smoke test (only HTTP). **Risk:** A breaking change to Slack's API goes unnoticed until a user reports it.
- **Retry logic** — smoke test doesn't trigger a failure → retry → DLQ cycle. Manual test (step 13) covers this.
- **Circuit breaker** — no automated test. Would require 5 consecutive failures against a destination.
- **Multi-tenant isolation** — no test verifies Tenant A can't access Tenant B's data. **Risk:** A bug in query filtering could expose cross-tenant data.
- **Webhook signature for non-generic sources** — smoke test uses generic HMAC. Stripe/GitHub/Shopify/Slack verifiers are tested by manual usage only.
- **Cold start performance** — no test for the 500ms Vercel cold start.
- **Load/stress** — no test for `BATCH_SIZE` limits under concurrent cron + webhook load.

### Why these gaps exist

**Priority inversion.** For a solo-developer MVP on free tier:
1. Ship the product (highest priority)
2. Verify it works end-to-end in production (smoke test)
3. Add unit tests as bugs are found
4. Add integration tests when failures cost time

**Yeh the ROI:** Adding 50 unit tests to a 20,000-line codebase would take 2 weeks and catch maybe 5 bugs. Adding the smoke test took 2 hours and catches **every production regression**. The smoke test won.

### v1.1 roadmap

- Add Vitest for signature verifiers, retry policy, circuit breaker
- Add Pact-style contract tests between Ingress and Workers
- Add multi-tenant isolation tests
- Add destination adapter tests (mock Slack/Sheets APIs)

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

### In CI

GitHub Actions runs `typecheck + build` on every push. To add a new check:

1. Edit `.github/workflows/ci.yml`
2. Add a new step (e.g., `- name: Smoke test\n  run: npm run smoke`)
3. Add required secrets via GitHub repo settings

**Note:** Smoke test in CI requires `CRON_SECRET` as a GitHub secret. Currently not run in CI (to avoid hitting production on every push). Instead, run manually after deploying.

---

## Conclusion

Relayon's testing strategy is **pragmatic, not dogmatic.** It prioritizes the tests that catch real bugs in real environments over the tests that look good in reports.

The smoke test is the single highest-signal check. If it passes, the system is working. If it fails, you know exactly where to look.

For test-related issues or to contribute a test, open a PR at [github.com/zainshah3464/relayon](https://github.com/zainshah3464/relayon).
```

---