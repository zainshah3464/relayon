# Relayon — Roadmap

> **Where Relayon is going, and — more importantly — where it's not.**
>
> **Current version:** v1.5.0

This roadmap is **honest**. It reflects what will actually be built, what's deferred, and what's been deliberately decided against. Every item has a rationale.

**Note on this document (v1.5 update):** The original v1.0 roadmap planned v1.1-v2.0 with specific items. Reality diverged — some items shipped earlier than planned, some later, and several major features shipped that weren't on the roadmap at all (scheduled workflows, versioning, encryption, key rotation). This version documents the divergence honestly and re-plans from the actual v1.5 state.

---

## Guiding Principles

**1. Free tier is a feature, not a limitation.** Every decision respects the $0/month constraint. If a feature requires paid infrastructure, it must provide enough value to justify the cost — and that justification must be argued, not assumed.

**2. Ship small, ship often.** A feature that ships this week beats a feature that "ships when it's done" in six months.

**3. Documented gaps are better than undocumented features.** It's OK to not have a feature, as long as it's documented.

**4. No feature without a real user.** If nobody has asked for it, it doesn't go on the roadmap.

**5. Security is not a feature — it's a floor.** No feature ships that lowers the security floor.

**6. Honesty about velocity beats optimism about timelines.** If a date slips, the roadmap updates. The dates are estimates, not commitments. What's shipped, shipped.

---

## Current State — v1.5.0

**Shipped:** 2026-10-26

See [CHANGELOG](./CHANGELOG.md) for full details of each version.

**What's live:**

- 4-app monorepo deployed on Vercel ($0/month)
- Multi-tenant auth (JWT + refresh rotation + **API keys with scopes**, v1.2+)
- Workflow CRUD + destination management
- **Workflow versioning** with snapshots, restore, and line-level diff (v1.3-v1.5)
- **Scheduled workflows** — DB-backed cron, run-now, bulk pause/resume (v1.3-v1.5)
- 5 webhook signature verifiers
- Groq AI enrichment with cache + fallback
- JSONata transforms with preview endpoint
- **Conditional routing** via JSONata rules (v1.1+)
- **9 destination adapters** — HTTP, Slack, Email, Sheets, Discord, Airtable, Notion, PostgreSQL, MongoDB
- **Credential encryption at rest** — AES-256-GCM with HKDF per-tenant keys, key rotation, full-config toggle (v1.3-v1.5)
- **Destination validation** — schema + real dry-run via workers, `__dryRun` honored in all 9 adapters (v1.5)
- Exponential backoff retry with DLQ
- Circuit breaker
- Bulk DLQ replay + discard
- Full dashboard: events, DLQ, analytics, charts, settings, API keys, schedules, versions
- 11 documentation files

**What's NOT there (still):**

- **Unit tests — 0 across the entire codebase** (5 versions shipped without adding any)
- Persistent audit log table
- SAML SSO
- Row-level security
- SOC 2 / HIPAA / GDPR certification
- Multi-region deployment
- Self-hosted Docker / Helm
- i18n (Urdu / Hindi)
- Linear, PagerDuty, Opsgenie adapters
- `API_KEY_PEPPER` rotation automation
- MFA / TOTP for dashboard login

---

## Reality Check — What Actually Happened (v1.0 → v1.5)

**The original v1.0 roadmap was overtaken.** Here's what was planned vs what shipped:

