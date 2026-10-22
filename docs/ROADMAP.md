
# Relayon — Roadmap

> **Where Relayon is going, and — more importantly — where it's not.**

This roadmap is **honest**. It reflects what will actually be built, what's deferred, and what's been deliberately decided against. Every item has a rationale.

---

## Guiding Principles

**1. Free tier is a feature, not a limitation.** Every decision respects the $0/month constraint. If a feature requires paid infrastructure, it must provide enough value to justify the cost — and that justification must be argued, not assumed.

**2. Ship small, ship often.** A feature that ships this week beats a feature that "ships when it's done" in six months.

**3. Documented gaps are better than undocumented features.** It's OK to not have a feature, as long as it's documented.

**4. No feature without a real user.** If nobody has asked for it, it doesn't go on the roadmap.

**5. Security is not a feature — it's a floor.** No feature ships that lowers the security floor.

---

## Current State — v1.0.0

**Shipped:** 2026-10-22

Complete MVP. See [CHANGELOG](./CHANGELOG.md) for full details.

**What's live:**
- 4-app monorepo deployed on Vercel ($0/month)
- Multi-tenant auth with JWT + refresh rotation
- Workflow CRUD + destination management
- 5 webhook signature verifiers
- Groq AI enrichment with cache + fallback
- JSONata transforms
- 4 destination adapters (HTTP, Slack, Email, Sheets)
- Exponential backoff retry with DLQ
- Circuit breaker
- Full dashboard: events, DLQ, analytics, settings
- 5 documentation files

**What's NOT there:**
- Unit tests
- API key management UI
- Conditional routing
- Charts in analytics
- Bulk actions

---

## Short Term — v1.1 (Q1 2027)

**Target:** 4-6 weeks. Focus: **fill the testing gap and unlock API key usage.**

### 1. Unit tests (Vitest) — P0

**Why:** Current testing is smoke test only. Bugs in pure functions (signature verifiers, retry calculation, JSONata timeout) have no coverage.

**Scope:**
- Signature verifiers (5 sources × 3 cases each = 15 tests)
- Retry policy parsing + backoff calculation (8 tests)
- Circuit breaker state transitions (6 tests)
- JSONata transform edge cases (5 tests)
- Groq cache key generation (3 tests)
- IP hash function (2 tests)

**Effort:** ~2 days
**Blocks:** Nothing

**Success criteria:** 40+ tests, all green in CI.

---

### 2. API keys management UI — P1

**Why:** The `api_keys` table exists but no way to create/rotate keys via UI. Currently anyone using the public API must share the dashboard JWT (which expires every 15 min).

**Scope:**
- `GET /api/api-keys` (list, hash-only)
- `POST /api/api-keys` (create, raw shown once)
- `DELETE /api/api-keys/:id` (revoke)
- Dashboard UI: `/settings/api-keys` page
- API key auth middleware (accept `X-Api-Key: <raw>` in addition to `Authorization: Bearer <jwt>`)

**Effort:** ~3 days
**Blocks:** Third-party integrations (they need long-lived API keys)

**Success criteria:** A user can create an API key, use it via curl, and revoke it.

---

### 3. Destination test endpoint — P1

**Why:** Users can't verify a destination works until they send a real webhook. A "Send test event" button on each destination would catch config errors immediately.

**Scope:**
- `POST /api/destinations/:id/test` — sends a synthetic event through the adapter
- Returns the adapter's response (status code, body snippet, latency)
- Does **not** count against quota
- Rate-limited: 3 tests/min per destination

**Effort:** ~2 days
**Blocks:** Nothing

**Success criteria:** User clicks "Test" → sees immediate success/error → fixes config if needed.

---

### 4. Persistent audit log — P2

**Why:** Console logs get deleted after 30 days. Every privileged action should persist for compliance and debugging.

**Scope:**
- New table: `audit_logs` (actor_id, action, target_type, target_id, before, after, ip_hash, timestamp)
- Middleware in API that logs every mutating request
- `GET /api/audit-logs` — cursor-paginated list
- Dashboard page: `/settings/audit`

**Effort:** ~4 days (schema + middleware + UI)
**Blocks:** Enterprise tier

**Success criteria:** Every workflow/destination/DLQ action is queryable in the dashboard.

---

### 5. Improved error messages — P2

**Why:** Current errors are technically correct but not actionable. `"Invalid or expired token"` doesn't tell the user what to do.

**Scope:**
- Every `401` gets a "next step" suggestion
- Every `404` includes "check workflowId"
- Every `429` includes the reset time
- Adapter errors surface the destination's response body (already done) + a hint

**Effort:** ~1 day
**Blocks:** Nothing

**Success criteria:** A new user can recover from every error without reading docs.

---

## Medium Term — v1.2 (Q2 2027)

**Target:** 6-8 weeks. Focus: **make the dashboard feel like a product, not a prototype.**

### 6. Charts in analytics — P1

