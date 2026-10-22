
# Relayon — API Reference

> **Complete reference for Relayon's HTTP APIs.**

Relayon exposes **three independent APIs**, each on its own domain:

| API | Base URL | Purpose |
|---|---|---|
| **Dashboard API** | `https://relayon-api.vercel.app/api` | Control plane (auth, workflows, events) |
| **Ingress API** | `https://relayon-ingress.vercel.app` | Data plane (webhook reception) |
| **Workers API** | `https://relayon-workers.vercel.app/internal` | Internal automation (cron-triggered) |

---

## Table of Contents

- [Authentication](#authentication)
- [Dashboard API](#dashboard-api)
  - [Auth](#auth)
  - [Tenants](#tenants)
  - [Workflows](#workflows)
  - [Destinations](#destinations)
  - [Events](#events)
  - [DLQ](#dlq)
  - [Analytics](#analytics)
  - [Health](#health)
- [Ingress API](#ingress-api)
  - [Webhook Receiver](#webhook-receiver)
  - [Health](#ingress-health)
- [Workers API](#workers-api)
  - [Process](#process)
  - [Deliver](#deliver)
  - [Queue Status](#queue-status)
  - [Egress Stats](#egress-stats)
  - [DLQ Replay](#dlq-replay)
  - [Health](#workers-health)
- [Error Response Format](#error-response-format)
- [Rate Limiting](#rate-limiting)

---

## Authentication

### Dashboard API — JWT (Bearer)

All routes under `/api/*` (except `/api/auth/*` and `/api/health`) require a valid JWT in the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token lifecycle:**
- **Access token** — 15 minutes expiry (`JWT_EXPIRES_IN=15m`)
- **Refresh token** — 7 days expiry, single-use (rotation enforced)
- **Auto-refresh** — Dashboard's `authInterceptor` refreshes silently on 401

**Payload (decoded):**
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

### Ingress API — HMAC Signature

No JWT. Instead, every webhook must include a source-specific signature header:

| Source | Header | Algorithm |
|---|---|---|
| Stripe | `Stripe-Signature` | HMAC-SHA256 over `{timestamp}.{body}` |
| GitHub | `X-Hub-Signature-256` | HMAC-SHA256 over `{body}`, prefixed `sha256=` |
| Shopify | `X-Shopify-Hmac-Sha256` | HMAC-SHA256 over `{body}`, base64 |
| Slack | `X-Slack-Signature` | HMAC-SHA256 over `v0:{timestamp}:{body}` |
| Generic | `X-Webhook-Signature` | HMAC-SHA256 over `{body}`, hex |

Signature verification uses **timing-safe comparison** to prevent timing attacks. Timestamp tolerance: 300 seconds (configurable via `WEBHOOK_SIGNATURE_TOLERANCE_SECONDS`).

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
{
  "refreshToken": "mUt9tJ9K..."
}
```

**Response `200`:** Same shape as login.

**Errors:**
- `401 Unauthorized` — token invalid, revoked, or expired

---

#### `POST /api/auth/logout`

Revokes the provided refresh token.

**Request:**
```json
{
  "refreshToken": "mUt9tJ9K..."
}
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
{
  "name": "Acme Corp (Renamed)"
}
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

**Response `200`:**
```json
[
  {
    "id": "workflow-uuid",
    "tenantId": "tenant-uuid",
    "name": "Stripe → Slack",
    "sourceType": "stripe",
    "sourceConfig": { "secret": "whsec_..." },
    "enrichmentEnabled": true,
    "enrichmentPrompt": "Summarize and classify",
    "transformExpression": null,
    "isActive": true,
    "createdAt": "2026-10-20T08:00:00Z",
    "_count": { "destinations": 2 }
  }
]
```

---

#### `GET /api/workflows/:id`

Returns full workflow with destinations.

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
      "config": { "webhookUrl": "https://hooks.slack.com/..." },
      "enabled": true,
      "retryPolicy": { "max_attempts": 5, "backoff_ms": [10000, 30000, 60000, 300000, 900000] }
    }
  ]
}
```

**Errors:**
- `404 Not Found` — workflow doesn't exist or belongs to another tenant

---

#### `POST /api/workflows`

**Request:**
```json
{
  "name": "GitHub → Jira",
  "sourceType": "github",
  "sourceConfig": { "secret": "whsec_github_..." },
  "enrichmentEnabled": false,
  "enrichmentPrompt": null,
  "transformExpression": "{ 'title': pull_request.title, 'severity': 'high' }",
  "isActive": true
}
```

**`sourceType` enum:** `stripe`, `github`, `shopify`, `slack`, `generic`

**Response `201`:** Full workflow object.

---

#### `PATCH /api/workflows/:id`

All fields optional. Only provided fields are updated.

**Response `200`:** Updated workflow.

---

#### `DELETE /api/workflows/:id`

Cascade deletes destinations.

**Response `200`:**
```json
{ "deleted": true, "id": "workflow-uuid" }
```

---

### Destinations

#### `GET /api/workflows/:workflowId/destinations`

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

---

#### `POST /api/workflows/:workflowId/destinations`

**Request:**
```json
{
  "type": "http",
  "name": "Production Webhook",
  "config": { "url": "https://api.example.com/webhook", "method": "POST" },
  "enabled": true
}
```

**`type` enum:** `http`, `slack`, `email`, `sheets`, `postgres`, `mongodb`

**Config examples by type:**

**HTTP:**
```json
{ "url": "https://...", "method": "POST", "headers": { "X-Custom": "value" } }
```

**Slack:**
```json
{ "webhookUrl": "https://hooks.slack.com/services/T00/B00/XXX" }
```

**Email (Resend):**
```json
{ "apiKey": "re_...", "to": ["a@x.com"], "from": "Relayon <noreply@y.com>" }
```

**Google Sheets:**
```json
{
  "spreadsheetId": "1abc...",
  "range": "Sheet1!A:Z",
  "serviceAccountEmail": "xxx@xxx.iam.gserviceaccount.com",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
}
```

**Response `201`:** Full destination object.

---

#### `PATCH /api/destinations/:id`

Update name, config, or enabled. Cannot change `type` (create a new destination instead).

**Response `200`:** Updated destination.

---

#### `DELETE /api/destinations/:id`

**Response `200`:**
```json
{ "deleted": true, "id": "dest-uuid" }
```

---

### Events

#### `GET /api/events`

Cursor-paginated list of events for the tenant.

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

Cursor-paginated list of DLQ entries (deliveries with `status: 'dlq'`).

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

Resets a DLQ delivery to `status: 'pending'`. Workers will pick it up on next `/internal/deliver` cycle.

**Response `200`:**
```json
{ "replayed": true, "deliveryId": "delivery-id" }
```

**Errors:**
- `404 Not Found` — delivery doesn't exist or isn't in DLQ status

---

#### `DELETE /api/dlq/:id`

Permanently deletes a DLQ delivery.

**Response `200`:**
```json
{ "discarded": true, "deliveryId": "delivery-id" }
```

---

### Analytics

#### `GET /api/analytics/overview`

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

Pops events from `queue:events:incoming`, enriches, transforms, writes to MongoDB, and fans out to egress.

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

**Behavior:**
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

### DLQ Replay

#### `POST /internal/replay/:deliveryId`

Internal endpoint — same semantics as `/api/dlq/:id/replay` but bypasses JWT (uses cron secret).

**Response `200`:**
```json
{ "replayed": true, "message": "Delivery re-queued" }
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

All errors follow a consistent shape:

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
| `403` | Forbidden — valid auth but insufficient permissions |
| `404` | Not Found — resource doesn't exist or belongs to another tenant |
| `409` | Conflict — duplicate resource (e.g., email already in use) |
| `413` | Payload Too Large — body exceeds limit |
| `429` | Too Many Requests — rate limit exceeded |
| `500` | Internal Server Error — unexpected server failure |
| `503` | Service Unavailable — degraded dependency |

---

## Rate Limiting

| Endpoint group | Limit |
|---|---|
| `/webhook/:tenantId/:workflowId` | **300 req/min** per workflow |
| `/api/auth/*` | **10 req/min** per IP |
| `/api/*` (authenticated) | **60 req/min** per user |
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