# Relayon — Final Roadmap & Project Closure

> **The complete journey, the delivered scope, and the point at which development ended.**
>
> **Final project version:** `v3.7.0`  
> **Project status:** **Complete — no further feature roadmap**  
> **Repository audit snapshot:** 24 November 2026

Relayon's roadmap is closed. The project reached its intended final version, `v3.7.0`, and no additional product versions, feature milestones, or development phases are planned.

This document replaces the former v1.5.0 forward-looking roadmap. It records what was actually built from `v1.0.0` through `v3.7.0`, explains the difference between the development/version history and the hosted rollout, and preserves the decisions about work that was deliberately not pursued.

The roadmap is a historical and closure record—not a promise of future delivery.

---

## 1. Project closure

Relayon is complete at `v3.7.0`.

- The final tagged product version is `v3.7.0`.
- The repository history contains **28 version tags**, from `v1.0.0` through `v3.7.0`.
- The six formal GitHub Release records cover `v1.0.0` through `v1.5.0`. Later versions are represented by Git version tags and their corresponding source history; they should not be described as published GitHub Release objects.
- The implementation and supporting documentation for the later versions have been prepared. The hosted rollout is a separate operational step.
- At the time this roadmap was closed, `v1.0.0`–`v1.5.0` were the versions live on the hosted platform. `v1.6.0`–`v3.7.0` were present in the repository as completed, tagged versions and were awaiting the planned hosted rollout alongside their documentation.
- No `v3.8.0`, `v4.0.0`, or other follow-on product release is planned.

**Important distinction:** a version being implemented, tagged, documented, and ready for deployment does not mean it is already running on the public hosted platform. The live platform state must be checked independently from the Git tag history.

### What “complete” means here

Project completion means the planned product-development scope has ended at `v3.7.0`. It does not mean every possible enterprise, compliance, operational, or third-party integration feature exists. It also does not claim that every version after `v1.5.0` was already live at the closure snapshot.

---

## 2. Guiding principles that shaped the project

1. **Build for a real integration problem.** Relayon exists to receive, validate, transform, route, and deliver webhook events reliably.
2. **Prefer useful reliability over feature count.** Retries, idempotency, dead-letter recovery, signature verification, encryption, and operational visibility are core product behavior.
3. **Keep the architecture understandable.** The platform is organized around four application services, three data stores, and a defined event-processing pipeline.
4. **Treat security as a baseline.** Authentication, tenant boundaries, secret protection, webhook verification, and controlled operations are part of the product rather than optional decoration.
5. **Document actual behavior.** Documentation should describe the implementation that exists, distinguish deployment state from source state, and disclose known limitations.
6. **Do not invent a roadmap to keep a project open.** When the intended scope is complete and no further development is planned, the honest status is project closure.

---

## 3. The journey: `v1.0.0` → `v3.7.0`

The original v1.5 roadmap expected a smaller set of incremental releases. The actual project expanded substantially. The following is a concise record of the versioned work, based on the repository's tag and commit audit.

