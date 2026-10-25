# Relayon — API Reference

> **Complete reference for Relayon's HTTP APIs.**
>
> **Current version:** v1.5.0

Relayon exposes **three independent APIs**, each on its own domain:

| API | Base URL | Purpose |
|---|---|---|
| **Dashboard API** | `https://relayon-api.vercel.app/api` | Control plane (auth, workflows, events, schedules, versions, API keys) |
| **Ingress API** | `https://relayon-ingress.vercel.app` | Data plane (webhook reception) |
| **Workers API** | `https://relayon-workers.vercel.app/internal` | Internal automation (cron-triggered, dry-run) |

---

## Table of Contents

- [Authentication](#authentication)
- [Dashboard API](#dashboard-api)
  - [Auth](#auth)
  - [Tenants](#tenants)
  - [Workflows](#workflows)
  - [Workflow Versions](#workflow-versions)
  - [Destinations](#destinations)
  - [Destination Validation](#destination-validation)
  - [Schedules](#schedules)
  - [Events](#events)
  - [DLQ](#dlq)
  - [Analytics](#analytics)
  - [API Keys](#api-keys)
  - [Health](#health)
- [Ingress API](#ingress-api)
  - [Webhook Receiver](#webhook-receiver)
  - [Health](#ingress-health)
- [Workers API](#workers-api)
  - [Process](#process)
  - [Deliver](#deliver)
  - [Queue Status](#queue-status)
  - [Egress Stats](#egress-stats)
  - [Adapter List](#adapter-list)
  - [Egress Dry-Run](#egress-dry-run)
  - [Schedule Tick](#schedule-tick)
  - [Schedule Run-Now](#schedule-run-now)
  - [Schedule Status](#schedule-status)
  - [Health](#workers-health)
- [Error Response Format](#error-response-format)
- [Rate Limiting](#rate-limiting)
- [Live API](#live-api)

---

## Authentication

### Dashboard API — JWT or API Key

Every route under `/api/*` (except `/api/auth/*` and `/api/health`) requires **one of**:

**Option A — JWT Bearer** (dashboard sessions):
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Option B — API Key** (programmatic access):
```http
X-API-Key: rlk_live_ab12cd34_...48hex...
```

**Token lifecycle (JWT):**
- **Access token** — 15 minutes expiry
- **Refresh token** — 7 days expiry, single-use (rotation enforced)
- **Auto-refresh** — Dashboard's `authInterceptor` refreshes silently on 401

**JWT payload (decoded):**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "owner",
  "tenantId": "tenant-uuid",
  "iat": 1700000000,
  "exp": 1700000900
}
```

**API key scope enforcement:** Routes marked `@RequireScopes('...')` will reject API keys that lack the scope with `403 Forbidden`. JWT sessions bypass scope checks (they have full tenant access).

**Available scopes:** `events:read`, `workflows:read`, `workflows:write`, `destinations:read`, `destinations:write`, `dlq:read`, `dlq:write`, `analytics:read`

### Ingress API — HMAC Signature

No JWT. Every webhook must include a source-specific signature header:

| Source | Header | Algorithm |
|---|---|---|
| Stripe | `Stripe-Signature` | HMAC-SHA256 over `{timestamp}.{body}` |
| GitHub | `X-Hub-Signature-256` | HMAC-SHA256 over `{body}`, prefixed `sha256=` |
| Shopify | `X-Shopify-Hmac-Sha256` | HMAC-SHA256 over `{body}`, base64 |
| Slack | `X-Slack-Signature` | HMAC-SHA256 over `v0:{timestamp}:{body}` |
| Generic | `X-Webhook-Signature` | HMAC-SHA256 over `{body}`, hex |

Signature verification uses **timing-safe comparison**. Timestamp tolerance: 300 seconds (configurable via `WEBHOOK_SIGNATURE_TOLERANCE_SECONDS`).

### Workers API — Cron Secret

All routes under `/internal/*` require the shared cron secret:

```http
X-Cron-Secret: a1b2c3d4e5f6...
```

If missing or mismatched, returns `401 Unauthorized`. Comparison is **timing-safe**.

---

## Dashboard API

### Auth

#### `POST /api/auth/signup`

Create a new tenant + owner user.

**Request:**
```json
{
  "name": "Zain Shah",
  "tenantName": "Acme Corp",
  "email": "zain@acme.com",
  "password": "SecurePass123!"
}
```

**Validation:**
- `name` — 2-80 chars
- `tenantName` — 2-80 chars (auto-slugified; conflicts get random suffix)
- `email` — valid email, unique globally
- `password` — min 8 chars, max 128

**Response `201`:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "mUt9tJ9K...",
  "user": {
    "id": "user-uuid",
    "email": "zain@acme.com",
    "name": "Zain Shah",
    "role": "owner",
    "tenantId": "tenant-uuid",
    "tenantName": "Acme Corp",
    "tenantSlug": "acme-corp"
  }
}
```

**Errors:**
- `409 Conflict` — email already in use
- `400 Bad Request` — validation failure

---

#### `POST /api/auth/login`

**Request:**
```json
{
  "email": "zain@acme.com",
  "password": "SecurePass123!"
}
```

**Response `200`:** Same shape as signup.

**Errors:**
- `401 Unauthorized` — invalid credentials (same message for both wrong email and wrong password — prevents user enumeration)

---

#### `POST /api/auth/refresh`

Exchange a refresh token for a new access/refresh pair. **Rotates** the refresh token — the old one is revoked immediately.

**Request:**
```json
{ "refreshToken": "mUt9tJ9K..." }
```

**Response `200`:** Same shape as login.

**Errors:**
- `401 Unauthorized` — token invalid, revoked, or expired

---

#### `POST /api/auth/logout`

Revokes the provided refresh token.

**Request:**
```json
{ "refreshToken": "mUt9tJ9K..." }
```

**Response `204 No Content`**

---

#### `GET /api/auth/me`

Returns the current user + tenant.

**Headers:** `Authorization: Bearer <token>`

**Response `200`:**
```json
{
  "id": "user-uuid",
  "email": "zain@acme.com",
  "name": "Zain Shah",
  "role": "owner",
  "tenantId": "tenant-uuid",
  "tenantName": "Acme Corp",
  "tenantSlug": "acme-corp"
}
```

---

### Tenants

#### `GET /api/tenants/me`

**Response `200`:**
```json
{
  "id": "tenant-uuid",
  "name": "Acme Corp",
  "slug": "acme-corp",
  "plan": "free",
  "quotaEventsPerMonth": 10000,
  "quotaAiTokensPerMonth": 100000,
  "createdAt": "2026-10-22T10:00:00Z"
}
```

---

#### `PATCH /api/tenants/me`

**Request:**
```json
{ "name": "Acme Corp (Renamed)" }
```

**Response `200`:** Updated tenant object.

---

#### `GET /api/tenants/users`

**Response `200`:**
```json
[
  {
    "id": "user-uuid",
    "email": "zain@acme.com",
    "name": "Zain Shah",
    "role": "owner",
    "lastLoginAt": "2026-10-22T10:00:00Z",
    "createdAt": "2026-10-20T08:00:00Z"
  }
]
```

---

### Workflows

#### `GET /api/workflows`

List all workflows for the current tenant.

**Required scope:** `workflows:read`

**Response `200`:**
```json
[
  {
    "id": "workflow-uuid",
    "tenantId": "tenant-uuid",
    "name": "Stripe → Slack",
    "sourceType": "stripe",
    "sourceConfig": { "secret": "enc:v2:key-2026-10:..." },
    "enrichmentEnabled": true,
    "enrichmentPrompt": "Summarize and classify",
    "transformExpression": null,
    "routingRules": [],
    "isActive": true,
    "createdAt": "2026-10-20T08:00:00Z",
    "_count": { "destinations": 2 },
    "schedule": {
      "cronExpression": "0 9 * * *",
      "isActive": true,
      "nextRunAt": "2026-10-26T09:00:00Z"
    }
  }
]
```

**`sourceConfig.secret` is returned encrypted** (`enc:v2:...`) — never plaintext.

---

#### `GET /api/workflows/:id`

Returns full workflow with destinations and schedule.

**Required scope:** `workflows:read`

**Response `200`:**
```json
{
  "id": "workflow-uuid",
  "name": "Stripe → Slack",
  "sourceType": "stripe",
  "destinations": [
    {
      "id": "dest-uuid",
      "type": "slack",
      "name": "Production Alerts",
      "config": { "webhookUrl": "••••••••" },
      "enabled": true,
      "retryPolicy": { "max_attempts": 5, "backoff_ms": [10000, 30000, 60000, 300000, 900000] }
    }
  ],
  "schedule": {
    "id": "schedule-uuid",
    "cronExpression": "0 9 * * *",
    "timezone": "Asia/Karachi",
    "payloadTemplate": {},
    "isActive": true,
    "lastRunAt": null,
    "nextRunAt": "2026-10-26T04:00:00Z",
    "createdAt": "2026-10-25T20:00:00Z",
    "updatedAt": "2026-10-25T20:00:00Z"
  }
}
```

**`config` secrets are redacted** to `••••••••` — never the ciphertext.

**Errors:**
- `404 Not Found` — workflow doesn't exist or belongs to another tenant

---

#### `POST /api/workflows`

**Required scope:** `workflows:write`

**Request:**
```json
{
  "name": "GitHub → Jira",
  "sourceType": "github",
  "sourceConfig": { "secret": "whsec_github_..." },
  "enrichmentEnabled": false,
  "enrichmentPrompt": null,
  "transformExpression": "{ 'title': pull_request.title, 'severity': 'high' }",
  "routingRules": [],
  "isActive": true
}
```

**`sourceType` enum:** `stripe`, `github`, `shopify`, `slack`, `generic`

**`routingRules` (v1.1+):** Array of `{ when: string, destinationIds: string[] }` where `when` is a JSONata boolean expression. Empty array = send to all destinations.

```json
[
  { "when": "$exists(data.amount) and data.amount > 100", "destinationIds": ["dest-high-value"] },
  { "when": "$exists(type) and type = 'payment_intent.succeeded'", "destinationIds": ["dest-slack", "dest-sheets"] }
]
```

**Response `201`:** Full workflow object.

**Side effects:**
- A version snapshot `v1` is captured automatically
- If no `routingRules` provided, defaults to `[]` (all destinations)

---

#### `PATCH /api/workflows/:id`

All fields optional. Only provided fields are updated.

**Required scope:** `workflows:write`

**Response `200`:** Updated workflow.

**Side effects:**
- A new version snapshot is captured automatically

---

#### `DELETE /api/workflows/:id`

Cascade deletes destinations, schedules, and versions.

**Required scope:** `workflows:write`

**Response `200`:**
```json
{ "deleted": true, "id": "workflow-uuid" }
```

---

#### `GET /api/workflows/:id/export`

Export workflow as YAML for version control. Secrets are replaced with `${...}` placeholders.

**Required scope:** `workflows:read`

**Response `200`:** `Content-Type: application/x-yaml`

```yaml
apiVersion: relayon/v1
kind: Workflow
metadata:
  name: Stripe to Slack
spec:
  sourceType: stripe
  sourceConfig:
    secret: ${SOURCE_SECRET}
  enrichmentEnabled: true
  enrichmentPrompt: Summarize and classify
  transformExpression: null
  routingRules: []
  isActive: true
  destinations:
    - type: slack
      name: Production Alerts
      config:
        webhookUrl: ${SLACK_WEBHOOKURL}
      enabled: true
```

**Response also sets `Content-Disposition: attachment; filename="workflow-{id}.yaml"`.**

---

#### `POST /api/workflows/import`

Import workflow from YAML. All `${...}` placeholders **must be replaced with real values** before import — unresolved placeholders return `400`.

**Required scope:** `workflows:write`

**Request:**
```json
{ "yaml": "apiVersion: relayon/v1\nkind: Workflow\n..." }
```

**Response `201`:**
```json
{
  "id": "new-workflow-uuid",
  "name": "Stripe to Slack",
  "destinationsCreated": 2
}
```

**Errors:**
- `400 Bad Request` — invalid YAML, wrong apiVersion, unresolved placeholders
- `422 Unprocessable Entity` — schema validation failed

**Side effects:**
- A version snapshot `v1` is captured with message `"Imported from YAML"`

---

#### `POST /api/workflows/:id/preview-transform`

Compile + evaluate a JSONata expression against a sample payload — used by the dashboard's transform editor to validate before saving.

**Required scope:** `workflows:read`

**Request:**
```json
{
  "expression": "{ 'event_type': type, 'amount_usd': data.amount / 100 }",
  "samplePayload": {
    "type": "checkout.session.completed",
    "data": { "amount": 5000, "currency": "usd" }
  }
}
```

**Response `200` (success):**
```json
{
  "ok": true,
  "result": { "event_type": "checkout.session.completed", "amount_usd": 50 },
  "error": null,
  "durationMs": 3
}
```

**Response `200` (failure):**
```json
{
  "ok": false,
  "result": null,
  "error": "Compile error: Expected \"}\" before end of expression",
  "durationMs": 1
}
```

**Timeout:** 2000ms. Expressions exceeding this return `ok: false` with timeout error.

---

### Workflow Versions

Every `create` / `update` / `import` / `restore` operation captures an immutable snapshot. Capped at 50 versions per workflow (oldest trimmed automatically).

#### `GET /api/workflows/:id/versions`

List version summaries (no full snapshots).

**Required scope:** `workflows:read`

**Response `200`:**
```json
[
  {
    "id": "version-uuid",
    "version": 3,
    "message": "Configuration updated",
    "createdBy": "user-uuid",
    "createdAt": "2026-10-25T23:18:52Z"
  },
  {
    "id": "version-uuid",
    "version": 2,
    "message": "Renamed to \"test-234\"",
    "createdBy": "user-uuid",
    "createdAt": "2026-10-25T23:18:45Z"
  },
  {
    "id": "version-uuid",
    "version": 1,
    "message": "Initial version",
    "createdBy": "user-uuid",
    "createdAt": "2026-10-25T23:18:30Z"
  }
]
```

---

#### `GET /api/workflows/:id/versions/:version`

Get a single version with full snapshot.

**Required scope:** `workflows:read`

**Response `200`:**
```json
{
  "id": "version-uuid",
  "version": 2,
  "message": "Configuration updated",
  "createdBy": "user-uuid",
  "createdAt": "2026-10-25T23:18:52Z",
  "snapshot": {
    "name": "test-234",
    "sourceType": "stripe",
    "sourceConfig": { "secret": "enc:v1:K45H..." },
    "enrichmentEnabled": true,
    "enrichmentPrompt": null,
    "transformExpression": "asd",
    "routingRules": [],
    "isActive": true,
    "destinations": [
      {
        "type": "slack",
        "name": "Test Slack",
        "config": { "webhookUrl": "enc:v1:K45H..." },
        "enabled": true,
        "retryPolicy": { "max_attempts": 5, "backoff_ms": [10000, 30000, 60000, 300000, 900000] }
      }
    ]
  }
}
```

**Errors:**
- `404 Not Found` — version doesn't exist

---

#### `GET /api/workflows/:id/versions/:a/diff/:b`

**Unified line-level diff** between two versions (v1.5+).

**Required scope:** `workflows:read`

**Response `200`:**
```json
{
  "fromVersion": 1,
  "toVersion": 2,
  "identical": false,
  "stats": { "added": 1, "removed": 1 },
  "unified": "===================================================================\n--- v1\tVersion 1\n+++ v2\tVersion 2\n@@ -47,5 +47,5 @@\n   },\n   \"enrichmentPrompt\": null,\n   \"enrichmentEnabled\": true,\n-  \"transformExpression\": \"asd\"\n+  \"transformExpression\": \"\"\n }\n\\ No newline at end of file"
}
```

**Behaviour:**
- `identical: true` + empty `unified` if snapshots are byte-equal
- `stats.added` / `stats.removed` are line counts
- Diff format matches `git diff` — dashboard renders color-coded (green/red/cyan)

**Errors:**
- `404 Not Found` — either version doesn't exist
- `400 Bad Request` — same version twice

---

#### `POST /api/workflows/:id/versions/:version/restore`

Restore a workflow to a previous version. **Destinations are deleted and recreated** — their UUIDs will change.

**Required scope:** `workflows:write`

**Response `200`:** Full workflow object (post-restore).

**Side effects:**
- A new version `vN+1` is captured with message `"Restored from vN"` — history stays linear (never branches)
- All destinations replaced

---

### Destinations

#### `GET /api/workflows/:workflowId/destinations`

**Required scope:** `destinations:read`

**Response `200`:**
```json
[
  {
    "id": "dest-uuid",
    "workflowId": "workflow-uuid",
    "type": "http",
    "name": "Production Webhook",
    "config": { "url": "https://api.example.com/webhook", "method": "POST" },
    "enabled": true,
    "retryPolicy": { "max_attempts": 5, "backoff_ms": [10000, 30000, 60000, 300000, 900000] },
    "createdAt": "2026-10-20T08:00:00Z"
  }
]
```

**`config` secrets are always redacted to `••••••••`** — the client never receives ciphertext.

---

#### `POST /api/workflows/:workflowId/destinations`

**Required scope:** `destinations:write`

**Request:**
```json
{
  "type": "http",
  "name": "Production Webhook",
  "config": { "url": "https://api.example.com/webhook", "method": "POST" },
  "enabled": true
}
```

**`type` enum:** `http`, `slack`, `email`, `sheets`, `discord`, `airtable`, `notion`, `postgres`, `mongodb`

**Config examples by type:**

**HTTP:**
```json
{ "url": "https://...", "method": "POST", "headers": { "X-Custom": "value" } }
```

**Slack / Discord:**
```json
{ "webhookUrl": "https://hooks.slack.com/services/T00/B00/XXX" }
```

**Email (Resend):**
```json
{ "apiKey": "re_...", "to": ["a@x.com"], "from": "Relayon <noreply@y.com>" }
```

**Google Sheets (service account):**
```json
{
  "spreadsheetId": "1abc...",
  "range": "Sheet1!A:Z",
  "serviceAccountEmail": "xxx@xxx.iam.gserviceaccount.com",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
}
```

**Airtable:**
```json
{ "apiKey": "pat...", "baseId": "appXXXX", "tableName": "Leads", "typecast": true }
```

**Notion:**
```json
{ "apiKey": "secret_...", "dataSourceId": "uuid", "titleProperty": "Name" }
```

**PostgreSQL (v1.4):**
```json
{
  "connectionString": "postgresql://user:pass@host/db?sslmode=require",
  "table": "events",
  "columns": { "type": "event_type", "data.amount": "amount_cents" },
  "onConflict": "id",
  "ssl": true
}
```

**MongoDB (v1.4):**
```json
{
  "connectionString": "mongodb+srv://...",
  "database": "mydb",
  "collection": "events",
  "upsertKey": "orderId"
}
```

**Response `201`:** Full destination object with `config` secrets redacted.

**Side effects:**
- Secret fields in `config` are encrypted at rest (`enc:v2:...`)
- If `FULL_CONFIG_ENCRYPTION=true`, all non-metadata fields are encrypted

---

#### `PATCH /api/destinations/:id`

Update name, config, or enabled. Cannot change `type` — create a new destination instead.

**Required scope:** `destinations:write`

**Request (partial):**
```json
{
  "config": { "webhookUrl": "https://hooks.slack.com/services/NEW/URL/XXX" }
}
```

**Response `200`:** Updated destination.

**Special behaviour:** If a `config` field is sent as the redaction mask `"••••••••"`, the existing stored ciphertext is preserved. This lets the dashboard re-save a destination without re-entering secrets.

---

#### `DELETE /api/destinations/:id`

**Required scope:** `destinations:write`

**Response `200`:**
```json
{ "deleted": true, "id": "dest-uuid" }
```

---

### Destination Validation (v1.5)

#### `POST /api/destinations/validate`

Two-layer validation: schema check + optional real dry-run via workers.

**Required scope:** `destinations:read`

**Request:**
```json
{
  "type": "slack",
  "config": { "webhookUrl": "https://hooks.slack.com/services/TEST/TEST/TEST" },
  "dryRun": true
}
```

**Response `200` (success):**
```json
{
  "ok": true,
  "layer": "both",
  "errors": [],
  "warnings": [],
  "dryRun": {
    "attempted": true,
    "success": true,
    "latencyMs": 245,
    "detail": "config valid — Slack webhooks cannot be tested without sending a message"
  }
}
```

**Response `200` (schema failure):**
```json
{
  "ok": false,
  "layer": "schema",
  "errors": [
    { "field": "webhookUrl", "message": "'webhookUrl' is required for slack" }
  ],
  "warnings": [],
  "dryRun": null
}
```

**Response `200` (connectivity failure):**
```json
{
  "ok": false,
  "layer": "both",
  "errors": [
    { "field": "config", "message": "PostgreSQL: ECONNREFUSED" }
  ],
  "warnings": [],
  "dryRun": {
    "attempted": true,
    "success": false,
    "latencyMs": 12,
    "detail": "PostgreSQL: ECONNREFUSED"
  }
}
```

**Response `200` (workers unreachable — graceful):**
```json
{
  "ok": true,
  "layer": "schema",
  "errors": [],
  "warnings": ["Dry-run skipped: WORKERS_URL or CRON_SECRET not configured"],
  "dryRun": null
}
```

**`layer` values:**
- `schema` — only schema validation ran (dry-run skipped or not requested)
- `both` — schema + dry-run ran

**Dry-run probes by adapter type:**

| Type | Probe | Writes? |
|---|---|---|
| `http` | HEAD request | No |
| `slack` / `discord` | URL format only | No |
| `email` | GET /api-keys (auth check) | No |
| `sheets` | GET spreadsheet metadata | No |
| `airtable` | GET base tables | No |
| `notion` | GET data source | No |
| `postgres` | `SELECT 1` | No |
| `mongodb` | `ping` command | No |

**⚠️ Critical:** dry-run **never writes** to the destination — no Slack message, no email, no DB row.

---

### Schedules (v1.3+)

#### `GET /api/workflows/:workflowId/schedule`

**Required scope:** `workflows:read`

**Response `200`:** Schedule object, or `null` if not configured.

```json
{
  "id": "schedule-uuid",
  "workflowId": "workflow-uuid",
  "cronExpression": "0 9 * * *",
  "timezone": "Asia/Karachi",
  "payloadTemplate": { "report": "daily" },
  "isActive": true,
  "lastRunAt": "2026-10-25T04:00:00Z",
  "nextRunAt": "2026-10-26T04:00:00Z",
  "createdAt": "2026-10-25T20:00:00Z",
  "updatedAt": "2026-10-25T20:00:00Z"
}
```

---

#### `PUT /api/workflows/:workflowId/schedule`

Create or update a schedule. Cron expression validated at save.

**Required scope:** `workflows:write`

**Request:**
```json
{
  "cronExpression": "0 9 * * *",
  "timezone": "Asia/Karachi",
  "payloadTemplate": { "report": "daily" },
  "isActive": true
}
```

**Validation:**
- `cronExpression` — 5-field cron, only digits, `*`, `,`, `-`, `/`, spaces (no `MON`/`JAN` names)
- `timezone` — valid IANA timezone name
- `payloadTemplate` — arbitrary JSON object

**Response `200`:** Full schedule object.

**Errors:**
- `400 Bad Request` — invalid cron expression
- `404 Not Found` — workflow doesn't exist

---

#### `DELETE /api/workflows/:workflowId/schedule`

**Required scope:** `workflows:write`

**Response `200`:**
```json
{ "deleted": true, "workflowId": "workflow-uuid" }
```

---

#### `POST /api/workflows/:workflowId/schedule/run-now` (v1.4+)

Manually trigger a scheduled workflow immediately, without waiting for the next cron tick. `nextRunAt` is **not** changed — the regular schedule continues.

**Required scope:** `workflows:write`

**Response `200`:**
```json
{
  "triggered": true,
  "workflowId": "workflow-uuid",
  "correlationId": "69b42467-6165-4547-8ad1-ff11492d44f2",
  "timestamp": "2026-10-25T23:29:08Z"
}
```

**Behaviour:**
- Enqueues a synthetic event with `rawPayload.type = "relayon.schedule.manual"`
- Updates `lastRunAt` to now
- `nextRunAt` untouched — cron stays scheduled

**Errors:**
- `404 Not Found` — no schedule configured
- `400 Bad Request` — `WORKERS_URL` or `CRON_SECRET` not configured in API env

**Requires:** `WORKERS_URL` and `CRON_SECRET` env vars on API.

---

#### `POST /api/schedules/bulk/pause-all` (v1.5+)

Pause all schedules for the tenant.

**Required scope:** `workflows:write`

**Response `200`:**
```json
{ "updated": 5 }
```

**Behaviour:** Sets `isActive: false` on every schedule for the tenant. Workflows themselves stay active.

---

#### `POST /api/schedules/bulk/resume-all` (v1.5+)

Resume all schedules for the tenant. **Recomputes `nextRunAt`** for each — paused schedules would otherwise fire immediately on resume.

**Required scope:** `workflows:write`

**Response `200`:**
```json
{ "updated": 5 }
```

**Behaviour:** Sets `isActive: true` and recomputes `nextRunAt` from the current time (so `nextRunAt` is always in the future).

---

### Events

#### `GET /api/events`

Cursor-paginated list of events for the tenant.

**Required scope:** `events:read`

**Query params:**
- `workflowId` (optional) — filter by workflow
- `status` (optional) — `received` | `processing` | `processed` | `failed`
- `limit` (optional, default 25, max 100)
- `cursor` (optional) — from previous response's `nextCursor`

**Response `200`:**
```json
{
  "items": [
    {
      "_id": "mongo-id",
      "correlationId": "a1578194-...",
      "workflowId": "workflow-uuid",
      "sourceType": "stripe",
      "status": "processed",
      "receivedAt": "2026-10-22T10:41:43Z",
      "processedAt": "2026-10-22T10:41:45Z",
      "hasEnrichment": true,
      "hasError": false
    }
  ],
  "nextCursor": "mongo-id-of-last-item"
}
```

`nextCursor` is `null` when no more pages exist.

---

#### `GET /api/events/:id`

Returns full event with all its deliveries.

**Required scope:** `events:read`

**Response `200`:**
```json
{
  "_id": "mongo-id",
  "correlationId": "a1578194-...",
  "workflowId": "workflow-uuid",
  "sourceType": "stripe",
  "status": "processed",
  "rawPayload": { "id": "evt_...", "type": "payment_intent.succeeded" },
  "enrichedPayload": { "summary": "...", "category": "payment", "severity": "low" },
  "transformedPayload": null,
  "enrichment": {
    "enabled": true,
    "cached": false,
    "model": "openai/gpt-oss-120b",
    "durationMs": 2916,
    "error": null
  },
  "error": null,
  "receivedAt": "2026-10-22T10:41:43Z",
  "processedAt": "2026-10-22T10:41:45Z",
  "deliveries": [
    {
      "_id": "delivery-id",
      "destinationId": "dest-uuid",
      "destinationType": "slack",
      "status": "delivered",
      "attemptCount": 1,
      "lastResponse": { "statusCode": 200, "latencyMs": 342, "bodySnippet": "ok" },
      "deliveredAt": "2026-10-22T10:41:46Z"
    }
  ]
}
```

**Errors:**
- `404 Not Found` — event doesn't exist or belongs to another tenant

---

### DLQ

#### `GET /api/dlq`

Cursor-paginated list of DLQ entries.

**Required scope:** `dlq:read`

**Query params:**
- `limit` (optional, default 25, max 100)
- `cursor` (optional)

**Response `200`:**
```json
{
  "items": [
    {
      "_id": "delivery-id",
      "tenantId": "tenant-uuid",
      "eventId": "mongo-event-id",
      "correlationId": "a1578194-...",
      "destinationId": "dest-uuid",
      "destinationType": "http",
      "status": "dlq",
      "attemptCount": 5,
      "attempts": [
        { "at": "2026-10-22T10:41:46Z", "statusCode": 500, "latencyMs": 124, "error": "HTTP 500" }
      ],
      "lastResponse": { "statusCode": 500, "bodySnippet": "...", "latencyMs": 124 },
      "error": { "code": "destination_error", "message": "Max retry attempts exhausted" },
      "dlqReason": "Max retry attempts exhausted",
      "dlqAt": "2026-10-22T11:01:00Z"
    }
  ],
  "nextCursor": "last-id"
}
```

---

#### `POST /api/dlq/:id/replay`

Resets a single DLQ delivery to `status: 'pending'`.

**Required scope:** `dlq:write`

**Response `200`:**
```json
{ "replayed": true, "deliveryId": "delivery-id" }
```

**Errors:**
- `404 Not Found` — delivery doesn't exist or isn't in DLQ status

---

#### `POST /api/dlq/bulk-replay` (v1.1+)

Bulk replay up to 100 DLQ entries in one call.

**Required scope:** `dlq:write`

**Request:**
```json
{ "ids": ["delivery-id-1", "delivery-id-2", "delivery-id-3"] }
```

**Response `200`:**
```json
{
  "total": 3,
  "replayed": 2,
  "failed": 1,
  "failures": [
    { "id": "delivery-id-3", "reason": "Not found, not owned, or not in DLQ" }
  ]
}
```

**Behaviour:**
- Duplicate IDs are deduplicated
- Capped at 100 IDs per request
- Uses atomic `updateMany` — no partial-write surprises

**Errors:**
- `400 Bad Request` — `ids` array empty or > 100

---

#### `DELETE /api/dlq/:id`

Permanently deletes a DLQ delivery.

**Required scope:** `dlq:write`

**Response `200`:**
```json
{ "discarded": true, "deliveryId": "delivery-id" }
```

---

#### `POST /api/dlq/bulk-discard` (v1.2+)

Bulk discard up to 100 DLQ entries permanently.

**Required scope:** `dlq:write`

**Request:**
```json
{ "ids": ["delivery-id-1", "delivery-id-2"] }
```

**Response `200`:**
```json
{
  "total": 2,
  "discarded": 2,
  "failed": 0
}
```

---

### Analytics

#### `GET /api/analytics/overview`

**Required scope:** `analytics:read`

**Response `200`:**
```json
{
  "events24h": 42,
  "events7d": 312,
  "eventsProcessed": 310,
  "eventsFailed": 2,
  "deliveries": {
    "delivered": 308,
    "dlq": 2,
    "pending": 2,
    "successRate": 99
  }
}
```

---

#### `GET /api/analytics/delivery`

**Required scope:** `analytics:read`

**Response `200`:**
```json
{
  "byStatus": [
    { "status": "delivered", "count": 308 },
    { "status": "dlq", "count": 2 },
    { "status": "pending", "count": 2 }
  ],
  "byDestination": [
    {
      "_id": "dest-uuid",
      "destinationType": "slack",
      "total": 210,
      "delivered": 208,
      "dlq": 2,
      "avgLatencyMs": 342
    }
  ]
}
```

---

#### `GET /api/analytics/cost` (v1.1+)

30-day cost estimation per destination.

**Required scope:** `analytics:read`

**Response `200`:**
```json
{
  "windowDays": 30,
  "events": {
    "total": 312,
    "enriched": 298,
    "cacheHits": 145,
    "estimatedTokens": 45000
  },
  "cost": {
    "groqUsd": 0.0045,
    "redisUsd": 0.00024,
    "totalUsd": 0.00474
  },
  "perDestination": [
    {
      "destinationId": "dest-uuid",
      "destinationType": "http",
      "totalDeliveries": 210,
      "totalAttempts": 218,
      "retries": 8,
      "retryRate": 3.8,
      "delivered": 208,
      "dlq": 2,
      "estimatedRedisCostUsd": 0.000009
    }
  ],
  "notes": [
    "Groq cost is estimated from payload size (1 token ≈ 4 bytes).",
    "Redis cost assumes $0.00002/command (Upstash pay-as-you-go rate).",
    "MongoDB Atlas M0 is free up to 512 MB — not included."
  ]
}
```

---

#### `GET /api/analytics/timeseries?range=24h|7d|30d` (v1.2+)

Time-series buckets for charting. Uses MongoDB `$dateTrunc` for hourly (24h) or daily (7d, 30d) buckets.

**Required scope:** `analytics:read`

**Query params:**
- `range` (optional, default `24h`) — `24h` | `7d` | `30d`

**Response `200`:**
```json
{
  "range": "24h",
  "unit": "hour",
  "buckets": [
    {
      "ts": "2026-10-25T00:00:00Z",
      "events": 2,
      "failed": 0,
      "delivered": 1,
      "dlq": 1,
      "attempts": 2
    },
    {
      "ts": "2026-10-25T01:00:00Z",
      "events": 0,
      "failed": 0,
      "delivered": 0,
      "dlq": 0,
      "attempts": 0
    }
  ]
}
```

**Behaviour:**
- Empty buckets are filled with zero counts — continuous series
- Bucket count: 25 for `24h`, 8 for `7d`, 31 for `30d`

---

### API Keys (v1.2+)

#### `GET /api/api-keys`

List API keys for the tenant (hashes only — raw values never retrievable).

**Headers:** `Authorization: Bearer <jwt>` (JWT only — API keys cannot list other API keys)

**Response `200`:**
```json
[
  {
    "id": "key-uuid",
    "name": "CI pipeline",
    "prefix": "rlk_live_ab12cd34",
    "scopes": ["events:read", "workflows:read"],
    "environment": "live",
    "lastUsedAt": "2026-10-23T23:57:12Z",
    "expiresAt": "2027-01-21T22:19:00Z",
    "revokedAt": null,
    "createdAt": "2026-10-23T22:19:00Z"
  }
]
```

---

#### `POST /api/api-keys`

Create a new API key. **Raw key is returned once — never retrievable again.**

**Headers:** `Authorization: Bearer <jwt>` (JWT only)

**Request:**
```json
{
  "name": "CI pipeline",
  "scopes": ["events:read", "workflows:read"],
  "environment": "live",
  "neverExpires": false
}
```

**`scopes` enum:** `events:read`, `workflows:read`, `workflows:write`, `destinations:read`, `destinations:write`, `dlq:read`, `dlq:write`, `analytics:read`

**`environment` enum:** `live` (default) | `test`

**Response `201`:**
```json
{
  "id": "key-uuid",
  "name": "CI pipeline",
  "prefix": "rlk_live_ab12cd34",
  "scopes": ["events:read", "workflows:read"],
  "environment": "live",
  "expiresAt": "2027-01-21T22:19:00Z",
  "createdAt": "2026-10-23T22:19:00Z",
  "rawKey": "rlk_live_ab12cd34_f7cebdac923c3e6cee146bb32495e25e6cc20fd81595b65b"
}
```

**⚠️ `rawKey` is shown once.** Store it securely.

**Errors:**
- `400 Bad Request` — invalid scopes, name too short, or empty scopes array

---

#### `DELETE /api/api-keys/:id`

Revoke an API key. **Immediate** — the next request using this key returns `401`.

**Headers:** `Authorization: Bearer <jwt>` (JWT only)

**Response `200`:**
```json
{ "revoked": true, "id": "key-uuid" }
```

---

#### `POST /api/api-keys/:id/rotate` (v1.5+)

Zero-downtime rotation: creates a new key with same scopes, caps the old key's `expiresAt` at `now + 24h` (grace window).

**Headers:** `Authorization: Bearer <jwt>` (JWT only)

**Response `200`:**
```json
{
  "oldKeyId": "old-key-uuid",
  "newKey": {
    "id": "new-key-uuid",
    "name": "CI pipeline (rotated)",
    "prefix": "rlk_live_de56fg78",
    "scopes": ["events:read", "workflows:read"],
    "environment": "live",
    "expiresAt": "2027-01-21T22:19:00Z",
    "createdAt": "2026-10-25T23:30:00Z",
    "rawKey": "rlk_live_de56fg78_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b"
  },
  "oldKeyRevokeAt": "2026-10-26T23:30:00Z"
}
```

**Behaviour during grace window:**
- Both old and new key work
- After `oldKeyRevokeAt`, old key returns `401` (expired)
- Old key can be revoked manually earlier with `DELETE /api/api-keys/:id`

**Errors:**
- `404 Not Found` — key doesn't exist or already revoked

---

### Health

#### `GET /api/health`

No auth required.

**Response `200`:**
```json
{
  "status": "ok",
  "db": "up",
  "version": "0.1.0",
  "timestamp": "2026-10-22T10:41:43Z"
}
```

**Response `200` (degraded):**
```json
{ "status": "degraded", "db": "down", ... }
```

---

## Ingress API

### Webhook Receiver

#### `POST /webhook/:tenantId/:workflowId`

Receives a webhook for the specified workflow.

**Headers (depending on source type):**

Stripe:
```http
Content-Type: application/json
Stripe-Signature: t=1700000000,v1=abc123...
```

GitHub:
```http
Content-Type: application/json
X-Hub-Signature-256: sha256=abc123...
```

**Optional headers (idempotency):**
```http
X-Correlation-Id: my-tracking-id
X-Event-Id: evt-unique-id
```

If `X-Event-Id` not provided, the body hash is used as the idempotency key.

**Body:** Arbitrary JSON, max 5 MB.

**Response `202 Accepted`:**
```json
{
  "status": "accepted",
  "correlationId": "a1578194-...",
  "message": "Event queued for processing"
}
```

**Response `200 OK` (duplicate):**
```json
{
  "status": "duplicate",
  "message": "Event already processed",
  "correlationId": "a1578194-..."
}
```

**Errors:**
- `400 Bad Request` — invalid JSON or non-object payload
- `401 Unauthorized` — signature verification failed
- `404 Not Found` — workflow doesn't exist, is inactive, or belongs to another tenant
- `413 Payload Too Large` — body > 5 MB
- `429 Too Many Requests` — rate limit exceeded (300/min per workflow)

---

### Ingress Health

#### `GET /health`

**Response `200`:**
```json
{
  "status": "ok",
  "checks": { "db": "up", "redis": "up" },
  "version": "0.1.0",
  "timestamp": "2026-10-22T10:41:43Z"
}
```

---

## Workers API

All routes require `X-Cron-Secret: <secret>` header.

### Process

#### `POST /internal/process`

Pops events from `queue:events:incoming`, enriches, transforms, applies routing rules, writes to MongoDB, fans out to egress.

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

**Behaviour:**
- Processes up to `BATCH_SIZE` events (default 3)
- Stops after `TIME_BUDGET_MS` (default 7000ms)
- Remaining events stay in queue for next invocation

---

### Deliver

#### `POST /internal/deliver`

Pops deliveries from `queue:egress:pending`, attempts to deliver, retries or DLQs on failure.

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

---

### Queue Status

#### `GET /internal/status`

**Response `200`:**
```json
{
  "incoming": 5,
  "processing": 0,
  "egress": 12,
  "timestamp": "2026-10-22T10:41:43Z"
}
```

---

### Egress Stats

#### `GET /internal/egress/stats`

**Response `200`:**
```json
{
  "pending": 12,
  "delayed": 3,
  "delivered24h": 308,
  "dlq": 2
}
```

---

### Adapter List (v1.2+)

#### `GET /internal/adapters`

Lists all registered adapters discovered via `@DestinationAdapter` decorator.

**Response `200`:**
```json
[
  { "type": "http", "displayName": "HTTP Webhook", "configSchema": { "required": ["url"], "optional": ["method", "headers"] } },
  { "type": "slack", "displayName": "Slack", "configSchema": { "required": ["webhookUrl"] } },
  { "type": "email", "displayName": "Email (Resend)", "configSchema": { "required": ["apiKey", "to", "from"] } },
  { "type": "sheets", "displayName": "Google Sheets", "configSchema": { "required": ["spreadsheetId", "range", "serviceAccountEmail", "privateKey"] } },
  { "type": "discord", "displayName": "Discord", "configSchema": { "required": ["webhookUrl"], "optional": ["username"] } },
  { "type": "airtable", "displayName": "Airtable", "configSchema": { "required": ["apiKey", "baseId", "tableName"], "optional": ["typecast"] } },
  { "type": "notion", "displayName": "Notion", "configSchema": { "required": ["apiKey", "dataSourceId", "titleProperty"], "optional": ["payloadProperty", "notionVersion"] } },
  { "type": "postgres", "displayName": "PostgreSQL", "configSchema": { "required": ["connectionString", "table"], "optional": ["columns", "onConflict", "ssl"] } },
  { "type": "mongodb", "displayName": "MongoDB", "configSchema": { "required": ["connectionString", "database", "collection"], "optional": ["upsertKey"] } }
]
```

---

### Egress Dry-Run (v1.5+)

#### `POST /internal/egress/dry-run`

Runs an adapter against a synthetic payload **without writing to the destination**. Called by the API's `/api/destinations/validate` when `dryRun: true`.

**Request:**
```json
{
  "type": "slack",
  "config": { "webhookUrl": "https://hooks.slack.com/services/TEST/TEST/TEST" },
  "tenantId": "tenant-uuid"
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

**Behaviour:**
- Adapter receives config with `__dryRun: true` added
- Each adapter uses a safe probe (HEAD request, auth check, `SELECT 1`, etc.)
- **No writes to the destination** — no Slack message, no email, no DB row
- 5s timeout per probe

---

### Schedule Tick (v1.3+)

#### `POST /internal/schedule/tick`

Claims due schedules atomically, enqueues synthetic events. Called by external cron every 5 minutes.

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

**Behaviour:**
- Selects up to 25 schedules where `isActive AND nextRunAt <= now`
- Atomic claim via `updateMany` with `nextRunAt <= now` predicate — no duplicate enqueue even under concurrent ticks
- Computes new `nextRunAt` from cron expression before enqueueing
- Invalid cron → schedule deactivated + logged

---

### Schedule Run-Now (v1.4+)

#### `POST /internal/schedule/run-now`

Manually trigger a schedule without waiting for `nextRunAt`.

**Request:**
```json
{ "workflowId": "workflow-uuid" }
```

**Response `200`:**
```json
{
  "correlationId": "69b42467-6165-4547-8ad1-ff11492d44f2",
  "workflowId": "workflow-uuid",
  "enqueuedAt": "2026-10-25T23:29:08Z"
}
```

**Behaviour:**
- Enqueues synthetic event with `rawPayload.type = "relayon.schedule.manual"`
- `nextRunAt` untouched — cron stays scheduled
- Errors if schedule doesn't exist or workflow is inactive

---

### Schedule Status (v1.3+)

#### `GET /internal/schedule/status`

**Response `200`:**
```json
{
  "active": 5,
  "dueNow": 0,
  "next": {
    "workflowId": "workflow-uuid",
    "cronExpression": "0 9 * * *",
    "timezone": "Asia/Karachi",
    "nextRunAt": "2026-10-26T04:00:00Z"
  },
  "timestamp": "2026-10-25T23:30:00Z"
}
```

---

### Workers Health

#### `GET /internal/health`

**Response `200`:**
```json
{
  "status": "ok",
  "checks": { "postgres": "up", "redis": "up", "mongo": "up" },
  "version": "0.1.0",
  "timestamp": "2026-10-22T10:41:43Z"
}
```

---

## Error Response Format

All Dashboard API errors follow a consistent shape:

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "path": "/api/workflows",
  "timestamp": "2026-10-22T10:41:43Z"
}
```

Ingress errors have a slightly different shape (uses `correlationId` instead of `path`):

```json
{
  "error": "invalid_signature",
  "message": "invalid signature",
  "correlationId": "a1578194-..."
}
```

### Error codes by HTTP status

| Status | Meaning |
|---|---|
| `400` | Bad Request — validation failed or malformed input |
| `401` | Unauthorized — missing/invalid token or signature |
| `403` | Forbidden — valid auth but insufficient scope/permissions |
| `404` | Not Found — resource doesn't exist or belongs to another tenant |
| `409` | Conflict — duplicate resource (e.g., email already in use) |
| `413` | Payload Too Large — body exceeds limit |
| `422` | Unprocessable Entity — schema validation failed on YAML import |
| `429` | Too Many Requests — rate limit exceeded |
| `500` | Internal Server Error — unexpected server failure |
| `503` | Service Unavailable — degraded dependency |

---

## Rate Limiting

| Endpoint group | Limit |
|---|---|
| `/webhook/:tenantId/:workflowId` | **300 req/min** per workflow |
| `/api/auth/*` | **10 req/min** per IP |
| `/api/*` (authenticated) | **60 req/min** per user/API key |
| `/internal/*` | No limit (protected by cron secret) |

Rate limit response includes:

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1700000060
Retry-After: 45
```

---

## Live API

**Try it now:** `https://relayon-api.vercel.app/api/health`

**Live dashboard:** `https://relayon.vercel.app`

**Source:** [github.com/zainshah3464/relayon](https://github.com/zainshah3464/relayon)
```

---