# Relayon — Testing Strategy & Quality Gates

> **A source-aligned guide to automated tests, integration boundaries, production smoke checks, browser journeys, load scenarios, mutation testing, and CI enforcement.**
>
> **Final version:** **v3.7.0** (project officially complete — 24 November 2026)
> **Audited commit:** [`f4dd930eafd2ab61381bc1c049bb6cdbb7480235`](https://github.com/zainshah3464/relayon/commit/f4dd930eafd2ab61381bc1c049bb6cdbb7480235)
> **License:** [Relayon Proprietary Source-Visible License v1.0](./LICENSE)

| Document metadata | Value |
|---|---|
| Repository | [`zainshah3464/relayon`](https://github.com/zainshah3464/relayon) |
| Branch audited | `main` |
| Source snapshot | 24 November 2026 |
| Runtime used by CI | Node.js 22 |
| Test framework | Vitest 2.1.x, Playwright, Stryker, k6 |
| Scope | Four application workspaces plus shared packages and repository-level test infrastructure |

This document describes the test assets and workflow definitions present at the audited commit. It is **not** a report that the test suites were executed successfully during this documentation audit. A configured test, a CI job, and a verified production guarantee are three different things; this guide keeps those claims separate.

---

## Table of Contents

- [1. Current Testing Posture](#1-current-testing-posture)
- [2. Testing Principles](#2-testing-principles)
- [3. Test Pyramid and Inventory](#3-test-pyramid-and-inventory)
- [4. Unit Tests](#4-unit-tests)
- [5. Integration Tests](#5-integration-tests)
- [6. PostgreSQL Row-Level Security Tests](#6-postgresql-row-level-security-tests)
- [7. Browser End-to-End Tests](#7-browser-end-to-end-tests)
- [8. Production Smoke Test](#8-production-smoke-test)
- [9. Load and Performance Tests](#9-load-and-performance-tests)
- [10. Mutation Testing](#10-mutation-testing)
- [11. CI/CD Workflows](#11-cicd-workflows)
- [12. Local Test Environment](#12-local-test-environment)
- [13. Running the Suites](#13-running-the-suites)
- [14. Coverage Model and Interpretation](#14-coverage-model-and-interpretation)
- [15. Known Gaps and Reliability Caveats](#15-known-gaps-and-reliability-caveats)
- [16. Release Verification Checklist](#16-release-verification-checklist)
- [17. Test File Inventory](#17-test-file-inventory)
- [18. Historical Manual Verification (v1.1–v1.5)](#18-historical-manual-verification-v11v15)
- [19. Source References](#19-source-references)

---

## 1. Current Testing Posture

Relayon no longer has the v1.5-era testing posture described by the previous version of this document. The repository now contains several automated layers, and the GitHub Actions configuration runs **unit, integration, and RLS-oriented test jobs** on pushes and pull requests to `main`.

### Snapshot summary

The counts below are **file counts from the audited `main` tree**, not counts of individual `it()` assertions or proof that every assertion passed.

| Layer | Repository inventory | Configured execution |
|---|---:|---|
| Vitest unit tests | **29** `*.spec.ts` files under application source trees | CI on push and pull request; coverage enabled |
| Integration tests | **9** `*.integration.spec.ts` files | CI on push and pull request |
| Playwright E2E | **4** spec files | Available by command; **no Playwright job** in current GitHub Actions workflows |
| Production smoke | **11** checks in `scripts/smoke-test.mjs` | Manual command; **not wired into current CI** workflows |
| k6 load scenarios | **4** scripts | Manual / operator-invoked; **not wired into current CI** workflows |
| Stryker mutation testing | Configured source mutation set + a 3-file critical command | **Pull-request job only**; explicitly non-blocking (`continue-on-error: true`) |
| Workflow YAML validation | `workflows/**` validator | Path-filtered push and pull-request workflow |
| Typecheck and builds | Four application build targets + workspace typecheck | CI on push and pull request |

### What Changed Since the Old v1.5 Document

- **Unit tests are implemented**; the old "0 unit tests / Vitest planned" statement is obsolete.
- **Integration suites exist** for authentication, API keys, billing webhooks, DLQ flow, quota, RLS, schedules, version restore, and webhook flow.
- A separate **Vitest integration configuration** and shared test environment setup are present.
- **Playwright has four E2E spec files** rather than a purely manual 13-step journey.
- **Stryker mutation testing** and **four k6 scenario scripts** are present.
- The production smoke script has **11 checks** in the current source, not the old 10-check list.
- **CI has separate build and test workflows**; it is not accurate to describe the build workflow as the only automated quality check.

### The Most Important Distinction

A green CI run is useful evidence, but it does **not** mean every operational path has been tested:

1. The **unit and integration jobs** are automated and run in GitHub Actions.
2. The **browser E2E suite exists but is not currently included** in the GitHub Actions workflow files.
3. The **production smoke script exists but is not currently called** by those workflows.
4. The **k6 scripts exist but are not part of push/PR CI**.
5. **Mutation testing runs only on pull requests** and is configured to be **non-blocking**.
6. The **RLS test has a role-dependent skip path** that needs attention before its job can be treated as definitive enforcement proof.

---

## 2. Testing Principles

Relayon uses a layered strategy because its behavior spans application logic, persistent stores, queues, background workers, browser state, and external HTTP destinations.

### 2.1 Test Observable Contracts

Prefer assertions on externally meaningful behavior:

- Invalid webhook signatures are rejected.
- Repeated idempotency keys do not create duplicate work.
- A user cannot read or mutate another tenant's workflow.
- Retry and circuit-breaker state transitions follow the configured policy.
- Workflow transformations return the expected payload.
- A schedule is claimed **once** under concurrent ticks.
- API-key scopes and revocation are enforced.

Tests should not overfit to private helper call order unless the interaction itself is the contract.

### 2.2 Exercise Failure Paths, Not Only Happy Paths

The high-risk behavior is often in failure handling: wrong signatures, stale keys, rejected credentials, quota exhaustion, duplicate requests, retry exhaustion, unavailable workers, malformed configuration, and tenant-boundary violations. The current suite includes targeted coverage for several of these cases.

### 2.3 Use Real Infrastructure Where the Boundary Matters

The integration workflow provisions **PostgreSQL, Redis, and MongoDB service containers**. Those tests provide stronger evidence for database constraints, queue-adjacent behavior, and persistence integration than tests that replace every infrastructure dependency with an in-memory mock.

That does **not** mean every integration spec exercises every production service. Individual specs may intentionally override a provider or skip an assertion when a dependency is unavailable; those boundaries are documented in [§15](#15-known-gaps-and-reliability-caveats).

### 2.4 Treat Production Smoke Tests as Deployment Checks, Not Full Regression Suites

The smoke script exercises a narrow generic-webhook-to-HTTP-destination path using the deployed APIs. It is useful after deployment, but it does **not** replace unit, integration, tenant-isolation, adapter, or load tests.

### 2.5 Keep Test Claims Proportional to Evidence

- A test file proves that a test is **authored**, not that it **passed recently**.
- A configured coverage threshold is **not** the same thing as measured coverage from a successful run.
- A CI job labelled "RLS enforcement" is **not** sufficient evidence when the test can skip assertions for an unsuitable database role.
- A test that verifies an event exists is **not** necessarily proving that a downstream receiver persisted the correct delivery.

---

## 3. Test Pyramid and Inventory

```text
                         ┌──────────────────────────┐
                         │ Production smoke         │
                         │ 11 checks · manual       │
                         │ deployed HTTP path       │
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │ Browser E2E              │
                         │ 4 Playwright spec files  │
                         │ command-driven / manual  │
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │ Integration              │
                         │ 9 spec files             │
                         │ Postgres / Redis / Mongo │
                         │ CI on push + pull request│
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │ Unit                     │
                         │ 29 spec files            │
                         │ Vitest · V8 coverage     │
                         │ CI on push + pull request│
                         └──────────────────────────┘
```

Mutation testing, load testing, workflow-file validation, and typecheck/build are **complementary quality checks** rather than additional layers in the request-flow pyramid.

### Test Framework Versions and Configuration

| Concern | Current implementation |
|---|---|
| Unit framework | Vitest `^2.1.8` |
| Integration framework | Vitest using `vitest.integration.config.ts` |
| TypeScript / Nest decorators | `unplugin-swc` transform in both Vitest configs |
| Unit environment | Node.js; fork pool with one fork; 10-second test timeout and 15-second hook timeout |
| Integration environment | Node.js; fork pool with one fork; **serial execution**; 60-second test and hook timeouts |
| Coverage provider | **V8** |
| Browser automation | Playwright `^1.49.0`, Chromium desktop project |
| Mutation testing | Stryker `^8.6.0` with Vitest runner |
| Load testing | k6 scripts under `test/load/` |

The root scripts and configuration files are the source of truth for available commands and runtime behavior.

---

## 4. Unit Tests

**Framework:** Vitest 2.1.x  
**Configuration:** `vitest.config.ts`  
**Test location:** `apps/*/src/**/*.spec.ts`  
**Count at audited commit:** **29 spec files**

### 4.1 What the Unit Suite Covers

The current source inventory contains tests in the following areas.

| Area | Current test subjects |
|---|---|
| API cryptography | Credential encryption/decryption (`crypto-box`) |
| Authentication | Auth service, password-strength validation, email-verification service |
| API keys | API-key verification and service behavior |
| Billing | Billing service and Stripe service |
| DLQ | DLQ service behavior |
| Quotas | API quota service and ingress quota helper |
| Workflows | Version capture/restore/diff service and workflow YAML behavior |
| Scheduling | API schedule service and worker schedule service |
| Ingress security | Idempotency middleware and source signature verifiers |
| Egress adapters | Airtable, Discord, Email, HTTP, MongoDB, Notion, PostgreSQL, Google Sheets, and Slack adapters |
| Egress reliability | Circuit breaker and retry policy |
| Processing | Conditional routing and JSONata transformation |

The inventory covers the **nine built-in destination adapter implementations individually**. Those adapter unit tests provide focused coverage of request mapping and response/error handling without relying on live credentials for every provider.

### 4.2 Runtime Behavior

`vitest.config.ts` configures:

- Node.js test environment.
- `test/setup/vitest-setup.ts` as the setup file.
- SWC transformation for TypeScript and legacy NestJS decorators/metadata.
- A fork-based pool with `singleFork: true` to avoid hanging worker processes.
- `testTimeout: 10_000` and `hookTimeout: 15_000`.
- Inclusion of application source `*.spec.ts` files.
- Exclusion of integration and E2E spec naming patterns.

The setup file imports `test/setup/env.ts`, which loads `.env.test`, requires `TEST_DATABASE_URL`, sets `NODE_ENV=test`, and maps test-specific database, Redis, MongoDB, and secret values into the process environment.

### 4.3 Coverage Collection

The `test:coverage` command uses **V8 coverage** with `text`, `html`, and `lcov` reporters. Coverage inclusion is deliberately **limited to a defined set of high-value implementation files** rather than the entire monorepo.

The configured source files are:

- `apps/api/src/lib/crypto-box.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/quota/quota.service.ts`
- `apps/ingress/src/lib/quota.ts`
- `apps/ingress/src/middleware/idempotency.ts`
- `apps/ingress/src/services/verifiers.ts`
- `apps/workers/src/modules/egress/adapters/http.adapter.ts`
- `apps/workers/src/modules/egress/circuit-breaker.service.ts`
- `apps/workers/src/modules/egress/retry-policy.ts`
- `apps/workers/src/modules/processing/routing.service.ts`
- `apps/workers/src/modules/processing/transform.service.ts`

Configured minimum thresholds:

| Metric | Threshold |
|---|---:|
| Lines | 55% |
| Functions | 55% |
| Branches | 50% |
| Statements | 55% |

These thresholds apply **to the configured coverage set**. They are **not** a claim that the dashboard or every source file in all workspaces has that coverage.

### 4.4 Unit-Test Command Examples

```bash
# Run the unit suite once
npm run test

# Watch mode during development
npm run test:watch

# Interactive Vitest UI
npm run test:ui

# Collect V8 coverage (the command used by the CI unit job)
npm run test:coverage
```

---

## 5. Integration Tests

**Framework:** Vitest  
**Configuration:** `vitest.integration.config.ts`  
**Test location:** `test/integration/**/*.integration.spec.ts`  
**Count at audited commit:** **9 spec files**

### 5.1 Current Integration Inventory

| File | Focus |
|---|---|
| `api-keys.integration.spec.ts` | API-key behavior against the application and test database |
| `auth.integration.spec.ts` | Authentication flows against the application and test database |
| `billing-webhook.integration.spec.ts` | Billing / Stripe webhook integration behavior |
| `dlq-flow.integration.spec.ts` | Dead-letter flow and related lifecycle behavior |
| `quota.integration.spec.ts` | Quota enforcement behavior |
| `rls.integration.spec.ts` | PostgreSQL row-level security checks (see §6 caveat) |
| `schedules.integration.spec.ts` | Persisted schedules and schedule behavior |
| `version-restore.integration.spec.ts` | Workflow version restore behavior |
| `webhook-flow.integration.spec.ts` | API-side webhook workflow and test-run behavior |

### 5.2 Service Dependencies in GitHub Actions

The test workflow provisions service containers for the relevant jobs:

| Service | CI image | Default exposed port |
|---|---|---:|
| PostgreSQL | `postgres:16-alpine` | 5432 |
| Redis | `redis:7-alpine` | 6379 |
| MongoDB | `mongo:7` | 27017 |

The jobs configure test URLs such as `TEST_DATABASE_URL`, `TEST_REDIS_URL`, and `TEST_MONGODB_URI`, then generate Prisma and SDK artifacts and apply migrations before running the suites.

### 5.3 Integration Execution Characteristics

`vitest.integration.config.ts` uses:

- Node.js environment.
- `test/setup/vitest-setup.ts`.
- SWC decorator metadata transformation.
- One fork to keep the suite **serial and deterministic**.
- 60-second test and hook timeouts.

The setup maps `TEST_DATABASE_URL` to `DATABASE_URL`, maps the test Redis and Mongo endpoints to the expected application environment variables, and uses the `relayon_ci` Mongo database name.

### 5.4 Important Boundaries Inside Individual Tests

The suite name alone should **not** be interpreted as proof that all downstream services were exercised.

- `webhook-flow.integration.spec.ts` **overrides `MongoService` with a test double**. It tests the API integration boundary, **not** a complete production MongoDB persistence and destination-delivery cycle.
- Its test-run assertion **returns early with a warning** when the Workers service cannot be reached or the internal secret does not match. A completed test run may therefore **not** have asserted the transform path in that environment.
- The full browser pipeline test uses separate API, Ingress, and Workers URLs; its destination is an HTTPBin URL. It should be read together with the E2E limitations documented later in this file.

### 5.5 Run Integration Tests Locally

Before running integration tests, start **isolated** PostgreSQL, Redis, and MongoDB services and configure `.env.test` with their test-only connection details. Apply the Prisma migrations and RLS SQL to the dedicated test database as appropriate.

```bash
npm run db:generate
npm run sdk:generate
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npm run db:rls
npm run test:integration
```

**Do not** point `.env.test` at production or at a database containing user data. The test suites create and delete test tenants and records.

---

## 6. PostgreSQL Row-Level Security Tests

**Test file:** `test/integration/rls.integration.spec.ts`  
**CI job:** `RLS enforcement`

The RLS integration spec checks PostgreSQL policy behavior using tenant context stored in the transaction-local setting `app.tenant_id`. It creates two tenants, performs data access in tenant-scoped transactions, and verifies that tenant-owned rows are not visible across tenant boundaries. The file includes checks covering tenant-owned entities such as usage counters and workflow versions.

### 6.1 Why the Database Role Matters

PostgreSQL superusers and roles with `BYPASSRLS` can **bypass** row-level security. The current test explicitly inspects the active role and detects whether RLS is enabled and forced on the `users` table.

When the current database role is a **superuser**, has **`BYPASSRLS`**, or RLS is **not active** on the checked table, the spec records a skip reason, sets `rlsActive = false`, and **returns early** from the individual assertions.

### 6.2 CI Caveat Requiring Attention

The current `.github/workflows/test.yml` creates its PostgreSQL service with `POSTGRES_USER: ci`. The official PostgreSQL container initializes that configured user as the **database initialization/superuser role** unless the workflow changes the role setup. The RLS spec is designed to **skip enforcement assertions** when it detects a superuser or `BYPASSRLS` role.

> **Practical consequence:** a successful `RLS enforcement` job **must not** automatically be described as proof that tenant RLS policies were exercised. The CI database role should be changed to a **dedicated non-superuser, non-`BYPASSRLS` test role** for the assertion path, and the workflow should **fail** when the suite skips instead of silently treating skipped assertions as a successful enforcement check.

This is a **test-infrastructure limitation**, not a statement that the production RLS policies are absent.

### 6.3 RLS Execution

```bash
# Apply the repository's RLS policies to the dedicated test database
npm run db:rls

# Run only the RLS integration spec
npx vitest run --config vitest.integration.config.ts test/integration/rls.integration.spec.ts
```

Use a **direct** PostgreSQL connection for this test. The spec warns that pooled/PgBouncer connections can reset transaction-local `app.tenant_id` state and cause misleading failures.

---

## 7. Browser End-to-End Tests

**Framework:** Playwright  
**Configuration:** `playwright.config.ts`  
**Test location:** `test/e2e/`  
**Inventory:** **4 spec files**

### 7.1 Current E2E Coverage

| File | Covered journey |
|---|---|
| `auth-flow.e2e.spec.ts` | Signup setup, dashboard navigation, logout, valid/invalid login behavior, and protected-route redirect |
| `full-pipeline.e2e.spec.ts` | Signup, workflow creation, HTTP destination configuration, signed webhook submission, worker process/deliver calls, and event visibility |
| `quota-ui.e2e.spec.ts` | Dashboard monthly-usage display and Analytics page usage/event card visibility |
| `tenant-isolation.e2e.spec.ts` | Tenant B receives `404` for Tenant A workflow read/update/delete and does not see Tenant A workflows or API keys |

### 7.2 Browser Configuration

The Playwright configuration currently sets:

- `testDir: './test/e2e'`
- One Chromium desktop project
- `fullyParallel: false` and `workers: 1`
- CI retries set to **one**, local retries set to **zero**
- CI GitHub + HTML reporters and local list + HTML reporters
- Global test timeout of **180 seconds**
- Assertion timeout of **30 seconds**
- Action timeout of **30 seconds** and navigation timeout of **60 seconds**
- Screenshots, videos, and traces retained on failure
- **No automatic `webServer` startup**

The dashboard and supporting backend services must be started separately. Defaults in the checked-in tests/config are:

| Variable | Default |
|---|---|
| `E2E_BASE_URL` | `http://localhost:4200` |
| `API_URL` | `http://localhost:3001` |
| `INGRESS_URL` | `http://localhost:3002` |
| `WORKERS_URL` | `http://localhost:3003` |
| `CRON_SECRET` | **No default**; must be supplied for internal Workers requests |

### 7.3 Run E2E Tests

Start the Dashboard, API, Ingress, and Workers locally, then run:

```bash
E2E_BASE_URL=http://localhost:4200 \
API_URL=http://localhost:3001 \
INGRESS_URL=http://localhost:3002 \
WORKERS_URL=http://localhost:3003 \
CRON_SECRET=<local-cron-secret> \
npm run test:e2e
```

Other available commands:

```bash
npm run test:e2e:ui
npm run test:e2e:full
```

### 7.4 E2E Coverage Is Not the Same as Full UI Coverage

The current suite covers **selected** authentication, dashboard, analytics, quota, pipeline, and tenant-isolation journeys. It does **not** constitute a comprehensive browser test of every dashboard route, form, locale, responsive layout, or destination-adapter UI.

The authentication and pipeline specs **create users through the API and seed browser `localStorage`** before navigating into authenticated screens. They therefore do **not fully exercise** every signup/login form interaction as a human user would.

The full-pipeline test adds an HTTP destination targeting HTTPBin and asserts webhook acceptance and eventual event visibility. Worker process/deliver responses are **logged when unsuccessful** rather than used as strict delivery assertions, and the test **does not verify** the full downstream receiver payload or delivery record. Treat it as an **end-to-end ingress/event-visibility check**, not a definitive test of every egress guarantee.

### 7.5 CI Status

The current GitHub Actions workflows do **not** define a Playwright job. The E2E tests are runnable from the repository, but a push or pull-request CI success does **not** currently imply that these browser tests were run.

---

## 8. Production Smoke Test

**Script:** `scripts/smoke-test.mjs`  
**Command:** `npm run smoke`  
**Execution:** operator-invoked; **not currently included in push/PR CI**

The smoke test targets deployed API, Ingress, and Workers endpoints by default. It requires `CRON_SECRET` because it calls protected internal Workers endpoints.

### 8.1 Default Endpoints

| Service | Default URL | Health path |
|---|---|---|
| API | `https://relayon-api.vercel.app` | `/api/health` |
| Ingress | `https://relayon-ingress.vercel.app` | `/health` |
| Workers | `https://relayon-workers.vercel.app` | `/internal/health` (with `X-Cron-Secret`) |

All three base URLs can be overridden through environment variables for staging or another deployment.

### 8.2 Current 11 Checks

| # | Check | What the script verifies |
|---:|---|---|
| 1 | API health | API health endpoint returns HTTP 200 and `status: "ok"` |
| 2 | Ingress health | Ingress health endpoint returns HTTP 200 |
| 3 | Workers health | Protected Workers health endpoint returns HTTP 200 and `status: "ok"` |
| 4 | Signup | Creates a unique smoke-test user and tenant |
| 5 | Create workflow | Creates a generic-source workflow with a generated signing secret |
| 6 | Create destination | Adds an HTTP destination pointing to `https://httpbin.org/post` |
| 7 | Send webhook | Sends an HMAC-signed generic webhook and expects HTTP 202 |
| 8 | Process batch | Calls `/internal/process` and expects HTTP 200 |
| 9 | Deliver batch | Calls `/internal/deliver` and expects HTTP 200 |
| 10 | Event visible in API | Queries the workflow's events and expects at least one item |
| 11 | Analytics endpoint | Calls `/api/analytics/overview` and expects HTTP 200 |

The script prints a pass/fail line for each check and exits non-zero if any recorded check fails. It stops early when signup or workflow creation fails because later steps would not have valid identifiers.

### 8.3 Run Against Production

```bash
CRON_SECRET=<production-cron-secret> npm run smoke
```

### 8.4 Run Against a Non-Production Deployment

```bash
API_URL=https://<staging-api-host> \
INGRESS_URL=https://<staging-ingress-host> \
WORKERS_URL=https://<staging-workers-host> \
CRON_SECRET=<staging-cron-secret> \
npm run smoke
```

### 8.5 What the Current Smoke Test Does Not Prove

- It exercises a **generic-source** webhook, not each Stripe/GitHub/Shopify/Slack signature-verification path.
- It exercises an **HTTP destination**, not all nine destination adapters.
- It does **not** test schedule creation, cron execution, schedule concurrency, run-now, or bulk schedule operations.
- It does **not** test API-key scope enforcement or rotation.
- It does **not** test key rotation or encryption-key compatibility by inspecting stored database values.
- It does **not** assert the actual HTTPBin response body or independently verify the persisted delivery payload.
- It checks that the process and deliver endpoints return HTTP 200; it does **not** assert the detailed counts in those response bodies.
- It does **not clean up** the created user, tenant, workflow, destination, event, or related test data.

> **Operational warning:** the default URLs are **production URLs**. Running this command creates data in the selected environment and makes an outbound request to HTTPBin. Use an isolated staging environment where possible, and run against production only with authorization and awareness of the side effects.

---

## 9. Load and Performance Tests

**Tool:** k6  
**Scripts:** `test/load/`  
**Execution:** manually invoked; **no current GitHub Actions job runs these scripts**

The repository contains **four k6 scenarios**. They require an **isolated tenant/workflow** configured for load testing. Do **not** point them at a production tenant without an explicit capacity-test plan.

### 9.1 Scenario Inventory

| Script | Purpose | Scenario profile | Important configured thresholds |
|---|---|---|---|
| `webhook-ingress.js` | Ramped webhook ingress with virtual users | 0 → 10 VUs, then 50, then 100, then ramp down | HTTP p95 `<300 ms`, p99 `<800 ms`, HTTP failure rate `<1%`, custom failure rate `<2%` |
| `webhook-sustained.js` | Sustained ingress using a ramping arrival rate | 10/s start; stages target 100/s, 500/s, then 100/s | HTTP p95 `<300 ms`, p99 `<800 ms`, HTTP failure `<1%`, custom failures `<2%`, enqueue-latency p95 `<200 ms` |
| `webhook-burst.js` | Short burst and rate-limit behavior | 0 → 500 VUs in 10s, hold 30s, ramp down in 10s | HTTP p95 `<1,000 ms`; 429 rate `<50%`; accepts 200, 202, or 429 |
| `delivery-throughput.js` | Worker process/deliver throughput | 1 VU, 20 shared iterations, up to 10 minutes | Processing latency p95 `<10 s`; calculated DLQ rate `<10%` |

These are **configured test thresholds**, not measured performance claims. Actual capacity depends on the deployment shape, database, Redis, worker concurrency, destination latency, and load-test environment.

### 9.2 Commands

```bash
# Webhook ingress with ramping VUs
npm run test:load

# Sustained arrival-rate test
npm run test:load:sustained

# Burst / rate-limit test
npm run test:load:burst

# Worker processing and delivery throughput
npm run test:load:delivery
```

### 9.3 Required Environment

For the ingress scenarios:

```bash
INGRESS_URL=http://localhost:3002 \
TENANT_ID=<load-test-tenant-id> \
WORKFLOW_ID=<load-test-workflow-id> \
SECRET=<workflow-webhook-secret> \
npm run test:load:sustained
```

The ingress scripts sign each payload with HMAC-SHA256 and generate distinct event IDs. The sustained and ingress scenarios expect accepted responses and check response latency/correlation metadata according to each script.

For delivery throughput:

```bash
WORKERS_URL=http://localhost:3003 \
CRON_SECRET=<local-cron-secret> \
npm run test:load:delivery
```

### 9.4 Load-Test Safety and Interpretation

- Use a **dedicated load-test tenant and workflow**; the scripts create real ingress requests and can enqueue real work.
- Ensure destination configuration is **safe for the test volume**. A load test can create downstream requests and provider costs.
- Run **one scenario at a time** unless the exercise explicitly measures combined traffic.
- **Preserve the k6 summary/output** with the environment, commit, deployment size, test duration, and configuration used.
- Do **not** interpret the thresholds embedded in the scripts as an SLO or benchmark until the scenario has actually been **executed** and the results **reviewed**.

---

## 10. Mutation Testing

**Tool:** Stryker 8.6.x with the Vitest runner  
**Configuration:** `stryker.config.mjs`

Mutation testing changes implementation expressions deliberately and checks whether the existing tests detect those changes. It is intended to measure **test sensitivity**, not merely statement execution.

### 10.1 Commands

```bash
# Run the configured mutation set
npm run test:mutation

# Run the smaller critical-path subset used by CI
npm run test:mutation:critical
```

The full Stryker configuration lists mutation targets in:

- API credential encryption (`crypto-box`)
- Authentication service
- API quota service
- API-key service
- Ingress signature verifiers
- Ingress idempotency middleware
- Worker retry policy
- Worker circuit breaker
- Worker routing service

The `test:mutation:critical` npm script narrows this to **three files**: `crypto-box.ts`, `retry-policy.ts`, and `quota.service.ts`.

### 10.2 Mutation Score Thresholds

The Stryker configuration declares:

| Threshold | Score |
|---|---:|
| High | 90% |
| Low | 70% |
| Break | **Not configured** (`null`) |

The absence of a `break` threshold means the configured score is **not a hard process-failure gate** at that level.

### 10.3 CI Behavior

The `mutation` job in `.github/workflows/test.yml`:

- Runs **only for pull-request events**
- Depends on the unit job
- Executes `npm run test:mutation:critical`
- Uploads `reports/mutation/` as the `mutation-report` artifact when the job reaches the artifact step
- Has **`continue-on-error: true`**

Therefore, mutation results are **diagnostic feedback** in the current workflow, **not a required merge gate**.

---

## 11. CI/CD Workflows

The repository **separates typecheck/build validation from test execution**. The relevant workflow files are under `.github/workflows/`.

### 11.1 CI — Typecheck and Build

**File:** `.github/workflows/ci.yml`  
**Triggers:** push to `main`, pull request targeting `main`

The `typecheck-and-build` job runs on `ubuntu-latest` using Node.js 22 and npm caching. Its sequence is:

1. Checkout
2. Install dependencies with `npm ci`
3. Generate the Prisma client
4. Generate the SDK from `openapi.json`
5. Run `npm run typecheck` across workspaces
6. Build the Dashboard
7. Build the API
8. Build Ingress
9. Build Workers

The workflow has **concurrency cancellation** enabled for a newer run on the same ref.

### 11.2 Tests — Unit, Integration, RLS, and Mutation

**File:** `.github/workflows/test.yml`  
**Triggers:** push to `main`, pull request targeting `main`

| Job | Dependency | Main work | Gate behavior |
|---|---|---|---|
| `unit` | None | PostgreSQL/Redis/Mongo services, Prisma + SDK generation, migrations, `npm run test:coverage`, Codecov upload | Normal job result; Codecov upload is non-fatal (`fail_ci_if_error: false`) |
| `integration` | `unit` | Service containers, generation, migrations, `npm run db:rls`, `npm run test:integration` | Normal job result |
| `rls` | `integration` | PostgreSQL service, generation, migrations, `npm run db:rls`, targeted RLS spec | Normal job result, but see the role/skip caveat in [§6](#6-postgresql-row-level-security-tests) |
| `mutation` | `unit` | Pull requests only; runs critical Stryker set and uploads report | Explicitly non-blocking via `continue-on-error: true` |

The `unit`, `integration`, and `rls` jobs are configured to run for **both** pushes to `main` and pull requests to `main`. The mutation job is **restricted to pull requests**.

### 11.3 Workflow YAML Validation

**File:** `.github/workflows/workflow-validate.yml`  
**Path filter:** `workflows/**`  
**Triggers:** changes under `workflows/` on push to `main` or on pull requests

The job installs `js-yaml` without changing the manifest and runs:

```bash
node scripts/relayon-sync.mjs validate
```

This validates **repository-managed workflow YAML**. It is distinct from the unit and integration tests for application runtime behavior.

### 11.4 Keep-Alive Workflow

**File:** `.github/workflows/keep-alive.yml`  
**Schedule:** every 12 hours; also supports manual `workflow_dispatch`

The workflow curls the production API and Ingress health endpoints. Its commands use `|| true`, so this workflow is a **best-effort keep-alive ping**, not a strict health gate or a deployment smoke test. It does **not** ping Workers.

### 11.5 What Current CI Does Not Run

The checked-in GitHub Actions workflow definitions do **not** currently include commands for:

- `npm run test:e2e` (Playwright)
- `npm run smoke` (deployed smoke test)
- Any `npm run test:load*` command (k6)
- The full, unfiltered `npm run test:mutation` Stryker run

Do **not** claim these suites are automatically executed on every push or pull request.

### 11.6 Merge-Gate Configuration

At the audited snapshot, GitHub reports the `main` branch as **not protected** and with **no required status checks** configured. The workflows can run without being enforced as mandatory merge checks. Configure repository rulesets or branch protection and mark the appropriate CI jobs as **required** if merges must be blocked on failures.

---

## 12. Local Test Environment

### 12.1 Runtime and Prerequisites

| Requirement | Purpose |
|---|---|
| Node.js 22 | Matches the GitHub Actions runtime; root package requires Node.js `>=20` |
| npm | Installs the root workspace and runs root scripts |
| PostgreSQL 16 | Test database and RLS/integration scenarios |
| Redis 7 | Test Redis service for relevant application paths |
| MongoDB 7 | Test event/delivery store for the configured test environment |
| Playwright Chromium | Browser E2E suite |
| k6 | Load-test scripts only |

### 12.2 Test Environment File

The shared setup at `test/setup/env.ts` loads `.env.test` from the repository root. It **requires** `TEST_DATABASE_URL` and then assigns that value to `DATABASE_URL`. It maps `TEST_REDIS_URL` and `TEST_MONGODB_URI` to the application variables used by the test runtime.

Example shape (use local or dedicated test-only service URLs and replace all placeholders):

```dotenv
TEST_DATABASE_URL=postgresql://ci:ci@localhost:5432/relayon_test?sslmode=disable
TEST_REDIS_URL=redis://localhost:6379
TEST_MONGODB_URI=mongodb://localhost:27017/relayon_test
```

The setup also provides test JWT secrets, cron/internal secrets, connector encryption keys, an API-key pepper, Groq test values, and test batch/time-budget defaults. Those values are **for tests only**; do not copy them into deployed environments.

> **Important safety detail:** although a comment in `test/setup/env.ts` says it should fail if `TEST_DATABASE_URL` points at production, the current implementation **only checks that the variable exists**. It does **not** parse or validate the hostname against a production denylist. The operator must ensure that `.env.test` points to a disposable test database.

### 12.3 Initial Setup

```bash
npm ci
npm run db:generate
npm run sdk:generate
```

Start PostgreSQL, Redis, and MongoDB with the test URLs configured. Apply database migrations before integration tests:

```bash
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

Apply RLS SQL before exercising the RLS test path:

```bash
npm run db:rls
```

**Do not** use `npm run db:reset` against any shared or production environment.

---

## 13. Running the Suites

### 13.1 Common Development Commands

```bash
# Typecheck every workspace that defines a typecheck script
npm run typecheck

# Build each application
npm run build:dashboard
npm run build:api
npm run build:ingress
npm run build:workers

# Unit tests
npm run test

# Unit tests with coverage thresholds and reports
npm run test:coverage

# Integration tests
npm run test:integration

# All three principal automated test commands in sequence
npm run test:all
```

`npm run test:all` is defined as `test`, then `test:integration`, then `test:e2e`. It does **not** include the smoke test, load tests, mutation tests, the dedicated RLS setup command, Prisma migrations, or SDK generation. Prepare the environment first and run any required setup explicitly.

### 13.2 Focus One Unit or Integration Test

```bash
# One unit spec (matched by vitest.config.ts)
npx vitest run --config vitest.config.ts apps/api/src/lib/crypto-box.spec.ts

# One integration spec (matched by vitest.integration.config.ts)
npx vitest run --config vitest.integration.config.ts test/integration/rls.integration.spec.ts
```

### 13.3 Run Browser Tests

Start the services and dashboard separately, then:

```bash
npm run test:e2e
```

Use the environment variables described in [§7](#7-browser-end-to-end-tests) when the services are not running on their default local ports.

### 13.4 Run Production Smoke

```bash
CRON_SECRET=<cron-secret> npm run smoke
```

The default endpoints are **production**. Override the base URLs to target staging or local deployments, and account for the test data the script creates.

### 13.5 Run Load Tests

```bash
npm run test:load
npm run test:load:sustained
npm run test:load:burst
npm run test:load:delivery
```

Supply the tenant/workflow/signing-secret environment for ingress scenarios or the Workers URL/cron secret for delivery throughput.

### 13.6 Run Mutation Tests

```bash
npm run test:mutation
npm run test:mutation:critical
```

The **complete** Stryker run is more expensive than the **critical-path** subset used in CI.

---

## 14. Coverage Model and Interpretation

Coverage in Relayon is intentionally **scoped to a set of security- and reliability-sensitive files**. It should be interpreted as **one signal** in a larger quality model.

| Evidence | What it tells you | What it does not tell you |
|---|---|---|
| Unit test pass | Covered isolated logic behaved as asserted in the test environment | That all services or production integrations work together |
| Integration test pass | The covered application paths worked against the configured test infrastructure | That every external provider or every deployment topology works |
| RLS test pass | RLS assertions ran and passed **only if** the test did not take its skip path | That a green result necessarily means RLS assertions executed |
| Playwright pass | The selected browser journeys passed against the configured app URLs | That every dashboard route, browser, viewport, or human flow is covered |
| Smoke pass | The 11 configured checks passed against the selected deployment | That all adapters, schedules, security features, or retry paths work |
| k6 pass | The scenario met the thresholds encoded in that run | That a different deployment has the same capacity or latency |
| Mutation result | The tests detected some deliberate changes to configured code | That unmutated modules or untested business rules are protected |
| Typecheck/build pass | TypeScript and build-time compilation succeeded for configured workspaces | That runtime behavior is correct |

### Recommended Reporting Discipline

When publishing a release or engineering update, distinguish:

- **Configured:** a test file, command, or workflow exists.
- **Executed:** the suite ran against a named commit and environment.
- **Passed:** the run result is green, with skips and non-blocking jobs disclosed.
- **Verified in deployment:** a production or staging smoke check ran against the actual deployment.

Avoid reporting a coverage percentage unless it comes from a **generated report for a specific commit**. The thresholds in `vitest.config.ts` are **configured minimums**, not a measured coverage result.

---

## 15. Known Gaps and Reliability Caveats

This section records limitations visible in the audited repository snapshot. It is **not** a claim that the application is broken; it describes where the current test evidence is **incomplete or can be overstated**.

### 15.1 RLS Assertions Can Be Skipped by the Database Role

The RLS spec deliberately avoids claiming enforcement when the active role is a superuser or has `BYPASSRLS`, but **returns early** from test bodies after setting `rlsActive = false`. The current CI service initializes PostgreSQL as user `ci`; this must be reviewed so the CI test role is **non-superuser** and the assertions actually execute. Make skipped RLS assertions **fail the job** or otherwise produce an unmistakable non-green result.

### 15.2 Playwright Is Not Part of Current Push/PR CI

Four E2E spec files exist, but **none** of the checked-in GitHub Actions workflow jobs runs Playwright. UI regressions in the selected journeys are therefore **not automatically caught** by the current push/PR workflow set.

### 15.3 The Browser Suite Is Selective

The E2E tests cover authentication, a generic webhook pipeline, quota/analytics visibility, and selected cross-tenant API behavior. They do **not** exhaustively cover all Dashboard screens, responsive breakpoints, locale/RTL states, forms, or all destination configuration interactions.

### 15.4 The E2E Pipeline Test Has a Weaker Delivery Assertion Than Its Title Suggests

The full-pipeline test checks webhook acceptance and eventual event visibility. Worker process/deliver responses are **logged if they are not OK** rather than strictly asserted, and the test does **not confirm** the final downstream receiver payload or a successful delivery record. A stronger assertion should verify the actual delivery result end to end.

### 15.5 Webhook Integration Test Stubs MongoDB

`webhook-flow.integration.spec.ts` **overrides `MongoService` with a test double**. It is useful for API integration behavior, but it is **not** a real Mongo event/delivery persistence test. Its transform test can also **return early** when Workers are unavailable or the internal secret is mismatched.

### 15.6 Smoke Test Covers One Narrow Route

The 11-check smoke flow covers a generic signed webhook and HTTP destination. It does **not** independently cover the nine destination adapters, provider-specific source signatures, scheduling, encryption rotation, API-key scope/rotation, or complete delivery response correctness.

### 15.7 Smoke Tests Create Persistent Records

The current script **does not clean up** test users, tenants, workflows, destinations, events, or other test data. Use a controlled environment and account for this accumulation.

### 15.8 Test Setup Does Not Actually Validate a Production Hostname

`test/setup/env.ts` checks that `TEST_DATABASE_URL` is **present** but does **not reject a production hostname** despite its nearby comment. Local operators must verify the URL manually. A fail-closed denylist or explicit test-database marker would make this safer.

### 15.9 Load Testing Is Not a CI Gate

Four k6 scripts and thresholds are present, but the GitHub Actions workflows do **not** execute them. No throughput or latency number should be represented as a current benchmark without a saved run result.

### 15.10 Mutation Testing Is Intentionally Non-Blocking

The critical mutation job runs on pull requests, but **`continue-on-error: true`** means a mutation failure does **not fail the overall workflow**. It is useful feedback, not an enforced gate.

### 15.11 Coverage Is Not Monorepo-Wide

The configured coverage include list contains **11 critical source files**. The current source tree does **not** contain Angular Dashboard unit spec files under `apps/dashboard`; selected Dashboard behavior is covered through the Playwright tests instead.

### 15.12 Main Is Not Protected at This Snapshot

GitHub's branch metadata reports `main` as **unprotected**, with **no required status checks**. Even if workflows run, they are **not necessarily enforced** as merge requirements until repository rules are configured.

### 15.13 External-Provider Behavior Is Not Fully Represented by Mocks

Adapter unit specs cover each built-in adapter implementation, but those tests should not be described as **live end-to-end certification** against every third-party account, permission set, rate limit, or provider outage. Use controlled provider test accounts or contract tests for those guarantees where required.

---

## 16. Release Verification Checklist

Use this checklist as a **practical release gate**. It intentionally separates automated CI evidence from operator-run checks.

### Before Merging

- [ ] `CI / Typecheck & Build` passes for the commit.
- [ ] `Tests / Unit tests` passes and the V8 coverage thresholds are met.
- [ ] `Tests / Integration tests` passes against the CI service containers.
- [ ] RLS assertions are confirmed to execute using a non-superuser, non-`BYPASSRLS` role; **a skip message is not accepted as proof**.
- [ ] Workflow YAML validation passes when `workflows/**` changes.
- [ ] Review the Stryker report on pull requests; remember the current job is non-blocking.

### Before a Deployment or Release

- [ ] Run the **Playwright suite** against the release candidate with Dashboard, API, Ingress, and Workers online.
- [ ] Run the **production smoke script** against the intended deployment, preferably staging first.
- [ ] Confirm the smoke-test records and outbound HTTPBin request are expected in that environment.
- [ ] Run the relevant **k6 scenario** only against an isolated load-test tenant and safe destination configuration.
- [ ] Review **adapter-specific changes** against the matching adapter unit spec and any provider-specific test environment available.
- [ ] Record the **commit SHA**, test commands, environment, result, and any **skipped/non-blocking** checks in the release notes.

### After Deployment

- [ ] Check API, Ingress, and Workers health endpoints.
- [ ] Run the smoke test with the deployment's `CRON_SECRET`.
- [ ] Inspect application logs and delivery/DLQ state for the smoke workflow.
- [ ] Confirm any scheduled processing and external cron configuration separately; **the smoke script does not validate schedule execution**.

---

## 17. Test File Inventory

The following inventory is pinned to the audited commit so that the documented file counts can be reproduced.

### 17.1 Unit Spec Files — 29

```text
apps/api/src/lib/crypto-box.spec.ts
apps/api/src/modules/api-keys/api-keys.service.spec.ts
apps/api/src/modules/auth/__tests__/email-verification.service.spec.ts
apps/api/src/modules/auth/__tests__/strong-password.validator.spec.ts
apps/api/src/modules/auth/auth.service.spec.ts
apps/api/src/modules/billing/billing.service.spec.ts
apps/api/src/modules/billing/stripe.service.spec.ts
apps/api/src/modules/dlq/dlq.service.spec.ts
apps/api/src/modules/quota/quota.service.spec.ts
apps/api/src/modules/schedules/schedules.service.spec.ts
apps/api/src/modules/workflows/workflow-versions.service.spec.ts
apps/api/src/modules/workflows/workflows-yaml.spec.ts
apps/ingress/src/lib/quota.spec.ts
apps/ingress/src/middleware/idempotency.spec.ts
apps/ingress/src/services/verifiers.spec.ts
apps/workers/src/modules/egress/adapters/airtable.adapter.spec.ts
apps/workers/src/modules/egress/adapters/discord.adapter.spec.ts
apps/workers/src/modules/egress/adapters/email.adapter.spec.ts
apps/workers/src/modules/egress/adapters/http.adapter.spec.ts
apps/workers/src/modules/egress/adapters/mongodb.adapter.spec.ts
apps/workers/src/modules/egress/adapters/notion.adapter.spec.ts
apps/workers/src/modules/egress/adapters/postgres.adapter.spec.ts
apps/workers/src/modules/egress/adapters/sheets.adapter.spec.ts
apps/workers/src/modules/egress/adapters/slack.adapter.spec.ts
apps/workers/src/modules/egress/circuit-breaker.service.spec.ts
apps/workers/src/modules/egress/retry-policy.spec.ts
apps/workers/src/modules/processing/routing.service.spec.ts
apps/workers/src/modules/processing/transform.service.spec.ts
apps/workers/src/modules/schedule/schedule.service.spec.ts
```

### 17.2 Integration Spec Files — 9

```text
test/integration/api-keys.integration.spec.ts
test/integration/auth.integration.spec.ts
test/integration/billing-webhook.integration.spec.ts
test/integration/dlq-flow.integration.spec.ts
test/integration/quota.integration.spec.ts
test/integration/rls.integration.spec.ts
test/integration/schedules.integration.spec.ts
test/integration/version-restore.integration.spec.ts
test/integration/webhook-flow.integration.spec.ts
```

### 17.3 Playwright Spec Files — 4

```text
test/e2e/auth-flow.e2e.spec.ts
test/e2e/full-pipeline.e2e.spec.ts
test/e2e/quota-ui.e2e.spec.ts
test/e2e/tenant-isolation.e2e.spec.ts
```

### 17.4 Load Scripts — 4

```text
test/load/webhook-ingress.js
test/load/webhook-sustained.js
test/load/webhook-burst.js
test/load/delivery-throughput.js
```

---

## 18. Historical Manual Verification (v1.1–v1.5)

> **Historical context:** Before the automated testing foundation was added in v2.0/v2.1, versions v1.1 through v1.5 were shipped with **manual verification checklists** executed by the developer before tagging each release. This section is preserved as a **historical record** — the automated test suite that replaced this manual process is documented in §4–§10. The checklists remain useful as a **specification of what each feature was supposed to do** and can inform future regression testing.

### 18.1 v1.1 — Reliability & Operator Experience

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

### 18.2 v1.2 — Extensibility, Observability & Security

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

### 18.3 v1.3 — Scheduling, Versioning, Encryption, New Adapters

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

### 18.4 v1.4 — Database Adapters & Key Rotation

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

### 18.5 v1.5 — Validation, Diff, Key Rotation, Bulk Ops

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

### 18.6 Manual End-to-End Test (Pre-Automation)

**Purpose:** Full user journey before the Playwright suite existed. Documented here as a historical record.

**13-step sequence (v1.0–v1.5 era):**

1. Open `https://relayon.vercel.app` in browser
2. Sign up with a new email → should land on dashboard
3. Verify sidebar shows correct tenant name
4. Navigate to `/workflows` → click "New workflow"
5. Create workflow with `sourceType: stripe`, `secret: whsec_test123`, enrichment ON
6. Copy the webhook URL from workflow detail page
7. Send a signed webhook (or curl) → expect `202`
8. Navigate to `/events` → verify event appears with `status: processed`
9. Add HTTP destination: `https://httpbin.org/post`
10. Trigger `/internal/process` and `/internal/deliver` via cron secret
11. Refresh `/events` → click event → verify drawer shows raw payload, enriched payload, deliveries section with `delivered` badge
12. Navigate to `/analytics` → verify events count, success rate, destination breakdown, time-series chart
13. (Optional DLQ test) Update destination URL to `https://httpbin.org/status/500`, trigger 3 events, verify DLQ page shows entry, replay it after fixing URL

**Note:** This manual journey was replaced by the `full-pipeline.e2e.spec.ts` Playwright test in the v2.0/v2.1 automation push. However, the Playwright version has **weaker delivery assertions** (see §15.4) than this historical manual check, so the manual 13-step remains valuable as a pre-release confidence check.

---

## 19. Source References

All repository source links below are pinned to commit `f4dd930eafd2ab61381bc1c049bb6cdbb7480235`, the `main` branch head at final release.

| Area | Source |
|---|---|
| Root scripts, dependencies, and runtime | [`package.json`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/package.json) |
| Build/typecheck CI | [`.github/workflows/ci.yml`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/.github/workflows/ci.yml) |
| Unit, integration, RLS, mutation CI | [`.github/workflows/test.yml`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/.github/workflows/test.yml) |
| Workflow YAML validator CI | [`.github/workflows/workflow-validate.yml`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/.github/workflows/workflow-validate.yml) |
| Keep-alive job | [`.github/workflows/keep-alive.yml`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/.github/workflows/keep-alive.yml) |
| Vitest unit config | [`vitest.config.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/vitest.config.ts) |
| Vitest integration config | [`vitest.integration.config.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/vitest.integration.config.ts) |
| Shared test setup | [`test/setup/env.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/test/setup/env.ts) and [`test/setup/vitest-setup.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/test/setup/vitest-setup.ts) |
| Playwright configuration | [`playwright.config.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/playwright.config.ts) |
| Production smoke | [`scripts/smoke-test.mjs`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/scripts/smoke-test.mjs) |
| Mutation configuration | [`stryker.config.mjs`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/stryker.config.mjs) |
| RLS integration assertions | [`test/integration/rls.integration.spec.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/test/integration/rls.integration.spec.ts) |
| API webhook integration boundary | [`test/integration/webhook-flow.integration.spec.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/test/integration/webhook-flow.integration.spec.ts) |
| Playwright full-pipeline journey | [`test/e2e/full-pipeline.e2e.spec.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/test/e2e/full-pipeline.e2e.spec.ts) |
| Ingress load scenarios | [`test/load/webhook-ingress.js`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/test/load/webhook-ingress.js), [`webhook-sustained.js`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/test/load/webhook-sustained.js), and [`webhook-burst.js`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/test/load/webhook-burst.js) |
| Worker delivery load scenario | [`test/load/delivery-throughput.js`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/test/load/delivery-throughput.js) |
| RLS application script | [`scripts/apply-rls.mjs`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/scripts/apply-rls.mjs) |

---

## Final Note

Relayon ended at **v3.7.0** with a **materially stronger automated testing foundation** than the original v1.5 architecture doc described: **29 unit spec files, 9 integration spec files, 4 Playwright journeys, an 11-check smoke script, mutation testing, and 4 k6 scenarios** are present in the final tree. The most valuable next improvements — if the project were ever resumed — would **not** be to inflate test counts, but to close the evidence gaps:

1. **Make RLS assertions non-skippable in CI** — the current CI database role bypasses RLS, so the job can pass without actually exercising the policies.
2. **Add Playwright to the automated pipeline** — the E2E suite exists but doesn't run on push/PR.
3. **Strengthen the full-pipeline delivery assertion** — verify the actual downstream receiver payload, not just event visibility.
4. **Protect `main` with required checks** — currently unprotected with no required status checks.
5. **Run load/smoke tests in a controlled release process** — they're manual-only and target production by default.

The project was closed honestly: **every gap is documented, no metric is inflated, and every claim is proportionate to the evidence that actually exists in the repository.**

---

<div align="center">

**Relayon v3.7.0 — Final Release · Project Complete**

*Testing is honest. Coverage is scoped. Gaps are documented.*

*Made with ❤️ in Pakistan*

</div>
```

---