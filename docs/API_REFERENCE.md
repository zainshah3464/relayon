# Relayon — API Reference

> **Complete HTTP API reference for the Relayon monorepo.**
>
> **Final version:** **v3.7.0** (project officially complete — 24 November 2026)
> **Audited commit:** [`f4dd930eafd2ab61381bc1c049bb6cdbb7480235`](https://github.com/zainshah3464/relayon/commit/f4dd930eafd2ab61381bc1c049bb6cdbb7480235)
> **License:** [Relayon Proprietary Source-Visible License v1.0](./LICENSE)

| Document metadata | Value |
|---|---|
| Repository | [`zainshah3464/relayon`](https://github.com/zainshah3464/relayon) |
| Branch audited | `main` |
| Source snapshot | 24 November 2026 |
| Latest semantic tag at snapshot | `v3.7.0` (the audited `main` head also contains two commits after that tag) |
| Package metadata | root `package.json` reports `0.1.0`; this is not the same as the Git tag history |

This document describes the routes and request behavior implemented in the audited source snapshot. It is **not** a promise that every external integration, deployment, or optional environment variable is configured in every environment.

---

## Table of Contents

- [API Surface](#api-surface)
- [Conventions and Security Model](#conventions-and-security-model)
- [Authentication](#authentication)
- [Dashboard API](#dashboard-api)
  - [Health](#health)
  - [Authentication and Accounts](#authentication-and-accounts)
  - [Tenants](#tenants)
  - [Workflows](#workflows)
  - [Workflow Versions](#workflow-versions)
  - [Destinations](#destinations)
  - [Schedules](#schedules)
  - [Events](#events)
  - [Dead-Letter Queue](#dead-letter-queue)
  - [Analytics](#analytics)
  - [API Keys](#api-keys)
  - [Billing](#billing)
  - [Provider Integrations and BYOK](#provider-integrations-and-byok)
  - [AI Assistant](#ai-assistant)
  - [Quota and Usage Export](#quota-and-usage-export)
  - [Outbound Webhook Endpoints](#outbound-webhook-endpoints)
  - [Operational Cron and Outbox](#operational-cron-and-outbox)
  - [Playground](#playground)
  - [Presence and Tracking](#presence-and-tracking)
  - [CLI Tunnel Sessions](#cli-tunnel-sessions)
  - [Community](#community)
  - [Platform Administration](#platform-administration)
  - [Feature Flags](#feature-flags)
- [Ingress API](#ingress-api)
  - [Webhook Receiver](#webhook-receiver)
  - [Playground Capture](#playground-capture)
  - [Tunnel Capture](#tunnel-capture)
  - [Ingress Health](#ingress-health)
- [Workers API](#workers-api)
  - [Processing](#processing)
  - [Delivery and Replay](#delivery-and-replay)
  - [Queue and Egress Status](#queue-and-egress-status)
  - [Adapter Catalogue and Dry-Run](#adapter-catalogue-and-dry-run)
  - [Schedule Operations](#schedule-operations)
  - [Workers Health](#workers-health)
- [Error Response Formats](#error-response-formats)
- [Rate Limits and Quotas](#rate-limits-and-quotas)
- [Implementation Notes and Known Contract Edges](#implementation-notes-and-known-contract-edges)
- [OpenAPI and Source Map](#openapi-and-source-map)

---

## API Surface

Relayon exposes **three separately deployed HTTP services**. The browser dashboard talks primarily to the Dashboard API; third-party providers call Ingress; scheduled or internal processing invokes Workers.

| Service | Production base URL | Local default | Responsibility |
|---|---|---|---|
| Dashboard API | `https://relayon-api.vercel.app/api` | `http://localhost:3001/api` | Authentication, tenant configuration, workflows, destinations, events, billing, analytics, administration |
| Ingress API | `https://relayon-ingress.vercel.app` | `http://localhost:3002` | Signed webhook intake, playground capture, CLI tunnel capture |
| Workers API | `https://relayon-workers.vercel.app/internal` | `http://localhost:3003/internal` | Queue processing, delivery, replay, schedule ticks, adapter diagnostics |

The dashboard is deployed separately at `https://relayon.vercel.app` (local default `http://localhost:4200`).

### Prefixes

- The NestJS Dashboard API applies the global `/api` prefix.
- The NestJS Workers service applies the global `/internal` prefix.
- Ingress is an Express application and does **not** add a global API prefix.

### API Documentation Endpoints

The Dashboard API configures Swagger UI at:

- `GET /api/docs`
- `GET /api/openapi.json`

Swagger/OpenAPI is **disabled** when the API process has `DISABLE_OPENAPI=true`. The spec is generated from Nest controllers at application startup; it should be treated as a **generated view**, not a replacement for the guards and DTOs described below.

---

## Conventions and Security Model

### HTTP and Payload Conventions

- Dashboard API and Workers API use JSON request and response bodies unless a route explicitly streams content or returns a file.
- Dashboard API enables Nest's global validation pipe with `whitelist: true`, `forbidNonWhitelisted: true`, and transformation enabled. **Unknown DTO properties are rejected** rather than silently accepted.
- Dashboard API uses a global exception filter. Ingress has its own Express error handler and response format.
- Timestamps in examples are ISO 8601 UTC strings. Actual values are generated at runtime.
- Resource IDs are opaque identifiers. Do **not** derive or construct IDs.
- Tenant-facing resource handlers use the authenticated tenant context when they query or mutate records. A cross-tenant resource lookup normally behaves as **not found** rather than exposing another tenant's record.
- `GET` collection routes that expose a `limit`/`cursor` pair are **cursor-based** where noted. Do not assume offset pagination.

### Authentication Classes

There are four practical route classes:

| Class | Credential | Typical use |
|---|---|---|
| Public | None | Signup/login, public community reads, tracking, playground session APIs, selected health endpoints |
| JWT-only | `Authorization: Bearer <access-token>` | Account settings, tenant settings, API-key management, destinations, billing, integrations, administration |
| JWT or scoped API key | JWT or `X-API-Key` | Workflow, event, DLQ, analytics and schedule APIs; tunnel sessions |
| Internal cron | `X-Cron-Secret` | Workers operations and API maintenance/outbox controllers |
| Provider signature | Source-specific HMAC/signature header | Inbound webhook receiver and Stripe billing webhook |

A route's guard is **authoritative**. The fact that a feature is available to API keys in one controller does **not** mean all Dashboard API routes accept API keys.

### API-Key-Capable Routes

The `JwtOrApiKeyGuard` is applied to these controller groups:

| Route group | API-key scope |
|---|---|
| `/api/workflows/**` | `workflows:read` or `workflows:write`, as annotated per operation |
| `/api/workflows/:workflowId/schedule/**` | `workflows:read` or `workflows:write`, as annotated per operation |
| `/api/events/**` | `events:read` |
| `/api/dlq/**` | `dlq:read` or `dlq:write`, as annotated per operation |
| `/api/analytics/**` | `analytics:read` |
| `/api/tunnel/**` | No additional scope annotation in the current controller |

JWT sessions are accepted by these routes and **bypass API-key scope checks**. The API-key guard verifies the key, tenant, expiry/revocation state, and required scopes.

### Available API-Key Scopes

The current API-key DTO permits exactly these scopes:

- `events:read`
- `workflows:read`
- `workflows:write`
- `destinations:read`
- `destinations:write`
- `dlq:read`
- `dlq:write`
- `analytics:read`

> **Important:** `destinations:read` and `destinations:write` are valid key scopes in the key schema, but the current `DestinationsController` is guarded by `JwtAuthGuard`, **not** `JwtOrApiKeyGuard`. Therefore those scopes do **not** currently grant API-key access to destination endpoints. The same caution applies to other JWT-only controller groups.

### Internal Cron Authentication

Workers routes (except the health endpoint) and the Dashboard API maintenance/outbox routes use:

```http
X-Cron-Secret: <shared-secret>
```

The guard **fails closed** when `CRON_SECRET` is missing or shorter than 16 characters. It compares equal-length secrets using a **timing-safe comparison**. API and Workers must be configured with the **same** secret for API-to-Workers calls to work.

---

## Authentication

### JWT Access and Refresh Tokens

The defaults used by the auth service are:

| Token | Default lifetime | Behavior |
|---|---:|---|
| Access token | 15 minutes | Signed JWT sent as a Bearer token |
| Refresh token | 7 days | Random opaque token; only its SHA-256 hash is stored; single-use rotation |

These durations can be overridden with `JWT_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN`.

A successful refresh **revokes the presented refresh token** and issues a new access/refresh pair. Reusing a revoked or expired refresh token returns `401`.

### API Keys

API keys are created by an authenticated tenant user. The raw value is returned **only once**; the database stores a hash, not the raw key.

- Key format: `rlk_<live|test>_<8-hex-prefix>_<48-hex-secret>`
- Default lifetime: **90 days**
- `neverExpires: true` stores no expiry
- Rotation preserves scopes/environment and gives the old key up to a **24-hour grace period**
- During that grace window, both old and new keys can verify
- Rotation history is available to the tenant through the API-key management endpoint

### Inbound Webhook Signatures

The Ingress API does **not** use the dashboard's JWT session for source webhook authentication. It verifies a signature against the workflow's configured `sourceConfig.secret`.

| Source type | Required header(s) | Verification |
|---|---|---|
| Stripe | `Stripe-Signature` | HMAC-SHA256 over `<timestamp>.<raw-body>`; `t=` timestamp and one or more `v1=` signatures |
| GitHub | `X-Hub-Signature-256` | HMAC-SHA256 over raw body; `sha256=` hex prefix |
| Shopify | `X-Shopify-Hmac-Sha256` | HMAC-SHA256 over raw body; Base64 |
| Slack | `X-Slack-Signature`, `X-Slack-Request-Timestamp` | HMAC-SHA256 over `v0:<timestamp>:<raw-body>`; `v0=` prefix |
| Generic | Configurable header (default `X-Webhook-Signature`) | HMAC-SHA256 over raw body; hex by default, Base64 when `sourceConfig.encoding` is `base64` |

Stripe and Slack timestamp checks use `WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` (default 300 seconds). The current GitHub and Shopify verifier implementations **validate the HMAC but do not apply that timestamp tolerance**.

### Stripe Billing Webhook Signature

`POST /api/billing/webhook` is public at the JWT layer but verifies Stripe's `Stripe-Signature` header using the **raw request body**. The API bootstrap enables raw-body capture specifically for this purpose.

---

# Dashboard API

Base URL:

```text
https://relayon-api.vercel.app/api
```

All paths in this section are relative to `/api`.

## Health

### `GET /health`

**Authentication:** Public.

Checks the PostgreSQL connection using `SELECT 1`.

Example response:

```json
{
  "status": "ok",
  "db": "up",
  "version": "0.1.0",
  "timestamp": "2026-11-24T10:00:00.000Z"
}
```

When the database probe fails, the handler returns `status: "degraded"` and `db: "down"`. The current handler constructs the response **without changing the HTTP status** from the successful GET default; consumers should inspect `status` and `db`, not only the HTTP code.

---

## Authentication and Accounts

Controller: [`auth.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/auth/auth.controller.ts)

### `POST /auth/signup`

**Authentication:** Public.  
**Success:** `201 Created`.

Creates a tenant and its initial owner user. Local signups trigger an email-verification message asynchronously.

Request:

```json
{
  "name": "Zain Shah",
  "tenantName": "Acme Corp",
  "email": "zain@example.com",
  "password": "A-Strong-Password-123!"
}
```

Validation:

| Field | Constraint |
|---|---|
| `name` | String, 2–80 characters |
| `tenantName` | String, 2–80 characters |
| `email` | Valid email, maximum 255 characters, unique globally |
| `password` | Strong-password validator: minimum **12 characters** and minimum score 3 |

The tenant slug is generated from the tenant name. If the slug already exists, a random suffix is appended.

Response shape:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque-refresh-token>",
  "user": {
    "id": "<user-id>",
    "email": "zain@example.com",
    "name": "Zain Shah",
    "role": "owner",
    "tenantId": "<tenant-id>",
    "tenantName": "Acme Corp",
    "tenantSlug": "acme-corp",
    "isSuperAdmin": false
  }
}
```

Errors:

- `400` — DTO validation failure.
- `409` — email already in use.

The signup response includes a session pair, but the **local-password login flow subsequently requires the email to be verified**.

### `POST /auth/login`

**Authentication:** Public.  
**Success:** `200 OK`.

Request:

```json
{
  "email": "zain@example.com",
  "password": "A-Strong-Password-123!"
}
```

Response: same session shape as signup.

Errors:

- `400` — request validation failed.
- `401` — invalid email/password.
- `401` — local account email has **not been verified**; the response carries a verification-specific message.

The invalid-credentials message is the same for an unknown email and a wrong password.

### `POST /auth/refresh`

**Authentication:** Public; the refresh token is the credential.  
**Success:** `200 OK`.

Request:

```json
{
  "refreshToken": "<refresh-token>"
}
```

Returns a new access/refresh pair. The submitted refresh token is **revoked as part of rotation**.

Errors: `401` for an unknown, revoked, or expired refresh token.

### `POST /auth/logout`

**Authentication:** Public; the refresh token is the credential.  
**Success:** `204 No Content`.

Request:

```json
{
  "refreshToken": "<refresh-token>"
}
```

Revokes the supplied refresh token. The endpoint does **not** return a JSON response body.

### `GET /auth/me`

**Authentication:** JWT only.  
**Success:** `200 OK`.

Returns the authenticated user and tenant identity, including account metadata:

- `id`, `email`, `name`, `role`
- `tenantId`, `tenantName`, `tenantSlug`
- `emailVerified`
- `hasPassword`
- `provider` (`local`, `google`, or `github`)
- `locale`
- `isSuperAdmin`

### `PATCH /auth/me/locale`

**Authentication:** JWT only.  
**Success:** `200 OK`.

Request:

```json
{
  "locale": "ur"
}
```

Allowed locale values are `en`, `ur`, and `ar`.

Response:

```json
{
  "locale": "ur"
}
```

### Google OAuth

| Method and path | Authentication | Behavior |
|---|---|---|
| `GET /auth/google?returnTo=/dashboard` | Public | Starts Google OAuth and redirects to the provider |
| `GET /auth/google/callback` | Provider callback guard | Validates the OAuth state, establishes/links the account, issues a short-lived exchange ticket and redirects to the dashboard callback |

### GitHub OAuth

| Method and path | Authentication | Behavior |
|---|---|---|
| `GET /auth/github?returnTo=/dashboard` | Public | Starts GitHub OAuth and redirects to the provider |
| `GET /auth/github/callback` | Provider callback guard | Validates the OAuth state, establishes/links the account, issues an exchange ticket and redirects to the dashboard callback |

The callback redirects to the configured `APP_ORIGIN` (default `http://localhost:4200`) with `/auth/oauth-callback?ticket=...`.

### `POST /auth/oauth-exchange`

**Authentication:** Public; one-time OAuth ticket is the credential.  
**Success:** `200 OK`.

Request:

```json
{
  "ticket": "<one-time-oauth-ticket>"
}
```

Consumes the ticket and returns the normal session response plus `returnTo`.

### `POST /auth/verify-email`

**Authentication:** Public; verification token is the credential.  
**Success:** `200 OK`.

Request:

```json
{
  "token": "<email-verification-token>"
}
```

Response:

```json
{
  "verified": true,
  "userId": "<user-id>",
  "tenantId": "<tenant-id>"
}
```

### `POST /auth/resend-verification`

**Authentication:** Public.  
**Success:** `200 OK`.

Request:

```json
{
  "email": "zain@example.com"
}
```

Returns the same generic message whether or not the email is eligible for a new verification message:

```json
{
  "message": "If this email exists and is unverified, a new link has been sent."
}
```

### `POST /auth/forgot-password`

**Authentication:** Public.  
**Success:** `200 OK`.

Request:

```json
{
  "email": "zain@example.com"
}
```

Returns a generic response to avoid disclosing whether an account exists:

```json
{
  "message": "If this email exists, a reset link has been sent."
}
```

### `POST /auth/reset-password`

**Authentication:** Public; reset token is the credential.  
**Success:** `200 OK`.

Request:

```json
{
  "token": "<password-reset-token>",
  "password": "A-New-Strong-Password-123!"
}
```

The token must be **at least 64 characters**. The new password uses the same strong-password policy as signup.

Response:

```json
{
  "reset": true
}
```

---

## Tenants

Controller: [`tenants.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/tenants/tenants.controller.ts)

All tenant routes are **JWT-only**.

### `GET /tenants/me`

Returns the authenticated tenant's profile and plan/quota settings.

### `PATCH /tenants/me`

Updates the tenant name.

Request:

```json
{
  "name": "Acme Corp — Production"
}
```

`name` must be 2–80 characters.

### `PATCH /tenants/me/quota`

**Authorization:** JWT; tenant owner only.

Request fields:

| Field | Constraint |
|---|---|
| `eventsPerMonth` | Optional integer, 0–100,000,000 |
| `aiTokensPerMonth` | Optional integer, 0–1,000,000,000 |
| `quotaMode` | Optional `hard` or `soft` |

A non-owner receives `403 Forbidden`.

### `GET /tenants/users`

Lists users belonging to the current tenant. The response includes account identity, role, and relevant login/creation metadata.

---

## Workflows

Controller: [`workflows.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/workflows/workflows.controller.ts)

**Authentication:** JWT or API key. API keys are scope-checked per operation.

### `GET /workflows`

**Scope:** `workflows:read`.

Lists the tenant's workflows, newest first. The response includes each workflow's destination count and a compact schedule projection where a schedule exists.

### `POST /workflows`

**Scope:** `workflows:write`.  
**Success:** `201 Created`.

Request:

```json
{
  "name": "Stripe to Slack",
  "sourceType": "stripe",
  "sourceConfig": {
    "secret": "<source-signing-secret>"
  },
  "enrichmentEnabled": true,
  "enrichmentPrompt": "Summarize and classify the event",
  "transformExpression": null,
  "routingRules": [],
  "isActive": true
}
```

Validation:

| Field | Constraint |
|---|---|
| `name` | String, 2–80 characters |
| `sourceType` | `stripe`, `github`, `shopify`, `slack`, or `generic` |
| `sourceConfig` | Optional object |
| `enrichmentEnabled` | Optional boolean |
| `enrichmentPrompt` | Optional string, maximum 2,000 characters |
| `transformExpression` | Optional string, maximum 2,000 characters |
| `routingRules` | Optional array |
| `isActive` | Optional boolean |

Defaults: `sourceConfig: {}`, `enrichmentEnabled: false`, `routingRules: []`, `isActive: true`.

The create operation **writes the initial workflow and version-1 snapshot in the same database transaction**. It also emits a `workflow.created` outbox event in that transaction.

> **⚠️ Credential handling note:** The current `WorkflowsService` writes `sourceConfig` **directly** to the workflow JSON column and returns the workflow record from create/list/get/update paths **without** calling the connector encryption or redaction helpers. In the audited source, a source signing secret supplied in `sourceConfig.secret` is therefore **not** handled like destination credentials: it is stored as supplied and can appear in workflow JSON responses. The version snapshot also captures the same `sourceConfig`. **Do not assume this field is encrypted or masked by the current Workflow API.**

### `GET /workflows/:id`

**Scope:** `workflows:read`.

Returns the tenant-owned workflow with destinations and its schedule. A missing or cross-tenant workflow returns `404`.

> **⚠️ Response serialization distinction:** This handler returns the Prisma workflow record **directly**. Its `sourceConfig` is returned as stored; included `destinations[].config` values are also returned in their **stored representation** (recognized destination secret fields may therefore appear as `enc:v2:...` ciphertext envelopes here). This is **different** from `GET /workflows/:workflowId/destinations`, whose service explicitly redacts secret config values to `••••••••`.

### `PATCH /workflows/:id`

**Scope:** `workflows:write`.  
**Success:** `200 OK`.

All supported workflow fields are optional. Only supplied properties are changed. The update operation captures a **new workflow version snapshot** and emits a `workflow.updated` outbox event **transactionally**.

### `DELETE /workflows/:id`

**Scope:** `workflows:write`.  
**Success:** `200 OK`.

Deletes the workflow. Database cascade behavior removes dependent resources according to the schema. A `workflow.deleted` outbox event is emitted as part of the delete transaction.

Response:

```json
{
  "deleted": true,
  "id": "<workflow-id>"
}
```

### `GET /workflows/export-all`

**Scope:** `workflows:read`.

Exports every tenant workflow into YAML documents.

Response:

```json
{
  "workflows": [
    {
      "id": "<workflow-id>",
      "name": "Stripe to Slack",
      "filename": "stripe-to-slack-12345678.yaml",
      "yaml": "apiVersion: relayon/v1\nkind: Workflow\n..."
    }
  ]
}
```

### `GET /workflows/:id/export`

**Scope:** `workflows:read`.

Returns a YAML document with `Content-Type: application/x-yaml` and a `Content-Disposition` attachment filename. Secret-valued keys such as `secret`, `apiKey`, `privateKey`, `webhookUrl`, `token`, and `password` are replaced with `${...}` placeholders in the exported YAML.

### `POST /workflows/import`

**Scope:** `workflows:write`.  
**Success:** `201 Created`.

Request:

```json
{
  "mode": "create",
  "yaml": "apiVersion: relayon/v1\nkind: Workflow\nmetadata:\n  name: Imported workflow\n..."
}
```

- `yaml` must be a string of **at least 20 characters**.
- `mode` is optional and must be `create` or `upsert`.
- Default mode is `create`.
- `upsert` looks for a workflow with the **same tenant and name** and updates it when found.
- Exported `${...}` placeholders must be **replaced with real values** before import.

The import response contains `id`, `name`, `destinationsCreated`, and `updated`.

Errors:

- `400` — invalid YAML, wrong `apiVersion`/`kind`, missing required metadata/spec fields, or unresolved secret placeholders.
- `422` — DTO/schema validation failure where applicable.

### `POST /workflows/:id/preview-transform`

**Scope:** `workflows:read`.  
**Success:** `200 OK`.

Compiles and evaluates a JSONata expression against a supplied sample payload.

Request:

```json
{
  "expression": "{ 'event_type': type, 'amount_usd': data.amount / 100 }",
  "samplePayload": {
    "type": "payment.succeeded",
    "data": {
      "amount": 5000
    }
  }
}
```

Success response:

```json
{
  "ok": true,
  "result": {
    "event_type": "payment.succeeded",
    "amount_usd": 50
  },
  "error": null,
  "durationMs": 3
}
```

An empty expression, compile error, evaluation error, or expression timeout is returned as `ok: false` with `result: null` and an explanatory `error`. The evaluation timeout is **2,000 ms**.

### `POST /workflows/:id/test`

**Scope:** `workflows:read`.  
**Success:** `200 OK`.

Invokes the Workers test-processing path for a workflow. It does **not** require the caller to send a webhook through Ingress.

Request:

```json
{
  "payload": {
    "type": "test.event",
    "data": {
      "amount": 5000
    }
  },
  "dryRunDestinations": true
}
```

Both fields are optional; `payload` defaults to `{}` and `dryRunDestinations` defaults to `false`.

The API service calls `WORKERS_URL/internal/process/test` with its configured `CRON_SECRET`. If either environment variable is missing, the endpoint returns a `400` configuration error. This endpoint is **distinct** from the assertion-oriented `POST /workflows/:id/test-run` below.

### `POST /workflows/:id/test-run`

Controller: [`workflow-test.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/workflows/testing/workflow-test.controller.ts)

**Authentication:** JWT only.  
**Success:** `200 OK`.

Runs the workflow test pipeline and evaluates assertion steps against the transformed payload.

Request:

```json
{
  "payload": {
    "type": "order.created",
    "data": {
      "total": 125
    }
  },
  "steps": [
    {
      "id": "has-type",
      "assert": "type = 'order.created'",
      "description": "The expected event type is present"
    }
  ]
}
```

- `payload` is optional and must be an object.
- `steps` is **required**, 1–50 entries.
- Each step requires `id` (1–80 characters) and `assert` (1–2,000 characters); `description` is optional (maximum 200 characters).

Response shape:

```json
{
  "pipeline": {},
  "assertions": {},
  "allPassed": true
}
```

The exact `pipeline` and `assertions` fields depend on the executed workflow and assertion results.

---

## Workflow Versions

Controller: [`workflows.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/workflows/workflows.controller.ts)

**Authentication:** JWT or API key.

### `GET /workflows/:id/versions`

**Scope:** `workflows:read`.

Lists version summaries (version number, message, author and timestamp).

### `GET /workflows/:id/versions/:version`

**Scope:** `workflows:read`.

Returns the selected version including its snapshot. `version` is parsed as an integer.

### `GET /workflows/:id/versions/:a/diff/:b`

**Scope:** `workflows:read`.

Returns a unified, line-level diff between two snapshots.

Response shape:

```json
{
  "fromVersion": 1,
  "toVersion": 2,
  "identical": false,
  "stats": {
    "added": 1,
    "removed": 1
  },
  "unified": "--- v1\n+++ v2\n..."
}
```

`identical` is true and `unified` is empty when the snapshots are equal. The diff is based on **serialized snapshot content**; it is not a semantic field-level patch.

### `POST /workflows/:id/versions/:version/restore`

**Scope:** `workflows:write`.  
**Success:** `200 OK`.

Restores a historical snapshot. A restore is recorded as a **new version** so that history remains linear. Destinations are **recreated** from the snapshot; restored destination IDs may therefore differ from the previous IDs.

The current version-retention policy keeps at most **50 snapshots** per workflow.

> **⚠️ Version snapshots retain the source configuration and destination config as captured by the workflow service. In particular, the workflow source configuration noted above is NOT redacted by the version read path in the audited code; protect version API responses accordingly.**

---

## Destinations

Controller: [`destinations.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/destinations/destinations.controller.ts)

**Authentication:** **JWT only.** The current destination controller does **not** accept API keys, even though destination scopes exist in the API-key schema.

### `GET /destinations/adapters`

Returns the adapter catalogue discovered from Workers.

Response:

```json
{
  "adapters": []
}
```

When `WORKERS_URL` or `CRON_SECRET` is unavailable, or Workers cannot be reached, the endpoint returns an **empty adapter array and a warning**. The adapter list is fetched from `GET <WORKERS_URL>/internal/adapters`.

### `GET /workflows/:workflowId/destinations`

Lists destinations for a tenant-owned workflow. Secret config values are **redacted** in client responses.

### `POST /workflows/:workflowId/destinations`

**Success:** `201 Created`.

Request:

```json
{
  "type": "http",
  "name": "Production webhook",
  "config": {
    "url": "https://example.com/events",
    "method": "POST"
  },
  "enabled": true
}
```

Current **DTO-accepted** destination types:

- `http`
- `slack`
- `email`
- `sheets`
- `postgres`
- `mongodb`

The DTO requires:

- `type`: one of the six values above
- `name`: 2–80 characters
- `config`: object
- `enabled`: optional boolean

Secret config fields are **encrypted at rest**. When `FULL_CONFIG_ENCRYPTION=true`, the service encrypts **all supported config fields** rather than only recognized secret fields. Destination API responses use redaction; clients should not expect to read stored ciphertext.

### Destination Config Examples

**HTTP**

```json
{
  "url": "https://example.com/webhook",
  "method": "POST",
  "headers": {
    "X-Source": "relayon"
  }
}
```

**Slack**

```json
{
  "webhookUrl": "https://hooks.slack.com/services/..."
}
```

**Email (Resend)**

```json
{
  "apiKey": "re_...",
  "to": ["ops@example.com"],
  "from": "Relayon <noreply@example.com>"
}
```

**Google Sheets**

```json
{
  "spreadsheetId": "<spreadsheet-id>",
  "range": "Sheet1!A:Z",
  "serviceAccountEmail": "service-account@example.iam.gserviceaccount.com",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
}
```

**PostgreSQL**

```json
{
  "connectionString": "postgresql://user:password@host:5432/database",
  "table": "events",
  "columns": {
    "type": "event_type",
    "data.amount": "amount_cents"
  },
  "onConflict": "id",
  "ssl": true
}
```

**MongoDB**

```json
{
  "connectionString": "mongodb+srv://user:password@cluster.example/database",
  "database": "application",
  "collection": "events",
  "upsertKey": "eventId"
}
```

### `PATCH /destinations/:id`

Updates `name`, `config`, and/or `enabled`. The destination `type` is **not** part of the update DTO.

If the client sends the redaction mask `••••••••` for an existing secret field, the service **preserves the stored value** instead of replacing it with the mask.

### `DELETE /destinations/:id`

**Success:** `200 OK`.

Response:

```json
{
  "deleted": true,
  "id": "<destination-id>"
}
```

### `POST /destinations/validate`

**Success:** `200 OK`.

Validates a destination config. Validation can be schema-only or schema plus a Workers dry-run.

Request:

```json
{
  "type": "postgres",
  "config": {
    "connectionString": "postgresql://user:password@host/database",
    "table": "events"
  },
  "dryRun": true,
  "destinationId": "<optional-existing-destination-id>"
}
```

The request DTO currently accepts the **same six types** as destination creation.

Response shape:

```json
{
  "ok": true,
  "layer": "both",
  "errors": [],
  "warnings": [],
  "dryRun": {
    "attempted": true,
    "success": true,
    "latencyMs": 12,
    "detail": "..."
  }
}
```

`layer` is:

- `schema` — schema validation only (dry-run not requested, skipped, or unable to reach Workers)
- `both` — schema and dry-run executed

The response uses **HTTP `200` for validation success and validation failure**; inspect `ok`, `errors`, `warnings`, and `dryRun`. When Workers are unavailable, the service can return `ok: true` with a warning and `dryRun: null`. **Do not interpret a skipped dry-run as proof of destination connectivity.**

> **⚠️ Validation caveat:** The Worker registry currently contains **nine** built-in adapters (`http`, `slack`, `email`, `sheets`, `discord`, `airtable`, `notion`, `postgres`, `mongodb`), but the API's `CreateDestinationDto` and `ValidateDestinationDto` currently accept only **six** (`http`, `slack`, `email`, `sheets`, `postgres`, `mongodb`). The three adapter types **`discord`, `airtable`, and `notion` are therefore discoverable in the worker catalogue but rejected by these two DTOs** in the audited snapshot. See [Implementation Notes](#implementation-notes-and-known-contract-edges).

---

## Schedules

Controllers: [`schedules.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/schedules/schedules.controller.ts), [`schedules-bulk.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/schedules/schedules-bulk.controller.ts)

Per-workflow schedule routes accept **JWT or API keys**:

- read: `workflows:read`
- write: `workflows:write`

Bulk schedule routes are **JWT-only**.

### `GET /workflows/:workflowId/schedule`

**Scope:** `workflows:read`.

Returns the schedule object or `null` when none is configured.

### `PUT /workflows/:workflowId/schedule`

**Scope:** `workflows:write`.

Creates or replaces a schedule.

Request:

```json
{
  "cronExpression": "0 9 * * *",
  "timezone": "Asia/Karachi",
  "payloadTemplate": {
    "report": "daily"
  },
  "isActive": true
}
```

Validation:

- `cronExpression`: required string, 9–120 characters, standard five-field cron syntax; allowed characters are digits, `*`, `,`, `-`, `/`, and spaces.
- `timezone`: optional IANA timezone string (maximum 64 characters); defaults to `UTC` when omitted.
- `payloadTemplate`: optional JSON object; defaults to `{}`.
- `isActive`: optional boolean; defaults to `true`.

The service parses the cron expression with the specified timezone and computes `nextRunAt` **at save time**. Invalid expression/timezone input is rejected.

### `DELETE /workflows/:workflowId/schedule`

**Scope:** `workflows:write`.  
**Success:** `200 OK`.

Deletes that workflow's schedule.

Response:

```json
{
  "deleted": true,
  "workflowId": "<workflow-id>"
}
```

### `POST /workflows/:workflowId/schedule/run-now`

**Scope:** `workflows:write`.  
**Success:** `200 OK`.

Triggers the configured schedule immediately through Workers. The regular `nextRunAt` value is **not** changed; the scheduled cadence remains in place. `lastRunAt` is updated after the worker accepts the operation.

Response shape:

```json
{
  "triggered": true,
  "workflowId": "<workflow-id>",
  "correlationId": "<correlation-id>",
  "timestamp": "2026-11-24T10:00:00.000Z"
}
```

Requires `WORKERS_URL` and `CRON_SECRET` in the API environment.

### `POST /schedules/bulk/pause-all`

**Authentication:** JWT only.  
**Success:** `200 OK`.

Pauses all active schedules for the current tenant. Workflows themselves remain active.

Response:

```json
{
  "updated": 5
}
```

### `POST /schedules/bulk/resume-all`

**Authentication:** JWT only.  
**Success:** `200 OK`.

Resumes paused schedules and **recomputes** each `nextRunAt` from the current time so a schedule does **not** immediately fire merely because its old due time passed while paused.

Response:

```json
{
  "updated": 5
}
```

### `POST /schedules/bulk/delete`

**Authentication:** JWT only.  
**Success:** `200 OK`.

Deletes every schedule belonging to the current tenant. Workflows are **not** deleted.

Response:

```json
{
  "deleted": 5
}
```

---

## Events

Controller: [`events.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/events/events.controller.ts)

**Authentication:** JWT or API key.

### `GET /events`

**Scope:** `events:read`.

Query parameters:

| Parameter | Meaning |
|---|---|
| `workflowId` | Optional workflow filter |
| `status` | Optional event-status filter |
| `limit` | Optional page size; defaults to 25 |
| `cursor` | Optional cursor returned by the previous page |

Response shape:

```json
{
  "items": [
    {
      "_id": "<mongo-event-id>",
      "correlationId": "<correlation-id>",
      "workflowId": "<workflow-id>",
      "sourceType": "stripe",
      "status": "processed",
      "receivedAt": "2026-11-24T10:00:00.000Z",
      "processedAt": "2026-11-24T10:00:01.000Z",
      "hasEnrichment": false,
      "hasError": false
    }
  ],
  "nextCursor": "<cursor-or-null>"
}
```

`nextCursor` is `null` when no further page exists.

### `GET /events/:id`

**Scope:** `events:read`.

Returns one event with its processing/enrichment fields and associated delivery records. A missing or cross-tenant event returns `404`.

### `POST /events/:id/replay`

**Scope:** `events:read`.  
**Success:** `200 OK`.

Requests replay/reprocessing of the selected tenant-owned event. The endpoint is **intentionally annotated with `events:read`** in the current source; there is **no** separate `events:write` scope.

---

## Dead-Letter Queue

Controller: [`dlq.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/dlq/dlq.controller.ts)

**Authentication:** JWT or API key.

### `GET /dlq`

**Scope:** `dlq:read`.

Query parameters:

- `limit` — optional; defaults to 25.
- `cursor` — optional pagination cursor.

Returns tenant-scoped delivery records currently in the dead-letter queue, including attempts, last response/error and DLQ timestamp where present.

### `POST /dlq/:id/replay`

**Scope:** `dlq:write`.  
**Success:** `200 OK`.

Resets/requeues one DLQ delivery for another delivery attempt.

### `POST /dlq/bulk-replay`

**Scope:** `dlq:write`.  
**Success:** `200 OK`.

Request:

```json
{
  "ids": ["<delivery-id-1>", "<delivery-id-2>"]
}
```

`ids` must contain 1–100 strings. The service deduplicates IDs and returns a summary with `total`, `replayed`, `failed`, and per-ID failure reasons.

### `POST /dlq/bulk-discard`

**Scope:** `dlq:write`.  
**Success:** `200 OK`.

Uses the **same request validation** as bulk replay: 1–100 string IDs. Permanently discards the selected tenant-owned DLQ records and returns a per-batch result summary.

### `DELETE /dlq/:id`

**Scope:** `dlq:write`.  
**Success:** `200 OK`.

Permanently discards one DLQ delivery.

---

## Analytics

Controller: [`analytics.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/analytics/analytics.controller.ts)

**Authentication:** JWT or API key.  
**Scope for every route:** `analytics:read`.

| Method and path | Description |
|---|---|
| `GET /analytics/overview` | Tenant event/delivery overview |
| `GET /analytics/delivery` | Delivery breakdown by status and destination |
| `GET /analytics/cost` | 30-day estimated usage/cost summary |
| `GET /analytics/timeseries?range=24h` | Time-series buckets |

### Time-series Range

`range` accepts `24h`, `7d`, or `30d`. Any missing or unrecognized value falls back to `24h`.

The response contains:

- `range`
- `unit` (`hour` or `day`)
- `buckets`, with timestamp and event/delivery counters

The service fills empty time buckets with zero-valued entries for a continuous series.

### Cost Analytics

The cost endpoint returns **estimates, not provider invoices**. Values are based on application-side event/token/command estimates and documented assumptions. Consumers should **not** treat the result as authoritative billing data.

---

## API Keys

Controller: [`api-keys.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/api-keys/api-keys.controller.ts)

**Authentication:** **JWT only.** API keys **cannot** manage, enumerate, revoke, or rotate other API keys.

### `GET /api-keys`

Lists key metadata for the current tenant. The raw key and stored hash are **not** returned.

Typical fields: `id`, `name`, `prefix`, `scopes`, `environment`, `lastUsedAt`, `expiresAt`, `revokedAt`, `createdAt`.

### `GET /api-keys/rotations/history`

Returns key rotation lineage/history for the current tenant.

### `POST /api-keys`

**Success:** `201 Created`.

Request:

```json
{
  "name": "CI pipeline",
  "scopes": ["events:read", "workflows:read"],
  "environment": "live",
  "neverExpires": false
}
```

Validation:

- `name`: 2–60 characters.
- `scopes`: at least one allowed scope; every value must be in the scope list above.
- `environment`: optional `live` or `test`; defaults to `live`.
- `neverExpires`: optional boolean; defaults to normal 90-day expiry.

Response includes key metadata and `rawKey`. **The raw key is returned once only.** Save it securely when it is created.

### `DELETE /api-keys/:id`

**Success:** `200 OK`.

Revokes the key **immediately**. Future use returns `401`.

### `POST /api-keys/:id/rotate`

**Success:** `200 OK`.

Creates a new key with the **same environment and scopes**. The old key remains usable until its capped expiry/grace time (up to **24 hours**).

Response shape:

```json
{
  "oldKeyId": "<old-key-id>",
  "newKey": {
    "id": "<new-key-id>",
    "name": "CI pipeline (rotated)",
    "prefix": "rlk_live_<prefix>",
    "scopes": ["events:read", "workflows:read"],
    "environment": "live",
    "expiresAt": "<iso-date-or-null>",
    "createdAt": "<iso-date>",
    "rawKey": "<new-raw-key>"
  },
  "oldKeyRevokeAt": "<iso-date>"
}
```

The new raw key is returned **once**. The grace period is capped by the old key's earlier existing expiry if that expiry occurs before 24 hours.

---

## Billing

Controller: [`billing.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/billing/billing.controller.ts)

### `GET /billing/status`

**Authentication:** JWT only.

Returns the current tenant billing/subscription status.

### `POST /billing/checkout`

**Authentication:** JWT only.

Request:

```json
{
  "priceId": "price_123456789"
}
```

`priceId` must match the Stripe price ID pattern `price_<letters-or-digits>`. The service creates a Stripe Checkout session and returns its checkout information.

### `POST /billing/portal`

**Authentication:** JWT only.

Creates a Stripe customer-portal session for the tenant. The return origin is taken from the request `Origin` header, then `APP_ORIGIN`, then the local dashboard default.

### `POST /billing/webhook`

**Authentication:** Public route with Stripe signature verification.  
**Success:** `200 OK`.

Required header:

```http
Stripe-Signature: t=<timestamp>,v1=<signature>
```

The controller constructs the Stripe event from the **raw request body** and passes it to billing event handling.

Response:

```json
{
  "received": true
}
```

Invalid signature or malformed event construction is rejected.

---

## Provider Integrations and BYOK

Controller: [`integrations.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/integrations/integrations.controller.ts)

Base path: `/settings/integrations`  
**Authentication:** JWT only.

Supported provider identifiers in the DTO:

- `groq`
- `openai`
- `anthropic`
- `resend`

| Method and path | Description |
|---|---|
| `GET /settings/integrations` | List tenant provider integrations |
| `GET /settings/integrations/status` | Return provider configuration status |
| `POST /settings/integrations` | Store/update provider key and optional model |
| `POST /settings/integrations/test` | Test a supplied provider key without saving it |
| `POST /settings/integrations/:provider/toggle` | Toggle one configured provider |
| `DELETE /settings/integrations/:provider` | Remove a provider integration |

Upsert request:

```json
{
  "provider": "groq",
  "apiKey": "<provider-api-key>",
  "model": "llama-3.3-70b-versatile",
  "isActive": true
}
```

`apiKey` must be 20–500 characters; `model` is optional (maximum 120 characters); `isActive` is optional.

> **⚠️ Role check:** Only tenant owners and admins can call the integration **upsert** route. The controller's test, toggle, list/status and delete routes require JWT but **do not repeat** that owner/admin check.

Provider keys are managed by the integration service and used by the provider-key resolver for tenant BYOK behavior.

---

## AI Assistant

Controller: [`ai.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/ai/ai.controller.ts)

**Authentication:** JWT only.

### `GET /ai/status`

Returns whether the tenant has a resolvable Groq key, the active model/key source, and feature metadata.

The current implementation describes:

- tool calling: enabled
- retrieval: PostgreSQL full-text search (`postgres-fts`)
- streaming: **simulated SSE framing**, not provider-native token streaming

### `POST /ai/chat`

**Success:** `200 OK`, `Content-Type: text/event-stream`.

Request:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Summarize my recent delivery failures."
    }
  ]
}
```

Validation:

- `messages`: 1–30 entries.
- Each `role`: `user` or `assistant`.
- Each `content`: 1–4,000 characters.

The response is **Server-Sent Events**. Each event is framed as:

```text
data: {"type":"<event-type>","data":{...}}

```

The controller emits agent events until `done` or `error`; a disconnected client aborts the agent request. Read the event `type` and `data` rather than expecting a single JSON response body.

### `POST /ai/admin/ingest`

Controller: [`ingest.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/ai/ingest.controller.ts)

**Authentication:** JWT; tenant owner only.  
**Success:** `200 OK`.

Triggers the knowledge-document ingestion/indexing operation used by the AI assistant. Non-owner users receive `403`.

---

## Quota and Usage Export

Controllers: [`quota.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/quota/quota.controller.ts), [`usage-export.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/quota/usage-export.controller.ts)

Both routes are **JWT-only**.

### `GET /quota`

Returns the current UTC month quota snapshot.

Response shape:

```json
{
  "period": "2026-11",
  "mode": "hard",
  "metrics": {
    "events": {
      "used": 120,
      "limit": 10000,
      "remaining": 9880,
      "resetAt": "2026-12-01T00:00:00.000Z"
    },
    "ai_tokens": {
      "used": 4000,
      "limit": 100000,
      "remaining": 96000,
      "resetAt": "2026-12-01T00:00:00.000Z"
    },
    "deliveries": {
      "used": 150,
      "limit": 10000,
      "remaining": 9850,
      "resetAt": "2026-12-01T00:00:00.000Z"
    }
  }
}
```

The sample limits are **illustrative, not universal defaults**. Actual limits come from the tenant's quota configuration. `deliveries` currently uses the tenant **event quota value** as its limit.

### `GET /usage/export?period=YYYY-MM`

Streams tenant usage as CSV.

- `period` is optional and accepts the `YYYY-MM` shape.
- Missing or malformed period falls back to the current UTC month.
- The file name is tenant-scoped and period-specific.
- CSV columns: `period`, `metric`, `used`, `limit`, `remaining`, `updated_at`.

---

## Outbound Webhook Endpoints

Controller: [`webhook-endpoints.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/webhooks/webhook-endpoints.controller.ts)

**Authentication:** JWT only.

These endpoints register **tenant-owned destinations for Relayon-generated outbound platform events**. They are **distinct** from workflow destinations used to forward inbound customer webhooks.

| Method and path | Description |
|---|---|
| `GET /webhook-endpoints` | List tenant outbound webhook endpoints |
| `POST /webhook-endpoints` | Create an endpoint |
| `POST /webhook-endpoints/:id/toggle` | Enable/disable an endpoint |
| `DELETE /webhook-endpoints/:id` | Remove an endpoint |

Create request:

```json
{
  "url": "https://customer.example.com/relayon-events",
  "description": "Production event consumer",
  "eventTypes": ["workflow.created", "workflow.updated"]
}
```

Validation:

- `url` is required, must include a protocol, and is limited to 500 characters.
- `description` is optional and limited to 200 characters.
- `eventTypes` is an optional array of strings.

Outbox deliveries use **Standard Webhooks-style signature headers** (`webhook-id`, `webhook-timestamp`, and `webhook-signature`) in the delivery path. Delivery is **asynchronous**; endpoint creation does not mean a consumer has received an event.

---

## Operational Cron and Outbox

These routes are on the **Dashboard API**, not the Workers API. They are guarded by `X-Cron-Secret`.

### Maintenance Endpoints

Controller: [`cron.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/cron/cron.controller.ts)

| Method and path | Purpose |
|---|---|
| `POST /cron/retention-cleanup?dryRun=true` | Delete `page_events` older than 90 days; dry-run reports the count |
| `POST /cron/token-cleanup?dryRun=true` | Delete old email-verification and password-reset token rows |
| `POST /cron/audit-cleanup?dryRun=true` | Delete admin audit rows older than one year |

`dryRun` accepts `true` or `1`. These jobs use PostgreSQL **advisory locks**; if another instance holds the lock, the result reports that the job was skipped because the lock is held.

### Outbox Poller Endpoints

Controller: [`outbox-poller.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/webhooks/outbox-poller.controller.ts)

| Method and path | Purpose |
|---|---|
| `POST /cron/outbox/tick` | Poll and deliver pending outbox events |
| `GET /cron/outbox/stats` | Aggregate pending/delivered/failed counts and 24-hour totals |
| `POST /cron/outbox/retry?id=<outbox-event-uuid>` | Reset one failed outbox event to pending |

The retry route expects an `id` **query parameter**. It resets a matching failed event; it does **not** accept an ID in the request body.

---

## Playground

Controllers: [`playground.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/playground/playground.controller.ts)

**Authentication:** JWT only.

The playground provides short-lived request-capture sessions for testing integrations. Ingress captures requests under `/play/:sessionId`; the Dashboard API manages sessions.

| Method and path | Description |
|---|---|
| `POST /playground/sessions` | Create a new capture session |
| `GET /playground/sessions` | List current user's capture sessions |
| `GET /playground/sessions/:id` | Retrieve a session and its captured requests |
| `DELETE /playground/sessions/:id` | Delete a session |

Create request:

```json
{
  "name": "Stripe test capture"
}
```

Response shape:

```json
{
  "id": "<session-id>",
  "name": "Stripe test capture",
  "captureUrl": "https://relayon-ingress.vercel.app/play/<session-id>",
  "expiresAt": "<iso-date>",
  "createdAt": "<iso-date>"
}
```

Sessions have a **one-hour TTL** and up to **100 captured requests per session** in the current service. Captured requests are held in **Redis** (ephemeral), not persisted to PostgreSQL/MongoDB.

---

## Presence and Tracking

Controller: [`presence.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/presence/presence.controller.ts)

### `POST /presence/heartbeat`

**Authentication:** JWT only.

Records a live-presence heartbeat for the authenticated session. The dashboard refreshes this every **15 seconds**; the Redis presence record uses a **45-second TTL** so stale sessions drop off automatically.

Request body: none required.

Response:

```json
{
  "ok": true,
  "seenAt": "2026-11-24T10:00:00.000Z"
}
```

### `GET /admin/presence`

**Authentication:** JWT; super-admin only.

Returns active sessions across tenants for the admin presence view. Supports optional `tenantId` filter.

Presence is **ephemeral** and derived from Redis TTL, not from a durable audit table.

### Product page tracking

Controller: [`tracking.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/tracking/tracking.controller.ts)

### `POST /track/batch`

**Authentication:** Public (bounded event fields).

Accepts batched page-view/product events. Client IPs are **hashed** with `IP_HASH_SALT` before storage; raw IPs are never stored. Events are stored in PostgreSQL `page_events` and cleaned up by the `POST /cron/retention-cleanup` job after **90 days**.

Request:

```json
{
  "events": [
    {
      "type": "page_view",
      "path": "/dashboard",
      "referrer": "https://google.com"
    }
  ]
}
```

---

## CLI Tunnel Sessions

Controller: [`tunnel.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/tunnel/tunnel.controller.ts)

**Authentication:** JWT or API key (the `@Relayon/cli` package authenticates via API key).

The tunnel provides a temporary public URL that captures inbound webhook requests and forwards them to a developer's local application — an ngrok alternative.

| Method and path | Description |
|---|---|
| `POST /tunnel/sessions` | Create a tunnel session |
| `GET /tunnel/sessions` | List the tenant's active tunnel sessions |
| `GET /tunnel/sessions/:id` | Retrieve a session (metadata only) |
| `DELETE /tunnel/sessions/:id` | End a tunnel session |

Create request:

```json
{
  "localPort": 3000,
  "label": "Local dev"
}
```

Response shape:

```json
{
  "id": "<session-id>",
  "publicUrl": "https://relayon-ingress.vercel.app/t/<session-id>",
  "sseUrl": "https://relayon-ingress.vercel.app/t/<session-id>/stream",
  "localPort": 3000,
  "expiresAt": "<iso-date>",
  "createdAt": "<iso-date>"
}
```

Tunnel sessions expire after **24 hours** in the current service. The SSE stream (`/t/:sessionId/stream`) is **stateful** on the Ingress side; the CLI reconnects on disconnect. Sensitive headers such as `Authorization` and `Cookie` are **stripped** before forwarding to the local application.

> **This is a development tunnel, not a replacement for the production workflow ingress endpoint.**

---

## Community

Controller: [`community.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/community/community.controller.ts)

**Authentication:** JWT required for write operations; public read endpoints also listed below where applicable.

### Posts

| Method and path | Description |
|---|---|
| `GET /community/posts` | Cursor-paginated list of published posts |
| `GET /community/posts/:id` | Retrieve a post with replies |
| `POST /community/posts` | Create a post |
| `PATCH /community/posts/:id` | Update an owned post |
| `DELETE /community/posts/:id` | Delete an owned post |
| `POST /community/posts/:id/replies` | Add a reply |
| `POST /community/posts/:id/like` | Like/unlike a post |
| `POST /community/posts/:id/flag` | Report a post |

Create post request:

```json
{
  "title": "Stripe → Slack with AI enrichment",
  "body": "How I set up severity classification...",
  "tags": ["stripe", "slack", "ai"]
}
```

Post creation and reply creation are **rate-limited hourly** by the community service. The post author can mark a reply as the accepted solution.

### Templates

| Method and path | Description |
|---|---|
| `GET /community/templates` | List published workflow templates |
| `POST /community/templates/:id/import` | Import a template's workflow YAML into the current tenant |

Template YAML is validated for the expected Relayon workflow structure before being accepted. Importing a template creates a **new workflow** in the caller's tenant; the caller must still supply tenant-owned credentials before the imported workflow can deliver anything.

### Announcements

| Method and path | Description |
|---|---|
| `GET /announcements` | Public list of published announcements |
| `GET /announcements/:id` | Public announcement detail |

Announcement **creation** is a platform-admin operation; see [Platform Administration](#platform-administration).

### Moderation visibility

Public listings exclude posts that are hidden, removed, or otherwise not in a published state. Moderation actions and flag resolution are recorded and visible to platform administrators.

---

## Platform Administration

Controllers: [`admin.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/admin/admin.controller.ts) and sub-modules under `admin/` (feature-flags, impersonation, moderation, social, time-travel).

**Authentication:** JWT; **super-admin only**. This is a distinct platform-level authorization, not a tenant owner/admin role.

### Overview and Observability

| Method and path | Description |
|---|---|
| `GET /admin/overview` | Platform-level aggregate counts (tenants, users, workflows, events) |
| `GET /admin/health` | Connectivity and dependency status (PostgreSQL, MongoDB, Redis) |
| `GET /admin/presence` | Active-session view (see Presence section) |
| `GET /admin/audit` | Admin audit-log records |
| `GET /admin/tracking` | Traffic/presence analytics foundation |

### Tenants

| Method and path | Description |
|---|---|
| `GET /admin/tenants` | Paginated tenant list |
| `GET /admin/tenants/:id` | Tenant detail: plan, subscription, limits, usage, users, recent keys |
| `PATCH /admin/tenants/:id` | Adjust tenant configuration (plan, limits) |

### Users

| Method and path | Description |
|---|---|
| `GET /admin/users` | Search users and inspect tenant association/role |
| `PATCH /admin/users/:id` | Adjust a user (super-admin, role) |

### Impersonation

| Method and path | Description |
|---|---|
| `POST /admin/impersonation/start` | Start a short-lived tenant-scoped support session |
| `POST /admin/impersonation/end` | End the current impersonation session |
| `GET /admin/impersonation/active` | List active (un-ended) impersonation sessions |

Impersonation sessions have a **15-minute expiry** in the current service. Start and end actions are **separately audited** into `AdminAuditLog`.

### Moderation

| Method and path | Description |
|---|---|
| `GET /admin/moderation/flags` | List open flags with content and author context |
| `POST /admin/moderation/flags/:id/resolve` | Resolve a flag (dismiss or action) |
| `POST /admin/moderation/posts/:id/hide` | Hide a post |
| `POST /admin/moderation/posts/:id/restore` | Restore a hidden/removed post |
| `POST /admin/moderation/posts/:id/remove` | Remove a post |

Moderation actions update content state and create **moderation audit records**. Three pending flags on the same content trigger an **auto-hide** in the current implementation.

### Announcements

| Method and path | Description |
|---|---|
| `POST /admin/announcements` | Create an announcement |
| `PATCH /admin/announcements/:id` | Update an announcement |
| `DELETE /admin/announcements/:id` | Delete an announcement |
| `POST /admin/announcements/:id/share` | Share to supported social destination (Twitter API v2 + share intents) |

### Time-Travel

Controller: [`time-travel.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/admin/time-travel/time-travel.controller.ts)

| Method and path | Description |
|---|---|
| `GET /admin/time-travel?tenantId=<id>&timestamp=<iso>` | Reconstruct selected tenant/workflow state at a historical timestamp |

Time-travel reconstructs state from **version snapshots and retained audit records**. It **rejects future timestamps**. This is a **reconstruction/forensics feature**, **not** a full point-in-time restore of transient Redis/MongoDB state or external side effects.

---

## Feature Flags

Controller: [`feature-flags-admin.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/admin/feature-flags/feature-flags-admin.controller.ts)

**Authentication:** JWT; super-admin only.

| Method and path | Description |
|---|---|
| `GET /admin/feature-flags` | List all flags |
| `POST /admin/feature-flags` | Create a flag |
| `PATCH /admin/feature-flags/:id` | Update a flag (enabled, percentage, tenant overrides) |
| `DELETE /admin/feature-flags/:id` | Delete a flag |

Flags are cached in the API process and refresh at a **30-second interval**. Evaluation supports:

- Global enabled value
- Percentage rollout
- Tenant override

A tenant-specific override takes priority. Missing flags evaluate as **disabled**.

> **Feature flags are a rollout control, not an authorization boundary.** Do not rely on a feature flag as the sole guard for sensitive APIs.

---

# Ingress API

Base URL:

```text
https://relayon-ingress.vercel.app
```

Ingress is an **Express 5** application with **no global prefix**.

## Webhook Receiver

### `POST /webhook/:tenantId/:workflowId`

**Authentication:** Source-specific HMAC signature. No JWT.

Receives a webhook for the specified tenant and workflow. The raw body bytes are used for signature verification (JSON parser preserves raw buffer).

Optional headers (idempotency / correlation):

```http
X-Correlation-Id: my-tracking-id
X-Event-Id: evt-unique-id
```

If `X-Event-Id` is not provided, a body hash is used as the idempotency key.

Body: arbitrary JSON, **5 MB limit**.

Response `202 Accepted`:

```json
{
  "status": "accepted",
  "correlationId": "<uuid>",
  "message": "Event queued for processing"
}
```

Response `200 OK` (duplicate):

```json
{
  "status": "duplicate",
  "message": "Event already processed",
  "correlationId": "<uuid>"
}
```

Errors:

- `400 Bad Request` — invalid JSON or non-object payload
- `401 Unauthorized` — signature verification failed
- `404 Not Found` — workflow doesn't exist, is inactive, or belongs to another tenant
- `413 Payload Too Large` — body > 5 MB
- `429 Too Many Requests` — tenant rate limit exceeded (see [Rate Limits](#rate-limits-and-quotas))
- `500 Internal Server Error` — dependency failure (DB, Redis, or quota check)

> **A `202` means admitted to the Redis queue, not delivered to the destination.** See [Architecture §6](./ARCHITECTURE.md#6-inbound-webhook-architecture) for the full path.

## Playground Capture

### `ALL /play/:sessionId`

Captures any HTTP request to the playground session's URL. The captured request is stored in **Redis** (ephemeral, one-hour TTL, max 100 requests per session) and appears in the dashboard playground view.

Returns an acknowledgment response to the caller. Does **not** forward to any destination.

## Tunnel Capture

### `ALL /t/:sessionId`

Captures an inbound request and forwards it to the CLI's SSE stream for delivery to the developer's local application.

### `GET /t/:sessionId/stream`

Server-Sent Events stream. The CLI (`@relayon/cli`) connects here and receives captured requests in real time. On disconnect, the CLI reconnects automatically.

Sensitive headers such as `Authorization`, `Cookie`, and `X-API-Key` are **stripped** before forwarding.

## Ingress Health

### `GET /health`

**Authentication:** Public.

Response `200`:

```json
{
  "status": "ok",
  "checks": {
    "db": "up",
    "redis": "up"
  },
  "version": "0.1.0",
  "timestamp": "2026-11-24T10:00:00.000Z"
}
```

---

# Workers API

Base URL:

```text
https://relayon-workers.vercel.app/internal
```

All routes require `X-Cron-Secret: <secret>` header (except `/internal/health` — see below).

## Processing

### `POST /internal/process`

Pops events from `queue:events:incoming`, runs AI enrichment, transform, routing, writes to MongoDB, fans out to egress.

**Response `200`:**

```json
{
  "processed": 3,
  "succeeded": 3,
  "failed": 0,
  "skipped": 0,
  "durationMs": 4521,
  "breakdown": {
    "enriched": 3,
    "enrichmentCacheHits": 0,
    "enrichmentFailures": 0,
    "transformed": 1,
    "egressJobsQueued": 4
  }
}
```

Behavior:

- Processes up to `BATCH_SIZE` events (default **3**)
- Stops after `TIME_BUDGET_MS` (default **7000 ms**)
- Remaining events stay in queue for next invocation

### `POST /internal/process/test`

Runs the workflow processing pipeline against a **sample payload** without creating production events or egress deliveries. Called by the API's `POST /api/workflows/:id/test`.

Request:

```json
{
  "workflowId": "<workflow-id>",
  "payload": { "type": "test.event" },
  "dryRunDestinations": true
}
```

Returns stage-level results (enrichment, transform, routing) but does **not** invoke destination adapters when `dryRunDestinations: false` (default).

## Delivery and Replay

### `POST /internal/deliver`

Pops deliveries from `queue:egress:pending`, attempts delivery, retries or DLQs on failure.

**Response `200`:**

```json
{
  "processed": 4,
  "delivered": 3,
  "retried": 1,
  "dlq": 0,
  "skipped": 0,
  "stuckRecovered": 0,
  "durationMs": 2340
}
```

## Queue and Egress Status

### `GET /internal/status`

**Response `200`:**

```json
{
  "incoming": 5,
  "processing": 0,
  "egress": 12,
  "timestamp": "2026-11-24T10:00:00.000Z"
}
```

### `GET /internal/egress/stats`

**Response `200`:**

```json
{
  "pending": 12,
  "delayed": 3,
  "delivered24h": 308,
  "dlq": 2
}
```

## Adapter Catalogue and Dry-Run

### `GET /internal/adapters`

Lists all registered adapters discovered via the `@DestinationAdapter` decorator.

**Response `200`:**

```json
[
  { "type": "http", "displayName": "HTTP Webhook", "configSchema": { "required": ["url"], "optional": ["method", "headers"] } },
  { "type": "slack", "displayName": "Slack", "configSchema": { "required": ["webhookUrl"] } },
  { "type": "email", "displayName": "Email (Resend)", "configSchema": { "required": ["apiKey", "to", "from"] } },
  { "type": "sheets", "displayName": "Google Sheets", "configSchema": { "required": ["spreadsheetId", "range", "serviceAccountEmail", "privateKey"] } },
  { "type": "discord", "displayName": "Discord", "configSchema": { "required": ["webhookUrl"] } },
  { "type": "airtable", "displayName": "Airtable", "configSchema": { "required": ["apiKey", "baseId", "tableName"], "optional": ["typecast"] } },
  { "type": "notion", "displayName": "Notion", "configSchema": { "required": ["apiKey", "dataSourceId", "titleProperty"] } },
  { "type": "postgres", "displayName": "PostgreSQL", "configSchema": { "required": ["connectionString", "table"], "optional": ["columns", "onConflict", "ssl"] } },
  { "type": "mongodb", "displayName": "MongoDB", "configSchema": { "required": ["connectionString", "database", "collection"], "optional": ["upsertKey"] } }
]
```

> The API's destination DTO only accepts **6** of these 9 types — see [Implementation Notes](#implementation-notes-and-known-contract-edges).

### `POST /internal/egress/dry-run`

Runs an adapter against a **synthetic payload** without writing to the destination. Called by the API's `POST /api/destinations/validate` when `dryRun: true`.

**Request:**

```json
{
  "type": "slack",
  "config": { "webhookUrl": "https://hooks.slack.com/services/TEST/TEST/TEST" },
  "tenantId": "<tenant-id>"
}
```

**Response `200`:**

```json
{
  "ok": true,
  "statusCode": 200,
  "latencyMs": 245,
  "error": null,
  "adapterType": "slack"
}
```

Behavior:

- Adapter receives config with `__dryRun: true` added
- Each adapter uses a **safe probe**:
  - HTTP/Slack/Discord → `HEAD` request
  - Email → `GET /api-keys` (auth check)
  - Sheets → metadata fetch
  - Airtable → base tables list
  - Notion → data source fetch
  - PostgreSQL → `SELECT 1`
  - MongoDB → `ping`
- **No writes to the destination** — no Slack message, no email, no DB row
- 5s timeout per probe

## Schedule Operations

### `POST /internal/schedule/tick`

Claims due schedules atomically, enqueues synthetic events. Called by external cron every **5 minutes**.

**Response `200`:**

```json
{
  "due": 2,
  "enqueued": 2,
  "skipped": 0,
  "deactivated": 0,
  "durationMs": 245
}
```

Behavior:

- Selects up to **25** schedules where `isActive AND nextRunAt <= now`
- Atomic claim via `updateMany` with `nextRunAt <= now` predicate — no duplicate enqueue even under concurrent ticks
- Computes new `nextRunAt` from cron expression **before** enqueueing
- Invalid cron → schedule deactivated + logged

### `POST /internal/schedule/run-now`

Manually trigger a schedule without waiting for `nextRunAt`. Called by API's `POST /api/workflows/:id/schedule/run-now`.

**Request:**

```json
{
  "workflowId": "<workflow-id>"
}
```

**Response `200`:**

```json
{
  "correlationId": "<uuid>",
  "workflowId": "<workflow-id>",
  "enqueuedAt": "<iso-date>"
}
```

Behavior:

- Enqueues synthetic event with `rawPayload.type = "relayon.schedule.manual"`
- `nextRunAt` **untouched** — cron stays scheduled
- Errors if schedule doesn't exist or workflow is inactive

### `GET /internal/schedule/status`

**Response `200`:**

```json
{
  "active": 5,
  "dueNow": 0,
  "next": {
    "workflowId": "<workflow-id>",
    "cronExpression": "0 9 * * *",
    "timezone": "Asia/Karachi",
    "nextRunAt": "<iso-date>"
  },
  "timestamp": "<iso-date>"
}
```

## Workers Health

### `GET /internal/health`

**Authentication:** Public in the current source (this endpoint is **exempt** from the cron-secret guard).

**Response `200`:**

```json
{
  "status": "ok",
  "checks": {
    "postgres": "up",
    "redis": "up",
    "mongo": "up"
  },
  "version": "0.1.0",
  "timestamp": "<iso-date>"
}
```

---

## Error Response Formats

### Dashboard API

Consistent shape:

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "path": "/api/workflows",
  "timestamp": "2026-11-24T10:00:00.000Z"
}
```

Validation errors from the DTO pipe can include a `message` array of field-specific strings.

### Ingress API

Different shape (uses `correlationId` instead of `path`):

```json
{
  "error": "invalid_signature",
  "message": "invalid signature",
  "correlationId": "<uuid>"
}
```

### Workers API

Internal cron routes typically return `401` for auth failures or a structured `{ error: "..." }` for other failures. Do not depend on a specific Workers error shape from external callers — always treat the cron secret as a **deployment secret**, not a public credential.

### HTTP Status Codes by Scenario

| Status | Meaning |
|---|---|
| `400` | Bad Request — validation failed or malformed input |
| `401` | Unauthorized — missing/invalid token, API key, signature, or cron secret |
| `403` | Forbidden — valid auth but insufficient scope/permissions |
| `404` | Not Found — resource doesn't exist or belongs to another tenant |
| `409` | Conflict — duplicate resource (e.g., email already in use) |
| `413` | Payload Too Large — body exceeds limit |
| `422` | Unprocessable Entity — schema validation failed on YAML import |
| `429` | Too Many Requests — rate limit exceeded |
| `500` | Internal Server Error — unexpected server failure |
| `503` | Service Unavailable — degraded dependency |

---

## Rate Limits and Quotas

### Rate limits

| Endpoint group | Limit |
|---|---|
| `/webhook/:tenantId/:workflowId` | **1,000 req/min** per **tenant** (tenant-scoped counter in the current webhook path) |
| `/api/auth/*` | **10 req/min** per IP |
| `/api/*` (authenticated) | **60 req/min** per user/API key |
| `/internal/*` | No explicit limit (protected by cron secret) |

> **Important correction:** The v1.5-era documentation described the ingress rate limit as **300 req/min per workflow**. The **current source uses `RATE_LIMIT_PER_MINUTE = 1000` with a tenant-scoped counter** in the webhook path. Do not use the old 300 figure as the current behavior.

### Monthly quotas

Monthly **event**, **AI-token**, and **delivery** quotas are managed separately from the per-minute rate limit. They are stored in PostgreSQL and surfaced via `GET /api/quota`. A tenant's `quotaMode` can be `hard` (reject at the limit) or `soft` (bounded overage allowance).

Rate limit response shape:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
```

---

## Implementation Notes and Known Contract Edges

These are honest, source-visible behaviors in the audited snapshot. They are **not** aspirational — they describe what the current code does.

### Source config is not encrypted or redacted

The workflow `sourceConfig` JSON is written to the Prisma column directly. `WorkflowsService` does **not** call the connector encryption or redaction helpers for this field. `GET /workflows/:id` returns `sourceConfig` as stored. Workflow version snapshots capture `sourceConfig` unchanged.

**Consequence:** a workflow source signing secret supplied via `sourceConfig.secret` is **not** protected like destination credentials. Treat the Workflows API as sensitive and protect it at the network/auth boundary.

### Destination DTOs accept fewer adapter types than the registry

The Workers adapter registry contains **nine** built-in adapters:

- `http`
- `slack`
- `email`
- `sheets`
- `discord`
- `airtable`
- `notion`
- `postgres`
- `mongodb`

The API's `CreateDestinationDto` and `ValidateDestinationDto` accept only **six**:

- `http`
- `slack`
- `email`
- `sheets`
- `postgres`
- `mongodb`

**Consequence:** creating or validating a `discord`, `airtable`, or `notion` destination through the current API is rejected by DTO validation, even though those adapters exist and can deliver if the destination row is otherwise created.

### API-key scopes vs. actual guard coverage

The API-key schema allows `destinations:read` and `destinations:write`. The `DestinationsController` uses `JwtAuthGuard`, **not** `JwtOrApiKeyGuard`. Therefore:

- API keys with destination scopes are **valid** and can be issued.
- They do **not** grant access to any `/destinations/*` endpoint.
- Same caution applies to any other JWT-only controller that appears alongside API-key-capable controllers.

### Event replay uses `events:read`

`POST /api/events/:id/replay` is annotated with `events:read`, not a write scope. There is no `events:write` scope in the current schema. A caller with read scope can trigger a replay.

### Billing webhook uses raw body

`POST /api/billing/webhook` is public at the JWT layer but requires valid Stripe signature verification against the raw request body. The API bootstrap enables raw-body capture **specifically** for this route (and the inbound webhook receiver in Ingress).

### Test endpoint requires Workers URL and cron secret

`POST /api/workflows/:id/test` and `POST /api/workflows/:id/schedule/run-now` make protected internal calls to Workers. They return `400` if `WORKERS_URL` or `CRON_SECRET` is not configured on the API deployment.

### Presence is ephemeral

Presence is Redis-TTL-based (45-second TTL, 15-second heartbeat refresh). It is **not** a durable audit record. If Redis is unavailable, presence disappears, but the rest of the platform can continue.

### Time-travel is reconstruction, not restore

`GET /admin/time-travel` reconstructs selected tenant/workflow state from version snapshots and audit records. It is **not** a full point-in-time restore of Redis or MongoDB transient state, and it does not undo external side effects.

### Rate limit default changed

The current ingress rate limit is `RATE_LIMIT_PER_MINUTE = 1000` **per tenant**. This is a different value from the v1.5 docs' "300 req/min per workflow." See [Rate Limits](#rate-limits-and-quotas).

### Swagger/OpenAPI is generated

The OpenAPI document at `GET /api/openapi.json` is generated from Nest controllers. It reflects the DTOs and route decorators visible to Nest at bootstrap — but it does **not** override guards, and does not encode cross-cutting behaviors like the raw-body capture for billing webhooks. Disable it in production with `DISABLE_OPENAPI=true` if the public surface should not be exposed.

### No `/api` prefix on Ingress

Ingress is an Express application with no global prefix. Its routes are exactly `/webhook/:tenantId/:workflowId`, `/play/:sessionId`, `/t/:sessionId`, `/t/:sessionId/stream`, and `/health`. Do not assume an `/api` prefix.

### No `/internal` prefix on Workers' health path

Workers use a global `/internal` prefix. However, `/internal/health` is **not** guarded by the cron secret in the current source — verify before treating health checks as authenticated.

---

## OpenAPI and Source Map

### OpenAPI endpoints

| Path | Purpose |
|---|---|
| `GET /api/openapi.json` | Generated OpenAPI 3.1 document |
| `GET /api/docs` | Swagger UI |

Set `DISABLE_OPENAPI=true` in the API environment to disable both.

### Source file map (audited commit)

All links pinned to `f4dd930`:

| Area | Source |
|---|---|
| API bootstrap | [`apps/api/src/main.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/main.ts) |
| API module composition | [`apps/api/src/app.module.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/app.module.ts) |
| Auth controller | [`auth.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/auth/auth.controller.ts) |
| Tenants controller | [`tenants.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/tenants/tenants.controller.ts) |
| Workflows controller | [`workflows.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/workflows/workflows.controller.ts) |
| Workflow test controller | [`workflow-test.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/workflows/testing/workflow-test.controller.ts) |
| Destinations controller | [`destinations.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/destinations/destinations.controller.ts) |
| Schedules controllers | [`schedules.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/schedules/schedules.controller.ts), [`schedules-bulk.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/schedules/schedules-bulk.controller.ts) |
| Events controller | [`events.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/events/events.controller.ts) |
| DLQ controller | [`dlq.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/dlq/dlq.controller.ts) |
| Analytics controller | [`analytics.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/analytics/analytics.controller.ts) |
| API keys controller | [`api-keys.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/api-keys/api-keys.controller.ts) |
| Billing controller | [`billing.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/billing/billing.controller.ts) |
| Integrations controller | [`integrations.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/integrations/integrations.controller.ts) |
| AI controller | [`ai.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/ai/ai.controller.ts) |
| AI ingest controller | [`ingest.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/ai/ingest.controller.ts) |
| Quota controllers | [`quota.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/quota/quota.controller.ts), [`usage-export.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/quota/usage-export.controller.ts) |
| Outbound webhook endpoints | [`webhook-endpoints.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/webhooks/webhook-endpoints.controller.ts) |
| Outbox poller | [`outbox-poller.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/webhooks/outbox-poller.controller.ts) |
| Cron controller | [`cron.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/cron/cron.controller.ts) |
| Playground controller | [`playground.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/playground/playground.controller.ts) |
| Presence controller | [`presence.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/presence/presence.controller.ts) |
| Tracking controller | [`tracking.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/tracking/tracking.controller.ts) |
| Tunnel controller | [`tunnel.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/tunnel/tunnel.controller.ts) |
| Community controller | [`community.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/community/community.controller.ts) |
| Admin controller | [`admin.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/admin/admin.controller.ts) |
| Feature flags admin | [`feature-flags-admin.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/admin/feature-flags/feature-flags-admin.controller.ts) |
| Time-travel controller | [`time-travel.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api/src/modules/admin/time-travel/time-travel.controller.ts) |
| Ingress app | [`apps/ingress/src/app.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress/src/app.ts) |
| Ingress webhook route | [`apps/ingress/src/routes/webhook.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress/src/routes/webhook.ts) |
| Ingress signature middleware | [`apps/ingress/src/middleware/signature.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress/src/middleware/signature.ts) |
| Ingress verifiers | [`apps/ingress/src/services/verifiers.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress/src/services/verifiers.ts) |
| Ingress atomic ingest | [`apps/ingress/src/lib/redis-batch.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress/src/lib/redis-batch.ts) |
| Workers processing controller | [`apps/workers/src/modules/processing/processing.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/processing/processing.controller.ts) |
| Workers egress controller | [`apps/workers/src/modules/egress/egress.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/egress/egress.controller.ts) |
| Workers schedule controller | [`apps/workers/src/modules/schedule/schedule.controller.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/schedule/schedule.controller.ts) |
| Workers adapter registry | [`apps/workers/src/modules/egress/adapters/registry.ts`](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers/src/modules/egress/adapters/registry.ts) |

---

<div align="center">

**Relayon v3.7.0 — Final Release · Project Complete**

*Honest about gaps. Every caveat documented.*

*Made with ❤️ in Pakistan*

</div>
```

---