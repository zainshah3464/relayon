# AGENTS.md — Relayon Engineering Guide for AI Agents

> **Purpose:** This is the repository-level operating manual for AI coding agents, autonomous agents, code assistants, and human engineers working in Relayon.
>
> **Project:** Relayon  
> **Repository:** [`zainshah3464/relayon`](https://github.com/zainshah3464/relayon)  
> **Documentation target:** `v3.7.0`  
> **Audited source snapshot:** `main` at commit [`f4dd930eafd2ab61381bc1c049bb6cdbb7480235`](https://github.com/zainshah3464/relayon/commit/f4dd930eafd2ab61381bc1c049bb6cdbb7480235)  
> **Last source review:** 2026-11-25
>
> This file gives agents the architectural map, invariants, workflows, and decision rules needed to work safely. It is not a replacement for reading the implementation. When a task touches a subsystem, follow the source links and inspect the current local working tree before changing code.

---

## 0. Instructions to every AI agent

You are working in a multi-service, multi-tenant event-processing platform. Changes can affect authentication, tenant isolation, event delivery, external side effects, billing, data retention, encryption, and production operations.

**Correctness, security, and compatibility take priority over speed and code volume.**

### 0.1 Mandatory operating rules

1. **Inspect before editing.** Read the relevant implementation, tests, schema/migrations, and docs before proposing or applying a change.
2. **Treat the local checkout as the task's source of truth.** The user may have uncommitted changes that are newer than GitHub `main`. Never replace them with remote content without understanding the diff.
3. **Do not assume documentation is current.** Some historical documentation in the remote repository may describe v1.5-era behavior. Compare it with the current code and the user's local documentation updates.
4. **Never invent APIs, environment variables, routes, queue names, schema fields, scripts, or product capabilities.** Find the actual declaration and verify it.
5. **Preserve tenant isolation.** Every tenant-owned read, write, queue job, cache key, stream, replay, and administrative action must have an explicit ownership boundary.
6. **Preserve delivery semantics.** Relayon uses asynchronous, at-least-once processing. Never claim exactly-once side effects.
7. **Treat every external side effect as dangerous.** A validation/test path must not send a real email, post a real message, insert a real row, or mutate a real third-party record.
8. **Protect secrets.** Never print, commit, expose, return, or log raw credentials, tokens, encryption keys, session cookies, or private payload data.
9. **Do not weaken fail-closed controls.** Signature verification, authorization, internal worker authentication, quota enforcement, and encryption failures must not silently become permissive.
10. **Use migrations for schema changes.** Update Prisma schema, migration SQL, generated artifacts where required, and tests as one coherent change.
11. **Test behavior, not only compilation.** Add tests for success, failure, boundary, race, and tenant-isolation cases relevant to the change.
12. **Do not claim tests passed unless you ran them.** Report exact commands and outcomes; distinguish not-run, skipped, blocked, and failed.
13. **Do not silently broaden scope.** Make the smallest complete change that solves the task. Ask before destructive, irreversible, or externally visible actions.
14. **Do not change licensing language.** The project uses the Relayon Proprietary Source-Visible License v1.0; it is not MIT.
15. **Update docs when behavior changes.** API, architecture, security, deployment, database, troubleshooting, and changelog references should remain consistent with implementation.

### 0.2 Source-of-truth order

When sources disagree, use this order and explain material discrepancies:

1. Current local source code and its tests.
2. Current Prisma schema and committed migration history.
3. Current OpenAPI source/spec and generated SDK contract.
4. Current CI/deployment configuration and environment examples.
5. Current detailed documentation in the local working tree.
6. Remote documentation and README.
7. Historical release notes, old examples, and prior chat summaries.

A comment or README claim is not proof that runtime behavior exists. A test is evidence of intended behavior, but still inspect the implementation if the task changes it.

### 0.3 Before any write

Run:

```bash
git status --short --branch
git diff --stat
git diff
```

Do not discard, reset, clean, checkout over, or reformat unrelated user changes. Do not amend commits, force-push, create releases, deploy, run production migrations, or change GitHub settings unless the user explicitly requests it.

### 0.4 Communication expectations

When reporting work, state:
- What changed and why.
- Which files changed.
- Which tests/checks ran.
- What did not run and why.
- Any migration, environment, deployment, or rollback requirements.
- Remaining risks or follow-up work.

Avoid vague claims such as “production-ready,” “fully secure,” “all tests pass,” or “zero downtime” unless the evidence supports the exact claim.

---

## 1. Project identity and product model

Relayon is a webhook relay and event-workflow platform. It receives events from external producers, verifies and accepts them, processes them asynchronously, optionally enriches and transforms payloads, selects destinations, and manages delivery attempts and recovery.

It also supports scheduled workflow execution and a broader application control plane for tenants, users, API keys, usage, billing, integrations, collaboration, administration, and developer tooling.

### 1.1 Core product concepts

| Concept | Meaning |
|---|---|
| **Tenant** | Isolation and quota boundary for customer-owned resources |
| **User** | Authenticated identity associated with a tenant and role |
| **Workflow** | Configuration describing an event source, optional processing, routing, and destination set |
| **Source** | Inbound webhook provider/type and its verification configuration |
| **Destination** | Outbound adapter configuration attached to a workflow |
| **Event** | An accepted inbound or synthetic event and its processing record |
| **Delivery** | A destination-specific attempt/result associated with an event |
| **Schedule** | A database-backed trigger that creates synthetic workflow events |
| **Workflow version** | Immutable configuration snapshot and restore/diff history |
| **API key** | Tenant-scoped programmatic credential with scopes |
| **Integration / BYOK key** | Tenant-provided provider credential, encrypted at rest and resolved for provider calls |
| **Quota** | Usage limit and enforcement mode for tenant resources |
| **DLQ** | Terminal/recovery state for deliveries that exhausted their retry policy |
| **Tunnel session** | Short-lived local-development capture/forwarding session |
| **Knowledge chunk** | Searchable documentation/knowledge record used by the AI assistant |

### 1.2 Product boundaries

Relayon is not merely a webhook receiver. The repository contains:
- A user-facing Angular application.
- A NestJS control-plane API.
- An Express webhook ingress service.
- NestJS background workers.
- PostgreSQL, MongoDB, and Redis integrations.
- Built-in and externally loaded destination adapters.
- AI assistant and retrieval/search capabilities.
- Billing, quota, provider integration, community, admin, and tracking modules.
- An official TypeScript SDK and local tunnel CLI.
- Docker and Vercel deployment assets.

Do not describe a capability as generally available solely because a module or route exists. Check feature flags, plan/quota gates, UI wiring, and deployment configuration.

---

## 2. Repository map

Repository root: [`https://github.com/zainshah3464/relayon`](https://github.com/zainshah3464/relayon)

### 2.1 Top-level layout

```text
relayon/
├── apps/
│   ├── api/                  # NestJS control plane
│   ├── dashboard/            # Angular UI
│   ├── ingress/              # Express webhook ingress
│   └── workers/              # Processing, schedules, outbound delivery
├── packages/
│   ├── cli/                  # @relayon/cli local tunnel utility
│   ├── db/                   # Prisma schema and migrations
│   └── sdk/                  # @relayon/sdk generated TypeScript client
├── docs/                     # Architecture, API, database, operations guides
├── scripts/                  # DB RLS, workflow sync, smoke checks
├── test/
│   ├── e2e/
│   ├── fixtures/
│   ├── integration/
│   ├── load/
│   ├── mocks/
│   └── setup/
├── docker/                   # Service Dockerfiles/configuration
├── .github/workflows/        # CI, test, workflow validation, keep-alive
├── docker-compose.yml
├── package.json
├── package-lock.json
├── README.md
├── DEPLOYMENT.md
└── LICENSE
```

This is a navigation map, not a promise that every file is listed. Inspect the tree before adding new directories.

### 2.2 Important root files

| Path | Why it matters |
|---|---|
| `package.json` | npm workspaces, root commands, Node engine |
| `package-lock.json` | Dependency lockfile; keep synchronized with package changes |
| `docker-compose.yml` | Local/container service topology and operational tick process |
| `DEPLOYMENT.md` | Deployment and environment setup |
| `LICENSE` | Binding project license; read before contribution/distribution questions |
| `LICENSE-MIT-LEGACY` | Historical license file; does not supersede current `LICENSE` |
| `.github/workflows/ci.yml` | Typecheck and build workflow |
| `.github/workflows/test.yml` | Unit, integration, RLS, and mutation jobs |
| `.github/workflows/workflow-validate.yml` | Workflow configuration validation |
| `scripts/relayon-sync.mjs` | Workflow pull, validate, and push utility |
| `scripts/apply-rls.mjs` | Applies database RLS SQL |
| `scripts/smoke-test.mjs` | Operational smoke checks |

---

## 3. Runtime topology and service ownership

The application has four main services. Keep their responsibilities separate.

### 3.1 Dashboard — `apps/dashboard`

**Runtime:** Angular 19, TypeScript, RxJS, Tailwind CSS, Transloco, Lucide Angular.

**Role:** User interface and control plane client. It calls the API; it must not access PostgreSQL, MongoDB, or Redis directly.

Main areas:
- Authentication: login, signup, OAuth callback, email verification, password reset.
- Dashboard overview and onboarding.
- Workflow list, workflow details, schedules, and version history.
- Events and delivery exploration.
- DLQ operations.
- Analytics and quota views.
- API keys and provider integrations.
- Billing/settings.
- AI chat and assistant widget.
- Playground and local tunnel UX.
- Community pages and announcements.
- Admin views for health, users, tenants, moderation, audit, feature flags, and time-travel tooling.
- PWA/network/update support.
- Locale and translation infrastructure.
- Shared dialogs, toasts, forms, icons, shell, and layout.

Useful paths:
- [`apps/dashboard/src/app/app.routes.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/dashboard/src/app/app.routes.ts)
- [`apps/dashboard/src/app/core`](https://github.com/zainshah3464/relayon/tree/main/apps/dashboard/src/app/core)
- [`apps/dashboard/src/app/features`](https://github.com/zainshah3464/relayon/tree/main/apps/dashboard/src/app/features)
- [`apps/dashboard/src/app/shared`](https://github.com/zainshah3464/relayon/tree/main/apps/dashboard/src/app/shared)
- [`apps/dashboard/package.json`](https://github.com/zainshah3464/relayon/blob/main/apps/dashboard/package.json)

**Dashboard conventions**
- Follow existing standalone-component and route conventions.
- Reuse core services for API, auth, tracking, integrations, and presence.
- Reuse shared UI primitives, especially confirmation dialogs and toast services.
- Keep API response types aligned with actual API contracts.
- Preserve route guards and authentication interceptors.
- Preserve responsive behavior, accessibility, keyboard behavior, and localization.
- Do not create a second parallel API/auth abstraction without a clear architectural reason.
- Do not treat the dashboard's `test` script as a real suite: its current package script is a placeholder that prints a message and exits successfully.

### 3.2 API — `apps/api`

**Runtime:** NestJS 11.

**Role:** Authenticated control plane and product API. It owns tenant-facing CRUD, access control, configuration, account operations, analytics, billing, and administrative endpoints.

The API is modular. The current module map includes:

| Module / area | Responsibility |
|---|---|
| `auth` | Signup, login, refresh/logout, password recovery, email verification, OAuth strategies |
| `tenants` | Tenant metadata and tenant-scoped operations |
| `workflows` | Workflow CRUD, export/import, versions, testing |
| `destinations` | Destination CRUD and validation |
| `events` | Event queries and lifecycle views |
| `dlq` | Failed-delivery inspection and replay operations |
| `analytics` | Usage and delivery analytics |
| `api-keys` | Scoped API key lifecycle |
| `schedules` | Workflow schedule management |
| `quota` | Usage counters, limits, enforcement, export |
| `billing` | Stripe billing and billing webhook handling |
| `ai` | AI chat agent, retrieval, knowledge ingestion, tool registry |
| `integrations` | BYOK provider keys, validation, provider-key resolution |
| `tracking` | Product/usage tracking |
| `presence` | User/session presence |
| `admin` | Super-admin functions, moderation, impersonation, social/admin tooling |
| `community` | Community content, posts, announcements/templates |
| `cron` | API-side scheduled/outbox maintenance endpoints |
| `webhooks` | Outbound webhook/event integration surfaces |
| `playground` | Playground capture/testing support |
| `tunnel` | Tunnel session lifecycle, captured webhook listing, streaming |
| `feature-flags` | Feature-flag evaluation and guards |
| `analytics`, `health`, `redis`, `mongo`, `prisma` | Supporting data/health modules |

Key files:
- [`apps/api/src/app.module.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/api/src/app.module.ts)
- [`apps/api/src/main.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/api/src/main.ts)
- [`apps/api/src/common/guards`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/common/guards)
- [`apps/api/src/modules`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules)
- [`apps/api/src/lib/crypto-box.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/api/src/lib/crypto-box.ts)
- [`apps/api/package.json`](https://github.com/zainshah3464/relayon/blob/main/apps/api/package.json)

**API conventions**
- Put domain logic in the relevant module/service; controllers should remain transport-focused.
- Use DTO validation for request bodies and query parameters.
- Apply the existing auth/tenant/scope guard model rather than duplicating checks.
- Use the tenant-aware Prisma access pattern where the module and table support it.
- Avoid cross-module imports that bypass module boundaries.
- Keep API error shapes consistent with existing filters and exception conventions.
- If adding or changing a route, update the OpenAPI source/spec, generated SDK contract, API docs, and integration tests as appropriate.
- Do not expose raw encrypted config or decrypted secrets in API responses.

### 3.3 Ingress — `apps/ingress`

**Runtime:** Express 5, TypeScript, ioredis, Prisma client, Zod.

**Role:** Public-facing webhook front door and capture endpoints. Keep this service focused on receiving, validating, and queueing events. Heavy AI and destination calls belong in Workers.

Main source paths:
- [`apps/ingress/src/app.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/ingress/src/app.ts)
- [`apps/ingress/src/routes`](https://github.com/zainshah3464/relayon/tree/main/apps/ingress/src/routes)
- [`apps/ingress/src/middleware`](https://github.com/zainshah3464/relayon/tree/main/apps/ingress/src/middleware)
- [`apps/ingress/src/services`](https://github.com/zainshah3464/relayon/tree/main/apps/ingress/src/services)
- [`apps/ingress/src/lib`](https://github.com/zainshah3464/relayon/tree/main/apps/ingress/src/lib)
- [`apps/ingress/package.json`](https://github.com/zainshah3464/relayon/blob/main/apps/ingress/package.json)

Current ingress route families include:
- `/health`
- `/play/...` — playground capture
- `/t/...` — CLI tunnel capture
- `/webhook/:tenantId/:workflowId` — configured webhook ingestion

The Express app captures the raw request body for signature verification, applies CORS configuration, and uses a bounded JSON body parser. The current source configures a 5 MB JSON limit; verify the local code before changing it.

**Webhook ingestion sequence (verify source before changing):**
1. Assign or propagate a correlation ID.
2. Resolve the tenant/workflow.
3. Verify the configured source signature.
4. Validate the JSON payload shape.
5. Enforce event quota and set quota headers.
6. Derive idempotency and tenant rate-limit keys.
7. Atomically perform idempotency check, rate-limit operation, and queue push through the Redis ingest helper.
8. Return an accepted/duplicate/rate-limited response.

Current queue key shared with Workers:
- `queue:events:incoming`

Current ingress response behavior in the inspected implementation:
- New accepted event: `202` with `status: "accepted"`.
- Duplicate idempotency key: `200` with `status: "duplicate"`.
- Rate limit exceeded: `429` with `Retry-After` and rate-limit headers.
- Quota rejection uses the quota error path and response behavior defined in the current code.

Do not split the atomic ingest operation into separate Redis calls without proving the resulting race behavior is safe.

### 3.4 Workers — `apps/workers`

**Runtime:** NestJS 11, Redis, Prisma, MongoDB/Mongoose, JSONata, Groq SDK, PostgreSQL/MongoDB destination clients.

**Role:** Asynchronous processing, enrichment, transformation, routing, schedules, dry-runs, and outbound delivery.

Main source paths:
- [`apps/workers/src/app.module.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/src/app.module.ts)
- [`apps/workers/src/modules/processing`](https://github.com/zainshah3464/relayon/tree/main/apps/workers/src/modules/processing)
- [`apps/workers/src/modules/egress`](https://github.com/zainshah3464/relayon/tree/main/apps/workers/src/modules/egress)
- [`apps/workers/src/modules/schedule`](https://github.com/zainshah3464/relayon/tree/main/apps/workers/src/modules/schedule)
- [`apps/workers/src/lib/queues.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/src/lib/queues.ts)
- [`apps/workers/package.json`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/package.json)

Workers currently owns three major execution domains:
- Processing: incoming events → enrichment/transform/routing → persisted event + delivery jobs.
- Egress: pending/delayed jobs → adapter execution → delivered/retry/DLQ state.
- Scheduling: due workflow schedules → synthetic event enqueue.

Keep worker handlers bounded by the configured batch size and time budget. If a task changes concurrency, recovery, or queue acknowledgements, inspect the full service and tests, not only the controller.

---

## 4. Event and delivery architecture

### 4.1 Queue contracts

The shared worker queue constants currently define:

| Constant | Redis key | Purpose |
|---|---|---|
| `INCOMING_QUEUE` | `queue:events:incoming` | Accepted inbound/synthetic events |
| `PROCESSING_QUEUE` | `queue:events:processing` | Events currently claimed for processing |
| `EGRESS_QUEUE` / `EGRESS_PENDING_QUEUE` | `queue:egress:pending` | Destination delivery jobs ready to run |
| `EGRESS_DELAYED_QUEUE` | `queue:egress:delayed` | Delayed retry jobs, represented as a sorted set |

Source: [`apps/workers/src/lib/queues.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/src/lib/queues.ts)

Do not rename queue keys or change serialized job shapes without coordinated changes to Ingress, Workers, recovery scripts, deployment schedules, and any operational tooling. Treat queue names and job interfaces as cross-service contracts.

### 4.2 Queued event contract

The current `QueuedEvent` shape includes:
- `correlationId`
- `tenantId`
- `workflowId`
- `sourceType`
- `receivedAt`
- `rawPayload`
- sanitized `headers`
- `ipHash`
- `userAgent`
- optional `idempotencyKey`

### 4.3 Egress job contract

The current `EgressJob` shape includes:
- `tenantId`
- `eventId`
- `correlationId`
- `destinationId`
- `destinationType`
- `destinationConfig`
- `payload`
- `attemptCount`
- `enqueuedAt`

Never trust a queued tenant or destination identifier blindly. Preserve the validation/ownership checks performed by the processing and delivery services.

### 4.4 Processing service behavior

The current processing service:
- Claims a bounded batch from the incoming queue.
- Collects distinct workflow IDs and loads workflow configuration with enabled destinations.
- Processes each event against its workflow.
- Requeues unprocessed batch items if the execution time budget is exceeded.
- Records processing failures and acknowledges handled queue entries.
- Optionally calls AI enrichment.
- Applies JSONata transformations when configured.
- Evaluates routing rules.
- Persists event/delivery records in MongoDB.
- Enqueues one egress job per selected destination.
- Exposes a pipeline test-run path that evaluates stages and can optionally dry-run destinations.

Source:
[`apps/workers/src/modules/processing/processing.service.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/src/modules/processing/processing.service.ts)

**Important:** Understand the queue's claim/ack/requeue semantics before changing error handling. A catch block that acknowledges a job after a partial side effect can create data-loss or duplicate behavior.

### 4.5 Egress service behavior

The current egress service:
- Recovers DB-pending deliveries (including replayed/manual work).
- Recovers deliveries stuck in `delivering` for longer than the configured recovery threshold.
- Processes pending queue items.
- Claims due delayed retry entries from the sorted set.
- Loads the adapter through the registry.
- Applies adapter timeout behavior.
- Uses retry policy helpers and circuit-breaker state.
- Updates delivery state and moves exhausted work to DLQ.
- Exposes delivery stats and replay operations.
- Provides destination dry-run execution.

Source:
[`apps/workers/src/modules/egress/egress.service.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/src/modules/egress/egress.service.ts)

Current source constants include a five-minute stuck-delivery threshold and a circuit-open delay; always inspect the implementation and tests before relying on exact values.

### 4.6 Delivery semantics — critical invariant

**The platform is at-least-once. It is not exactly-once.**

A worker may perform a destination side effect, then crash before its acknowledgement/state update is durably completed. A retry can therefore repeat the side effect.

Agents must:
- Preserve idempotency metadata where supported.
- Avoid promising exactly-once behavior.
- Make retries safe where possible.
- Distinguish an event's processing state from each destination delivery's state.
- Ensure replay creates the intended new attempt/correlation semantics.
- Test crashes/races around external side effects and acknowledgements.

### 4.7 Failure and recovery rules

When changing retries or DLQ:
- Preserve the per-destination retry policy and default behavior unless the task explicitly changes it.
- Validate retry attempt counting (off-by-one errors are high risk).
- Keep delayed queue scores consistent with the worker's due-time comparison.
- Ensure only one worker can claim a delayed entry at a time.
- Ensure stuck recovery does not resurrect already completed deliveries.
- Ensure DLQ replay validates tenant ownership and current status.
- Ensure event replay and delivery replay are not conflated.
- Consider expired/missing parent event documents.
- Preserve operational logging without exposing payload secrets.

Relevant tests:
- [`apps/workers/src/modules/egress/retry-policy.spec.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/src/modules/egress/retry-policy.spec.ts)
- [`apps/workers/src/modules/egress/circuit-breaker.service.spec.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/src/modules/egress/circuit-breaker.service.spec.ts)
- [`test/integration/dlq-flow.integration.spec.ts`](https://github.com/zainshah3464/relayon/blob/main/test/integration/dlq-flow.integration.spec.ts)

---

## 5. Ingress security and source verification

Supported source types in the current documented and codebase model include Stripe, GitHub, Shopify, Slack, and Generic HMAC. Verify the verifier registry and workflow DTO before adding or changing one.

Relevant source:
- [`apps/ingress/src/middleware/signature.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/ingress/src/middleware/signature.ts)
- [`apps/ingress/src/services/verifiers.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/ingress/src/services/verifiers.ts)
- [`apps/ingress/src/services/verifiers.spec.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/ingress/src/services/verifiers.spec.ts)
- [`apps/ingress/src/middleware/resolveWorkflow.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/ingress/src/middleware/resolveWorkflow.ts)
- [`apps/ingress/src/lib/redis-batch.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/ingress/src/lib/redis-batch.ts)

### Rules

- Verify signatures against the exact raw request bytes required by the provider.
- Do not parse and re-serialize JSON before computing a signature.
- Use timing-safe comparison after checking buffer lengths.
- Enforce timestamp tolerance where the provider's signature protocol requires it.
- Fail closed when a secret is missing, malformed, unavailable, or cannot be decrypted.
- Never allow a generic signature mode to silently bypass verification.
- Avoid trusting `X-Forwarded-For` or other client-controlled headers without the configured proxy trust model.
- Sanitize sensitive headers before persisting/logging request metadata.
- Keep body-size limits and JSON-object validation.
- Test valid, invalid, tampered, expired, malformed, and boundary timestamp cases.

---

## 6. Data layer and ownership

Relayon uses three data systems with distinct responsibilities.

### 6.1 PostgreSQL + Prisma

PostgreSQL stores relational/control-plane data, including tenant and user identity, workflow configuration, destination configuration, schedules, versions, API keys, billing/usage state, integrations, and other application records.

Package:
- [`packages/db`](https://github.com/zainshah3464/relayon/tree/main/packages/db)
- [`packages/db/prisma/schema.prisma`](https://github.com/zainshah3464/relayon/blob/main/packages/db/prisma/schema.prisma)
- [`packages/db/prisma/migrations`](https://github.com/zainshah3464/relayon/tree/main/packages/db/prisma/migrations)

### 6.2 MongoDB

MongoDB stores event and delivery documents used by the processing and operational read paths. Workers write event/delivery state; the API reads it through its Mongo module.

Inspect the schemas before changing fields:
- [`apps/workers/src/modules/mongo/schemas`](https://github.com/zainshah3464/relayon/tree/main/apps/workers/src/modules/mongo/schemas)
- [`apps/api/src/modules/mongo/schemas`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules/mongo/schemas)

The worker implementation currently defines 30-day event/delivery TTL constants. Verify actual Mongo indexes and schema configuration before changing retention behavior.

### 6.3 Redis

Redis is used for:
- Incoming and egress queues.
- Delayed retry sorted set.
- Idempotency keys.
- Rate-limit counters/windows.
- AI/provider caching and limiter state.
- Presence and tunnel streams.
- Other ephemeral coordination data.

Redis keys are cross-service contracts. Search the repository before renaming or reusing a key.

### 6.4 Ownership boundaries

Respect service ownership:
- API is the primary control-plane writer through Prisma.
- Workers own event processing and delivery writes in MongoDB.
- API reads event/delivery data for dashboard and operational APIs.
- Ingress resolves workflow metadata and writes accepted jobs to Redis.
- Do not introduce multiple independent writers for the same state without a consistency design.

There is no implicit cross-database foreign key between PostgreSQL and MongoDB. IDs such as `workflowId` in event documents are references by application convention. Handle deleted or expired related records defensively.

### 6.5 Prisma and migration workflow

- Prisma CLI/client are pinned to `6.19.3` in the root DB workspace.
- The root `postinstall` contains Prisma generation logic.
- Use the repository's DB scripts; do not casually invoke an unpinned `npx prisma`.
- For schema changes, update `schema.prisma`, create a migration, and test migration deployment against a clean DB and an upgraded DB.
- Never edit an already-applied production migration to change history.
- Review generated client impacts and any raw SQL that references changed columns.
- Review RLS SQL and tests when changing tenant-owned tables.

Commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:studio
npm run db:rls
```

Use `db:migrate` for local development migration creation; use `db:deploy` for applying committed migrations in deployment/CI. Do not run reset against data that matters.

### 6.6 Row-level security (RLS)

The repository includes:
- `packages/db/prisma/rls/policies.sql`
- `scripts/apply-rls.mjs`
- `test/integration/rls.integration.spec.ts`

RLS is not a universal property of every table merely because an RLS script exists. Inspect policy coverage and the exact table being changed. Application-level tenant checks remain mandatory. Never remove a `withTenant`/tenant-scoped access path on the assumption that RLS automatically covers the operation.

---

## 7. Tenant isolation and authorization

Tenant isolation is a system-wide invariant, not a controller-only concern.

### 7.1 Authentication mechanisms

Current repository areas include:
- JWT access authentication.
- Refresh-token lifecycle and rotation.
- API-key authentication using `X-API-Key`.
- OAuth strategies for GitHub and Google.
- Email verification.
- Password reset.
- Strong-password validation.
- Cron-secret protection for internal endpoints.
- Webhook source signature verification.

Source:
- [`apps/api/src/modules/auth`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules/auth)
- [`apps/api/src/common/guards`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/common/guards)

### 7.2 API key authorization

API keys are scoped credentials. The guard/decorator implementation is authoritative for:
- Supported key format.
- Prefix lookup.
- Hash/pepper behavior.
- Scope checks.
- Expiry/revocation behavior.
- Rotation grace behavior.
- JWT-vs-API-key route behavior.

Do not assume a JWT and an API key have identical privileges. Do not add a route to API-key access without deciding which scope is required.

Source:
- [`apps/api/src/modules/api-keys`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules/api-keys)
- [`apps/api/src/common/guards/jwt-or-api-key.guard.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/api/src/common/guards/jwt-or-api-key.guard.ts)

### 7.3 Tenant-scoped query checklist

For every new tenant-owned operation, verify:
- Tenant ID comes from authenticated context, not an untrusted body field.
- Resource lookup includes tenant ownership in the query predicate.
- Nested child resources are scoped through their parent.
- Mutations cannot change ownership by patching `tenantId`.
- Replay, export, import, stream, and bulk operations are scoped.
- Cache/Redis keys include the correct tenant/session identity where required.
- Error behavior does not leak whether another tenant's resource exists.
- Tests cover cross-tenant access denial.

### 7.4 Administrative paths

Admin and super-admin features may intentionally cross tenant boundaries. These must use their dedicated guards, audit/actor context, and narrowly scoped services. Never reuse a super-admin service for ordinary tenant requests or remove an admin guard to make a test pass.

Relevant code:
- [`apps/api/src/modules/admin`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules/admin)
- [`apps/api/src/modules/admin/super-admin.guard.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/api/src/modules/admin/super-admin.guard.ts)

---

## 8. Credential encryption and secret handling

Credential encryption is a critical subsystem.

Main implementation:
- [`apps/api/src/lib/crypto-box.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/api/src/lib/crypto-box.ts)
- Worker counterpart under [`apps/workers/src/lib`](https://github.com/zainshah3464/relayon/tree/main/apps/workers/src/lib)
- [Security guide](https://github.com/zainshah3464/relayon/blob/main/docs/SECURITY.md)

### 8.1 Required behavior

- Use the existing encryption/decryption helpers.
- Preserve authenticated encryption and tenant-bound key derivation.
- Preserve envelope/version compatibility unless a migration plan explicitly changes it.
- Keep key IDs/keyring semantics intact.
- Keep API responses redacted.
- Ensure the service that encrypts and the service that decrypts use compatible keyring configuration.
- Never use a tenant-supplied key identifier or envelope field as authority without validation.
- Fail closed on malformed envelopes, unknown key IDs, authentication-tag failures, or tenant mismatch.
- Never log plaintext secrets or decrypted config.

### 8.2 Changes that require extra review

Any change to these areas requires focused tests and security review:
- Cipher, nonce, authentication tag, or envelope format.
- HKDF inputs/context or tenant binding.
- Keyring parsing and active key selection.
- Legacy envelope fallback.
- Full-config encryption mode.
- Secret-field allowlists.
- API redaction behavior.
- Rotation scripts and rollback behavior.

### 8.3 Encryption is not universal data encryption

Do not claim all database contents are encrypted by the credential-encryption subsystem. Verify whether the specific field is encrypted. Event payloads and other operational records may have different storage behavior and retention controls.

---

## 9. Destination adapters and external adapter loading

### 9.1 Built-in adapters

The worker adapter registry currently contains built-in adapter implementations for the repository's supported destinations, including:
- HTTP
- Slack
- Email
- Google Sheets
- Discord
- Airtable
- Notion
- PostgreSQL
- MongoDB

Authoritative implementation:
[`apps/workers/src/modules/egress/adapters`](https://github.com/zainshah3464/relayon/tree/main/apps/workers/src/modules/egress/adapters)

Core contracts:
- `types.ts` — adapter input/output/context contracts.
- `plugin.decorator.ts` — adapter registration metadata.
- `registry.ts` — adapter registry.
- Individual `*.adapter.ts` — provider implementation.
- Individual `*.adapter.spec.ts` — adapter tests where present.
- `helpers.ts` — shared adapter helpers.

### 9.2 Adapter design requirements

A destination adapter must:
- Validate required configuration.
- Respect the common adapter contract.
- Return structured success/failure information.
- Distinguish retryable from non-retryable errors.
- Apply timeouts and avoid unbounded requests.
- Avoid logging credentials or sensitive response content.
- Handle provider rate limits and transient failures deliberately.
- Respect dry-run mode.
- Avoid unsafe URL, SQL, path, or query construction.
- Avoid unbounded response-body reads.
- Preserve correlation/event context where supported.
- Be registered through the existing registry mechanism.

### 9.3 Dry-run contract

A destination "test connection" or validation request must not create a real production side effect.

The egress service adds `__dryRun: true` to the adapter config for dry-run execution. Each adapter must honor the contract and use a safe provider-specific probe, or report that it cannot perform a live validation without sending a real message.

Examples of safe probe categories in the historical/current adapter design include:
- Connection/metadata checks.
- Authentication validation.
- Database `SELECT 1`/ping.
- HTTP HEAD where semantically supported.
- Schema/format-only validation when the provider has no safe read-only check.

Do not turn a probe into a real POST, message send, insert, update, page creation, or email send.

### 9.4 External adapter loader

External adapters are loaded from the configured external adapter directory and validated against a manifest schema.

Relevant code:
- [`adapter-loader.service.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/src/modules/egress/adapters/loader/adapter-loader.service.ts)
- [`manifest.schema.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/src/modules/egress/adapters/loader/manifest.schema.ts)
- [`sandbox-runner.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/src/modules/egress/adapters/loader/sandbox-runner.ts)
- [`types.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/src/modules/egress/adapters/loader/types.ts)

The inspected loader:
- Reads manifests and validates them with Zod.
- Resolves the entrypoint and rejects path traversal.
- Rejects duplicate adapter types.
- Runs adapter code in a Node `worker_threads` worker.
- Applies memory/resource limits and a bounded execution timeout.
- Provides a controlled HTTPS request bridge.
- Rejects external adapters declaring `trust: "trusted"`.

**Security boundary warning:** `worker_threads` plus resource limits and an HTTPS bridge is not equivalent to hardened OS/container isolation. Do not describe it as a perfect sandbox. Review the actual worker permissions, filesystem exposure, network bridge, and Node runtime behavior before making security claims.

---

## 10. AI, retrieval, and provider integrations

Relayon contains more than webhook enrichment. The API includes an AI assistant with tool calling and retrieval, plus tenant BYOK provider integrations.

### 10.1 Workflow enrichment

Worker processing can call the configured LLM provider for optional event enrichment. Inspect:
- [`apps/workers/src/modules/processing/groq.service.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/src/modules/processing/groq.service.ts)
- [`apps/workers/src/modules/processing/ai-rate-limiter.service.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/src/modules/processing/ai-rate-limiter.service.ts)
- [`apps/workers/src/modules/processing/processing.service.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/src/modules/processing/processing.service.ts)

When changing enrichment:
- Preserve the disabled/no-provider path.
- Handle provider timeouts, rate limits, and errors.
- Preserve tenant quota accounting.
- Do not let optional enrichment silently prevent the core pipeline from recovering.
- Avoid caching across tenants unless the cache key and data-sharing policy explicitly permit it.
- Do not log full user payloads or provider credentials.

### 10.2 AI assistant

API AI modules include:
- Chat controller/service.
- Tool registry and tool definitions.
- Workflow tools.
- Analytics tools.
- Documentation search tool.
- Knowledge ingestion and chunking.
- Retrieval service.

Relevant paths:
- [`apps/api/src/modules/ai`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules/ai)
- [`chat-agent.service.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/api/src/modules/ai/chat-agent.service.ts)
- [`rag.service.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/api/src/modules/ai/rag.service.ts)
- [`tools/registry.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/api/src/modules/ai/tools/registry.ts)

The current retrieval implementation uses a four-tier PostgreSQL full-text/keyword fallback strategy. It is not an embeddings/vector database implementation. Do not describe it as vector search unless the implementation is changed and verified.

The chat agent uses a bounded tool loop and a model fallback chain. Preserve iteration limits, provider retries, tenant context, and tool authorization. Tool arguments are untrusted input; validate them and ensure each tool scopes its database work to the authenticated tenant.

### 10.3 BYOK provider keys

Provider integration code:
- [`apps/api/src/modules/integrations`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules/integrations)
- [`provider-resolver.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/api/src/modules/integrations/provider-resolver.ts)
- [`provider-validators.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/api/src/modules/integrations/provider-validators.ts)

The current integration service validates provider keys, encrypts stored key material, redacts API responses, tracks validation/use metadata, and invalidates resolver cache on changes.

When changing provider resolution:
- Preserve tenant-over-platform resolution rules.
- Preserve disabled integration behavior.
- Do not return decrypted key material.
- Validate keys before persisting them where the current flow requires it.
- Handle missing platform keys and missing tenant keys explicitly.
- Keep model/provider allowlists synchronized with UI and API validation.
- Test cache invalidation after create/update/delete/toggle.

---

## 11. Quotas, usage, and billing

The API contains dedicated quota and billing modules.

Relevant paths:
- [`apps/api/src/modules/quota`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules/quota)
- [`apps/api/src/modules/billing`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules/billing)
- [`apps/api/src/modules/cron`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules/cron)
- [`test/integration/quota.integration.spec.ts`](https://github.com/zainshah3464/relayon/blob/main/test/integration/quota.integration.spec.ts)
- [`test/integration/billing-webhook.integration.spec.ts`](https://github.com/zainshah3464/relayon/blob/main/test/integration/billing-webhook.integration.spec.ts)

### Agent requirements

- Never bypass quota checks by calling a lower-level service directly.
- Understand whether the operation uses event quota, AI-token quota, or another usage counter.
- Preserve hard/soft mode semantics and warning/reset headers.
- Preserve atomicity of usage accounting.
- Avoid double-counting on webhook retries or processing replays.
- Verify how failed events and replayed events affect usage.
- Verify billing webhook signature verification and idempotency before changing Stripe handling.
- Keep plan/feature gates consistent across API and dashboard.
- Never trust plan names or quotas supplied by a client.

A quota change is a cross-cutting change: inspect ingress, worker AI limiter, API quota service, DB schema/migrations, UI, and integration tests.

---

## 12. Schedules and workflow versioning

### 12.1 Schedules

Schedule code:
- [`apps/workers/src/modules/schedule`](https://github.com/zainshah3464/relayon/tree/main/apps/workers/src/modules/schedule)
- [`apps/api/src/modules/schedules`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules/schedules)
- [`test/integration/schedules.integration.spec.ts`](https://github.com/zainshah3464/relayon/blob/main/test/integration/schedules.integration.spec.ts)

Schedules are database-backed and generate synthetic events that enter the normal processing pipeline.

When changing schedules:
- Preserve timezone-aware cron calculation.
- Validate cron syntax before persistence.
- Preserve atomic claiming across concurrent ticks.
- Keep `nextRunAt` consistent with the schedule's timezone and activation state.
- Ensure pause/resume does not cause an accidental fire storm.
- Keep run-now behavior separate from normal schedule advancement unless the product contract says otherwise.
- Validate tenant/workflow ownership.
- Test concurrent tick calls, timezone boundaries, daylight-saving transitions, paused schedules, and deleted workflows.

### 12.2 Workflow versions

Workflow versioning is part of configuration change management. Inspect:
- `apps/api/src/modules/workflows`
- `apps/api/src/modules/workflows/testing`
- The relevant Prisma models and migrations.
- `test/integration/version-restore.integration.spec.ts`

Preserve:
- Snapshot immutability.
- Version ordering and retention policy.
- Tenant ownership.
- Restore-as-a-new-version semantics where implemented.
- Destination/config handling and secret redaction.
- Diff behavior for nested/serialized configuration.
- Auditability of who initiated a change.

Do not mutate historical snapshots in place to implement restore.

---

## 13. Playground, tunnel, and developer tooling

### 13.1 Playground

The repository includes a playground flow for capturing/testing webhook payloads. Ingress exposes `/play` routes and API has a playground module. Inspect both sides before changing the feature.

Paths:
- [`apps/ingress/src/routes/play.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/ingress/src/routes/play.ts)
- [`apps/api/src/modules/playground`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules/playground)
- [`apps/dashboard/src/app/features/playground`](https://github.com/zainshah3464/relayon/tree/main/apps/dashboard/src/app/features/playground)

Do not confuse a playground/test-run operation with a production event delivery. Preserve its no-side-effect contract and bounded capture behavior.

### 13.2 Local tunnel

The tunnel path includes:
- API tunnel-session management.
- Ingress `/t` capture endpoint.
- Redis pub/sub streaming.
- Dashboard tunnel UI.
- CLI package for forwarding captured webhooks to localhost.

Paths:
- [`apps/api/src/modules/tunnel`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules/tunnel)
- [`apps/ingress/src/routes/tunnel.ts`](https://github.com/zainshah3464/relayon/blob/main/apps/ingress/src/routes/tunnel.ts)
- [`packages/cli`](https://github.com/zainshah3464/relayon/tree/main/packages/cli)
- [`packages/cli/README.md`](https://github.com/zainshah3464/relayon/blob/main/packages/cli/README.md)

The CLI package is `@relayon/cli` and exposes the `relayon` binary. Its implementation includes a listen command and forwarding/SSE client helpers.

When changing tunnel behavior:
- Authenticate session creation and management.
- Scope session access to the owning tenant.
- Validate ports and labels.
- Keep session expiry/heartbeat semantics consistent.
- Ensure stream subscriptions are cleaned up on disconnect.
- Avoid exposing captured payloads to other tenants.
- Validate local forwarding targets and error handling.
- Do not turn the tunnel into an unauthenticated general-purpose proxy.

### 13.3 TypeScript SDK

The SDK package is `@relayon/sdk`.

Paths:
- [`packages/sdk`](https://github.com/zainshah3464/relayon/tree/main/packages/sdk)
- [`packages/sdk/openapi.json`](https://github.com/zainshah3464/relayon/blob/main/packages/sdk/openapi.json)
- [`packages/sdk/scripts/sync-spec.mjs`](https://github.com/zainshah3464/relayon/blob/main/packages/sdk/scripts/sync-spec.mjs)
- [`packages/sdk/README.md`](https://github.com/zainshah3464/relayon/blob/main/packages/sdk/README.md)

The SDK is generated from OpenAPI. If API contracts change:
1. Update the authoritative API/OpenAPI source.
2. Run the spec sync/generation flow.
3. Review generated diffs.
4. Build and typecheck the SDK.
5. Update SDK docs/examples if public usage changes.

Do not hand-edit generated SDK output as the only source of truth.

---

## 14. API contract and documentation workflow

### 14.1 API reference

The API surface is split across Dashboard API, Ingress API, and internal Workers endpoints. The current API reference is:
[`docs/API_REFERENCE.md`](https://github.com/zainshah3464/relayon/blob/main/docs/API_REFERENCE.md)

Before adding/changing an endpoint:
- Find the controller and DTO.
- Find its guard and required scopes.
- Find the service method and data access path.
- Determine tenant ownership rules.
- Determine status codes and error shape.
- Determine pagination and limits.
- Determine whether the endpoint triggers external side effects.
- Update OpenAPI and generated SDK if applicable.
- Add integration/E2E coverage.
- Update docs and examples.

Never infer endpoint behavior from a route name alone.

### 14.2 Documentation links

Use these canonical repository paths for deeper reference. The local checkout may contain newer uncommitted versions; prefer those when available.

| Topic | Repository document |
|---|---|
| Architecture | [`docs/ARCHITECTURE.md`](https://github.com/zainshah3464/relayon/blob/main/docs/ARCHITECTURE.md) |
| API reference | [`docs/API_REFERENCE.md`](https://github.com/zainshah3464/relayon/blob/main/docs/API_REFERENCE.md) |
| Database | [`docs/DATABASE.md`](https://github.com/zainshah3464/relayon/blob/main/docs/DATABASE.md) |
| Security | [`docs/SECURITY.md`](https://github.com/zainshah3464/relayon/blob/main/docs/SECURITY.md) |
| Testing | [`docs/TESTING.md`](https://github.com/zainshah3464/relayon/blob/main/docs/TESTING.md) |
| Troubleshooting | [`docs/TROUBLESHOOTING.md`](https://github.com/zainshah3464/relayon/blob/main/docs/TROUBLESHOOTING.md) |
| Contributing | [`docs/CONTRIBUTING.md`](https://github.com/zainshah3464/relayon/blob/main/docs/CONTRIBUTING.md) |
| FAQ | [`docs/FAQ.md`](https://github.com/zainshah3464/relayon/blob/main/docs/FAQ.md) |
| Changelog | [`docs/CHANGELOG.md`](https://github.com/zainshah3464/relayon/blob/main/docs/CHANGELOG.md) |
| Roadmap | [`docs/ROADMAP.md`](https://github.com/zainshah3464/relayon/blob/main/docs/ROADMAP.md) |
| Deployment | [`DEPLOYMENT.md`](https://github.com/zainshah3464/relayon/blob/main/DEPLOYMENT.md) |
| Product guide | [`docs/relayon-guide.md`](https://github.com/zainshah3464/relayon/blob/main/docs/relayon-guide.md) |
| Workflow examples | [`docs/workflow-examples.md`](https://github.com/zainshah3464/relayon/blob/main/docs/workflow-examples.md) |
| Features inventory | [`docs/FEATURES.md`](https://github.com/zainshah3464/relayon/blob/main/docs/FEATURES.md) — add/retain this path when the local feature inventory is committed |
| Code of Conduct | [`docs/CODE_OF_CONDUCT.md`](https://github.com/zainshah3464/relayon/blob/main/docs/CODE_OF_CONDUCT.md) — add/retain this path when the local policy file is committed |

**Documentation freshness warning:** The public `main` branch may not yet contain the user's newer local v3.7.0 documentation edits. If a linked file is older than the implementation or local checkout, do not copy stale instructions. Inspect `git status`, local file contents, and source before editing.

### 14.3 Changelog discipline

- Record user-visible behavior changes.
- Mention migrations and new environment variables.
- State compatibility changes and deprecations.
- Distinguish shipped changes from planned work.
- Do not retroactively invent release dates or claim deployment without evidence.
- Do not use a package's internal `0.1.0` version as the product release version.

---

## 15. Environment configuration

Each service has an environment example. Inspect the actual example before adding a variable.

- [`apps/api/.env.example`](https://github.com/zainshah3464/relayon/blob/main/apps/api/.env.example)
- [`apps/ingress/.env.example`](https://github.com/zainshah3464/relayon/blob/main/apps/ingress/.env.example)
- [`apps/workers/.env.example`](https://github.com/zainshah3464/relayon/blob/main/apps/workers/.env.example)
- [`packages/db/.env.example`](https://github.com/zainshah3464/relayon/blob/main/packages/db/.env.example)

### 15.1 Environment variable rules

- Add a new variable to the correct service example and config validation.
- Document whether it is required, optional, secret, or environment-specific.
- Document format, default, and rotation implications.
- Ensure CI/test environments provide safe dummy values where needed.
- Ensure Docker and Vercel deployment docs are updated if the variable is required there.
- Do not place real secrets in `.env.example`.
- Do not assume a variable is shared across services unless the code requires it.
- Where encryption is shared between API and Workers, document and validate consistency.
- Avoid insecure development fallbacks in production paths.

### 15.2 Runtime versions and package management

- Root `package.json` declares Node `>=20.0.0`.
- CI workflows use Node 22.
- Use npm workspaces and the committed `package-lock.json`.
- Prefer `npm ci` for reproducible CI/install verification.
- Do not upgrade Angular, NestJS, Prisma, TypeScript, or major runtime dependencies casually; check compatibility across all workspaces and generated clients.

---

## 16. Local development

### 16.1 Install

```bash
git clone https://github.com/zainshah3464/relayon.git
cd relayon
npm ci
```

For a normal contributor working from a branch that changes dependencies, use `npm install` only when intentionally updating the lockfile.

### 16.2 Configure local environment

Copy the examples:

```bash
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example apps/api/.env.local
cp apps/ingress/.env.example apps/ingress/.env.local
cp apps/workers/.env.example apps/workers/.env.local
```

PowerShell equivalent:

```powershell
Copy-Item packages/db/.env.example packages/db/.env
Copy-Item apps/api/.env.example apps/api/.env.local
Copy-Item apps/ingress/.env.example apps/ingress/.env.local
Copy-Item apps/workers/.env.example apps/workers/.env.local
```

Populate PostgreSQL, MongoDB, Redis, auth, cron, encryption, provider, and service URL variables according to each example and the deployment guide.

### 16.3 Generate client and migrate

```bash
npm run db:generate
npm run db:deploy
```

### 16.4 Run services

Use separate terminals:

```bash
npm run dev:api
npm run dev:ingress
npm run dev:workers
npm run dev:dashboard
```

Default local ports in the current project layout:
- Dashboard: `4200`
- API: `3001`
- Ingress: `3002`
- Workers: `3003`

Verify actual config if a port or base URL is changed.

---

## 17. Commands and quality gates

Run from repository root unless a workspace-specific command is required.

### 17.1 Root scripts

| Command | Purpose |
|---|---|
| `npm run typecheck` | Run workspace typecheck scripts where present |
| `npm run lint` | Run workspace lint scripts where present |
| `npm run test` | Root Vitest unit suite |
| `npm run test:watch` | Vitest watch |
| `npm run test:ui` | Vitest UI |
| `npm run test:coverage` | Unit coverage |
| `npm run test:integration` | Integration suite |
| `npm run test:e2e` | Playwright E2E suite |
| `npm run test:e2e:full` | Full E2E directory |
| `npm run test:all` | Unit + integration + E2E sequence |
| `npm run test:mutation` | Stryker mutation testing |
| `npm run test:mutation:critical` | Mutation testing for selected critical paths |
| `npm run test:load` | Ingress load test |
| `npm run test:load:sustained` | Sustained load |
| `npm run test:load:burst` | Burst load |
| `npm run test:load:delivery` | Delivery throughput load test |
| `npm run smoke` | Operational smoke script |
| `npm run sdk:sync` | Sync SDK OpenAPI spec |
| `npm run sdk:generate` | Generate SDK client |
| `npm run sdk:build` | Build SDK |
| `npm run workflows:pull` | Pull workflow files |
| `npm run workflows:validate` | Validate workflow files |
| `npm run workflows:push` | Push workflow files |

### 17.2 Build commands

```bash
npm run build:dashboard
npm run build:api
npm run build:ingress
npm run build:workers
```

### 17.3 CI reality

Current CI is split across workflows:
- `ci.yml`: npm install, Prisma generation, SDK generation, typecheck, and four app builds.
- `test.yml`: unit tests with PostgreSQL/Redis/MongoDB services, integration tests, a separate RLS enforcement job, and a critical-path mutation job on pull requests. The mutation job is configured as continue-on-error.
- `workflow-validate.yml`: workflow validation.
- `keep-alive.yml`: scheduled keep-alive behavior.

Do not claim CI only runs typecheck/build; inspect all workflow files. Equally, do not claim every CI job is a required merge gate without checking repository branch protection settings.

### 17.4 Test inventory

The repository contains:
- Unit specs in application modules (for example auth, API keys, billing, DLQ, quota, adapters, retry, routing, transform, schedules, crypto).
- Integration specs for auth, API keys, billing webhook, DLQ flow, quotas, RLS, schedules, version restore, and webhook flow.
- E2E specs for auth flow, full pipeline, quota UI, and tenant isolation.
- k6 load scripts for ingress, sustained/burst ingress, and delivery throughput.

Dashboard's package-level `test` command is currently a placeholder, not a real dashboard test suite. Do not count it as meaningful coverage.

### 17.5 Minimum verification by change type

| Change | Minimum relevant verification |
|---|---|
| Pure utility | Unit tests + typecheck |
| API controller/DTO | Unit/integration test + typecheck/build |
| Tenant-scoped data access | Cross-tenant integration test + RLS test where relevant |
| Ingress/signature | Verifier tests + webhook integration test |
| Queue/worker | Processing/egress tests + integration flow + retry/recovery cases |
| Adapter | Adapter tests + dry-run tests + retry/error classification |
| Encryption | Crypto tests including tenant mismatch, malformed envelope, rotation/legacy compatibility |
| Prisma schema | Generate + migration deploy on clean/upgraded DB + integration |
| API contract | OpenAPI sync/generation + SDK build/typecheck + API tests |
| Dashboard | Dashboard typecheck/build + manual/automated UI verification |
| Billing/quota | Integration tests for duplicate webhooks, limits, race conditions, and reset behavior |
| Schedule | Timezone, concurrent tick, pause/resume, run-now, and integration tests |
| External adapter loader | Manifest/path traversal, timeout, resource, HTTPS bridge, failure, and trust-mode tests |

---

## 18. CI, Docker, and deployment

### 18.1 Deployment model

The repository supports multiple deployment approaches, including independent service deployment and Docker/container assets. Do not assume all services share one runtime or one environment.

Inspect:
- [`DEPLOYMENT.md`](https://github.com/zainshah3464/relayon/blob/main/DEPLOYMENT.md)
- [`docker-compose.yml`](https://github.com/zainshah3464/relayon/blob/main/docker-compose.yml)
- [`docker`](https://github.com/zainshah3464/relayon/tree/main/docker)
- [CI workflow](https://github.com/zainshah3464/relayon/blob/main/.github/workflows/ci.yml)
- [Test workflow](https://github.com/zainshah3464/relayon/blob/main/.github/workflows/test.yml)

### 18.2 Worker tick endpoints

Current worker controller/service responsibilities include:
- Processing incoming events.
- Delivering pending and delayed jobs.
- Schedule ticking.
- Schedule run-now.
- Destination dry-run.
- Health reporting.

Known route families from the architecture and current worker modules include `/internal/process`, `/internal/deliver`, `/internal/schedule/tick`, `/internal/schedule/run-now`, and `/internal/egress/dry-run`. Verify controller route decorators and deployment cron configuration before changing URLs.

The API also has cron/outbox-related responsibilities. Do not assume all cron jobs target Workers.

### 18.3 Deployment safety

Before deploying a change:
- Confirm which service(s) changed.
- Confirm required environment variables are set in every consuming service.
- Apply DB migrations in the correct order.
- Confirm worker/API compatibility during rollout.
- Confirm queue payload compatibility with already-enqueued jobs.
- Confirm scheduled tick configuration.
- Verify health endpoints and a representative end-to-end flow.
- Monitor error rates, queue depth, retry growth, and DLQ.
- Have a rollback plan for schema and config changes.

Never run production migrations or change production secrets unless explicitly authorized.

---

## 19. UI/UX and accessibility expectations

The dashboard is a user-facing operational control plane. A visually polished change that makes destructive operations ambiguous is not acceptable.

- Use shared design tokens and existing UI components.
- Use the shared confirmation dialog for destructive/irreversible actions.
- Use toast notifications for operation feedback.
- Show loading, empty, success, and error states.
- Do not rely on color alone to communicate status.
- Preserve keyboard navigation and visible focus.
- Use semantic labels and accessible dialog behavior.
- Keep responsive behavior intact.
- Keep forms validated and error messages actionable.
- Avoid silent mutation or optimistic UI that cannot be reconciled after API failure.
- Ensure user-facing strings use the existing localization approach.
- Preserve auth/session-expiry behavior.
- Never display raw secrets after creation; keep one-time-secret UX explicit.

Relevant shared UI:
- [`apps/dashboard/src/app/shared/ui`](https://github.com/zainshah3464/relayon/tree/main/apps/dashboard/src/app/shared/ui)
- [`apps/dashboard/src/app/core`](https://github.com/zainshah3464/relayon/tree/main/apps/dashboard/src/app/core)

---

## 20. Logging, observability, and operational diagnostics

The repository includes service-level logging, health endpoints, Sentry integration, and tracing instrumentation.

When adding logs:
- Prefer structured fields over interpolated payload dumps.
- Include correlation IDs where available.
- Include tenant/resource IDs only when safe and useful.
- Do not log credentials, authorization headers, cookies, raw API keys, encryption keys, or full sensitive payloads.
- Avoid high-cardinality metrics/labels.
- Keep expected duplicate/rate-limit behavior at an appropriate log level.
- Do not swallow errors without recording enough context to diagnose them.

When changing health checks, distinguish:
- Process liveness.
- Dependency readiness.
- Worker/queue operational status.

A healthy HTTP process does not necessarily mean the event pipeline is delivering.

---

## 21. Feature flags and product gates

The API includes feature flag infrastructure and an admin management path.

Relevant paths:
- [`apps/api/src/common/feature-flags`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/common/feature-flags)
- [`apps/api/src/modules/admin/feature-flags`](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules/admin/feature-flags)

When adding a gated feature:
- Determine whether the gate is global, tenant-scoped, plan-scoped, or role-scoped.
- Enforce the gate server-side; UI hiding is not authorization.
- Define behavior when the flag is absent or unavailable.
- Keep admin mutation access restricted.
- Add tests for enabled, disabled, and unauthorized cases.
- Document rollout and rollback behavior.

Do not bypass a feature gate by calling a service directly from an unguarded controller.

---

## 22. Community, admin, and user-facing platform modules

The API contains community, admin, moderation, impersonation, social, announcements, presence, and tracking modules. These are not part of the core webhook delivery pipeline, but they are part of the product.

Before modifying them:
- Inspect the controller, service, DTO, guard, schema, migration, and dashboard consumer.
- Preserve user/tenant boundaries.
- Treat moderation and impersonation as privileged operations.
- Keep actor identity and audit context.
- Validate all user-generated content.
- Apply rate limits to public or user-generated operations.
- Avoid leaking private tenant/user metadata through community endpoints.
- Ensure presence subscriptions are cleaned up.
- Ensure tracking data is minimized and does not contain secrets.

Do not assume the admin module's permissions are equivalent to ordinary tenant owner permissions.

---

## 23. Coding standards and implementation patterns

Follow the conventions already used in the relevant workspace. Do not impose a new framework or architecture on a single feature.

### 23.1 TypeScript

- Keep strict types; avoid `any` unless required at an external boundary and narrowed immediately.
- Use explicit DTOs for transport input.
- Validate untrusted JSON and environment values.
- Prefer small domain services with clear ownership.
- Avoid circular dependencies between Nest modules.
- Keep async failures explicit.
- Use `Promise.all` only when operations are independent and concurrency is bounded.
- Avoid fire-and-forget writes unless failure semantics are deliberate and observable.
- Do not use `eval`, `new Function`, or ad hoc dynamic execution.

### 23.2 NestJS API and Workers

- Keep controllers thin.
- Put business logic in injectable services.
- Use modules to define dependency boundaries.
- Use guards for authentication/authorization.
- Use DTOs and validation decorators for input.
- Reuse Prisma/Mongo/Redis modules instead of creating unmanaged clients.
- Ensure lifecycle hooks clean up subscriptions/connections where necessary.
- Protect internal endpoints with the existing cron/internal guard model.

### 23.3 Express Ingress

- Preserve middleware ordering.
- Capture raw body before signature validation.
- Keep public ingress fast and bounded.
- Use existing config validation and logger.
- Avoid adding heavyweight dependencies to the ingress path.
- Keep Redis atomic operations atomic.
- Sanitize headers and errors before logging/responding.

### 23.4 Angular

- Follow existing standalone component and routing patterns.
- Use injected services for API and shared state.
- Keep components focused.
- Preserve translation keys and locale behavior.
- Reuse shared UI primitives.
- Clean up subscriptions/streams and avoid duplicate polling.
- Do not place privileged business logic only in the client.

### 23.5 Database

- Use Prisma for relational data access in the established pattern.
- Use Mongoose for event/delivery documents in the established pattern.
- Use parameterized SQL; avoid concatenating untrusted values into raw SQL.
- Add indexes for new high-volume query patterns.
- Consider retention/TTL and query cost.
- Preserve transaction boundaries and tenant context.

---

## 24. Common high-risk mistakes

Do not:

- Claim exactly-once delivery.
- Treat a successful ingress `202` as proof that a destination has delivered.
- Perform a real destination write from a dry-run path.
- Remove signature verification to make local testing easier.
- Trust client-provided tenant IDs for authorization.
- Query a resource by ID without tenant ownership where applicable.
- Return ciphertext or plaintext secrets in API responses.
- Change encryption envelope behavior without compatibility tests.
- Rotate `API_KEY_PEPPER` casually; it affects verification of existing keys.
- Change Redis queue names or job shape in one service only.
- Acknowledge queue items after losing their work state.
- Make retry policy unbounded.
- Requeue DLQ work without checking parent event/tenant/status.
- Change cron schedule claiming without concurrency tests.
- Treat RLS as universal.
- Describe worker_threads as hardened OS/container isolation.
- Describe PostgreSQL full-text retrieval as vector/embedding search.
- Assume dashboard tests exist because an npm script exits zero.
- Assume old v1.5 docs describe the v3.7 implementation.
- Assume `main` already contains uncommitted local docs.
- Claim a deployment, test run, migration, release, or GitHub write happened when it did not.
- Change `LICENSE` or contribution ownership language without explicit legal/product direction.

---

## 25. Recommended task workflows

### 25.1 Bug fix

1. Reproduce the bug.
2. Find the route/controller or ingress/worker entry point.
3. Trace the call path to the service and data layer.
4. Identify the invariant being violated.
5. Add a regression test that fails before the fix.
6. Implement the smallest correct change.
7. Run targeted tests, typecheck, and relevant build.
8. Review logs/errors for secret leakage.
9. Update troubleshooting docs if the issue is operationally recurring.

### 25.2 New API endpoint

1. Define the endpoint's user and machine use cases.
2. Choose the correct API module.
3. Define DTOs and validation.
4. Add the controller route.
5. Apply auth, role, tenant, feature, quota, and API-key scope rules.
6. Implement service behavior.
7. Add DB migration/index if needed.
8. Add integration tests, including cross-tenant denial.
9. Update OpenAPI and regenerate SDK.
10. Update API reference and changelog.

### 25.3 New destination adapter

1. Read `adapters/types.ts`, `registry.ts`, and a similar built-in adapter.
2. Define the config schema and safe secret fields.
3. Implement the adapter with bounded HTTP/DB calls.
4. Classify retryable and terminal failures.
5. Implement a genuinely safe dry-run probe.
6. Register the adapter.
7. Add adapter tests for success, invalid config, auth failure, rate limit, timeout, malformed response, and dry-run no-side-effect.
8. Update destination validation metadata/UI.
9. Update API docs, feature inventory, and examples.

### 25.4 Schema change

1. Identify every reader/writer of the model/column.
2. Update Prisma schema.
3. Create a forward migration.
4. Update raw SQL, RLS policy, indexes, and test fixtures.
5. Regenerate Prisma client.
6. Test clean install and upgrade path.
7. Add tenant-isolation and rollback considerations.
8. Update database docs and deployment instructions.

### 25.5 Queue/worker change

1. Identify producer and consumer.
2. Inspect queue key and serialized job type.
3. Identify claim, ack, retry, recovery, and DLQ behavior.
4. Define behavior for old jobs already in Redis.
5. Add concurrency and crash-recovery tests.
6. Verify idempotency and duplicate side effects.
7. Update operational schedules and metrics if needed.

### 25.6 UI change

1. Identify route and feature component.
2. Find existing core service and API contract.
3. Reuse shared components and design tokens.
4. Add loading/empty/error/success states.
5. Preserve accessibility and responsive behavior.
6. Add/adjust translation strings.
7. Verify auth/role/feature gating.
8. Run dashboard typecheck/build and browser checks.

### 25.7 Security-sensitive change

1. State the threat and trust boundary.
2. Identify assets and attacker-controlled inputs.
3. Inspect all callers and all storage/serialization paths.
4. Define fail-closed behavior.
5. Add negative and adversarial tests.
6. Review logs, API responses, cache keys, and error messages.
7. Update `docs/SECURITY.md`.
8. Request human review for encryption/auth/tenant-isolation changes.

---

## 26. Release/version and licensing rules

- The documentation target for this guide is v3.7.0.
- The SDK and CLI packages declare version `3.7.0` in the audited source snapshot.
- The root monorepo package declares its own private package version; do not infer the product release from that field.
- Verify the release tag, changelog, and source commit before stating what shipped.
- The active license is the Relayon Proprietary Source-Visible License v1.0 in root `LICENSE`.
- `LICENSE-MIT-LEGACY` is historical and does not make the current project MIT-licensed.
- Contribution terms and any copyright assignment are governed by the current license and contribution guide.
- Do not promise unrestricted redistribution, sublicensing, resale, or derivative-work rights.

Source:
- [`LICENSE`](https://github.com/zainshah3464/relayon/blob/main/LICENSE)
- [`LICENSE-MIT-LEGACY`](https://github.com/zainshah3464/relayon/blob/main/LICENSE-MIT-LEGACY)
- [`packages/sdk/package.json`](https://github.com/zainshah3464/relayon/blob/main/packages/sdk/package.json)
- [`packages/cli/package.json`](https://github.com/zainshah3464/relayon/blob/main/packages/cli/package.json)

---

## 27. Final pre-merge checklist

### Code and architecture
- [ ] Change is in the correct service/module.
- [ ] Existing service boundaries are preserved.
- [ ] No unrelated refactor or generated churn.
- [ ] Types and validation are correct.
- [ ] No unsafe dynamic execution or unbounded operation.

### Security and tenancy
- [ ] Auth and scopes are correct.
- [ ] Tenant ownership is checked on reads and writes.
- [ ] Secrets are not logged or returned.
- [ ] Internal endpoints remain protected.
- [ ] RLS assumptions are verified, not guessed.
- [ ] Dry-run has no real side effects.

### Data and reliability
- [ ] Migration and indexes are included where needed.
- [ ] Queue payload compatibility is considered.
- [ ] Retry and idempotency semantics are preserved.
- [ ] Recovery and DLQ paths are tested.
- [ ] External side effects are bounded and classified.

### Verification
- [ ] Relevant unit tests pass.
- [ ] Relevant integration/E2E tests pass.
- [ ] Typecheck passes.
- [ ] Relevant build passes.
- [ ] SDK/OpenAPI generation is current if API changed.
- [ ] No test is falsely reported as run.

### Documentation and delivery
- [ ] API/architecture/security/database/deployment docs updated as relevant.
- [ ] Changelog updated when appropriate.
- [ ] New environment variables are documented.
- [ ] Rollout and rollback notes are included.
- [ ] User changes are preserved.
- [ ] No commit/push/deploy was performed without authorization.

---

## 28. Fast links for agents

### Repository and top-level docs
- [Repository](https://github.com/zainshah3464/relayon)
- [README](https://github.com/zainshah3464/relayon/blob/main/README.md)
- [Architecture](https://github.com/zainshah3464/relayon/blob/main/docs/ARCHITECTURE.md)
- [API reference](https://github.com/zainshah3464/relayon/blob/main/docs/API_REFERENCE.md)
- [Database](https://github.com/zainshah3464/relayon/blob/main/docs/DATABASE.md)
- [Security](https://github.com/zainshah3464/relayon/blob/main/docs/SECURITY.md)
- [Testing](https://github.com/zainshah3464/relayon/blob/main/docs/TESTING.md)
- [Troubleshooting](https://github.com/zainshah3464/relayon/blob/main/docs/TROUBLESHOOTING.md)
- [Deployment](https://github.com/zainshah3464/relayon/blob/main/DEPLOYMENT.md)
- [Workflow examples](https://github.com/zainshah3464/relayon/blob/main/docs/workflow-examples.md)
- [Product guide](https://github.com/zainshah3464/relayon/blob/main/docs/relayon-guide.md)
- [License](https://github.com/zainshah3464/relayon/blob/main/LICENSE)

### Source hotspots
- [API modules](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/modules)
- [API guards](https://github.com/zainshah3464/relayon/tree/main/apps/api/src/common/guards)
- [Ingress routes](https://github.com/zainshah3464/relayon/tree/main/apps/ingress/src/routes)
- [Ingress middleware](https://github.com/zainshah3464/relayon/tree/main/apps/ingress/src/middleware)
- [Worker processing](https://github.com/zainshah3464/relayon/tree/main/apps/workers/src/modules/processing)
- [Worker egress/adapters](https://github.com/zainshah3464/relayon/tree/main/apps/workers/src/modules/egress)
- [Worker schedules](https://github.com/zainshah3464/relayon/tree/main/apps/workers/src/modules/schedule)
- [Prisma schema](https://github.com/zainshah3464/relayon/blob/main/packages/db/prisma/schema.prisma)
- [Migrations](https://github.com/zainshah3464/relayon/tree/main/packages/db/prisma/migrations)
- [SDK](https://github.com/zainshah3464/relayon/tree/main/packages/sdk)
- [CLI](https://github.com/zainshah3464/relayon/tree/main/packages/cli)
- [Integration tests](https://github.com/zainshah3464/relayon/tree/main/test/integration)
- [E2E tests](https://github.com/zainshah3464/relayon/tree/main/test/e2e)
- [CI workflow](https://github.com/zainshah3464/relayon/blob/main/.github/workflows/ci.yml)
- [Test workflow](https://github.com/zainshah3464/relayon/blob/main/.github/workflows/test.yml)

---

<div align="center">

**End of Relayon Agent Guide**

*Read the code. Preserve the contracts. Verify the behavior. Never guess.*

</div>