| Original Plan (v1.0 roadmap) | Planned For | Actual Status | Version |
|---|---|---|---|
| Unit tests (Vitest) | v1.1 | ❌ **Still deferred** | v2.0 |
| API keys management UI | v1.1 | ✅ Shipped | v1.2 |
| Destination test endpoint | v1.1 | ✅ Shipped (as `/validate` + `/dry-run`) | v1.5 |
| Persistent audit log | v1.1 | ❌ **Still deferred** | v2.0 |
| Improved error messages | v1.1 | ⚠️ Partial | v2.0 (continue) |
| Charts in analytics | v1.2 | ✅ Shipped | v1.2 |
| Bulk DLQ actions | v1.2 | ✅ Shipped (replay v1.1, discard v1.2) | v1.1-v1.2 |
| Conditional routing | v1.2 | ✅ Shipped | v1.1 |
| Discord adapter | v1.2 | ✅ Shipped | v1.2 |
| Airtable adapter | v1.2 | ✅ Shipped | v1.3 |
| Notion adapter | v1.2 | ✅ Shipped | v1.3 |
| Linear adapter | v1.2 | ❌ **Still deferred** | v2.0 |
| PagerDuty adapter | v1.2 | ❌ **Still deferred** | v2.0 |
| Opsgenie adapter | v1.2 | ❌ **Still deferred** | v2.0 |
| PostgreSQL adapter | v1.2 | ✅ Shipped | v1.4 |
| MongoDB adapter | v1.2 | ✅ Shipped | v1.4 |
| i18n (Urdu + Hindi) | v1.2 | ❌ **Still deferred** | v2.0 |
| SAML SSO | v2.0 | ❌ Not started | v2.0+ |
| Row-level security | v2.0 | ❌ Not started | v2.0+ |
| SOC 2 Type I | v2.0 | ❌ Not started | v2.0+ |
| Multi-region | v2.0 | ❌ Not started | v2.0+ |
| Self-hosted | v2.0 | ❌ Not started | v2.0+ |

**And what shipped that was NOT on the roadmap:**

| Feature | Version | Why it shipped anyway |
|---|---|---|
| **Scheduled workflows** | v1.3 | Real user pattern (daily reports, periodic polls). DB-backed cron, serverless-safe. |
| **Workflow versioning** | v1.3 | Enterprise requirement — "who changed what when." Snapshot + restore + diff. |
| **Credential encryption at rest** | v1.3 | Was implicit under "PG adapter security" in original plan. Became the single biggest security upgrade. |
| **Key rotation (`enc:v2`)** | v1.4 | Follow-on to encryption. Zero-downtime rotation is table stakes for compliance. |
| **Schedule run-now** | v1.4 | UX gap — users wanted to test schedules without waiting for cron. |
| **API key rotation** | v1.5 | Companion to v1.2 API keys. Grace window rotation is standard. |
| **Full config encryption** | v1.5 | Optional flag for SOC 2 tenants who want *everything* encrypted, not just secrets. |
| **Version diff** | v1.5 | Restore existed in v1.3 but you couldn't see what changed. Diff closes that loop. |
| **Bulk schedule pause/resume** | v1.5 | Operator QoL — pausing 50 schedules one by one is painful. |
| **`__dryRun` safety in all 9 adapters** | v1.5 | Caught during v1.5 planning that only HTTP was honoring it. Would have sent real messages on validation. |

**The honest lesson:** velocity was much higher than the roadmap assumed (5 versions in 5 days instead of 4-6 weeks per version), but **testing fell behind**. Every release prioritized shipping the next high-value feature over building test infrastructure. v2.0 is where this stops.

---

## Next — v2.0 (Q1-Q2 2027)

**Target:** 3-4 months. **Focus: close the testing gap, then enterprise readiness.**

**The v2.0 ordering is non-negotiable:** tests first, then features. Every prior version deferred testing. v2.0 doesn't.

### 1. Unit tests (Vitest) — P0 (BLOCKING)

**Why:** 5 versions, 0 unit tests. This is the biggest technical debt. Every other v2.0 feature is blocked on having test coverage as a foundation.

**Scope:**
- Vitest + `@testing-library/node` infrastructure
- **crypto-box** — encrypt/decrypt round-trip, HKDF tenant separation, kid lookup, v1 envelope fallback, malformed envelope rejection
- **API keys** — verify (valid/revoked/expired/wrong secret/malformed), rotate grace window, scope enforcement, timing-safe compare
- **Versioning** — capture increment, 50-cap, restore destination recreation, diff edge cases (empty snapshots, unicode, very large)
- **Scheduling** — cron parser validation, atomic claim (real Postgres in CI), run-now enqueue
- **Routing** — no rules, rule matched, no rule matched, JSONata error
- **Signature verifiers** — 5 sources × 3 cases (happy, out-of-tolerance, tampered body)
- **Retry/backoff** — backoff calculation, retryable vs non-retryable classification
- **Circuit breaker** — open, closed, half-open transitions
- **All 9 adapters** — mocked HTTP, request shape verification, error classification, **`__dryRun` probe is safe (no writes)**