| Version range | Delivered scope |
|---|---|
| **`v1.0.0`** | Initial production foundation: four-app monorepo, tenant-aware authentication, workflows and destinations, webhook ingress and source verification, processing and delivery, retries, circuit breaker, DLQ, analytics, and Vercel deployment structure. |
| **`v1.1.0`–`v1.2.0`** | Bulk DLQ operations, workflow YAML import/export, cost analytics, conditional routing, custom destination adapter SDK foundation, time-series charts, scoped API keys, transform preview, and Discord support. |
| **`v1.3.0`–`v1.5.0`** | Database-backed schedules, workflow snapshots/restore/diff, encrypted destination credentials and key rotation, Airtable/Notion/PostgreSQL/MongoDB adapters, run-now, destination validation and dry-run, API-key rotation, bulk schedule operations, and optional full-config encryption. |
| **`v1.6.0`–`v1.9.0`** | Persisted validation and pipeline test-run capabilities, richer adapter catalog and dynamic forms, event replay, usage quotas and export, tenant RLS work, workflow YAML/Git synchronization, soft quota behavior, and external adapter loading. |
| **`v2.0.0`–`v2.2.0`** | Stripe test-mode billing groundwork, workflow test assertions, unit/integration/E2E test infrastructure and CI, OAuth sign-in, email verification and password recovery, stronger password handling, and English/Urdu/Arabic localization with RTL support. |
| **`v2.3.0`–`v2.5.0`** | AI assistant with PostgreSQL full-text search and tool calling, Redis atomic ingest improvements and AI rate limiting, and PWA support. |
| **`v2.6.0`–`v2.9.0`** | Privacy-conscious tracking and presence, super-admin capabilities, community/forum and templates, announcements, moderation and social sharing, tenant administration, user search, impersonation, and admin audit functionality. |
| **`v3.0.0`** | Distributed scheduling, sliding-window rate limiting, OpenTelemetry, OpenAPI 3.1 and typed SDK, Standard Webhooks, transactional outbox, time-travel tools, feature flags, and playground capabilities. |
| **`v3.1.0`–`v3.4.0`** | `@relayon/cli` local webhook tunnel, Docker Compose self-hosting assets, legal pages and interactive guide, onboarding wizard, SSR/prerendering and SEO, public header/footer/about content. |
| **`v3.5.0`–`v3.6.0`** | Bring-your-own-key provider integrations, provider resolution, AI intent detection, and improvements to retrieval-augmented generation, chunking, search, and workflow tools. |
| **`v3.7.0`** | Full dashboard UX overhaul: design tokens, shared modal/confirmation/toast system, Lucide iconography, skeleton and empty states, rebuilt workflows/events/analytics/admin/community/settings/legal screens, and responsive mobile-first layouts. |

### Work after the `v3.7.0` version tag

Two commits followed the `v3.7.0` UI feature commit on `main`. They are maintenance/brand work, not a new product version:

- **Brand and logo refresh:** a cohesive logo family, wordmarks, avatar, favicon/PWA assets, manifest updates, and social-preview artwork.
- **TypeScript declaration fix:** exported `ConfirmState` and explicitly typed the confirmation state signal to resolve the declaration-emission issue.

These changes do not create a `v3.8.0` roadmap item. The latest audited repository snapshot is commit `f4dd930eafd2ab61381bc1c049bb6cdbb7480235`.

---

## 4. Release and hosted-rollout status

The repository's version history and the hosted platform's deployment state are separate records.

| Version group | Repository status | Formal GitHub Release object | Hosted status at roadmap closure |
|---|---|---|---|
| `v1.0.0`–`v1.5.0` | Version tags and release history present | Yes — six formal Releases | Live |
| `v1.6.0`–`v3.7.0` | Completed version tags and corresponding implementation history present | No — version tags, not formal Release objects | Prepared/ready with documentation; hosted rollout pending |

The six formal GitHub Releases are:

- [`v1.0.0`](https://github.com/zainshah3464/relayon/releases/tag/v1.0.0)
- [`v1.1.0`](https://github.com/zainshah3464/relayon/releases/tag/v1.1.0)
- [`v1.2.0`](https://github.com/zainshah3464/relayon/releases/tag/v1.2.0)
- [`v1.3.0`](https://github.com/zainshah3464/relayon/releases/tag/v1.3.0)
- [`v1.4.0`](https://github.com/zainshah3464/relayon/releases/tag/v1.4.0)
- [`v1.5.0`](https://github.com/zainshah3464/relayon/releases/tag/v1.5.0)

The complete tag sequence is available from the [GitHub tags page](https://github.com/zainshah3464/relayon/tags).

**Rollout note:** the intention is to bring the prepared `v1.6.0`–`v3.7.0` versions to the hosted platform with their matching documentation. This is deployment/release operations for already completed work, not an open-ended feature roadmap. Do not label those versions “live” until the corresponding deployment has actually completed and been verified.

---

## 5. Final product scope

By `v3.7.0`, Relayon had grown beyond the original webhook-relay MVP.

### Core event platform

- Multi-tenant accounts and workspace boundaries.
- Webhook ingress, source signature verification, idempotency, rate limiting, and queue-based processing.
- Workflow and destination management.
- Transformations, conditional routing, and optional AI enrichment.
- Independent destination delivery, retry/backoff, circuit breaker, and dead-letter recovery.
- Event history, delivery visibility, usage information, and analytics.
- Database-backed scheduled workflows and workflow version history.

### Integrations and developer experience

- Built-in destination adapters across messaging, productivity, HTTP, and database use cases.
- Destination adapter SDK and external adapter loading.
- Workflow YAML import/export and Git-oriented synchronization tooling.
- Typed TypeScript SDK generated from OpenAPI.
- CLI tunnel for forwarding local development webhooks.
- Playground and workflow test-run capabilities.

### Security and platform controls

- JWT/session authentication, scoped API keys, and OAuth/account-recovery flows.
- Encrypted connector credentials and key rotation.
- Tenant isolation and PostgreSQL RLS policy work.
- Standard Webhooks and transactional outbox for outbound platform events.
- Feature flags, administrative audit capabilities, and moderation controls.

### AI and user experience

- AI assistant, retrieval/search capabilities, intent detection, and workflow-oriented tools.
- Bring-your-own-key provider integrations.
- English, Urdu, and Arabic localization with RTL support.
- PWA capabilities, onboarding, public/legal pages, and SEO/prerendering.
- Community, templates, moderation, and tenant administration.
- The `v3.7.0` dashboard design-system and responsive UX overhaul, followed by the brand refresh.

This is a product-scope summary, not a claim that every optional integration, provider, or deployment configuration is enabled on every hosted tenant.

---

## 6. Original v1.5 roadmap: final disposition

The former roadmap included work that was later delivered, changed in scope, or intentionally not pursued. Its status at project closure is recorded below.

| Original roadmap item | Final disposition |
|---|---|
| Unit tests and CI test infrastructure | Delivered beginning in the `v2.0` development window; the repository now contains unit, integration, RLS and other test support. |
| Persistent audit capabilities | Expanded into admin audit functionality and related platform administration during the `v2.x` work. This should not be confused with a claim that every mutation has a universal compliance-grade immutable audit trail. |
| MFA / TOTP | Not identified as a delivered feature in the audited version history; not part of the final `v3.7.0` scope. |
| API key pepper rotation automation | Not identified as a delivered feature in the audited version history; remains outside the completed scope. |
| Smoke-test extension | Testing infrastructure and CI matured after v1.5; consult `TESTING.md` for the exact current test and smoke coverage rather than relying on the old 10-to-16 estimate. |
| Linear, PagerDuty, Opsgenie adapters | Not listed among the completed built-in adapter milestones in the audited version summary; not part of the final scope. |
| `destinationSummary()` encrypted-envelope display fix | Not separately confirmed by the version-history audit; do not mark it complete solely because it appeared in the old roadmap. |
| Urdu/Hindi i18n | Localization was delivered as English/Urdu/Arabic with RTL support in the `v2.2` development milestone. |
| Improved actionable error messages | Incremental improvements shipped across the project; no separate universal completion claim is made here. |
| SAML SSO | Not delivered in the audited history; not part of final scope. |
| Row-level security | Tenant RLS work and a later full-rollout milestone are recorded in `v1.8`–`v1.9`; the current policy and test files are the source of truth for actual coverage. |
| SOC 2 / HIPAA / GDPR certification | No certification is claimed. Product security controls do not equal independent certification or legal compliance. |
| Multi-region deployment | Not identified as delivered; not part of final scope. |
| Self-hosted deployment | Docker Compose self-hosting assets were added in `v3.2`; this is distinct from a managed multi-region service. |

### Testing lesson

The old v1.5 roadmap described testing as a major gap. That description is historically accurate for the v1.5 state, but it is no longer an accurate description of the final repository. Test infrastructure, test suites, and CI checks were added in the `v2.0` development window and expanded in the subsequent repository state. The current testing guide and workflow definitions—not the old roadmap text—describe the final test setup.

---

## 7. Deliberate non-goals

The following ideas appeared in the earlier roadmap as non-goals or were never made part of the final product scope. They remain outside the completed project.

| Not planned | Reason / boundary |
|---|---|
| Zapier-style visual no-code workflow builder | The workflow, destination, transform, and routing model provides the intended integration control without duplicating a large visual automation platform. |
| Native iOS/Android applications | The responsive dashboard/PWA direction was preferred over separate native clients. |
| Blockchain/NFT features | No demonstrated need in the webhook/integration problem space. |
| ML-based anomaly detection | Requires dedicated data, evaluation, and operational ownership; existing analytics and operational signals are the chosen scope. |
| Voice assistant interface | Not a meaningful core interaction for webhook operations. |
| Custom LLM fine-tuning | Provider integrations, prompts, retrieval, and BYOK cover the intended AI scope without per-tenant fine-tuning infrastructure. |
| Real-time WebSocket dashboard updates | Polling, navigation refresh, and manual refresh were considered sufficient for the product's operating model. |
| Separate drag-and-drop workflow builder | Same scope and maintenance concerns as the visual no-code builder. |
| Advanced JSONPath event-query builder | Existing event browsing and filtering were preferred over a custom query language. |
| Tenant-specific custom domains/white-labeling | Additional DNS, certificate, routing, and support complexity was not justified by the final scope. |
| End-to-end encrypted webhook payloads | Relayon must inspect payloads to transform, route, enrich, and deliver them. Transport security and credential-at-rest encryption are different controls; payload E2E encryption would change core platform behavior. |

These are product decisions, not a backlog waiting for a future version.

---

## 8. What project completion does not claim

To keep the final status precise:

- **No compliance certification is claimed.** Security controls and documentation do not constitute SOC 2, HIPAA, or GDPR certification.
- **No multi-region guarantee is claimed.** Deployment options do not automatically provide multi-region availability.
- **No universal RLS guarantee should be inferred from the phrase “RLS work.”** Review the checked-in SQL policies, migrations, and RLS tests for the actual protected tables and execution paths.
- **No automatic API-key pepper rotation is claimed** unless separately implemented and documented in the current source.
- **No universal adapter compatibility is implied.** Each adapter has its own provider API, credentials, limits, and behavior.
- **No hosted rollout is implied by a Git tag.** The public platform's deployed version must be verified independently.
- **No future feature delivery is promised.** The project is closed at `v3.7.0`.

---

## 9. Documentation and source of truth

The final documentation set should describe the `v3.7.0` product and its actual repository state. The principal references are:

| Document / source | Purpose |
|---|---|
| [`README.md`](../README.md) | Project overview, entry points, and current status. |
| [`CHANGELOG.md`](./CHANGELOG.md) | Version-by-version change history from `v1.0.0` through `v3.7.0`. |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Service boundaries, event lifecycle, data stores, and architecture decisions. |
| [`API_REFERENCE.md`](./API_REFERENCE.md) | HTTP API reference; generated OpenAPI and current controllers remain authoritative for exact route coverage. |
| [`DATABASE.md`](./DATABASE.md) | Prisma schema, migrations, indexes, and RLS details. |
| [`SECURITY.md`](./SECURITY.md) | Security controls, threat boundaries, credential handling, and operational cautions. |
| [`TESTING.md`](./TESTING.md) | Unit, integration, RLS, E2E, load, smoke, and CI test guidance. |
| [`DEPLOYMENT.md`](../DEPLOYMENT.md) | Vercel and Docker Compose deployment instructions. |
| [`FEATURES.md`](../FEATURES.md) | Product feature inventory for the completed version. |
| [`LICENSE`](../LICENSE) | Current repository license terms. |

For implementation claims, prefer the current source tree, Prisma schema/migrations, OpenAPI output, CI workflows, and Git tag/commit history over older v1.5-era prose.

### Version and license metadata

The repository audit records a proprietary source-visible license introduced during the `v3.6` development window, with a separate historical MIT license file for the earlier period. License badges or generated API metadata that still say “MIT” should not override the checked-in license text. Read the actual `LICENSE` file for the governing terms.

---

## 10. Final status

| Item | Final state |
|---|---|
| Final product version | **`v3.7.0`** |
| Version tags | **28 (`v1.0.0`–`v3.7.0`)** |
| Formal GitHub Releases | **6 (`v1.0.0`–`v1.5.0`)** |
| Development roadmap | **Closed** |
| Further feature versions | **None planned** |
| Hosted versions at closure snapshot | `v1.0.0`–`v1.5.0` live |
| Later completed versions | `v1.6.0`–`v3.7.0` tagged/prepared; hosted rollout pending at snapshot |
| Post-tag maintenance | Brand/logo refresh and TypeScript declaration fix on `main`; no new version tag |
| Project status | **Complete** |

Relayon's development journey ends at `v3.7.0`. The remaining hosted rollout of the already completed versions is an operational deployment task, not a new roadmap. No additional product work is currently planned.

---

*Roadmap closed: 24 November 2026.*  
*Repository snapshot: `f4dd930eafd2ab61381bc1c049bb6cdbb7480235`.*  
*Copyright (c) 2026 Zain Shah. See the repository `LICENSE` for applicable terms.*