**Why:** Current analytics are just numbers. Time-series charts would show trends, spot anomalies, and make the dashboard feel premium.

**Scope:**
- **Event volume chart** — 7-day line chart, per status
- **Delivery success rate chart** — 7-day line chart
- **Latency distribution** — p50/p95/p99 per destination (bar chart)
- **Destination breakdown** — pie chart of events by destination type
- Implementation: pure SVG (no charting library — keeps bundle small)

**Effort:** ~5 days
**Blocks:** Nothing

**Success criteria:** Dashboard shows 4 charts with real data.

---

### 7. Bulk DLQ actions — P1

**Why:** If 50 deliveries fail during a Slack outage, replaying them one-by-one is painful.

**Scope:**
- Checkbox select on DLQ page
- "Replay selected" button (batch replay)
- "Discard selected" button
- `POST /api/dlq/replay-batch` (accepts `{ ids: string[] }`)

**Effort:** ~2 days
**Blocks:** Nothing

**Success criteria:** User can replay/discard 100 DLQ entries in one click.

---

### 8. Conditional routing — P1

**Why:** Currently every event goes to every destination. Users want "if severity=high → Slack; else → Sheets". This is a top request.

**Scope:**
- New column `destinations.condition` (JSONata boolean expression)
- On fan-out: evaluate condition, skip destination if false
- Dashboard: text area in destination form for condition
- Default: `true` (no change for existing destinations)

**Effort:** ~4 days
**Blocks:** Nothing

**Success criteria:** User can route events based on enrichment category.

---

### 9. More destination adapters — P2

**Why:** Requests for Discord, Airtable, Notion, Linear are the top user asks.

**Scope:**
- **Discord** — webhook (5 min)
- **Airtable** — REST API (30 min)
- **Notion** — REST API (30 min)
- **Linear** — GraphQL API (1h)
- **PagerDuty** — Events API (1h)
- **Opsgenie** — Alert API (1h)

**Effort:** ~1-2 days total
**Blocks:** Nothing

**Success criteria:** 6 new adapters, documented in `docs/API_REFERENCE.md`.

---

### 10. PostgreSQL/MongoDB destination adapters — P2

**Why:** "Route Stripe webhook → my Postgres" is a common pattern. Currently only external HTTP.

**Scope:**
- **Postgres destination** — user provides connection string, table name; worker does `INSERT`
- **MongoDB destination** — same, but `insertOne`
- New schema field: `destinations.config.encrypted` (encrypt connection strings)
- **Security critical:** must be rate-limited and timeout-bounded (5s per insert)

**Effort:** ~6 days (encryption + adapter + tests)
**Blocks:** Security review (encrypted configs)

**Success criteria:** User can insert a webhook payload into their Postgres with one config.

---

### 11. i18n (Urdu + Hindi) — P2

**Why:** Target audience is Pakistan/India. English-only limits reach.

**Scope:**
- Angular i18n with `@angular/localize`
- Language switcher in settings
- All dashboard strings externalized
- Emails in recipient's language
- PDF exports in selected language

**Effort:** ~10 days (translations + testing)
**Blocks:** Need translators

**Success criteria:** User can switch to Urdu/Hindi, dashboard + emails render correctly (RTL for Urdu).

---

## Long Term — v2.0 (Q3-Q4 2027)

**Target:** 3-4 months. Focus: **make Relayon enterprise-ready.**

### 12. SAML SSO — P0 for enterprise

**Why:** Enterprise customers won't use password auth. SAML SSO is table stakes for B2B SaaS.

**Scope:**
- SAML 2.0 via `samlify` or `passport-saml`
- Metadata exchange flow
- IdP initiated + SP initiated
- Auto-provision users on first login
- Map SAML groups → Relayon roles

**Effort:** ~3 weeks
**Blocks:** Enterprise tier

**Success criteria:** Okta/Azure AD integration working end-to-end.

---

### 13. Row-level security (RLS) — P0 for enterprise

**Why:** Currently multi-tenancy is enforced at application layer. Enterprise buyers want DB-enforced isolation.

**Scope:**
- Enable RLS on all tables
- Policy: `tenant_id = current_setting('app.tenant_id')::uuid`
- Middleware sets `app.tenant_id` on every DB session
- Defense in depth: even if application has a bug, DB prevents cross-tenant reads

**Effort:** ~1 week (risky — needs careful testing)
**Blocks:** SOC 2 compliance

**Success criteria:** Penetration test confirms Tenant A cannot query Tenant B data even with malicious SQL.

---

### 14. Compliance: SOC 2 Type I — P0 for enterprise

**Why:** Enterprise sales require SOC 2. Without it, no serious B2B buyers.

**Scope:**
- Audit log persistence (from v1.1)
- Documented security policies
- Incident response plan
- Access review process
- Annual penetration test
- Engage a SOC 2 auditor (~$15K-30K)

**Effort:** ~3-6 months (mostly documentation + audit)
**Blocks:** Enterprise revenue

**Success criteria:** SOC 2 Type I certificate issued.