**Effort:** ~3-4 weeks
**Blocks:** Every other v2.0 feature ships AFTER this

**Success criteria:**
- 60%+ line coverage on `apps/api/src/lib/`, `apps/api/src/modules/api-keys/`, `apps/api/src/modules/workflows/`, `apps/workers/src/modules/egress/adapters/`
- Zero regression PRs mergeable without a test
- Smoke test extended to cover versioning, API key verify, dry-run
- CI gates merges on coverage threshold

**Non-negotiable:** No v2.0 feature ships before this is complete.

---

### 2. Persistent audit log — P1

**Why:** Console logs disappear after 30 days. Every privileged action should persist for compliance and debugging. This was planned for v1.1 and deferred 5 times. v2.0 closes it.

**Scope:**
- New table: `audit_logs` (actor_id, actor_type [user/api-key/system], action, target_type, target_id, before, after, ip_hash, timestamp)
- Middleware in API that logs every mutating request
- `GET /api/audit-logs` — cursor-paginated list, filterable by action/actor/target
- Dashboard page: `/settings/audit` with filter + search
- Retention: 90 days by default (configurable per plan)

**Effort:** ~1 week
**Blocks:** SOC 2 readiness

**Success criteria:** Every workflow/destination/DLQ/schedule/API-key action is queryable in the dashboard.

---

### 3. MFA / TOTP — P1

**Why:** Password-only login is a gap in `SECURITY.md`. Enterprise buyers require MFA. This was never on the roadmap but surfaced during v1.5 security review.

**Scope:**
- TOTP via `otplib` or `speakeasy`
- QR code generation for setup
- Backup codes (10 per user, one-use each)
- Enforce MFA per-tenant (owner can require it)
- `POST /api/auth/mfa/setup`, `/verify`, `/disable`
- Login flow: password → TOTP challenge if enabled

**Effort:** ~1 week
**Blocks:** SOC 2 readiness

**Success criteria:** User can enable MFA, login requires TOTP code, backup codes work if TOTP device lost.

---

### 4. `API_KEY_PEPPER` rotation automation — P1

**Why:** Currently rotating `API_KEY_PEPPER` is a breaking change — all issued keys become invalid. No migration path exists.

**Scope:**
- Multi-pepper keyring (same pattern as `CONNECTOR_ENCRYPTION_KEYS` from v1.4)
- `API_KEY_PEPPERS=kid1:pepper1,kid2:pepper2` env format
- Store `pepper_kid` on each API key row
- Verification tries matching kid's pepper first, then falls back
- Rotation script: re-hash all keys with current pepper
- Zero-downtime rotation

**Effort:** ~3 days
**Blocks:** SOC 2 readiness (key rotation is evidence for auditors)

**Success criteria:** `API_KEY_PEPPERS` can rotate without invalidating issued keys.

---

### 5. Smoke test extension — P1

**Why:** Smoke test is still 10 checks (unchanged from v1.0). Doesn't cover v1.1-v1.5 features at all.

**Scope:**
- Add checks for: version snapshot capture, restore, diff
- Add checks for: API key verify (with real API key)
- Add checks for: dry-run validation (safe — no writes)
- Add checks for: scheduled workflow tick (force `nextRunAt` past via API)
- Add checks for: bulk schedule pause/resume
- Total: 10 → ~16 checks

**Effort:** ~3 days
**Blocks:** Nothing

**Success criteria:** Smoke test catches regressions in v1.1-v1.5 features, not just v1.0 happy path.

---

### 6. Linear + PagerDuty + Opsgenie adapters — P2

