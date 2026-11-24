# Relayon — Troubleshooting

> **Operational troubleshooting for local development, Vercel deployments, and self-hosted Docker Compose environments.**
>
> **Current version:** v3.7.0
>
> **Repository snapshot used for this update:** `main` at `f4dd930eafd2ab61381bc1c049bb6cdbb7480235` (24 November 2026).
>
> This guide combines historical v1.x failure patterns that may still occur with troubleshooting for the v2.x–v3.7 platform surface. A historical incident is not proof that the same defect exists in v3.7.0. Confirm the current code, deployment topology, logs, and live OpenAPI contract before applying a code-level workaround.

---

## Table of contents

- [How to troubleshoot safely](#how-to-troubleshoot-safely)
- [System map and first checks](#system-map-and-first-checks)
- [Local development and workspace](#local-development-and-workspace)
- [Dashboard and browser](#dashboard-and-browser)
- [API, ingress, and workers](#api-ingress-and-workers)
- [Database and Prisma](#database-and-prisma)
- [Redis, queues, and event processing](#redis-queues-and-event-processing)
- [Delivery, retries, circuit breaker, and DLQ](#delivery-retries-circuit-breaker-and-dlq)
- [Destination adapters and validation](#destination-adapters-and-validation)
- [Authentication, sessions, and API keys](#authentication-sessions-and-api-keys)
- [Encryption and key rotation](#encryption-and-key-rotation)
- [Schedules and background automation](#schedules-and-background-automation)
- [AI assistant, enrichment, RAG, and BYOK](#ai-assistant-enrichment-rag-and-byok)
- [Outbound webhooks and transactional outbox](#outbound-webhooks-and-transactional-outbox)
- [Vercel deployment](#vercel-deployment)
- [Docker Compose and self-hosting](#docker-compose-and-self-hosting)
- [SDK, CLI tunnel, and workflow YAML](#sdk-cli-tunnel-and-workflow-yaml)
- [Performance and observability](#performance-and-observability)
- [Security and tenant-isolation checks](#security-and-tenant-isolation-checks)
- [Diagnostics and incident checklist](#diagnostics-and-incident-checklist)
- [Escalation and bug reports](#escalation-and-bug-reports)

---

## How to troubleshoot safely

Use this sequence. It avoids changing production state before the failure is understood.

1. **Identify the failing boundary:** Dashboard, API, Ingress, Workers, PostgreSQL, MongoDB, Redis, AI provider, destination provider, scheduler, or deployment platform.
2. **Record the exact failure:** HTTP status, response body, timestamp with timezone, correlation ID, affected tenant/workflow/destination IDs (redact them in public reports), and the deployment commit.
3. **Check service health and dependencies:** A healthy frontend does not prove the API, worker queues, or data stores are healthy.
4. **Compare runtime configuration:** Check variable names, presence, whitespace, URL scheme, and whether secrets are consistent across services. Never paste secret values into an issue or chat.
5. **Inspect the relevant logs and durable state:** API/Ingress/Workers logs, PostgreSQL rows, Mongo event/delivery records, Redis queue state, and provider response.
6. **Make the smallest reversible change:** Avoid clearing queues, deleting keys, changing encryption material, editing applied migrations, or replaying a large DLQ batch as a first step.
7. **Verify recovery end to end:** Health alone is insufficient. Send a controlled test event and confirm it is accepted, processed, delivered, and visible in the expected records.

### Important operating rules

- Do not run `prisma migrate dev` against production. Use the repository's production migration path (`npm run db:deploy`) after reviewing and backing up.
- Never edit a migration that has already been applied to a shared environment. Add a new migration.
- Do not rotate `API_KEY_PEPPER`, JWT secrets, or connector-encryption keys as a debugging experiment.
- Do not delete Redis keys or queue data unless you know exactly what the key represents and have an approved recovery plan.
- Do not use `0.0.0.0/0` as a permanent database firewall rule. Prefer the narrowest network access supported by the hosting provider.
- A successful dry-run/connection check is not proof that a real destination write will succeed.
- A `processed` event does not imply every destination delivery succeeded. Event processing and delivery states are separate.
- Never assume Vercel functions are continuously running. The serverless topology depends on scheduled invocations.
- Treat examples containing `YOUR_*`, `<secret>`, or sample tokens as placeholders. Replace them safely; do not send literal angle-bracket placeholders in Windows CMD.

---

## System map and first checks

Relayon v3.7.0 is organized as four applications with shared packages and three primary data stores.

| Component | Responsibility | Local address | Production health endpoint |
|---|---|---|---|
| Dashboard | Angular user interface | `http://localhost:4200` | `https://relayon.vercel.app` |
| API | NestJS control plane: auth, tenants, workflows, settings, admin, AI and product APIs | `http://localhost:3001/api` | `https://relayon-api.vercel.app/api/health` |
| Ingress | Express public webhook receiver, playground and tunnel capture | `http://localhost:3002` | `https://relayon-ingress.vercel.app/health` |
| Workers | NestJS event processing, enrichment, routing, egress, retry and scheduling | `http://localhost:3003/internal` | `https://relayon-workers.vercel.app/internal/health` |
| PostgreSQL | Relational source of truth for tenants, users, workflows, destinations, schedules, API keys, integrations and outbox records | configured by `DATABASE_URL` | provider-specific |
| MongoDB | Event and delivery documents | configured by `MONGODB_URI` | provider-specific |
| Redis | Queues, idempotency, rate limits, cache and coordination | configured by Redis URL | provider-specific |

### Quick health checks

```bash
curl -i https://relayon-api.vercel.app/api/health
curl -i https://relayon-ingress.vercel.app/health
```

Workers health is protected in the deployed configuration; include the cron header when required:

```bash
curl -i https://relayon-workers.vercel.app/internal/health \
  -H "X-Cron-Secret: YOUR_CRON_SECRET"
```

For local services:

```bash
curl -i http://localhost:3001/api/health
curl -i http://localhost:3002/health
curl -i http://localhost:3003/internal/health \
  -H "X-Cron-Secret: YOUR_LOCAL_CRON_SECRET"
```

If an endpoint returns `404`, first confirm the base URL and route prefix. The API, Ingress, and Workers are separate network surfaces; `/api/...`, public ingress paths, and `/internal/...` are not interchangeable.

### Find the failing layer

| Symptom | Start with |
|---|---|
| Dashboard cannot sign in or load data | Browser network tab, API health, CORS, API logs |
| Source webhook gets `4xx` | Ingress route, workflow identifiers, signature, request size, quota/rate limit |
| Source webhook gets `5xx` or times out | Ingress logs, PostgreSQL/Redis connectivity, queue enqueue operation |
| Event accepted but not processed | Redis ingest queue, worker invocation/cron, worker logs |
| Event processed but destination not delivered | Mongo delivery record, egress queue, adapter config, provider response |
| Scheduled workflow does not run | PostgreSQL schedule state, timezone/next-run, worker schedule tick and cron |
| Dashboard/API works but AI fails | Provider resolution, BYOK key status, model, rate limits and provider response |
| Customer webhook notification is delayed | PostgreSQL outbox rows, API outbox poller/tick and endpoint response |

---

## Local development and workspace

### `npm ci` fails or workspace packages cannot resolve

**Likely causes**

- Node/npm version differs from the repository's expected toolchain.
- The lockfile and `package.json` have drifted.
- Install was run from an app subdirectory instead of the monorepo root.
- A prior partial install left an inconsistent `node_modules`.

**Checks and recovery**

```bash
node --version
npm --version
git status --short
```

The current CI workflow uses Node 22. The root package engine permits Node `>=20`; use the CI version when reproducing CI behavior.

Run install from the repository root:

```bash
npm ci
```

If the lockfile is genuinely out of sync, do not delete it casually in a production branch. Reconcile dependency changes intentionally, regenerate the lockfile with the agreed Node/npm toolchain, and commit the lockfile change.

### A root script works on one machine but not another

**Cause:** Workspace scripts, environment files, and local service dependencies are not necessarily identical on every machine.

**Fix**

1. Run commands from the repository root unless the script explicitly says otherwise.
2. Inspect the script in root `package.json`; do not guess script names.
3. Confirm the required `.env` file is in the expected app/package location.
4. Confirm PostgreSQL, MongoDB and Redis are reachable from the process that is failing.

The repository's intended local startup uses separate terminals:

```bash
npm run dev:api
npm run dev:ingress
npm run dev:workers
npm run dev:dashboard
```

### `npm run dev:dashboard` reports Angular template/compiler errors

**Cause:** A template syntax error, invalid Angular binding, missing import, or incompatible dependency state.

**Fix**

- Read the first Angular compiler error; later errors may be cascading.
- Check the component template and its standalone `imports`.
- Do not put Tailwind modifier syntax such as `/20`, `hover:` or `md:` into an Angular class-property name. Use a static class in an Angular control-flow branch or a supported class binding.
- Run the dashboard build after the fix:

```bash
npm run build:dashboard
```

Historical v1.x example: an unclosed `<span>` caused by `[class.bg-rose/20]` was fixed by using `@if` and a normal `class="bg-rose/20"` element. This is a useful pattern, not evidence that the current source contains that exact defect.

### Angular development server appears stuck after HMR startup

**Likely cause:** Cold build/cache, memory pressure, or another Node process holding a file.

**Fix**

1. Wait for the first compile and inspect CPU/memory before assuming it is hung.
2. Stop the dashboard process cleanly.
3. If the Angular cache is suspected to be corrupt, remove only the dashboard cache:

```powershell
Remove-Item -Recurse -Force apps/dashboard/.angular/cache
npm run dev:dashboard
```

Do not kill every Node process on a machine that may be running unrelated development services.

### Windows: Prisma `EPERM` while replacing a query-engine DLL

**Symptom**

```text
EPERM: operation not permitted, rename
...query_engine-windows.dll.node.tmp...
```

**Cause:** A process has loaded the Prisma query-engine DLL, so Windows prevents Prisma from replacing it.

**Fix**

1. Stop Relayon API, Ingress, Workers, Prisma Studio, and any test process using `@prisma/client`.
2. Close or restart tools that may hold the file (including editor extensions) if necessary.
3. Inspect remaining Node processes:

```cmd
tasklist | findstr /i node
```

4. Remove only stale temporary files after confirming no process is using the client.
5. Regenerate:

```bash
npm run db:generate
```

**Prevention:** Stop app/test processes before regenerating Prisma Client or reinstalling workspace dependencies.

---

## Dashboard and browser

### Dashboard loads but API requests fail

Check the browser Network panel:

- Request URL: is it pointing to the intended API environment?
- Status: `401`, `403`, `404`, `429`, `5xx`, or browser CORS error?
- Response body: capture the exact server message.
- Request headers: confirm auth is attached without exposing the token in screenshots.
- Origin: compare it with the API's configured CORS allow-list.

**Common causes**

- Incorrect API base URL in the dashboard build/runtime configuration.
- API deployment is unavailable or points to a different environment.
- Browser origin is not allowed by CORS.
- Session cookie/token expired or refresh flow failed.
- Reverse proxy routes `/api` to the wrong upstream in self-hosted deployments.

### Login succeeds but dashboard immediately returns to sign-in

Check:

1. API login response and browser storage/cookie behavior.
2. Whether refresh requests are sent to the correct API origin.
3. Whether `JWT_SECRET` and `JWT_REFRESH_SECRET` are stable across API instances.
4. Whether cookies are configured for the deployed domain, HTTPS and SameSite policy.
5. Whether the refresh-token record exists and is still valid.

Changing JWT signing secrets invalidates existing tokens. Do not rotate them to fix a single user's session; first establish whether configuration differs between instances.

### A new feature or page is missing

A component file existing on disk does not mean Angular renders it.

Check:

- Is the route registered in the current route tree?
- Is a standalone component imported by the parent component?
- Is the component actually referenced in the template?
- Is the feature hidden by a feature flag, role, tenant setting or plan entitlement?
- Did the relevant file make it into the deployed commit?
- Is the browser loading a stale bundle/service-worker cache?

After fixing, run the dashboard build and verify the route in a clean browser session. Do not rely on the existence of a source file alone.

### PWA/service worker shows stale UI

- Hard-refresh once to distinguish browser cache from server behavior.
- Inspect service-worker registration and update state in browser developer tools.
- Verify the deployment serves the expected asset hashes.
- Test in a private window to isolate local cache.
- Do not instruct users to clear all browser data as the first-line fix; that may remove useful session state.

### UI shows masked/encrypted credentials incorrectly

The database representation, API response representation, and UI summary are different layers. A ciphertext envelope in PostgreSQL should not be rendered as a usable secret in the dashboard/API response.

Check:

1. Is the database field encrypted where the current configuration policy requires encryption?
2. Does the API redact/mask sensitive fields before returning them?
3. Does the dashboard summary recognize the current envelope format?
4. Is the UI showing an old cached bundle?

Do not “fix” a display issue by returning plaintext credentials to the browser.

---

## API, ingress, and workers

### API route returns `404 Not Found`

**Checklist**

1. Confirm the request is sent to the API host, not Ingress or Workers.
2. Confirm the `/api` prefix is present where required.
3. Check the current controller's route decorator and HTTP method.
4. Check that its NestJS module is imported into the relevant parent module.
5. Inspect startup logs for the mapped route.
6. Confirm the deployed commit includes the controller/module registration.

A controller file can compile while its module is not registered. Historical schedule-route incidents were caused by missing module imports; this remains a useful NestJS diagnostic pattern, not a claim that v3.7 has that defect.

### Workers internal endpoint returns `401 Unauthorized`

**Cause:** Missing or mismatched `X-Cron-Secret`.

**Fix**

- Confirm the caller sends `X-Cron-Secret`.
- Compare the configured `CRON_SECRET` between the caller and the Workers runtime using a secret manager or secure environment inspection. Do not print the value into logs.
- Confirm the request is reaching the intended Workers deployment.
- Redeploy/restart only after correcting the secret configuration.

`WORKERS_URL` and `CRON_SECRET` are particularly important when API operations forward work to Workers (for example, schedule run-now or dry-run validation).

### Ingress webhook returns `401` or signature verification fails

**Check**

- The source type configured on the workflow.
- Correct signing secret for that source/workflow.
- The exact signature header expected by the verifier.
- Raw request body handling. HMAC must use the original bytes, not JSON that has been parsed and serialized again.
- Timestamp tolerance for timestamped signature schemes.
- Whether a reverse proxy/body parser modified the request before verification.

Relayon's ingress implementation includes source-specific verification for Stripe, GitHub, Shopify, Slack and generic HMAC in the audited source snapshot. Confirm the exact source-specific header and signature format in the current verifier before writing a custom sender.

### Ingress rejects a valid-looking webhook with `413`

The current ingress JSON parser has a documented 5 MB body limit in the audited source snapshot.

**Fix**

- Check the source payload size and proxy/platform body-size limit.
- Remove unnecessary fields or send a smaller test payload.
- If a larger limit is genuinely required, change the parser and upstream proxy limits deliberately, then test memory and abuse implications. Do not raise the limit blindly.

### Ingress returns `429 Too Many Requests`

Possible causes:

- Tenant quota reached.
- Ingress per-tenant rate limit reached.
- Provider/source is retrying too aggressively.
- Duplicate/replay traffic is overwhelming a tenant or endpoint.

Check the tenant's usage/quota view, ingress logs, rate-limit configuration and source retry policy. Do not disable rate limiting globally as a quick fix.

### API or Workers crashes with numeric environment values

**Cause:** Environment variables are strings at runtime even when TypeScript generics suggest a number.

**Fix**

Parse and validate numeric values at the configuration boundary:

```typescript
const timeoutMs = Number.parseInt(
  config.get<string>('ADAPTER_TIMEOUT_MS') ?? '15000',
  10,
);

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  throw new Error('ADAPTER_TIMEOUT_MS must be a positive integer');
}
```

This applies to timeout, batch-size, token-limit and time-budget settings. Prefer the project's existing validated configuration schema over scattered ad-hoc parsing.

### `NODE_ENV` validation fails even though it looks correct

**Cause:** Hidden whitespace or an unexpected value in the environment.

**Fix**

- Inspect the variable's value and surrounding whitespace without printing other secrets.
- Re-enter `development`, `production`, or `test` cleanly.
- Validate/trim configuration at the boundary where appropriate.
- Redeploy/restart the affected service.

Do not change `NODE_ENV` to an unsupported value to bypass validation.

---

## Database and Prisma

### `P1001: Can't reach database server`

**Check**

1. `DATABASE_URL` points to the correct PostgreSQL host/database.
2. The host is reachable from the app runtime, not merely from a developer laptop.
3. Managed database SSL requirements are satisfied.
4. Username/password and database name are correct.
5. Provider firewall, network allow-list, connection pool and project status.
6. The runtime uses the intended pooled or direct connection URL.

Test from the same network/runtime where possible. A successful local `psql` command does not prove Vercel or a container can reach the database.

### Prisma Client cannot find a query engine for the runtime

**Cause:** Prisma Client was generated for a different platform than the deployed runtime, or the schema's `binaryTargets` do not include the target needed by the current deployment.

**Fix**

1. Inspect `packages/db/prisma/schema.prisma`.
2. Compare its generator `binaryTargets` with the actual deployment targets and the current Prisma version.
3. Run the repository's `npm run db:generate` from the monorepo root.
4. Build/deploy from a clean install using the pinned lockfile.
5. Do not copy a generated client from a developer machine into a different OS/runtime.

The current schema in the audited snapshot declares multiple targets; do not replace it with the old v1.5 two-target example. The schema in the checked-out v3.7.0 source is authoritative.

### `prisma: command not found` during build

**Likely causes**

- Prisma CLI is not installed in the build environment.
- Build runs from the wrong workspace/root.
- Production install omitted a package expected by the build.
- A command invokes an unpinned remote `npx` package instead of the repository's installed Prisma version.

**Fix**

- Confirm `prisma` and `@prisma/client` versions in the lockfile/package manifests.
- Confirm the build step installs the workspace dependencies required for Prisma generation.
- Run the repo's documented DB generation script or the pinned local binary.
- Avoid unpinned `npx prisma` in production build commands; it may resolve a different CLI version.

Do not blindly copy the v1.5-era hard-coded Vercel build command. The current workspace build configuration and pinned Prisma version take precedence.

### `P2021` / table does not exist after deployment

**Cause:** Migration was not applied to the database used by the deployed service, or the service is connected to a different database than expected.

**Fix**

1. Confirm the runtime's database host/database name (redact credentials).
2. Inspect `_prisma_migrations`.
3. Check the migration status using the project's approved operational process.
4. Back up before applying pending production migrations.
5. Run the production migration command:

```bash
npm run db:deploy
```

Do not run `migrate dev` against production.

### Local schema changed but `db:deploy` does not create the missing table

**Cause:** Editing `schema.prisma` does not create a migration.

**Fix (local development)**

```bash
npx prisma migrate dev --name descriptive_change
```

Review the generated SQL and migration directory, commit both schema and migration, then allow the deployment pipeline to apply it with `db:deploy`.

Use the repository-pinned Prisma CLI (or workspace script) rather than an unpinned remote version.

### Production migration failed or was run with the wrong command

**Immediate response**

1. Stop further deploy attempts until the database state is understood.
2. Preserve the exact migration logs and `_prisma_migrations` state.
3. Take/verify a database backup or provider point-in-time recovery point.
4. Determine whether the migration partially applied and whether it is marked rolled back/failed.
5. Follow a reviewed forward-fix or restore plan.

Do not delete migration folders as a first response. Do not restore a production database without understanding data loss since the restore point. `migrate dev` can generate development migrations and prompt interactively; production deployment should apply committed migrations only.

### Prisma connection pool exhaustion

Symptoms include connection timeouts, `too many connections`, slow API requests, or failures that appear only under concurrency.

Check:

- Number of deployed instances/functions and concurrency.
- Connection pool limits in the connection URL/provider.
- Whether each request creates an unmanaged PrismaClient instead of reusing the app-scoped client.
- Long-running transactions and queries.
- Whether the deployment should use a pooler for application traffic and a direct URL for migrations.

Do not increase the database connection limit without checking the provider plan and total possible serverless concurrency.

### Row-level security behaves differently locally and in production

Relayon includes PostgreSQL RLS policy files and an application script. RLS coverage is policy-specific; do not assume every table is protected just because RLS is enabled somewhere.

Check:

- Whether the relevant table has RLS enabled.
- Whether the intended policy exists and is applied.
- Whether the request sets the expected tenant context.
- Which database role the app uses (superuser/table owner roles can bypass policies depending on configuration).
- Whether tests use the same role/transaction setup as the application.

Use the dedicated RLS test workflow and `npm run db:rls` where appropriate. Do not “fix” a tenant leak by disabling RLS.

---

## Redis, queues, and event processing

### Event is accepted (`202`) but never appears as processed

An ingress acknowledgement means the event was accepted into the ingest path; it does not mean all worker processing has completed.

**Check in order**

1. Is Redis reachable from Ingress and Workers?
2. Did Ingress successfully enqueue the event?
3. Is the worker processing invocation/cron running?
4. Are Workers healthy and authorized?
5. Are batch size/time budget settings too restrictive?
6. Are worker logs reporting MongoDB, PostgreSQL, transform, enrichment or queue errors?
7. Is the event stuck in a processing state that recovery logic should reclaim?

For Vercel, confirm the external scheduler actually invokes processing. For Compose, confirm the `cron` service is running and its logs show successful calls.

### Ingest queue grows continuously

Possible causes:

- Worker cron stopped or points to an old URL.
- `CRON_SECRET` mismatch.
- Workers deployment unhealthy.
- Batch/time budget too small for the incoming rate.
- Repeated worker failures cause items to be retried/requeued.
- Redis latency or resource pressure.

Compare incoming rate, processing rate, oldest queue age, worker duration and error rate. Increase batch settings only after confirming downstream stores and adapters can handle the added concurrency.

### Event processing repeatedly fails

Inspect the event's correlation ID across Ingress and Workers logs. Separate these failure classes:

- Workflow lookup/configuration failure.
- Transform expression error.
- AI enrichment/provider error.
- MongoDB persistence error.
- Destination routing/configuration error.
- Worker timeout or memory exhaustion.

If AI enrichment is optional for the workflow, determine whether the failure is configured to be fail-open or fail-closed in the current implementation. Do not assume all AI failures stop ordinary event processing.

### Duplicate events appear

Ingress uses idempotency/deduplication controls. Check:

- Whether the source sends a stable event ID or `X-Idempotency-Key`.
- Whether retries use the same idempotency identifier.
- Whether requests are hitting different environments/tenants/workflows.
- Redis availability/eviction and idempotency TTL.
- Whether the source's event is genuinely a distinct event with a different ID.

Do not remove idempotency keys globally to “fix” missing events. First confirm whether the sender is reusing an identifier incorrectly.

### Redis `ECONNREFUSED`, TLS, or authentication errors

- Confirm the correct Redis endpoint and port.
- Use the provider's TLS-enabled URL where required.
- Verify password/ACL credentials and network access.
- Check whether the app expects a TCP URL rather than a REST URL.
- Confirm Docker service DNS names are used inside Compose rather than `localhost`.

`localhost` inside a container means that same container, not another Compose service.

### Queue state appears inconsistent after Redis restart

Redis persistence and queue recovery behavior depend on the configured deployment. Check the Compose Redis persistence settings or managed-provider persistence/eviction policy. Inspect the durable Mongo event/delivery records before attempting manual queue reconstruction. Avoid flushing Redis in production.

---

## Delivery, retries, circuit breaker, and DLQ

### Deliveries remain `pending`

**Likely causes**

- Delivery invocation is not running.
- The delivery queue is delayed because `nextAttemptAt` is in the future.
- A destination is disabled or not selected by routing.
- Workers cannot reach Redis, MongoDB or the destination.
- The worker invocation ends before its batch/time budget is exhausted.

**Diagnose**

1. Inspect the delivery record and its `status`, `nextAttemptAt`, `attempts` and `lastResponse`.
2. Confirm the delivery cron/invocation runs.
3. Check the egress queue and delayed retry backlog.
4. Confirm the destination is enabled and the workflow routing rule selected it.
5. Inspect adapter and provider errors.

A pending delivery is not necessarily stuck if its retry time is still in the future.

### Delivery enters DLQ

Read the complete delivery history before replaying:

- Last HTTP status and response snippet.
- Network error (`ECONNREFUSED`, `ETIMEDOUT`, DNS, TLS).
- Retryable vs permanent classification.
- Attempt count and retry timestamps.
- Destination configuration and credential status.

Fix the underlying destination problem first. Then replay one controlled item and verify it reaches the destination before bulk replaying.

### Destination returns `429` or `5xx`

The remote provider may be rate-limiting or temporarily unavailable.

- Respect `Retry-After` where the adapter supports it.
- Reduce destination concurrency or request volume.
- Confirm provider account quota and status page.
- Check whether multiple workflows share the same provider account.
- Let retry/backoff logic operate; avoid manual rapid-fire replay.

### Circuit breaker appears permanently open

A circuit breaker prevents repeated calls to an unhealthy destination. Inspect the current breaker implementation and Redis key/TTL before deleting anything.

Historical v1.x behavior used a destination-scoped Redis counter and a time-based auto-close. Do not assume the old key name, threshold or TTL is unchanged in v3.7.0. Verify the current source/configuration and destination health first.

### Delivery says failed but destination received the request

This can happen when the destination accepted the request but the response was lost, timed out, or could not be parsed. The sender cannot always know whether a remote side effect occurred.

**Mitigation**

- Use destination-side idempotency keys where supported.
- Make downstream handlers idempotent.
- Inspect destination logs by correlation/event ID.
- Avoid blind replay if the operation is not safe to repeat.

### Event is `processed`, but one destination is still pending or failed

This is expected when event processing and each destination delivery have separate lifecycles. Inspect each delivery independently. Do not reset the event record to force a delivery retry.

### MongoDB delivery query or event lookup fails

Confirm the API/Workers are using the same `MONGODB_URI` and `MONGODB_DB_NAME`, and that the queried event ID/correlation ID belongs to that database/environment. Check indexes and database permissions before changing schemas.

---

## Destination adapters and validation

### Adapter is missing from the destination selector

Check:

1. Adapter type is part of the current adapter registry.
2. Adapter provider is registered in the current Egress module.
3. API adapter metadata endpoint returns the type.
4. Dashboard options are built from current metadata rather than an old static list.
5. The deployed Workers/API/dashboard versions are compatible.

Historical v1.x adapter additions required registration in `EgressModule.providers`; this remains a useful plugin-registration check, but verify the current registry and loader.

### `401` / `403` from a destination provider

- Re-save/verify the credential using the provider's current format.
- Check token scopes and account permissions.
- Confirm the token belongs to the intended workspace/project.
- Check whether a BYOK/provider integration key is being confused with a destination credential.
- Check provider token expiry/revocation.

Never paste provider tokens into logs or issue reports.

### HTTP destination fails

Check URL scheme (`https://` in production), DNS, TLS certificate, redirect behavior, target firewall, request method, headers, payload mapping and timeout. Confirm the destination endpoint is reachable from the Workers runtime—not just from your laptop.

Do not allow arbitrary private-network destinations without understanding SSRF protections and the deployment's network boundary.

### Slack/Discord webhook rejected

- Confirm the URL is a real provider-generated webhook URL, not a placeholder/test URL.
- Confirm the provider's current canonical URL format.
- Confirm the webhook still exists and the channel/workspace allows it.
- Check whether the credential was saved encrypted and can be decrypted by Workers.
- Inspect provider response; a locally valid-looking URL may still be revoked or nonexistent.

A URL passing local validation is not proof that the provider recognizes it.

### Email adapter fails

Check provider API key, sender/domain verification, recipient format, rate limits, and provider response. If the deployment uses a tenant BYOK email integration, confirm that provider resolution selected the intended tenant key rather than the platform fallback.

### Airtable or Notion returns `4xx`

- Airtable: confirm base/table identifiers, field names, field types, and integration access.
- Notion: confirm the integration is explicitly shared with the target page/database/data source and that the configured API version/resource identifier is current.
- For both: inspect the provider response body and permissions; a `404` can represent inaccessible resources, not only missing resources.

Do not hard-code old Notion API-version headers from historical troubleshooting snippets. Use the version expected by the current adapter.

### PostgreSQL adapter errors

| Error | Likely meaning | Check |
|---|---|---|
| `ECONNREFUSED` | Host/port unreachable | URL, network, firewall, service state |
| `ETIMEDOUT` | Network path or server response too slow | DNS, routing, provider availability, timeout |
| `28P01` | Authentication failed | Username/password and URL encoding |
| relation/table missing | Wrong table/schema/search path | Target database, schema and table |
| column missing | Mapping does not match target schema | Column names and payload paths |

Use a least-privilege database account restricted to the required schema/table and operations. Avoid granting superuser access to a destination adapter.

### MongoDB adapter errors

- Confirm URI starts with `mongodb://` or `mongodb+srv://`.
- URL-encode reserved characters in credentials.
- Confirm Atlas/network allow-list includes the actual Workers egress path.
- Confirm database/collection names and write permissions.
- Check provider connection limits and TLS requirements.

Avoid permanent `0.0.0.0/0` access where a narrower allow-list or private network is possible.

### Custom/external adapter fails to load

The current repository includes an external adapter loader and sandbox runner. Check the adapter package manifest, expected entry point, adapter contract, registration/allow-list policy, runtime compatibility, timeout and memory limits, and Workers logs.

The sandbox uses worker-thread/time/resource controls; do not describe it as a hardened OS/container security boundary. Only load code from trusted sources and keep external adapter execution isolated from secrets and privileged network access.

### Dry-run reports success but real delivery fails

A validation/dry-run checks only what its adapter implementation is designed to check. Some integrations can validate configuration or connectivity without performing a real write; others cannot prove provider-side permissions or payload validity without a real operation.

- Read the adapter's dry-run contract.
- Check whether the test uses `HEAD`, `GET`, `SELECT 1`, `ping`, or a configuration-only check.
- Confirm real-write permissions and payload shape separately.
- Verify that `__dryRun` is honored before any side-effecting request.

For Slack/Discord-style webhooks, a safe dry-run must not send a real message. If a test message appears, treat it as a safety defect and stop further tests until the adapter is corrected.

---

## Authentication, sessions, and API keys

### `401 Unauthorized` on API request

Check:

- Correct API host and route.
- `Authorization: Bearer <real-token>` format for bearer-token endpoints.
- Token expiry and refresh flow.
- JWT signing secrets consistent across API instances.
- Browser cookie domain/SameSite/secure settings when cookie sessions are used.
- Whether the route expects an API key instead of a JWT (or vice versa).

Do not include a real JWT in a bug report. Revoke exposed credentials.

### Windows CMD: `The system cannot find the file specified` when using curl

In Windows CMD, `<` and `>` are redirection operators. A literal placeholder such as `<jwt-token>` is interpreted as shell syntax.

Use a variable with a real token:

```cmd
set JWT=PASTE_REAL_TOKEN_HERE
curl -H "Authorization: Bearer %JWT%" https://relayon-api.vercel.app/api/workflows
```

PowerShell:

```powershell
$JWT = "PASTE_REAL_TOKEN_HERE"
curl.exe -H "Authorization: Bearer $JWT" https://relayon-api.vercel.app/api/workflows
```

Use a test account and never save a real token in shell history longer than necessary.

### `403 Forbidden` or missing API-key scope

The API key may not have the scope required by the endpoint. Review the current scope list in the API reference/OpenAPI and create a key with the minimum required scopes. Existing key scopes should not be assumed editable.

JWT dashboard sessions and API-key authorization can have different permission semantics. Confirm which credential type the request used.

### API key returns `401`

Check:

1. Key format and environment (`live` vs `test`) according to current API reference.
2. Key was copied completely and is not masked.
3. Key is not expired or revoked.
4. Key belongs to the expected tenant/environment.
5. `API_KEY_PEPPER` has not changed unexpectedly.
6. The API is connected to the database that contains the key record.

If `API_KEY_PEPPER` changes, previously stored key hashes may no longer verify. Treat pepper rotation as a planned credential migration, not a routine restart.

### API key rotation or grace period behaves unexpectedly

Inspect the key and rotation records, expiry and revocation timestamps, and the current verification code. Confirm the API deployment is running the expected commit. If an old key remains valid beyond its intended window, revoke it through the supported API/dashboard path and investigate before issuing more keys.

### OAuth callback fails

Check provider client ID/secret, exact callback URL, HTTPS/domain, allowed redirect URI, and environment-specific configuration. Confirm the API and OAuth provider use the same callback route. A callback configured for localhost will not automatically work for the production domain.

### Email verification or password reset link is invalid

Check email provider delivery, `APP_ORIGIN`/public dashboard URL, token expiry, one-time-use state, and whether the link was rewritten by an email security scanner. Do not extend token lifetime globally to work around one malformed link.

---

## Encryption and key rotation

### `Unsupported state or unable to authenticate data`

**Likely cause:** API encrypted a credential with one key, but Workers attempted to decrypt it with a different key or incompatible key ring.

**Fix**

1. Confirm API and Workers have compatible `CONNECTOR_ENCRYPTION_KEYS` configuration.
2. Confirm the same key ID maps to the same key material in both services.
3. Check that the required historical key is still present.
4. Restart/redeploy affected services after correcting configuration.
5. Test decryption using a controlled non-production record before replaying deliveries.

The plural key-ring variable is the current configuration pattern in the audited source; the singular `CONNECTOR_ENCRYPTION_KEY` is a legacy compatibility name. Follow the checked-out env examples and deployment guide.

### `Unknown kid` after encryption-key rotation

**Cause:** Ciphertext in the database references a key ID that is no longer available to the decrypting service.

**Recovery**

1. Restore the missing key ID/material from the secure backup/secret manager.
2. Deploy a compatible key ring to every service that decrypts credentials.
3. Verify that affected records can be decrypted.
4. Run the repository's documented rotation process to re-encrypt under the intended current key.
5. Verify migration completion before removing the old key.

If the old key material is permanently lost, ciphertext encrypted only with that key is not recoverable. Restore credentials from their authoritative source and re-save them.

### API and Workers have different key-ring ordering/content

Key IDs and key material must match across services. Compare configuration securely; do not print full key values. A different current-key selection may also affect which key is used for newly encrypted values.

### Secrets appear as plaintext in the database

Not every configuration field is a secret. Endpoint URLs, methods and non-sensitive routing metadata may be stored as ordinary configuration depending on the selected encryption policy. Verify the current secret-field policy and `FULL_CONFIG_ENCRYPTION` behavior before declaring a defect.

If a field that should be encrypted is stored in plaintext:

- Stop creating more affected records.
- Confirm the API path calls the encryption helper.
- Check service version/configuration and key-ring presence.
- Re-save or migrate affected credentials through a reviewed process.
- Avoid manually editing ciphertext in SQL.

### API returns ciphertext instead of a masked value

Check response DTO/serializer redaction and destination-specific UI rendering. Never solve this by exposing decrypted credentials to all dashboard clients.

### API key pepper or JWT secret was accidentally changed

- Restore the intended secret from the secret manager if possible.
- Expect sessions/API keys to be invalidated if the old value cannot be restored.
- Follow the documented reauthentication/reissue procedure.
- Do not generate a new random value on each container start; secrets must be stable across instances.

---

## Schedules and background automation

### Scheduled workflow does not fire

Check all of the following:

1. Workflow is active.
2. Schedule is active.
3. Cron expression is valid.
4. Configured timezone is what the operator expects.
5. `nextRunAt` is due and not in the future.
6. Workers schedule-tick endpoint is being invoked.
7. Caller has the correct `CRON_SECRET`.
8. Workers can reach PostgreSQL and Redis.
9. The schedule has not already been claimed/advanced by another scheduler instance.

Use the schedule status endpoint and database record where available. Inspect the current route in Workers rather than relying on an old URL copied from v1.x.

### Schedule tick returns `due: 0` / `enqueued: 0`

This may be normal. No schedule may be due at the time of the tick.

Check `isActive`, `nextRunAt`, timezone and workflow active state. Do not repeatedly force `nextRunAt` into the past in production; use a controlled test schedule or the dashboard's supported Run now action.

### Run now reports triggered but no event is visible

Separate the steps:

- API accepted the run-now request.
- API successfully called Workers.
- Workers enqueued/processed the scheduled payload.
- Event record was persisted.
- Destination deliveries were created and delivered.

Check API-to-Workers URL/secret, worker logs, queue depth, correlation ID and Mongo event record. A success response from the first step does not prove the final delivery completed.

### Bulk pause/resume returns `updated: 0`

This can be a valid no-op if there are no schedules or all schedules are already in the requested state. Check the matching schedule count and response contract before treating it as a failure.

### Vercel cron is delayed or does not run

Do not assume a serverless function is a persistent worker. Confirm the configured external cron provider, cadence, request URL, secret header, provider execution history and target deployment. GitHub Actions schedules are best-effort and can be delayed; use a scheduler appropriate to the required operational SLA.

### Docker Compose cron is not advancing work

Check:

```bash
docker compose ps
docker compose logs --tail=200 cron
docker compose logs --tail=200 workers
docker compose logs --tail=200 api
```

The checked-in Compose cron sidecar invokes worker processing, delivery, schedule tick and the API outbox tick. Confirm the sidecar is running, internal service DNS names resolve, and its shared secret matches the API/Workers configuration.

---

## AI assistant, enrichment, RAG, and BYOK

### AI enrichment returns `401 Unauthorized`

- Confirm the selected provider credential is present and valid.
- Determine whether the request used a tenant BYOK key or platform fallback.
- Check provider account status, key revocation and project permissions.
- Verify the key is configured in the correct environment.
- Do not paste the key into logs or test output.

### AI provider returns `404 model_not_found`

The configured model may have been retired, renamed, or may not be enabled for that provider/account/region.

- Query the provider's current model list using the provider's authenticated API or console.
- Confirm the model identifier is exact.
- Check the provider resolver and tenant integration selection.
- Update the model setting only after confirming provider support.

Do not treat a historical Groq model name in an old runbook as a permanent model guarantee.

### AI request times out or is rate-limited

Check provider status, model latency, tenant/provider rate limits, request size, token limits and configured timeout. Reduce request volume or use an available fallback where configured. AI enrichment/assistant requests should not be used as a substitute for the core event-delivery health check.

### BYOK key is saved but not used

Check:

1. Provider integration record exists for the correct tenant.
2. Key encryption/decryption succeeds.
3. Integration is enabled/toggled on.
4. Provider resolver selects that provider/key for the requested feature.
5. The feature actually supports that provider (assistant, enrichment, email, etc.).
6. The deployment is running code that includes the relevant v3.5–v3.7 integration behavior.

A saved key does not necessarily become the default for every feature. Follow provider-resolution rules for the specific module.

### AI assistant returns irrelevant answers or empty RAG results

- Confirm knowledge documents/chunks were ingested and indexed.
- Check tenant scoping on retrieval.
- Verify embedding/model configuration and provider availability.
- Check query intent/routing and the tool selected by the assistant.
- Compare a simple known-answer query with a query that requires tenant knowledge.
- Inspect retrieval scores and source chunks where the application exposes them.

Do not bypass tenant filters to make retrieval return more results.

### AI works for one tenant but not another

Compare tenant integration enablement, BYOK credentials, quotas, role/permission and knowledge corpus state. Do not copy one tenant's key or knowledge records into another tenant as a workaround.

---

## Outbound webhooks and transactional outbox

Relayon's platform can notify customer-configured webhook endpoints. This is distinct from inbound source webhooks and destination adapters attached to a workflow.

### Customer webhook endpoint receives no notification

Check:

- Endpoint is registered and enabled for the expected event types.
- Endpoint URL is reachable from the API runtime.
- Outbox event row was created.
- API outbox poller/tick is running.
- Delivery attempts and next-attempt timestamps.
- Endpoint response status, timeout and retry behavior.
- Signing secret and signature verification at the receiver.

The outbox is persisted in PostgreSQL; a missing notification may be waiting in the outbox rather than lost in the event-delivery queue.

### Receiver rejects signature

- Use the endpoint's configured signing secret, not a workflow source secret or destination credential.
- Verify the exact Standard Webhooks signing header and timestamp format expected by the current implementation.
- Verify the receiver signs/verifies the original payload bytes as specified by the protocol.
- Check clock skew and replay/timestamp tolerance.
- Confirm endpoint secret rotation was completed on both sides.

Do not paste signing secrets into a support ticket.

### Outbox backlog grows

Check API outbox tick schedule, API logs, database connectivity, endpoint timeouts, retry policy and lock/claim behavior. In Compose, confirm the cron sidecar includes the API outbox tick. In Vercel, confirm the external scheduler calls the API outbox route documented for the deployed version.

---

## Vercel deployment

### Build uses the wrong directory or cannot resolve workspace packages

The monorepo uses four Vercel projects with app-specific root directories:

| Project | Root directory |
|---|---|
| Dashboard | `apps/dashboard` |
| API | `apps/api` |
| Ingress | `apps/ingress` |
| Workers | `apps/workers` |

The apps depend on root-level workspace packages such as `packages/db` and `packages/shared`. Ensure Vercel's monorepo settings allow the build to access source files outside the app root and that the build/install command runs with the correct workspace context.

### Deployment is stuck on an old commit

Check:

- Vercel project is connected to the expected Git repository and branch.
- Deployment commit SHA matches GitHub.
- Ignored Build Step configuration.
- Build logs and project root directory.
- Whether the latest commit changed files relevant to that project.
- Whether a previous deployment is still serving production traffic.

Prefer a normal new commit/redeploy with a clean build over an empty commit as the first response.

### Build succeeds but runtime uses stale code

- Confirm production alias points to the intended deployment.
- Compare deployment commit SHA with the intended Git commit.
- Check service-specific deployment status; one Vercel project may deploy while another is unchanged.
- Verify browser/service-worker cache for Dashboard.
- Rebuild only the affected app after confirming the source change is included.

### Serverless worker queue stops progressing

Vercel functions are not a continuously running worker process. Confirm external cron invocations for processing, delivery and schedule tick are configured and succeeding. Also confirm API outbox tick is scheduled if customer webhook notifications are enabled.

Do not solve this by starting an unbounded background loop inside a serverless request handler.

### Workers/API cannot call each other

Check `WORKERS_URL`, `API_URL` where applicable, deployment hostnames, route prefixes, TLS, `CRON_SECRET`, provider network rules and function logs. Do not use a dashboard/public URL where an internal service URL is required.

### Environment variable is set but app still sees old value

Vercel environment variables are associated with deployment environments. After changing one:

1. Confirm Production/Preview/Development scope.
2. Confirm the correct project is being edited.
3. Redeploy the affected project.
4. Confirm the deployment timestamp/commit.
5. Check the application startup/config validation log without exposing the secret.

---

## Docker Compose and self-hosting

### `docker compose config` reports missing variables

Copy the Docker environment example to the expected root `.env` location, populate every required value, and validate:

```bash
docker compose config
```

Do not commit the populated `.env` file. Do not use example/default secrets in production.

### Containers start but cannot reach each other

Inside Compose, use service names (for example `postgres`, `redis`, `mongo`, `api`, `workers`) and container ports. `localhost` inside a container points to that same container.

Check:

```bash
docker compose ps
docker compose logs --tail=200 api
docker compose logs --tail=200 ingress
docker compose logs --tail=200 workers
```

Also inspect network membership and health checks. Do not expose database ports publicly just to make container-to-container connectivity work.

### Migration container exits unsuccessfully

- Inspect `migrate` logs.
- Confirm `DATABASE_URL`/direct URL and PostgreSQL health.
- Confirm the migration container uses the same schema/migration files as the app image.
- Back up the database and inspect migration state before retrying.
- Do not start app services against a schema that is known to be incompatible.

The Compose stack includes a one-shot migration stage; ensure it completes successfully before treating the application stack as ready.

### Nginx returns `502 Bad Gateway`

Check:

- Upstream service container is running and healthy.
- Nginx upstream names/ports match Compose service definitions.
- Dashboard/API path routing is correct.
- The app is listening on the container interface, not only `127.0.0.1`.
- Startup ordering/health checks completed.

### Host architecture causes image/platform errors

The checked-in Compose configuration documents ARM64 testing for an Oracle Cloud Ampere deployment. Operators on x86_64 should review the `platform` stanza and Docker images before deploying. Do not force an incompatible architecture without verifying all base images and native dependencies.

### Data disappears after container recreation

Confirm PostgreSQL, Redis and MongoDB use the intended named persistent volumes. `docker compose down -v` removes volumes and can delete persistent data; do not run it in production as a routine cleanup command.

Before upgrades, back up PostgreSQL and MongoDB and confirm Redis persistence/recovery requirements for the deployment.

### Compose cron is running but no background work occurs

Inspect `cron` logs and verify internal URLs, shared secret, API/Workers health and network access. Confirm all four invocation classes are running: process, deliver, schedule tick and outbox tick. A running cron container does not prove its HTTP requests succeeded.

---

## SDK, CLI tunnel, and workflow YAML

### SDK requests return type/schema errors

- Confirm SDK version matches the API's OpenAPI contract.
- Regenerate from the intended API spec if the server contract changed.
- Check auth configuration and API base URL.
- Inspect both SDK `error` and `data` results.
- Do not hand-edit generated SDK files as the permanent fix.

The repository's SDK workflow uses the OpenAPI spec and generator. Use the current root scripts (`sdk:sync`, `sdk:generate`, `sdk:build`) as defined by `package.json`.

### SDK calls wrong server

Set the client base URL explicitly for self-hosted or non-production environments. Ensure the URL is the API base, not the dashboard or ingress base.

### CLI tunnel cannot establish a session

Check:

- `RELAYON_API_KEY` is set and has required access.
- API URL points to the intended Relayon deployment.
- API tunnel session creation succeeds.
- Ingress tunnel capture URL is reachable.
- Local port is listening and not blocked by firewall.
- CLI can maintain/reconnect its SSE stream.

Run the CLI with a non-sensitive label and inspect API/Ingress logs using the session identifier. Do not expose the raw API key in terminal screenshots.

### Tunnel connects but local app receives no request

Confirm the source is sending to the tunnel URL returned by the CLI, not the normal workflow endpoint. Check the tunnel session is active, the local port is correct, and the CLI output shows forwarding rather than only session creation.

### Workflow YAML validation or push fails

- Run the repository's workflow validation command locally.
- Check YAML syntax, schema/version fields and referenced workflow identifiers.
- Confirm the API key has the required workflow read/write scope.
- Confirm target tenant/environment and API base URL.
- Review the API response; do not overwrite remote workflow state until the diff is understood.

---

## Performance and observability

### API cold start or first request is slow

A cold serverless function may initialize NestJS, Prisma and provider clients. Compare cold vs warm latency and inspect traces before treating one slow first request as a regression.

If every request is slow, investigate database connection setup, slow queries, pool saturation, external calls in request paths and network latency.

### Dashboard initial load is slow

Check bundle transfer size, cache headers, route-level lazy loading, service-worker behavior, CDN status and browser performance traces. Do not use a historical v1.5 bundle-size figure as the v3.7 baseline.

### Worker batch exceeds time budget

Check batch size, event payload size, AI provider latency, transform complexity, adapter timeouts and DB query duration. Reduce batch size or tune time budget based on measured behavior and platform execution limits. Do not increase timeouts beyond the hosting platform's maximum.

### Sentry/OpenTelemetry shows no data

- Confirm `SENTRY_DSN` / `OTEL_EXPORTER_OTLP_ENDPOINT` is set in the correct service.
- Confirm outbound network access to the collector/provider.
- Check environment and sampling configuration.
- Verify instrumentation initializes before app modules where required.
- Distinguish “no errors” from “telemetry not configured.”

### Logs cannot be correlated across services

Use the event correlation ID and timestamps to search Ingress, Workers, Mongo event/delivery records and destination logs. Ensure clocks are synchronized and include timezone in incident reports. Do not use email addresses, raw tokens or full webhook payloads as correlation identifiers.

---

## Security and tenant-isolation checks

### One tenant can see another tenant's data

Treat this as a security incident.

1. Stop further exposure and preserve logs.
2. Record endpoint, request ID, tenant IDs (redacted in external reports), user role and timestamp.
3. Verify authorization guard and tenant-context resolution.
4. Verify database query filters and applicable RLS policy.
5. Reproduce with two isolated test tenants in a non-production environment.
6. Review logs for broader access and rotate credentials only if exposure warrants it.
7. Follow the project's security disclosure process.

Do not patch by trusting a client-supplied tenant ID or by disabling RLS.

### Sensitive headers or payload data appear in logs

Check request logging, exception serialization, tracing attributes, and adapter error snippets. Redact Authorization, Cookie, Set-Cookie, X-API-Key and provider credentials. The ingress implementation in the audited snapshot filters sensitive headers from the queued event header snapshot; verify other logging paths separately.

### Internal worker endpoint is publicly callable

Internal routes should require `X-Cron-Secret` as configured. Check reverse proxy routing, route guard/middleware and secret configuration. Do not rely on an obscure URL path as authentication.

### External adapter security concern

The external adapter runner's worker-thread/time/resource controls are not equivalent to a hardened container or OS sandbox. Restrict who can register adapters, review adapter code, limit secrets/network access, and do not execute untrusted packages in a privileged production worker.

---

## Diagnostics and incident checklist

### Capture the minimum useful incident bundle

Before changing production state, collect:

- Relayon version/tag and deployed commit SHA.
- Deployment topology: Vercel or Docker Compose.
- Affected app/service and environment.
- UTC timestamp and timezone of the user-visible failure.
- HTTP method, route, status and sanitized response body.
- Correlation/event ID.
- Relevant service logs around the timestamp.
- Sanitized database record state (no payload secrets).
- Queue depth/age and retry/DLQ state.
- Recent deploy, migration, environment, provider-key or destination changes.

### Inspect the event lifecycle

Use the dashboard/API to locate the event by correlation ID. Then inspect the event record in MongoDB and its associated delivery records. Field names can evolve; use the current Mongoose schemas rather than copying old shell queries blindly.

Questions to answer:

- Did Ingress accept the request?
- Was the event queued?
- Did Workers claim and process it?
- Did transformation/routing complete?
- Were delivery records created?
- Which destinations succeeded, failed or remain delayed?
- Was a failure classified retryable or permanent?

### Inspect schedule state

Use the current API schedule endpoints and/or Prisma Studio in a controlled environment. Check workflow active state, schedule active state, cron expression, timezone, next-run and last-run timestamps. Do not manually update production timestamps unless following an approved recovery procedure.

### Inspect encryption state

Check the expected encrypted envelope and key ID without copying ciphertext into a public report. Confirm API/Workers key-ring compatibility and response redaction. A masked API value is expected; ciphertext should not be returned as a credential the user can reuse.

### Useful repository commands

```bash
# Workspace and dependency state
git status --short
node --version
npm --version

# Static checks/builds
npm run typecheck
npm run lint
npm run build:dashboard
npm run build:api
npm run build:ingress
npm run build:workers

# Database client/migration commands
npm run db:generate
npm run db:migrate       # local development only
npm run db:deploy        # production migration deployment
npm run db:studio
npm run db:rls

# Tests / validation (check package.json for exact current script availability)
npm run test
npm run test:integration
npm run workflows:validate
```

Run only the commands that exist in the checked-out `package.json`; the list is a diagnostic index, not a guarantee that every environment has all optional services installed.

### Healthy end-to-end verification

After a fix, use a controlled test workflow and verify:

1. Ingress accepts a valid test webhook.
2. Event is visible with the expected correlation ID.
3. Workers process it without an unhandled error.
4. Expected destination delivery records are created.
5. Destination receives the expected payload exactly once where idempotency is supported.
6. Delivery state and response are visible in the dashboard/API.
7. Any schedule/outbox path involved in the incident advances normally.

---

## Escalation and bug reports

Before opening an issue, search existing reports:

- [Relayon GitHub Issues](https://github.com/zainshah3464/relayon/issues)
- [Relayon repository](https://github.com/zainshah3464/relayon)

Include:

- Version/tag and deployed commit SHA.
- Environment and deployment topology.
- Which component is failing (Dashboard / API / Ingress / Workers / PostgreSQL / MongoDB / Redis / provider).
- Exact error message and sanitized HTTP response.
- Timestamp with timezone and correlation ID.
- Minimal reproduction steps.
- What you expected and what actually happened.
- Relevant sanitized logs and whether the issue reproduces locally.

**Never include:** passwords, JWTs, API keys, OAuth client secrets, webhook signing secrets, encryption keys, full database URLs, or unredacted customer payloads.

For security vulnerabilities, do not open a public issue with exploit details. Use the security contact and disclosure process documented in the repository's current `SECURITY.md`.

---

## Source of truth and related documentation

When this guide and the checked-out code disagree, prefer the current source and generated contracts:

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Vercel and Docker Compose deployment.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — service boundaries and event lifecycle.
- [`docs/API_REFERENCE.md`](./docs/API_REFERENCE.md) — API overview; use live OpenAPI for exhaustive route contracts.
- [`docs/DATABASE.md`](./docs/DATABASE.md) — PostgreSQL/Prisma model and migrations.
- [`docs/SECURITY.md`](./docs/SECURITY.md) — threat model and security controls.
- [`docs/TESTING.md`](./docs/TESTING.md) — automated and manual verification.
- [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) — release history.
- [Live Swagger UI](https://relayon-api.vercel.app/api/docs)
- [Live OpenAPI JSON](https://relayon-api.vercel.app/api/openapi.json)
- [Repository](https://github.com/zainshah3464/relayon)

**Version note:** The troubleshooting examples are operational guidance, not a claim that every listed historical symptom exists in the v3.7.0 code. Validate exact route names, schema fields, adapter contracts and environment variables against the deployed commit before applying a production change.