---

### 15. Multi-region deployment — P1

**Why:** Currently all services in `iad1`. EU/APAC users see 200-400ms latency. Enterprise needs low-latency in their region.

**Scope:**
- Deploy Workers to multiple Vercel regions
- Postgres with read replicas per region
- Redis with replica per region (Upstash supports this)
- Geo-routing at DNS level (Vercel Pro)
- Data residency: EU data stays in EU

**Effort:** ~4 weeks
**Blocks:** Vercel Pro ($20/mo) + Neon Pro + Upstash paid

**Success criteria:** EU users see <100ms API latency.

---

### 16. Self-hosted option — P1

**Why:** Some enterprises can't use SaaS (compliance, air-gap). Offering self-hosted option captures this market.

**Scope:**
- Docker Compose for full stack (Postgres + Mongo + Redis + 4 apps)
- Helm chart for Kubernetes
- Environment file with sensible defaults
- `/docs/self-hosting.md` deployment guide

**Effort:** ~2 weeks
**Blocks:** Nothing — pure additive

**Success criteria:** A user can run `docker compose up` and have a working Relayon locally.

---

## Not Planned — and Why

Deliberate non-goals. These are **not** oversights — they're decisions.

### ❌ Zapier-style no-code workflow builder

**Why not:** Zapier has 100+ engineers building their UI. Relayon is a solo project. The current `workflows + destinations` model covers 80% of use cases. A visual builder would double the codebase for 20% more reach.

**Alternative:** Conditional routing (v1.2) + 10 adapters (v1.2) covers most of the gap.

---

### ❌ Native mobile apps (iOS/Android)

**Why not:** The dashboard is responsive PWA-compatible. Building native apps for a webhook platform is a poor use of time — nobody manages webhooks on their phone at 3 AM.

**Alternative:** PWA install prompt (planned for v1.3).

---

### ❌ Blockchain / NFT features

**Why not:** Solutions looking for problems. No user has asked for this. Ever.

---

### ❌ Machine learning for anomaly detection

**Why not:** The analytics already show trends. ML for anomaly detection would need training data, labeled incidents, and a dedicated data scientist. Not worth it for an MVP.

**Alternative:** Threshold-based alerts (planned for v2.0) cover most use cases.

---

### ❌ Voice interface (Alexa, Siri)

**Why not:** "Alexa, send a webhook" is not a real use case.

---

### ❌ Custom LLM fine-tuning

**Why not:** Groq's `gpt-oss-120b` is good enough for the 4 enrichment tasks (summarize, classify, extract, translate). Fine-tuning requires labeled data per tenant, which no tenant has.

**Alternative:** Allow tenants to customize `enrichmentPrompt` (already done in v1.0).

---

### ❌ Real-time WebSocket updates on dashboard

**Why not:** Current polling is fine for the request-response workflow. WebSockets require a persistent connection, which Vercel Serverless doesn't support. The workaround (Upstash Realtime) costs $25/mo for a feature nobody has asked for.

**Alternative:** Dashboard refreshes on navigation. Users click "Refresh" for manual updates.

---

### ❌ Drag-and-drop workflow builder

**Why not:** Same as visual builder. The current form-based workflow creation is functional and 100x simpler.

---

### ❌ Advanced filtering on events (JSONPath queries)

**Why not:** Cursor-paginated list + status filter covers the common case. Advanced querying is a "power user" feature that would require MongoDB query builders, additional indexes, and a query DSL. Not worth it for the current user base.

**Alternative:** Export to CSV, query externally (planned for v1.3).

---

## How to Influence the Roadmap

### Vote on existing items

Reactions on GitHub issues count. High-reaction items move up. This is the **only** signal used for prioritization.

### Propose new features

Open an issue with:
- **Problem statement** — what problem does it solve?
- **Proposed solution** — how should it work?
- **Alternatives considered** — what else did you think of?
- **Success criteria** — how do we know it worked?

Vague proposals ("add AI") will be closed with a request for specificity.

### Sponsor a feature

Email `zainshahzs110@gmail.com` with the feature name and rough budget. Sponsorship moves items up but doesn't override architecture decisions.

### Contribute code

Comment on the issue, wait for maintainer confirmation, then follow `CONTRIBUTING.md`.

---

## Versioning Policy

| Version | Status | Purpose |
|---|---|---|
| `v1.0.x` | Current | Bug fixes, security patches only |
| `v1.1.0` | Planned | Tests + API keys + destination test |
| `v1.2.0` | Planned | Charts + conditional routing + bulk DLQ |
| `v2.0.0` | Planned | SAML SSO + RLS + SOC 2 + self-hosted |

**Breaking changes only in major versions.** `v1.x` is backward compatible.

**Support window:** Current minor + last two minors get security fixes.

---

## Last Updated

**2026-10-22** — Initial roadmap published with v1.0.0.

This document is a **living plan**, not a contract. Priorities shift based on user feedback, but the principles don't.
```

---