**Why:** Remaining requested adapters from v1.0 roadmap. 9 adapters exist, 3 more close the "common SaaS" set.

**Scope:**
- **Linear** — GraphQL API, create issue
- **PagerDuty** — Events API v2, trigger incident
- **Opsgenie** — Alerts API, create alert

**Effort:** ~3 days total (pattern established in v1.2, single file per adapter)
**Blocks:** Nothing

**Success criteria:** 12 adapters registered, each with `__dryRun` honored.

---

### 7. `destinationSummary` `enc:v2:` fix — P2 (cosmetic)

**Why:** Cosmetic v1.4 bug — dashboard shows "Slack/Discord webhook" for `enc:v2:` envelopes instead of "•••••••• (encrypted)". Cosmetic only, DB and API are correct.

**Scope:**
- Update `workflow-detail.component.ts` `destinationSummary()` to check both `enc:v1:` and `enc:v2:`

**Effort:** ~15 minutes
**Blocks:** Nothing

**Success criteria:** Dashboard shows "encrypted" indicator for both v1 and v2 envelopes.

---

### 8. i18n (Urdu + Hindi) — P2

**Why:** Target audience is Pakistan/India. English-only limits reach. This was planned for v1.2, deferred twice.

**Scope:**
- Angular i18n with `@angular/localize`
- Language switcher in settings
- All dashboard strings externalized
- Emails in recipient's language
- RTL support for Urdu
- Initial translation (translation quality is a separate problem)

**Effort:** ~2 weeks (mostly externalization + testing)
**Blocks:** Need translators (volunteers welcome)

**Success criteria:** User can switch to Urdu/Hindi, dashboard + emails render correctly.

---

### 9. Improved error messages — P2

**Why:** Current errors are technically correct but not actionable. `"Invalid or expired token"` doesn't tell the user what to do. This was partially addressed in v1.3-v1.5 (dry-run gives specific config errors), but many endpoints still return bare messages.

**Scope:**
- Every `401` gets a "next step" suggestion
- Every `404` includes "check workflowId" hint
- Every `429` includes reset time
- Adapter errors surface the destination's response body + hint (already done for most)
- Each error has a `hint` field in the response

**Effort:** ~2 days
**Blocks:** Nothing

**Success criteria:** A new user can recover from every error without reading docs.

---

## Long Term — v3.0 (2028)

**Target:** 3-6 months. Focus: **enterprise readiness** (only if v2.0 succeeds and there's actual demand).

**These are conditional — they ship only if the free-tier foundation has paying enterprise customers.**

### SAML SSO — P0 for enterprise

SAML 2.0 via `samlify` or `passport-saml`. Metadata exchange, IdP + SP initiated flows, auto-provision users, map SAML groups to roles. **Effort:** ~3 weeks. **Blocker:** Enterprise demand.

### Row-level security (RLS) — P0 for enterprise

Enable RLS on all tables. Policy: `tenant_id = current_setting('app.tenant_id')::uuid`. Middleware sets `app.tenant_id` per session. Defense in depth: even if app has a bug, DB prevents cross-tenant reads. **Effort:** ~1 week (risky — needs careful testing). **Blocker:** SOC 2 prep.

### SOC 2 Type I — P0 for enterprise

Audit log persistence (from v2.0), documented policies, incident response plan, access reviews, annual pentest, engage auditor (~$15K-30K). **Effort:** ~3-6 months. **Blocker:** Enterprise revenue.

### Multi-region deployment — P1

Workers to multiple Vercel regions, Postgres read replicas, Redis replicas (Upstash supports), geo-routing at DNS. **Effort:** ~4 weeks. **Blocker:** Vercel Pro + Neon Pro + Upstash paid.

### Self-hosted option — P1

Docker Compose full stack (Postgres + Mongo + Redis + 4 apps), Helm chart, `/docs/self-hosting.md`. **Effort:** ~2 weeks. **Blocker:** Nothing — pure additive when demand exists.

---

## Not Planned — and Why

Deliberate non-goals. These are **not** oversights — they're decisions.

### ❌ Zapier-style no-code workflow builder

**Why not:** Zapier has 100+ engineers building their UI. Relayon is a solo project. The current `workflows + destinations + routing rules` model covers 80% of use cases. A visual builder would double the codebase for 20% more reach.

**Alternative:** Conditional routing (shipped v1.1) + 12 adapters (v2.0) covers most of the gap.

---

### ❌ Native mobile apps (iOS/Android)

**Why not:** The dashboard is responsive PWA-compatible. Building native apps for a webhook platform is a poor use of time — nobody manages webhooks on their phone at 3 AM.

**Alternative:** PWA install prompt (planned for v2.0).

---

### ❌ Blockchain / NFT features

**Why not:** Solutions looking for problems. No user has asked for this. Ever.

---

### ❌ Machine learning for anomaly detection

**Why not:** The analytics already show trends. ML for anomaly detection would need training data, labeled incidents, and a dedicated data scientist. Not worth it for an MVP.

**Alternative:** Threshold-based alerts (planned for v3.0) cover most use cases.

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

**Alternative:** Export to CSV, query externally (planned for v2.0).

---

### ❌ Custom domain / white-label

**Why not:** Adds significant infrastructure complexity (DNS, SSL automation per tenant). Enterprise-tier feature with no current demand.

---

### ❌ Encrypted webhook payloads (E2E)

**Why not:** Payloads travel plaintext over TLS and are stored plaintext in MongoDB. Credentials are encrypted at rest, but payloads are not. This is by design — the platform needs to read payloads to transform, route, and deliver them. E2E encryption would break core functionality.

**Alternative:** If a tenant needs E2E, they should self-host (see v3.0 self-hosted option).

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

**Special note on v2.0 test contributions:** Any PR that adds a test — even one test, even a trivial one — is prioritized over feature PRs until v2.0's testing goal is met.

---

## Versioning Policy

**Current state (v1.5):**

| Version | Status | Purpose |
|---|---|---|
| `v1.0` | ✅ Shipped | Full MVP — 4 apps, 4 adapters, DLQ, dashboard |
| `v1.1` | ✅ Shipped | Bulk DLQ, YAML, cost analytics, conditional routing |
| `v1.2` | ✅ Shipped | Adapter SDK, charts, API keys, transform preview |
| `v1.3` | ✅ Shipped | Schedules, versioning, encryption, Airtable+Notion |
| `v1.4` | ✅ Shipped | PG+Mongo adapters, key rotation, run-now |
| `v1.5` | ✅ Shipped | Validation, dry-run, diff, key rotation, bulk schedules |
| `v1.6-v1.9` | Skipped | v2.0 takes priority |
| `v2.0` | Planned | Tests, audit log, MFA, key pepper rotation |
| `v3.0` | Conditional | SAML SSO, RLS, SOC 2, multi-region, self-hosted |

**Breaking changes only in major versions.** `v1.x` is backward compatible.

**Encryption format was additive, not breaking:** `enc:v1` → `enc:v2` (v1.4) added a new format but kept v1 decryption working. This is the "additive change" pattern — non-breaking, non-forced migration.

**Support window:** Current minor + last two minors get security fixes. After v2.0 ships, v1.5 will get security-only patches for 90 days.

**On the 5-versions-in-5-days velocity:** The roadmap originally assumed 4-6 weeks per version. Reality was ~1 day per version. This velocity came at the cost of test coverage (see [TESTING.md](./TESTING.md)). v2.0 rebalances — tests before features.

---

## Last Updated

**2026-10-26** — Full rewrite after v1.5. Original v1.0 roadmap items cross-referenced against actual v1.1-v1.5 shipping. Testing gap explicitly called out as v2.0 blocker. Remaining items consolidated into v2.0 (testing, audit, MFA, pepper rotation) and v3.0 (SAML, RLS, SOC 2, multi-region, self-hosted).

This document is a **living plan**, not a contract. Priorities shift based on user feedback, but the principles don't.
```

---