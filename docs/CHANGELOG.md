# Changelog

All notable changes to Relayon are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

> ## 🏁 Project Status: FINAL — Officially Complete
>
> **Relayon is complete at `v3.7.0`.** No further versions, features, or planned work are scheduled. The final version was closed on **2026-11-24**.
>
> - **28 version tags** — `v1.0.0` → `v3.7.0`
> - **6 published GitHub Releases** — `v1.0.0` → `v1.5.0` (releases for `v1.6.0` – `v3.7.0` are being finalized alongside this documentation update)
> - **78 commits on `main`**
> - **33 days, 13 hours, 24 minutes, 33 seconds** first-to-last commit span
> - **Final HEAD:** [`f4dd930eafd2ab61381bc1c049bb6cdbb7480235`](https://github.com/zainshah3464/relayon/commit/f4dd930eafd2ab61381bc1c049bb6cdbb7480235)
> - **License:** [Relayon Proprietary Source-Visible License v1.0](./LICENSE) (effective 2026-11-20)
>
> This changelog is the historical record of the complete project lifecycle. The `v3.7.0` entry includes two post-tag commits that were finalized as part of the release's closing state. Items from the previously-planned v2.0 roadmap that never shipped are documented in the [Project Final Status](#project-final-status--what-was-never-shipped) section for honest accounting.

---

## 📊 Quick Stats

| Metric | Value |
|---|---:|
| Version tags | **28** (`v1.0.0` → `v3.7.0`) |
| Formal GitHub Releases | **6** (`v1.0.0` → `v1.5.0`) |
| Commits on `main` | **78** |
| Total additions | **143,565** lines |
| Total deletions | **46,092** lines |
| Total diff churn | **189,657** lines |
| Current tree files | **556** |
| Current tree size | **4,256,517** bytes |
| Development span | **33d 13h 24m 33s** |
| GitHub Actions runs | **112** (105 ✅ / 7 ❌ historical) |
| Pull requests | 0 |
| Issues | 0 |
| Branches | 1 (`main`) |
| Final commit status | ✅ Success |

---

## 🗂 Version Index

| Version | Date | Theme | Tag type | Formal Release? |
|---|---|---|---|---|
| [**v3.7.0**](#370--2026-11-24--final-release) | 2026-11-24 | **UI/UX overhaul + final brand (FINAL)** | annotated | pending |
| [v3.6.0](#360--2026-11-20) | 2026-11-20 | AI intent detection + license change | annotated | pending |
| [v3.5.0](#350--2026-11-18) | 2026-11-18 | BYOK integrations | annotated | pending |
| [v3.4.0](#340--2026-11-18) | 2026-11-18 | SEO / SSR / public pages | annotated | pending |
| [v3.3.0](#330--2026-11-16) | 2026-11-16 | Legal pages, guide, onboarding | annotated | pending |
| [v3.2.0](#320--2026-11-16) | 2026-11-16 | Docker Compose self-hosting | annotated | pending |
| [v3.1.0](#310--2026-11-16) | 2026-11-16 | CLI tunnel | annotated | pending |
| [v3.0.0](#300--2026-11-16) | 2026-11-16 | Infra waves + SDK + outbox | annotated | pending |
| [v2.9.0](#290--2026-11-14) | 2026-11-14 | Admin phase D | annotated | pending |
| [v2.8.0](#280--2026-11-14) | 2026-11-14 | Moderation + social | annotated | pending |
| [v2.7.0](#270--2026-11-14) | 2026-11-14 | Community + templates | annotated | pending |
| [v2.6.0](#260--2026-11-13) | 2026-11-13 | Tracking + presence + admin A | annotated | pending |
| [v2.5.0](#250--2026-11-13) | 2026-11-13 | PWA | annotated | pending |
| [v2.4.0](#240--2026-11-12) | 2026-11-12 | Atomic ingest + AI limiter | annotated | pending |
| [v2.3.0](#230--2026-11-12) | 2026-11-12 | AI assistant | annotated | pending |
| [v2.2.0](#220--2026-11-11) | 2026-11-11 | i18n EN/UR/AR + RTL | annotated | pending |
| [v2.1.0](#210--2026-11-09) | 2026-11-09 | OAuth + testing framework | annotated | pending |
| [v2.0.0](#200--2026-11-03) | 2026-11-03 | Billing + assertions + soft quota | lightweight | pending |
| [v1.9.0](#190--2026-10-31) | 2026-10-31 | Soft quota, RLS rollout, external adapters | lightweight | pending |
| [v1.8.0](#180--2026-10-31) | 2026-10-31 | Quotas, RLS, workflow sync | lightweight | pending |
| [v1.7.0](#170--2026-10-28) | 2026-10-28 | Adapter descriptors, dynamic forms | lightweight | pending |
| [v1.6.0](#160--2026-10-27) | 2026-10-27 | Validation persistence, test-run | lightweight | pending |
| [**v1.5.0**](#150--2026-10-26) | 2026-10-26 | Validation, dry-run, diff, rotation | annotated | ✅ |
| [**v1.4.0**](#140--2026-10-25) | 2026-10-25 | DB adapters, key rotation, run-now | annotated | ✅ |
| [**v1.3.0**](#130--2026-10-24) | 2026-10-24 | Schedules, versioning, encryption | annotated | ✅ |
| [**v1.2.0**](#120--2026-10-23) | 2026-10-23 | SDK, charts, API keys, Discord | annotated | ✅ |
| [**v1.1.0**](#110--2026-10-23) | 2026-10-23 | Bulk DLQ, YAML, cost, routing | annotated | ✅ |
| [**v1.0.0**](#100--2026-10-22) | 2026-10-22 | Foundation — 4-app MVP | lightweight | ✅ |

---

## [3.7.0] — 2026-11-24 — FINAL RELEASE ✅

> **The final release.** Dashboard experience and design-system overhaul, completing the product's final user-facing state. This entry includes the two post-tag commits — brand identity refresh and the TS4029 declaration fix — which were finalized as part of v3.7.0's closing state.

**Tagged:** 2026-11-23 (PKT) · **Final state completed:** 2026-11-24 (PKT) · **Commits in release window:** #74–#78

### Added

- **Premium design system** — coordinated visual system for typography, spacing, surfaces, borders, controls, layout and responsive behavior.
- **Mobile-first application treatment** — updated application layouts and responsive interactions across dashboard feature areas.
- **Real icon system** — moved away from inconsistent text/symbol substitutes toward a consistent icon treatment (Lucide icons).
- **Shared confirmation and notification patterns** — `ConfirmDialog` and toast interactions are used across more product actions to make destructive actions and operation feedback more consistent.
- **Workflow and operations UI refinement** — the redesign covers the major dashboard surfaces (workflows, events, analytics, admin, community, settings, legal) rather than being limited to a standalone marketing page.
- **Skeleton loading states** and **empty states** across major screens.
- **`ConfirmState` type export** — explicit state-signal type annotation added (post-tag commit `f4dd930`).

### Changed

- **Dashboard presentation layer** rebuilt with premium tokens (v3.7.0 commit `4ef174e`).

### Fixed

- **Angular template parsing for email addresses** (2026-11-20) — escaped literal `@` characters in email display text where Angular control-flow parsing treated them as template syntax. Commit [`1971fbf`](https://github.com/zainshah3464/relayon/commit/1971fbfebc).
- **CI pipeline blockers** (2026-11-21) — resolved four root causes that were preventing the repository's CI workflow from completing. Commit [`e541247`](https://github.com/zainshah3464/relayon/commit/e5412472a8).
- **Integration test fixtures** (2026-11-22) — updated authentication test inputs to satisfy strong-password validation and corrected the Stripe source-type fixture used by failing integration tests. Commit [`009e956`](https://github.com/zainshah3464/relayon/commit/009e956803).
- **Dashboard declaration output / TS4029** (2026-11-24) — exported the `ConfirmState` type and added an explicit state-signal type annotation so the dashboard's generated TypeScript declarations no longer expose a private inferred type. Commit [`f4dd930`](https://github.com/zainshah3464/relayon/commit/f4dd930eafd2ab61381bc1c049bb6cdbb7480235).

### Post-release completion — Brand identity refresh (2026-11-24)

The following work was committed after the v3.7.0 tag and is incorporated into v3.7.0's final state per project owner designation.

- **Logo v2.0** — second-generation Relayon logo treatment: a hollow-bowl `R` mark, a three-stop gradient, depth/shadow treatment and a rim highlight. Commit [`5c84e0e`](https://github.com/zainshah3464/relayon/commit/5c84e0e3e18d95830e0985d7798d3f447b77e9f0).
- **Logo family** — light, dark, mono (dark + light), transparent, stacked wordmark, avatar variants added.
- **Favicon / PWA / icon set** — refreshed across sizes 16, 32, 72, 96, 128, 144, 152, 192, 384, 512; `apple-touch-icon` (SVG + PNG); favicon.ico / PNG / SVG.
- **Social preview** — `og-image.svg`, `og-image.png` updated.
- **Manifest paths consolidated**; `apple-touch-icon` reference corrected in `index.html`.
- **Inline logo rendering** refreshed in `logo.component.ts` (48 lines added / 50 removed).

### Engineering notes

- The UI overhaul is represented by the `v3.7.0` tag and its tagged commit [`4ef174e`](https://github.com/zainshah3464/relayon/commit/4ef174ea76698c6e342ce0f1d441b90e43de3968).
- The post-tag commits (`5c84e0e` brand refresh, `f4dd930` TS4029 fix) were completed as part of v3.7.0's final state on 2026-11-24.
- Latest `main` HEAD at final snapshot: `f4dd930` with **CI #39** and **Tests #6** both passing.

### Known Limitations

- This release improves the dashboard presentation; it does not change the underlying delivery guarantee from **at-least-once** to exactly-once.
- UI consistency does not remove the need for server-side authorization, tenant scoping or API-level validation.
- Skeleton/empty states are cosmetic improvements — they do not replace error-state handling at the API boundary.

### Source commits

- UI/UX overhaul: [`4ef174e`](https://github.com/zainshah3464/relayon/commit/4ef174ea76698c6e342ce0f1d441b90e43de3968).
- Brand refresh: [`5c84e0e`](https://github.com/zainshah3464/relayon/commit/5c84e0e3e18d95830e0985d7798d3f447b77e9f0).
- ConfirmState fix: [`f4dd930`](https://github.com/zainshah3464/relayon/commit/f4dd930eafd2ab61381bc1c049bb6cdbb7480235).

---

## [3.6.0] — 2026-11-20

**AI assistant intent detection, stronger documentation retrieval and a material licensing change.**

### Added

- **Chat intent detection** — the assistant classifies common user goals before selecting a response/tool path. The implemented intent categories include learning, taking an action, listing resources, debugging and general chat.
- **Improved documentation retrieval** — query expansion and retrieval fallbacks improve matching when a user's wording differs from the wording used in product documentation.
- **More deliberate tool selection** — workflow listing/detail, workflow creation, analytics and DLQ-related tools are selected according to the detected task rather than treating every message as a generic documentation question.
- **Improved assistant guidance** — action-oriented paths require the relevant user intent and required configuration details. Missing workflow details or credentials are requested rather than invented.

### Changed

- **RAG implementation clarified** — documentation retrieval uses PostgreSQL full-text search with multiple query strategies and keyword/phrase fallbacks. It is **not** a vector-embedding or semantic-vector database implementation.
- **License changed (effective 2026-11-20)** — the root `LICENSE` was changed from MIT to the **Relayon Proprietary Source-Visible License v1.0**.
  - The current license allows source viewing and the uses expressly granted in that license, including the stated self-hosting grant.
  - Modification for one's own deployment, competing forks, resale and AI-model training are restricted unless written permission is obtained.
  - `LICENSE-MIT-LEGACY` is retained as a historical license artifact; it does not override the current root `LICENSE`.
  - This is a **material change to usage and redistribution rights**, even though it does not itself change the HTTP API.
- **License metadata drift identified** — at this release, the README license badge and generated Swagger/OpenAPI license metadata still described MIT. Reconciliation is being completed as part of the final documentation commit accompanying this changelog.

### Security and governance

- Provider keys used by the assistant continue to be resolved through the tenant integration resolver and platform fallback rules. The assistant does not make a tenant's stored API key visible as ordinary dashboard text.
- The licensing update is **not** a security certification and does not establish SOC 2, HIPAA or GDPR compliance.

### Known Limitations

- AI intent classification and generated answers are probabilistic. They should not be treated as authorization decisions or as verified business facts.
- The RAG system is PostgreSQL full-text search, not embeddings/vector search.
- A configured provider key, provider availability and quota are still required for live AI functionality.

### Source commits

- AI assistant update: [`e615e7a`](https://github.com/zainshah3464/relayon/commit/e615e7ace6).
- License migration: [`78404a9`](https://github.com/zainshah3464/relayon/commit/78404a9a463827efdc502517adeb969689c0c70e).

---

## [3.5.0] — 2026-11-18

**Bring Your Own Key (BYOK) integrations.** Tenants can configure supported provider credentials under their own provider accounts and let Relayon resolve those credentials for supported services.

### Added

- **Tenant provider integrations** for Groq, OpenAI, Anthropic and Resend.
- **Provider key validation** before a credential is persisted. The validation path returns provider/model information without returning the stored plaintext key.
- **Model selection metadata** — a tenant can store a preferred model where the provider supports the configured selection.
- **Integration lifecycle controls** — create/update, activate/deactivate, status inspection and removal.
- **Tenant-aware provider key resolution** — active tenant credentials are preferred, with platform environment credentials used as a fallback where configured.
- **Resolver cache invalidation** — updates, toggles and deletion invalidate the affected tenant/provider cache entry.

### Security

- Provider credentials are encrypted before being persisted, using the tenant-scoped encryption helper.
- The management API is role-restricted to tenant owners/admins.
- The UI/API response contains provider and model metadata, not the recoverable API key.
- Provider validation has a bounded request timeout.

### Operational considerations

- BYOK is provider-specific. A Groq credential does not configure a Slack destination; a Resend credential does not configure an SMTP/database destination.
- The provider still controls its own rate limits, model availability, billing and terms.
- If a tenant key is inactive or invalid, the resolver may use a configured platform fallback. Operators should make this fallback behavior explicit in deployment policy.

### Source

[`c8c9a45`](https://github.com/zainshah3464/relayon/commit/c8c9a4551e36c1984be2d895054f187d6580f139).

---

## [3.4.0] — 2026-11-18

**Public-page SEO, server rendering/prerendering and product-site structure.**

### Added

- **SSR/prerendering for public pages** — server-rendering and prerender support was added for public-facing routes to improve initial HTML delivery and search-engine discoverability.
- **Header and footer components** — shared public-site navigation and footer structure.
- **About page** — a dedicated product/about surface.
- **Credit blocks** — shared attribution/credit presentation in the public product experience.
- **SEO service integration** — route-level metadata handling is part of the dashboard application.

### Changed

- Public information architecture was separated more clearly from authenticated application workflow screens.
- Rendering improvements target **public pages**; they should not be interpreted as a guarantee that every authenticated dashboard view is server-rendered.

### Known Limitations

- Search indexing and ranking depend on crawlers, page content, canonical metadata and deployment configuration; adding SSR/prerendering alone does not guarantee ranking.
- This work does not create native iOS/Android applications.

### Source commits

- SSR/prerendering: [`d63fece`](https://github.com/zainshah3464/relayon/commit/d63fece7d1).
- Header/footer/about/credits and tag target: [`933f4c3`](https://github.com/zainshah3464/relayon/commit/933f4c390c9ece47ddb34f54ffd8dabbcb64d0b3).

---

## [3.3.0] — 2026-11-16

**Legal information, interactive product guide and guided onboarding.**

### Added

- **Privacy page** — a public route for the product's privacy information.
- **Terms page** — a public route for terms of use.
- **Interactive guide** — a navigable, product-oriented guide for understanding Relayon's workflow concepts and setup sequence.
- **Onboarding wizard** — a guided first-use flow that helps a new tenant/user move through the initial product setup.

### Changed

- The initial product journey is more guided than a blank dashboard entry.
- Public legal and guide pages are available separately from authenticated workflow operations.

### Known Limitations

- Publishing a privacy/terms page does not by itself prove legal compliance in every jurisdiction. The deployed text and actual data-processing practices must remain aligned.
- Onboarding does not replace provider credential setup, destination validation or production testing.

### Source

[`6d42ed3`](https://github.com/zainshah3464/relayon/commit/6d42ed3f63).

---

## [3.2.0] — 2026-11-16

**Docker Compose self-hosting path.**

### Added

- **Container deployment stack** — repository-level Docker Compose configuration for the application services and their supporting infrastructure.
- **Database services** — PostgreSQL, Redis and MongoDB services with persistent-volume configuration.
- **Application services** — API, ingress, workers and dashboard containers.
- **Reverse proxy and scheduled operations** — Nginx and cron-related services are included in the Compose topology.
- **Migration step** — a dedicated migration service/job is included in the deployment flow so schema updates can be applied before application services depend on them.
- **ARM64 deployment verification** — the release commit records Oracle Cloud ARM64 (Ampere A1) verification.
- **Per-service Dockerfiles** — `Dockerfile.api`, `Dockerfile.dashboard`, `Dockerfile.ingress`, `Dockerfile.workers` (multi-stage with `migration` and `production` targets).
- **Cron sidecar** — pings `/internal/process`, `/internal/deliver`, `/internal/schedule/tick` and `/api/cron/outbox/tick` every 60 seconds.
- **Nginx configs** — `nginx.conf`, `nginx-dashboard.conf`.
- **DB init** — `init-db.sql`.

### Operational notes

- Self-hosting still requires operators to supply secrets, database credentials, encryption key material, provider credentials, public URLs, TLS and backup/restore procedures.
- Persistent volumes are not a substitute for tested off-host backups.
- Compose is a deployment option, not a managed hosting/SLA commitment.

### Source

[`d3c44a3`](https://github.com/zainshah3464/relayon/commit/d3c44a3e65).

---

## [3.1.0] — 2026-11-16

**`@relayon/cli` local webhook tunnel.**

### Added

- **CLI tunnel command** — start a hosted tunnel and forward captured webhook requests to a local application port:
  ```bash
  npx @relayon/cli listen --port 3000
  ```
- **Local webhook testing** — use a hosted Relayon URL while the receiving application remains bound to localhost.
- **SSE reconnect behavior** — the CLI reconnects to the event stream when the connection drops.
- **Request buffering/retrieval path** — the tunnel service retains captured requests for retrieval during the tunnel session.
- **Credential-aware client connection** — the CLI accepts the configured Relayon API URL and authentication token/key.

### Security and operational notes

- Sensitive headers such as `Authorization` and `Cookie` are removed before requests are forwarded to the local application.
- The CLI requires the local target port to be reachable; it does not start the developer's application.
- Tunnel sessions are temporary (the API tunnel-session service uses a 24-hour expiry).
- This is a **development** tunnel, not a replacement for the production workflow ingress endpoint.

### Source

[`bad76da`](https://github.com/zainshah3464/relayon/commit/bad76daff0).

---

## [3.0.0] — 2026-11-16

**Platform infrastructure, typed SDK, signed outbound webhooks and operator tooling.** Delivered in **four implementation waves**.

### Wave 1 — infrastructure and scheduled execution

- **Distributed cron coordination** — database-backed coordination prevents independent scheduled invocations from all claiming the same platform cron work.
- **Sliding-window rate limiting** — additional rate-limiting mechanism improves control over request bursts and request windows.
- **OpenTelemetry instrumentation** — tracing initialization/export support added to services so request/processing paths can emit distributed trace data when an exporter is configured.

### Wave 2 — OpenAPI 3.1 and TypeScript SDK

- **OpenAPI 3.1 specification** — the API schema became the contract source for generated client types.
- **`@relayon/sdk`** — a typed TypeScript SDK package.
- **SDK generation/build scripts** — the root workspace can generate and build the SDK from the checked-in OpenAPI document.
- **Authentication/client customization** — the SDK supports configured authentication and a custom `fetch` implementation.

### Wave 3 — Standard Webhooks and transactional outbox

- **Customer-configurable webhook endpoints** — tenants can register URLs and event filters for notifications emitted by Relayon.
- **Standard Webhooks-compatible signing** — outbound messages include `webhook-id`, `webhook-timestamp` and `webhook-signature` headers.
- **Transactional outbox** — application changes write corresponding outbox records within the same database transaction, reducing the risk of an application update committing without its notification record.
- **Outbox poller** — due records are claimed in bounded batches, matched to active endpoint subscriptions, sent with a timeout and retried according to the outbox policy.
- **Endpoint secret handling** — signing secrets use the `whsec_` convention.

### Wave 4 — operator tooling

- **Tenant time-travel** — reconstruct selected historical tenant/workflow configuration state from persisted workflow snapshots and audit records; compare two timestamps.
- **Feature flags** — support enablement, percentage rollout and tenant-specific overrides.
- **Webhook playground** — temporary capture sessions exposing an endpoint for inspecting incoming HTTP requests during development.

### Security and reliability

- Outbound webhook signatures are based on webhook ID, timestamp and raw body; consumers must verify the signature against the raw payload and enforce timestamp tolerance.
- The transactional outbox makes notification intent durable, but delivery remains retryable / at-least-once. Consumer endpoints should be idempotent.
- Time-travel is reconstruction from retained history, not a full point-in-time restore of every Redis/MongoDB transient state.
- Feature-flag evaluation is a rollout control, not an authorization boundary.

### Known Limitations

- OpenTelemetry export requires a configured collector/exporter endpoint; instrumentation code alone does not create an observability backend.
- Standard Webhooks delivery depends on endpoint availability and can be retried.
- The playground is a temporary diagnostic facility, not a production workflow.
- Feature flags should not be used as the only guard for sensitive APIs.

### Source commits

- Infrastructure: [`2376482`](https://github.com/zainshah3464/relayon/commit/23764823cd).
- OpenAPI/SDK: [`218aa40`](https://github.com/zainshah3464/relayon/commit/218aa402df).
- Standard Webhooks/outbox: [`4620cca`](https://github.com/zainshah3464/relayon/commit/4620cca728).
- Time-travel/flags/playground: [`932e47e`](https://github.com/zainshah3464/relayon/commit/932e47e443).

---

## [2.9.0] — 2026-11-14

**Platform administration and support visibility.**

### Added

- **Tenant detail view** — privileged operators can inspect tenant plan/subscription details, configured limits, current usage, users, workflows, recent API keys and related operational context.
- **User search** — platform operators can search users and inspect tenant association/role information.
- **Admin audit records** — privileged support actions are persisted with actor, target and action metadata.
- **Tenant impersonation** — a super-admin can start a short-lived tenant-scoped support session and explicitly end it.
- **Active impersonation listing** — the admin service can identify recent sessions that have not yet been paired with an end record.
- **Impersonation banner** — user-facing indicator that a support session is active.

### Security and governance

- Impersonation is restricted to super-admin authorization, not ordinary tenant owner/admin permissions.
- The impersonation service sets a **15-minute session expiry**.
- Start/end actions are separately audited, making support access traceable.
- Tenant state and admin audit records are not interchangeable; inspect both when reconstructing a support incident.

### Known Limitations

- Impersonation is a privileged support capability and should be used only under an approved operational process.
- Audit records provide application-level traceability; they do not replace an external immutable log-retention service.

### Source

[`682aca0`](https://github.com/zainshah3464/relayon/commit/682aca0b5b).

---

## [2.8.0] — 2026-11-14

**Community moderation queue and social sharing support.**

### Added

- **Moderation queue** — privileged moderators can inspect reported posts/replies with associated content and author context.
- **Flag resolution** — a report can be dismissed or actioned.
- **Moderation actions** — hide, restore and remove operations update the content state and create moderation audit records.
- **Flag state management** — resolving a report updates the flag status and records the administrative decision.
- **Social sharing metadata/actions** — announcement sharing support for supported social destinations (Twitter API v2 + share intents).
- **Auto-hide** — 3 pending flags auto-hide content.

### Changed

- Community public listings exclude hidden/removed or otherwise unpublished content.
- Moderation changes update reply/post counts where the associated content is removed.

### Known Limitations

- Social-sharing support in the repository does not prove that every external social account or platform credential is configured.
- Moderation still requires human review for context-sensitive reports; a flag is a review signal, not proof of a policy violation.

### Source

[`95407fe`](https://github.com/zainshah3464/relayon/commit/95407fe29e).

---

## [2.7.0] — 2026-11-14

**Community forum, reusable workflow templates and announcements.**

### Added

- **Community posts** — users can browse published community content and open posts by ID or slug.
- **Replies and solution marking** — posts support discussion; the post author can mark a reply as the solution.
- **Likes** — users can like/unlike posts and replies.
- **Workflow template posts** — template posts can carry Relayon YAML metadata.
- **Template import** — a tenant can retrieve a published template and import the workflow definition into its own workspace.
- **Announcements** — a dedicated public listing/detail path for official announcements.

### Security and abuse controls

- Post and reply creation use **hourly rate limits**.
- Template YAML is checked for the expected Relayon workflow structure before being accepted.
- Imported workflow YAML must still be reviewed and supplied with tenant-owned credentials before production use.

### Known Limitations

- A published template is a configuration starting point, not a guarantee that the receiving tenant's provider credentials, destination permissions or account quotas are available.
- Community content is subject to moderation state and visibility rules.

### Source

[`c4a075e`](https://github.com/zainshah3464/relayon/commit/c4a075efd0).

---

## [2.6.0] — 2026-11-13

**Privacy-oriented product tracking, live presence and platform-admin foundation.**

### Added

- **Page/product event tracking** — the dashboard can submit batches of page-view/product events for platform traffic analysis.
- **Live presence** — Redis-backed heartbeats allow the admin surface to estimate which sessions are currently active.
- **Tenant-aware presence** — live sessions can be associated with a tenant for support/operations views.
- **Super-admin boundary** — privileged platform operations are separated from ordinary tenant roles.
- **Traffic visibility foundation** — page-event records support traffic overview and top-page summaries.
- **Visitor hashing / UA parsing** — privacy-preserving visitor identification.
- **Presence heartbeat** — 45-second Redis TTL; dashboard refreshes a heartbeat every 15 seconds.

### Privacy and security

- The tracking path uses bounded event fields and stores page events in PostgreSQL.
- Client IP identifiers are handled through hashing in the tracking path.
- Presence is ephemeral: 45-second Redis TTL.
- Super-admin authorization is distinct from tenant-level owner/admin roles.

### Known Limitations

- Presence depends on live heartbeat delivery and Redis availability; it is not a durable audit record.
- Page tracking records product usage signals, not a guaranteed complete record of every browser interaction.
- Privacy controls must be evaluated alongside the actual deployed privacy notice and retention policy.

### Source

[`64df2fa`](https://github.com/zainshah3464/relayon/commit/64df2fa675).

---

## [2.5.0] — 2026-11-13

**Progressive Web App support and frontend dependency stabilization.**

### Added

- **PWA setup** — service-worker/PWA configuration and application lifecycle support.
- **Install experience** — UI/service support for prompting users to install the web application where the browser supports it.
- **Offline/network awareness** — network/offline status handling.
- **Update awareness** — the application can detect a service-worker/application update and present an update prompt.

### Fixed

- **Angular/RxJS version conflicts** — resolved the version conflicts that blocked a stable frontend dependency graph.
- **Workspace dependency alignment** — explicit alignment for the affected Angular packages and RxJS.

### Known Limitations

- PWA support does not create separate native iOS or Android applications.
- Offline behavior is limited by what the service worker caches; authenticated API mutations still need a working network unless a specific offline queue is implemented.
- Install prompts and service-worker behavior vary by browser/platform.

### Source

[`a03ab58`](https://github.com/zainshah3464/relayon/commit/a03ab58956).

---

## [2.4.0] — 2026-11-12

**Atomic webhook ingestion and AI-provider rate protection.**

### Added

- **Atomic Redis Lua ingest path** — the ingress request path combines its critical duplicate check, rate accounting and queue insertion operations in one Redis script.
- **Concurrency-safe admission** — competing requests do not have to coordinate multiple independent Redis round trips for the critical ingest decision.
- **Groq rate limiter** — AI request/token usage is subject to its own provider-oriented rate controls.

### Changed

- Reduced the window in which an event could be marked idempotent without being pushed into the queue, or be queued after a separate rate-limit check raced with another request.
- The v2.4 feature commit reports a **16× improvement** for the measured atomic-ingest path. This is a repository benchmark claim, not a universal throughput guarantee or production SLA.

### Operational considerations

- Atomic Redis behavior requires a healthy Redis service and compatible script execution support.
- The AI limiter is distinct from source webhook rate limiting; one does not replace the other.
- Queue throughput remains dependent on Redis capacity, worker batch size, external function duration and destination latency.

### Source

[`ad7ee01`](https://github.com/zainshah3464/relayon/commit/ad7ee018d3).

---

## [2.3.0] — 2026-11-12

**In-dashboard AI assistant with documentation retrieval and tool calling.**

### Added

- **AI chat interface** — users can ask product/how-to questions from the dashboard.
- **Groq-backed agent** — uses the configured Groq provider path for model responses.
- **Tool-calling framework** — the assistant can invoke defined application tools rather than relying only on free-form answers.
- **Workflow tools** — list workflows, inspect a specific workflow and create a workflow after the necessary values have been confirmed.
- **Operations tools** — retrieve delivery/workflow statistics and inspect DLQ information.
- **Documentation search tool** — the assistant can retrieve relevant documentation snippets through the RAG service.
- **Knowledge ingestion/chunking foundation** — product documentation can be ingested into the knowledge store and searched later.
- **Chat panel + chat widget** — dashboard components.

### Changed

- Chat responses are emitted through an **event-stream HTTP response**.
- Tool definitions include usage constraints and response guidance so internal records are summarized in user-facing language.

### Known Limitations

- The RAG implementation is PostgreSQL full-text search, **not** embedding/vector search.
- The chat status endpoint describes streaming as simulated; this should not be marketed as guaranteed token-by-token native provider streaming.
- A tool can only act within the authorization and capabilities implemented by the backend. The assistant is not a general unrestricted shell or database console.
- Live assistant behavior requires a usable provider key and available model quota.

### Source

[`e8159c0`](https://github.com/zainshah3464/relayon/commit/e8159c014f).

---

## [2.2.0] — 2026-11-11

**Working multi-language support and right-to-left layout.**

### Added

- **English (`en`) translation dictionary.**
- **Urdu (`ur`) translation dictionary.**
- **Arabic (`ar`) translation dictionary.**
- **Language selection service** — language can be resolved from the saved preference, authenticated user locale or browser locale, with English as the fallback.
- **Locale persistence** — a user's language preference can be retained across sessions.
- **RTL support** — Urdu and Arabic are treated as right-to-left languages.
- **Localized auth email templates.**

### Changed

- Dashboard text and layout behavior now have a locale-aware foundation instead of assuming English-only presentation.

### Known Limitations

- The supported dictionaries are **English, Urdu and Arabic**. Hindi was in the earlier plan but is not the language set implemented by this tagged release.
- Translation completeness depends on the dictionary entries actually provided by the application; a language selector alone does not prove every third-party/provider message has been translated.

### Source

[`3c5814c`](https://github.com/zainshah3464/relayon/commit/3c5814c3bcc9337122c51b87710f1f5086c62ef3).

---

## [2.1.0] — 2026-11-09

**Authentication hardening.**

### Added — authentication and account lifecycle

- **Google OAuth login.**
- **GitHub OAuth login.**
- **OAuth state validation** — callback flow includes a state-validation step to reduce login-CSRF risk.
- **Short-lived OAuth exchange ticket** — the callback exchanges a temporary ticket for the application session rather than exposing the full session credential as an ordinary callback query parameter.
- **Email verification** — verification tokens stored as hashes, expire and are marked used on successful verification.
- **Verification resend flow** — an existing unused token is invalidated before a replacement is created.
- **Password reset** — reset tokens are hashed, time-limited and one-time use.
- **Session revocation after reset** — refresh-token records for the affected user are revoked when the password is reset.
- **Strong-password validation** — signup/reset rules reject passwords that do not meet the configured validator requirements.
- **Password strength meter** — client-side component.

### Related — automated test framework

The repository-wide automated testing foundation was added across commits [`bf74a98`](https://github.com/zainshah3464/relayon/commit/bf74a98298), [`40de08e`](https://github.com/zainshah3464/relayon/commit/40de08ece5), and [`0b46f81`](https://github.com/zainshah3464/relayon/commit/0b46f81edc), which occurred in the v2.0.0/v2.1.0 development window. Highlights:

- **Vitest unit-test foundation** — root configuration, SWC/decorator setup and test environment configuration.
- **Integration-test configuration** — separate Vitest configuration and fixtures for tests that need PostgreSQL, Redis or MongoDB.
- **Reusable test helpers/mocks** — database/service fixtures, fake Redis helpers and mocked fetch support.
- **Unit tests** — important security, processing and delivery behavior: crypto, signature verification, retry policy, circuit breaker, transform/routing, API key and selected service behavior.
- **Integration tests** — auth, quota and webhook-flow integration coverage.
- **Playwright end-to-end assets** — E2E configuration and a full-pipeline test.
- **k6 load-test assets** — webhook ingress load scenarios and thresholds.
- **Stryker mutation-testing configuration/scripts** — critical-path mutation testing.

### Changed — CI

- Added a **dedicated Tests GitHub Actions workflow** with separate unit, integration and RLS enforcement jobs.
- The automated unit job provisions PostgreSQL, Redis and MongoDB test services and runs coverage-enabled Vitest tests.
- The integration job applies migrations/RLS setup and runs the integration test suite.
- The RLS job verifies tenant isolation against PostgreSQL row-level-security policies.
- The mutation job is configured for pull requests and is marked `continue-on-error`.
- The separate CI workflow runs workspace typecheck and builds the Dashboard, API, Ingress and Workers applications.

### Verification boundaries

- Playwright E2E and k6 load-test scripts are present in the repository, but their existence does not mean they run in every standard push workflow.
- Mutation testing is pull-request-triggered in the checked-in workflow and is non-blocking there.
- No test count or percentage coverage is stated here because those values vary by commit and were not established as a stable release contract.

### Source

- Authentication: [`2e96d0d`](https://github.com/zainshah3464/relayon/commit/2e96d0d29b).

---

## [2.0.0] — 2026-11-03

**Billing foundation, workflow assertions and quota-policy controls.**

### Added

- **Stripe billing integration in test mode** — the billing service can create checkout sessions and billing-portal sessions when Stripe is configured.
- **Subscription webhook handling** — Stripe subscription events update tenant billing/subscription state.
- **Workflow test-run assertions** — test-run results can be checked against JSONata assertions and returned with per-assertion outcomes.
- **Quota soft mode** — tenant quota behavior can be configured to allow a bounded overage rather than immediately rejecting at the normal quota boundary.
- **Usage reporting foundation** — the quota/billing path can report eligible usage to Stripe for applicable subscription states.

### Changed

- Workflow test-run is now more than a basic preview: it can return structured assertion results for a sample pipeline execution.
- Quota enforcement exposes separate usage metrics for events, AI tokens and deliveries.

### Known Limitations

- Stripe checkout/subscription behavior is only active when valid Stripe environment configuration and price identifiers are present.
- Test mode does not establish that a live subscription/payment flow has been verified in production.
- Quota soft mode changes the effective enforcement boundary; it does not guarantee a tenant can exceed provider-side limits.
- Workflow test assertions exercise the test pipeline, not a real external side effect at every destination.

### Source

[`d3cf772`](https://github.com/zainshah3464/relayon/commit/d3cf772590).

---

## [1.9.0] — 2026-10-31

**Quota flexibility, usage export, full RLS rollout and external adapters.**

### Added

- **Soft quota mode** — tenant usage enforcement supports a soft policy with a bounded overage allowance. In the current quota service, soft mode uses up to **2×** the configured limit as its effective allowance.
- **Usage export** — a tenant-facing usage export path was added for extracting usage records (CSV).
- **External adapter loader** — custom adapter packages can be loaded from the configured external-adapter directory when they provide a valid manifest and entrypoint.
- **Sandboxed adapter execution path** — adapters declaring the sandboxed trust mode are isolated in a worker-thread runner with a bounded execution time and a constrained HTTPS fetch bridge.

### Changed

- **RLS tenant-isolation rollout** — row-level-security policies were applied across the tenant-owned PostgreSQL data paths, complementing tenant-scoped service queries.
- **Quota reporting** — usage snapshots expose consumption against configured tenant limits.

### Security and operational notes

- External adapter manifests and entrypoint paths are validated; path traversal and duplicate adapter types are rejected.
- The sandbox is a control, not proof that arbitrary third-party adapter code is safe. Review adapter source, outbound destinations, permissions and credential handling before enabling it.
- PostgreSQL RLS requires the corresponding policies to be applied to the target database; source files alone do not update an already-running database.

### Known Limitations

- Soft quota mode is a product-level allowance, not a guarantee that an upstream provider will accept additional requests.
- Usage export should be treated as a report of Relayon's recorded usage counters, not as a substitute for a finalized provider invoice.
- Sandboxed external adapters remain subject to the limitations of their runtime and the permissions exposed by the host bridge.

### Source

[`171ac77`](https://github.com/zainshah3464/relayon/commit/171ac77d35).

---

## [1.8.0] — 2026-10-31

**Usage quotas, database tenant isolation and workflow-as-code synchronization.**

### Added

- **Tenant usage quotas** — usage accounting for events and AI-token consumption, with delivery usage included in the quota metric model.
- **Usage counters** — period-scoped counters track usage by tenant and metric.
- **PostgreSQL RLS policies** — row-level-security policy definitions and an application script added to enforce tenant boundaries at the database layer.
- **Workflow YAML sync CLI** — scripts support pulling workflows from the API, validating local YAML and pushing approved workflow definitions back to Relayon.
- **Workflow directory configuration** — the sync process supports a configurable local workflows directory and API/token environment settings.

### Changed

- Workflow configuration can be managed as **reviewable YAML in a Git repository** rather than only through interactive dashboard edits.
- Tenant isolation is defended at both application query boundaries and, when migrations/policies are applied, PostgreSQL RLS boundaries.

### Known Limitations

- YAML stored in Git must not contain live secrets. The export path redacts secret values into placeholders, and unresolved placeholders must be supplied before import.
- Applying RLS requires the database role/configuration expected by the policies and the RLS setup script.
- Workflow sync is a repository/client workflow; it does not make Relayon itself a Git hosting service or automatically create Git commits.

### Source

[`5b48022`](https://github.com/zainshah3464/relayon/commit/5b48022aa5).

---

## [1.7.0] — 2026-10-28

**Richer adapter metadata, dynamic configuration UI, delivery replay and operator-facing diff improvements.**

### Added

- **Rich adapter field descriptors** — adapter metadata can describe destination configuration fields in a form-oriented way, rather than exposing only a flat type/name catalogue.
- **Dynamic destination forms** — the dashboard uses adapter descriptors to render adapter-specific configuration inputs.
- **Event replay operation** — the event API gained a replay action for reprocessing an existing event through the workflow processing path.
- **Destination dry-run capability** — the egress path can execute a dry-run variant of adapter behavior where a provider-safe probe exists.

### Changed

- **Split version-diff view** — the workflow version comparison experience separates the compared snapshots/changes for easier inspection.
- Adapter discovery and dashboard form rendering are more metadata-driven, reducing the amount of adapter-specific form wiring required in the UI.

### Operational notes

- Event replay may produce new destination side effects. It should be used with awareness of downstream idempotency and the current destination configuration.
- A dry-run result is only as strong as the provider-safe check implemented by that adapter; it does not guarantee the real event payload will be accepted by the destination.

### Source

[`c47df3c`](https://github.com/zainshah3464/relayon/commit/c47df3c5db).

---

## [1.6.0] — 2026-10-27

**Validation history, pipeline test-run, adapter discovery and operational bulk controls.**

### Added

- **Persisted destination validation result**:
  - `lastValidatedAt` records the latest validation time.
  - `lastValidationOk` records whether the last validation passed.
  - `lastValidationError` records the latest validation failure detail.
- **Workflow pipeline test-run** — `POST /api/workflows/:id/test` forwards a sample payload to the worker-side test pipeline:
  - Runs the optional enrichment stage.
  - Evaluates the configured transform.
  - Evaluates routing and returns the selected destination information.
  - Reports stage-level result/error/duration data.
  - **Does not persist a production event or enqueue live egress deliveries.**
- **Adapter catalogue endpoint** — `GET /api/destinations/adapters` retrieves the available adapter catalogue from Workers using the internal shared secret.
- **API key rotation audit trail** — rotation records capture the old/new key IDs, actor, grace-window end and creation timestamp; the dashboard can list rotation history.
- **Bulk schedule deletion** — `POST /api/schedules/bulk/delete` removes all schedules belonging to the authenticated tenant while leaving the workflows themselves untouched.

### Changed

- Destination validation now updates the destination's last-validation metadata where a destination ID is provided.
- API key rotation now records the actor and a durable rotation-history row in addition to creating the replacement key and applying its grace window.

### Security and operational notes

- Adapter catalogue lookup uses the internal Workers URL and `CRON_SECRET`; it is not an unauthenticated worker-control endpoint.
- Bulk schedule deletion is tenant-scoped and deletes schedule records, not workflows or their event history.
- Pipeline test-run is explicitly separated from live event processing and egress delivery.

### Known Limitations

- Test-run requires `WORKERS_URL` and `CRON_SECRET` to be configured on the API deployment.
- A pipeline test-run does not prove that an external destination can accept a live write.
- Bulk schedule deletion is destructive to schedule configuration; it does not delete the workflows.

### Source

[`0b1dd14`](https://github.com/zainshah3464/relayon/commit/0b1dd14ef7).

---

## [1.5.0] — 2026-10-26

**Validation, full encryption, diff, key rotation, bulk ops.** The "auditable platform" release — every config can be tested before save, every change is diffable, keys rotate without downtime.

> ✅ **Formal GitHub Release:** [v1.5.0](https://github.com/zainshah3464/relayon/releases/tag/v1.5.0)

### Added

- **Destination validation endpoint** — `POST /api/destinations/validate` with two-layer check:
  - Schema validation (required fields, shape regex, URL format)
  - Optional real dry-run via workers `/internal/egress/dry-run`
  - Per-field error reporting with `{ field, message }` shape
  - Graceful fallback — if workers unreachable, returns `layer: 'schema'` with warning
- **`__dryRun` honor in all 9 adapters** — critical safety: validation **never writes** to the destination:
  - HTTP/Slack/Discord: HEAD request (no body, no message)
  - Email: `GET /api-keys` (Resend auth check, no email)
  - Sheets: `GET spreadsheet metadata` (no row append)
  - Airtable: `GET /meta/bases/:id/tables` (no record)
  - Notion: `GET /v1/data_sources/:id` (no page)
  - PostgreSQL: `SELECT 1` (no INSERT)
  - MongoDB: `ping` (no insert)
  - Slack/Discord webhooks cannot be probed without sending — return "config valid, cannot be tested without sending" (safest possible)
- **`encryptConfigAll()` helper** — full-tree encryption with `METADATA_CONFIG_KEYS` whitelist:
  - Encrypts every string value except metadata (url, method, table, baseId, etc.)
  - Toggled via `FULL_CONFIG_ENCRYPTION=true` env var on API
  - Default: `false` (only `SECRET_CONFIG_KEYS` encrypted — same as v1.3+)
  - Drop-in — decryptConfig works unchanged, no migration when toggling
- **Version diff endpoint** — `GET /api/workflows/:id/versions/:a/diff/:b`:
  - Unified line-level patch via `diff@7` package
  - Returns `{ fromVersion, toVersion, identical, stats: { added, removed }, unified }`
  - Dashboard renders color-coded (green `+`, red `-`, cyan `@@`)
- **API key rotation** — `POST /api/api-keys/:id/rotate`:
  - Creates new key with same scopes/environment
  - Caps old key's `expiresAt` at `now + 24h` (grace window)
  - Both keys work during grace; old returns `401` after
  - Lineage tracked via `rotatedFromId` field
- **Bulk schedule operations**:
  - `POST /api/schedules/bulk/pause-all` — sets `isActive: false` on all tenant schedules
  - `POST /api/schedules/bulk/resume-all` — recomputes `nextRunAt` (prevents immediate-fire storm on resume)

### Fixed (During Development)

- **`diff@7` ESM import failure** — `diff@7` is ESM-first; NestJS CommonJS build rejects `import { createTwoFilesPatch } from 'diff'`. **Fix:** `const { createTwoFilesPatch } = require('diff') as {...}` with type assertion.
- **`pg-format` types missing** — no `@types/pg-format` package exists on npm. **Fix:** Added `declare module 'pg-format'` in `apps/workers/src/types.d.ts`.
- **`__dryRun` gap in initial plan** — the original v1.5 plan only honored `__dryRun` in the HTTP adapter. This would have caused testing a Slack destination to send a real message, Email to send a real email, MongoDB to insert a real document. **Fix:** Added `__dryRun` check to all 9 adapters with distinct safe probes per type. **This was the single most important v1.5 safety decision.**
- **Schedules bulk routes conflict** — `@Controller('workflows/:workflowId/schedule')` conflicts with `bulk/pause-all` (routed as `:workflowId='bulk'`). **Fix:** Separate `SchedulesBulkController` on `@Controller('schedules')` root.
- **API `app.module.ts` needed `SchedulesBulkController` registration** — after creating the bulk controller, forgot to register it in `SchedulesModule`. **Fix:** Added to `controllers` array.
- **Workers dry-run endpoint route prefix** — `EgressController` is on `@Controller()` root (no prefix), so endpoint is `POST /internal/egress/dry-run`. Verified against route map.

### Known Limitations

- **Dry-run does not test actual delivery payload** — it verifies config validity, not "a real delivery would succeed." A Slack webhook pointing to a misconfigured channel still shows green.
- **Slack/Discord cannot be dry-run tested** — API design limitation; no safe probe exists without sending a message.
- **`FULL_CONFIG_ENCRYPTION` is API-only toggle** — Workers doesn't need to know (it decrypts whatever's there), but there's no UI to flip it per-tenant. Global env var only.
- **`API_KEY_PEPPER` rotation is a breaking change** — rotating it invalidates all issued keys. **No migration path was ever shipped.**
- **Version diff is line-based, not semantic** — a whitespace change in a config object shows as a diff even if functionally equivalent.
- **0ms latency readings on dry-run** — some HTTP destinations return sub-1ms (cached DNS, immediate HEAD rejection). Real delivery latency will differ.

### Performance

- **Validation endpoint** — ~200–500ms for real dry-run (network bound); ~5ms for schema-only
- **Version diff** — ~10–50ms for typical 2KB snapshots
- **API key rotate** — ~15ms (single DB transaction)

### Deployment

- **No new migrations** — `encryptConfigAll`, `validate`, `diff`, `rotate`, `bulk ops` are all code-only
- **No new env vars required** — `FULL_CONFIG_ENCRYPTION` is optional (default `false`), `WORKERS_URL` + `CRON_SECRET` already set in v1.4

---

## [1.4.0] — 2026-10-25

**Database adapters, key rotation, run-now.** The "enterprise delivery" release — 9 adapters total, zero-downtime credential rotation, manual schedule trigger.

> ✅ **Formal GitHub Release:** [v1.4.0](https://github.com/zainshah3464/relayon/releases/tag/v1.4.0)

### Added

- **PostgreSQL destination adapter** — `pg` + `pg-format` for SQL-safe dynamic identifiers:
  - Connection pooling per destination (max 3 connections)
  - Column mapping via dot-path (`"data.amount": "amount_cents"`)
  - Upsert support via `onConflict` (single column, regex-validated)
  - Fallback: single `payload` JSONB column if no columns mapped
  - Retryable classification: `ECONNRESET`, `ETIMEDOUT`, serialization failures, deadlocks, `too_many_connections`
- **MongoDB destination adapter** — native `mongodb` driver:
  - Client cache per destination, idle-swept after 60s
  - `_relayon` metadata enrichment on every document (`eventId`, `correlationId`, `destinationId`, `attemptNumber`, `deliveredAt`)
  - Upsert key support via `upsertKey` (comma-separated dot-paths)
  - `serverSelectionTimeoutMS` 5s, `maxPoolSize` 3
- **Versioned key rotation** — `enc:v2:<kid>:<iv>:<tag>:<ct>` envelope format:
  - `CONNECTOR_ENCRYPTION_KEYS=kid1:hexkey1,kid2:hexkey2` multi-key keyring
  - First key = current encryption; all keys = decryption
  - `enc:v1:` (v1.3 legacy) backward compat — brute-force try each key in reverse
  - **v1.3 → v1.4 migration path:** if only `CONNECTOR_ENCRYPTION_KEY` (singular) is set, treated as single-entry keyring with kid `v1-legacy` — zero env change required
  - Rotation script `scripts/rotate-encryption-key.mjs` — idempotent, re-encrypts all workflows + destinations with current key
- **Schedule run-now** — `POST /api/workflows/:id/schedule/run-now`:
  - Forwards to Workers `POST /internal/schedule/run-now`
  - Enqueues synthetic event with `rawPayload.type = 'relayon.schedule.manual'`
  - `nextRunAt` untouched — cron stays scheduled
  - `lastRunAt` updated to now
- **Version Compare UI** — side-by-side snapshot view in version drawer (superseded by v1.5 diff view).

### Fixed (During Development)

- **`CONNECTOR_ENCRYPTION_KEY` (v1.3) → `_KEYS` (v1.4) migration** — strict requirement of plural key would break local dev and prod for existing encrypted data. **Fix:** Backward compat in `loadKeyring()` — if `_KEYS` missing but `_KEY` present, treat as single-entry keyring with kid `v1-legacy`.
- **Postgres adapter dead code from plan** — initial plan had an unused block that would have built a malformed query with `'$1'` string literals wrapped by `%L`. **Fix:** Removed the dead code — only `finalSql` is used.
- **`SchedulesModule` not imported in API `app.module.ts`** — v1.3 shipped `SchedulesController` but the module was never wired into the root. Every `PUT /api/workflows/:id/schedule` returned 404. **Caught during v1.4 verification.** **Fix:** Added `SchedulesModule` to `AppModule.imports` array.
- **`destinationSummary` doesn't recognize `enc:v2:` prefix** — dashboard function checks `.startsWith('enc:v1:')`. **Never fixed** — remained a cosmetic limitation.
- **`WORKERS_URL` + `CRON_SECRET` missing on API** — run-now requires both env vars. **Fix:** Added to `DEPLOYMENT.md` env matrix; run-now throws `BadRequestException` with clear message if either is missing.

### Known Limitations

- **Rotation requires both keys in env during grace window** — remove old key too early and existing `enc:v2:old-key:...` envelopes become undecryptable with `Unknown kid` DLQ entries.
- **No automatic key expiry** — rotation is manual.
- **Postgres/MongoDB connection strings cannot be probed without credentials** — validation was added in v1.5.
- **Compare UI is side-by-side, not diff-based** — no line-level highlighting until v1.5.

### Performance

- **PG adapter** — ~50–200ms per insert (network bound); connection reuse saves ~30ms on subsequent inserts
- **MongoDB adapter** — ~30–100ms per insert; client cache saves ~200ms cold-start
- **Run-now** — ~200ms round-trip API → Workers → Redis LPUSH

### Deployment

- **No migration** — v1.4 is data-layer only. `enc:v1:` data stays readable, new data uses `enc:v2:`.
- **New env var:** `CONNECTOR_ENCRYPTION_KEYS` (plural) — replaces v1.3's `CONNECTOR_ENCRYPTION_KEY` (singular). Both must be present in **both** API and Workers.
- **API-only env vars:** `WORKERS_URL` and `CRON_SECRET` (for run-now endpoint).

---

## [1.3.0] — 2026-10-24

**Scheduled workflows, versioning, credential encryption, new adapters.** The "time-driven + auditable" release — the platform can now be triggered by cron, every config change is versioned, and credentials are encrypted at rest.

> ✅ **Formal GitHub Release:** [v1.3.0](https://github.com/zainshah3464/relayon/releases/tag/v1.3.0)

### Added

- **Scheduled workflows** — DB-backed cron, serverless-safe:
  - `workflow_schedules` table with `cronExpression`, `timezone`, `payloadTemplate`, `isActive`, `lastRunAt`, `nextRunAt`
  - `POST /internal/schedule/tick` — called by external cron every 5 min
  - Atomic claim via `updateMany` with `nextRunAt <= now` predicate — no duplicate enqueue under concurrent ticks
  - `cron-parser@4.9.0` pinned (v5 broke API with `CronExpressionParser.parse`)
  - `UpsertScheduleDto` regex: digits + `*`,`,`,`-`,`/`, space only — blocks named days/months to reduce parser attack surface
  - Invalid cron at save: `400 Bad Request`. Invalid cron at tick: schedule deactivated + logged (never crashes loop)
- **Workflow versioning** — immutable snapshots on every mutation:
  - `workflow_versions` table, 50-version cap per workflow
  - Captured on `create`, `update`, `importYaml`, `restore`
  - `GET /versions`, `GET /versions/:v`, `POST /versions/:v/restore`
  - Restore recreates destinations (UUIDs not stable), captures new version — history stays linear
- **Credential encryption at rest** — AES-256-GCM with HKDF per-tenant keys:
  - `crypto-box.ts` in both API and Workers (identical content)
  - `enc:v1:<iv>:<tag>:<ct>` envelope format
  - `SECRET_CONFIG_KEYS` field list — only secret fields encrypted, metadata stays plaintext for UI
  - `redactConfig()` — client receives `••••••••` for secrets
  - `decryptConfig()` on delivery — failure moves delivery to DLQ with `credential_decryption_error`
- **Airtable adapter** — `api.airtable.com/v0/{baseId}/{tableName}`, `typecast` optional
- **Notion adapter** — `api.notion.com/v1/pages` with `data_source_id` parent, `Notion-Version: 2026-03-11`
- **Schedule card + Version drawer in dashboard** — `WorkflowScheduleCardComponent`, `WorkflowVersionsDrawerComponent`

### Fixed (During Development)

- **`workflow-detail.component.ts` was never updated in v1.2** — the new components existed on disk but were never imported in `workflow-detail.component.ts`. Angular rendered nothing for them. **Caught because the last v1.2 commit only pushed `package.json` — the actual component file was never committed.** **Fix:** Full replace of `workflow-detail.component.ts` with imports + template wiring + Airtable/Notion form fields.
- **Encryption scope confusion** — HTTP URLs are not in `SECRET_CONFIG_KEYS` by design. **Fix:** Documented the scope clearly in `SECURITY.md`.
- **Prisma EPERM lock from v1.0** — re-encountered when regenerating after adding `WorkflowSchedule` + `WorkflowVersion` models. **Fix:** Kill all node processes first.
- **`cron-parser@5` API break** — pinned to `4.9.0` in both API and Workers workspaces.

### Known Limitations

- **`enc:v1:` has no key ID** — no key rotation possible. **Fixed in v1.4** with `enc:v2:<kid>` format.
- **Encryption covers only `SECRET_CONFIG_KEYS`** — non-secret fields stay plaintext. Full-config encryption added in v1.5 via `FULL_CONFIG_ENCRYPTION=true`.
- **No version diff yet** — restore overwrites, but you can't see what changed between two versions. **Fixed in v1.5.**
- **No manual schedule trigger** — cron tick waits for `nextRunAt`. **Fixed in v1.4.**
- **`destinationSummary` assumes `enc:v1:` prefix** — future v2 envelopes show wrong text. **Never fixed.**

### Deployment

- **Migration:** `v13_schedules_and_versions` — adds `workflow_schedules` + `workflow_versions` tables
- **New env vars:** `CONNECTOR_ENCRYPTION_KEY` (64 hex) — **must be identical in API and Workers**
- **Third external cron job:** `POST /internal/schedule/tick` every 5 min

---

## [1.2.0] — 2026-10-23

**Extensibility, observability, security.** The "platform" release — adapter SDK, raw SVG charts, scoped API keys.

> ✅ **Formal GitHub Release:** [v1.2.0](https://github.com/zainshah3464/relayon/releases/tag/v1.2.0)

### Added

- **Custom Destination SDK** — `@DestinationAdapter({ type, displayName, configSchema })` decorator:
  - `AdapterRegistry` uses NestJS `DiscoveryService` + `Reflector` for auto-discovery at bootstrap
  - Adding a new adapter = 1 new file + 1 line in `EgressModule.providers` — zero registry edits
  - Duplicate type detection with warning log
- **Time-series charts** — raw SVG, **zero dependencies** (no Chart.js, no D3):
  - `app-time-series-chart` component with signal inputs
  - Backend uses MongoDB `$dateTrunc` aggregation for hourly/daily bucketing
  - Hover tooltip, Y-axis grid, X-axis labels, range selector (24h / 7d / 30d)
  - Empty buckets filled with zeros for continuous series
- **API keys management**:
  - `rlk_<live|test>_<8-hex-prefix>_<48-hex-secret>` format (Stripe-style)
  - `api_keys` table with `prefix` (unique, indexed), `key_hash` (SHA-256 + pepper), `scopes[]`, `environment`, `expiresAt`, `revokedAt`, `lastUsedAt`
  - Show-once UX — raw key returned only in create response
  - `JwtOrApiKeyGuard` — hybrid guard accepts JWT or `X-API-Key` header
  - `@RequireScopes()` decorator for scope enforcement
  - Timing-safe verification via `crypto.timingSafeEqual`
  - **8 scopes:** `events:read`, `workflows:read`, `workflows:write`, `destinations:read`, `destinations:write`, `dlq:read`, `dlq:write`, `analytics:read`
- **Bulk DLQ discard** — `POST /api/dlq/bulk-discard` (mirror of `bulk-replay`, atomic `deleteMany`)
- **Transform preview** — `POST /api/workflows/:id/preview-transform` (JSONata compile + eval with 2s timeout)
- **Discord adapter** — reference implementation of the SDK
- **Settings API Keys tab** — create, list, revoke keys in dashboard

### Fixed (During Development)

- **`@types/jsonata` does not exist on npm** — attempted install failed with `ETARGET`. **Fix:** Removed — jsonata ships its own types.
- **`jsonata` package missing in API workspace** — `preview-transform` endpoint needed it. **Fix:** `npm install jsonata --workspace=api`.
- **Chart axis labels rendered as `Invalid Date`** — MongoDB `$dateTrunc` returns `Date` objects, but the pipeline was passing ISO strings to the frontend which Angular's `| date` pipe couldn't parse. **Fix:** Backend converts to ISO strings before response; frontend `new Date(p.ts)` for axis computation.
- **`api_keys.prefix` collision possible** — 8 hex = 4 bytes = 32 bits. Extremely rare but theoretically possible under high volume. **Not fixed** — DB unique constraint rejects insert with `409`. Accepted as-is.

### Known Limitations

- **Time-series bucketing is fixed to hour (24h) or day (7d/30d)** — no custom bucketing window.
- **Charts have no legend for empty series** — a series with 0 points shows a flat line at y=0. Cosmetic.
- **API keys cannot create other API keys** — only JWT sessions can. By design.
- **API key rotation not implemented yet** — you have to revoke and create a new one manually. **Fixed in v1.5.**
- **`API_KEY_PEPPER` change invalidates all issued keys** — no migration path. Documented as hard limitation.

### Deployment

- **Migration:** `api_keys_scopes` — rebuilds `api_keys` table (adds `prefix`, `scopes[]`, `environment`, `revoked_at`; renames `key` → `key_hash`)
- **New env var:** `API_KEY_PEPPER` (32+ char random string) — **must be stable forever**

---

## [1.1.0] — 2026-10-23

**Reliability & operator experience.** The "production-ops" release — bulk DLQ, workflow portability, cost visibility, conditional routing.

> ✅ **Formal GitHub Release:** [v1.1.0](https://github.com/zainshah3464/relayon/releases/tag/v1.1.0)

### Added

- **Bulk DLQ replay** — `POST /api/dlq/bulk-replay` with `{ ids: string[] }` (max 100):
  - Atomic `updateMany` scoped to `tenantId + status='dlq'`
  - Per-ID success/failure feedback in response
  - Duplicate ID deduplication
  - Dashboard checkbox UI + "Replay selected" button
- **Workflow YAML export/import**:
  - `GET /api/workflows/:id/export` — `application/x-yaml`, `Content-Disposition: attachment`
  - Secrets redacted to `${VAR}` placeholders — safe for Git versioning
  - `POST /api/workflows/import` — rejects unresolved placeholders with clear error
  - `apiVersion: relayon/v1` + `kind: Workflow` — same shape as K8s manifests
- **Cost analytics** — `GET /api/analytics/cost`:
  - 30-day window aggregation
  - Per-destination: total attempts, retries, retry rate, delivered, DLQ, estimated Redis cost
  - Groq cost estimated from payload size (1 token ≈ 4 bytes)
  - Notes array documents assumptions
- **Conditional routing** — `routingRules` JSONB column on `workflows`:
  - Array of `{ when: string, destinationIds: string[] }` where `when` is a JSONata boolean expression
  - Empty array = route to all destinations
  - First matching rule wins
  - `RoutingService.decide()` — clean separation, testable
  - No rule matched → event marked processed but no deliveries

### Fixed (During Development)

- **`jsonata` missing from API workspace** — routing rules needed it. **Fix:** `npm install jsonata --workspace=api`.
- **`routingRules` was missing from `Workflow` Prisma model** — initial plan assumed it existed. **Fix:** Added `routingRules Json @default("[]")` + `add_routing_rules` migration.
- **Bulk replay returned `_id` as string vs ObjectId mismatch** — **Fix:** Consistent `String(d._id)` conversion before comparison.
- **YAML export included raw secrets** — **Fix:** Added `SECRET_KEYS` set + `redactConfig()` walk.
- **`routingRules` empty array caused events to route to zero destinations** — **Fix:** Explicit early return when `rules.length === 0` → route to all destinations.

### Known Limitations

- **No rule builder UI** — `routingRules` must be set via API or Prisma Studio. **Never shipped.**
- **JSONata expressions not validated at save time** — a bad expression fails silently during processing (rule skipped). **Mitigated** by logging each rule error, but not user-facing.
- **Cost analytics are estimates** — not invoiced amounts. Actual Groq/Redis bills may differ.
- **No bulk DLQ discard yet** — only replay. **Fixed in v1.2.**
- **No workflow YAML import UI** — API only in v1.1. **Fixed in v1.2 frontend.**

### Deployment

- **Migration:** `add_routing_rules` — adds `workflows.routing_rules` JSONB column, default `[]`
- **New dependency:** `js-yaml` + `@types/js-yaml` in API workspace

---

## [1.0.0] — 2026-10-22

**First stable production release.** Live at [relayon.vercel.app](https://relayon.vercel.app).

> ✅ **Formal GitHub Release:** [v1.0.0](https://github.com/zainshah3464/relayon/releases/tag/v1.0.0)

This release represents the complete MVP — all 7 development phases shipped, deployed to Vercel, and verified end-to-end in production.

### Added

#### Core Platform
- **4-app monorepo** — Dashboard (Angular 19), API (NestJS 11), Ingress (Express 5), Workers (NestJS 11)
- **Multi-tenancy** — JWT auth with refresh token rotation, role-based access (owner/admin/viewer)
- **Workflow CRUD** — Create, read, update, delete webhook pipelines via dashboard or API
- **Destination management** — Attach N destinations per workflow, toggle enabled, delete

#### Ingress (Webhook Reception)
- **5 signature verifiers** — Stripe, GitHub, Shopify, Slack, Generic HMAC
- **Timing-safe comparison** for all signatures (`crypto.timingSafeEqual`)
- **Timestamp tolerance** — configurable window (default 300s) for Stripe and Slack
- **Redis idempotency** — `SET NX EX 86400` on body hash or `X-Event-Id` header
- **Rate limiting** — 300 req/min per workflow via Redis `INCR`
- **5 MB payload limit** with clean `413` response
- **Correlation IDs** — every request gets a UUID traceable across all services

#### Processing (AI + Transform)
- **Groq AI enrichment** — summarize, classify, extract, translate via `openai/gpt-oss-120b`
- **1-hour Redis cache** — identical payloads served from cache
- **Graceful degradation** — if Groq fails, event still processes and delivers
- **JSONata transform** — 2-second timeout, compile-time error handling
- **Batch processing** — configurable `BATCH_SIZE` (default 3) and `TIME_BUDGET_MS` (default 7000ms)

#### Delivery
- **4 destination adapters** — HTTP, Slack, Email (Resend), Google Sheets (service account JWT)
- **Exponential backoff retry** — 10s → 30s → 1m → 5m → 15m
- **Dead Letter Queue** — `status: 'dlq'` after max attempts, replayable
- **Circuit breaker** — pause unhealthy destinations (5 failures / 5 min)
- **At-least-once delivery** — `RPOPLPUSH` + atomic Mongo claim + 5-min stuck recovery
- **Idempotency-Key headers** — `{eventId}:{destinationId}` sent to HTTP destinations
- **Adapter timeout** — 15s default, configurable via `ADAPTER_TIMEOUT_MS`

#### Data Layer
- **PostgreSQL (Prisma)** — Tenants, Users, RefreshTokens, Workflows, Destinations, ApiKeys
- **MongoDB (Mongoose)** — Events, Deliveries (both with 30-day TTL indexes)
- **Redis (Upstash)** — 4 queues, idempotency, rate limits, circuit breaker, Groq cache

#### Dashboard
- **Login/Signup** — JWT auth with automatic token refresh
- **Workflows list** — create + list, filtered by tenant
- **Workflow detail** — webhook URL copy, destination CRUD (type-specific forms)
- **Events explorer** — cursor-paginated list, filter by status, detail drawer with raw + enriched payload + delivery attempts
- **DLQ manager** — inspect failures, replay with one click, discard permanently
- **Analytics** — events 24h/7d, success rate, pending count, DLQ count, per-destination breakdown
- **Settings** — tenant name rename
- **Responsive** — mobile sidebar toggle, adaptive layouts

#### Observability
- **Sentry integration** — optional DSN, captures exceptions in API/Ingress/Workers
- **Structured JSON logs** — correlation IDs, stage markers, duration tracking
- **Health endpoints** — `/api/health`, `/health`, `/internal/health`
- **Smoke test** — `scripts/smoke-test.mjs` with 10 checks across all 3 live domains

#### Documentation
- **README.md**, **DEPLOYMENT.md**, **docs/ARCHITECTURE.md**, **docs/API_REFERENCE.md**, **docs/DATABASE.md**, **docs/SECURITY.md**, **docs/TESTING.md**, **docs/CONTRIBUTING.md**, **docs/CHANGELOG.md**, **docs/TROUBLESHOOTING.md**, **docs/ROADMAP.md**

### Fixed (During Development)

- **Prisma EPERM on Windows** — `npm run db:generate` failed with `EPERM: operation not permitted, rename query_engine-windows.dll.node` because dev servers were holding the file lock. **Fix:** Kill all node processes before regenerating.
- **Groq timeout parsing** — `config.get<number>('GROQ_TIMEOUT_MS')` returned a string at runtime, causing `GroqError: timeout must be an integer`. **Fix:** Use `parseInt(config.get<string>(...), 10)`.
- **NODE_ENV tab character** — Vercel env var copy-pasted from a doc included a leading `\t`. **Fix:** Manually re-type env values; add `.trim().pipe(z.enum(...))` to schema.
- **Vercel serverless "No exports found"** — Workers and Ingress called `app.listen()` which crashes in Vercel's serverless runtime. **Fix:** Export default handler, skip `listen()` when `process.env.VERCEL` is set.
- **Prisma not found in Vercel build** — `postinstall: prisma generate` failed with `prisma: command not found` because Vercel's `PATH` didn't include workspace `node_modules/.bin`. **Fix:** Move `prisma` to root `dependencies`, use `node ./node_modules/prisma/build/index.js generate --schema=...` in build command.
- **npx pulled Prisma 8 RC** — `npx prisma generate` fetched `prisma@latest` (`8.0.0-rc.25`) which removed the `generate` command. **Fix:** Remove `npx`, pin exact version `6.19.3` in both root and workspace `package.json`.
- **Dashboard SPA 404 on refresh** — Angular SPA router 404'd on direct URL access. **Fix:** Add `rewrites` in `vercel.json` (`/(.*)` → `/index.html`).
- **CORS failure on production** — **Fix:** Update `CORS_ORIGIN` env var to match actual deployed dashboard URL.
- **`@types/jsonata` does not exist** — Attempting to install caused `ETARGET`. **Fix:** Remove it (jsonata ships its own types).
- **`INestApplication` typo** — Used `INestApplication` instead of `NestApplication` in workers `main.ts`. **Fix:** Correct the type name.

### Security

- **Timing-safe signature comparison** for all 5 webhook sources
- **Refresh token rotation** — old token revoked on every refresh
- **Bcrypt cost 12** for password hashing
- **JWT secret rotation** — old refresh tokens become unusable after secret change
- **Rate limiting** on auth endpoints (10 req/min per IP)
- **Sensitive header sanitization** — `Authorization`, `Cookie`, `X-Api-Key`, `Proxy-Authorization` stripped from webhook payloads before queueing
- **IP hashing** — SHA-256 + salt; raw IPs never stored
- **Zero `eval()` / zero dynamic code execution** anywhere in the codebase

### Performance

- **Cold starts** — Ingress ~500ms, API ~800ms, Workers ~1200ms (first invocation only)
- **Warm requests** — 30–100ms across all services
- **Dashboard bundle** — 310 KB initial (87 KB gzipped), lazy-loaded feature chunks

### Deployment

- **Vercel Hobby** — 4 separate projects from 1 GitHub repo
- **Total cost** — $0/month on free tiers (Vercel + Neon + Atlas M0 + Upstash + Groq + Sentry free)
- **Build time** — ~90 seconds per project (first build), ~15 seconds (cached)
- **Live URLs:**
  - Dashboard: `https://relayon.vercel.app`
  - API: `https://relayon-api.vercel.app`
  - Ingress: `https://relayon-ingress.vercel.app`
  - Workers: `https://relayon-workers.vercel.app`

### Known Limitations (as of v1.0.0)

- **Cron interval** — Vercel Hobby allows only 1 cron/day. External cron required. *(Still true at v3.7.0 — external cron remained the deployment pattern.)*
- **No automated backups** on free tier. Manual `pg_dump` / `mongodump` required. *(Never shipped.)*
- **No unit tests** — smoke test was the primary coverage. *(**Fixed in v2.0.0/v2.1.0** — Vitest + Playwright + Stryker + k6 added.)*
- **Encryption at rest** for `sourceConfig` and `destination.config` not implemented (plaintext in PostgreSQL). *(**Fixed in v1.3.0** — AES-256-GCM + HKDF per-tenant keys.)*
- **No MFA/TOTP** for dashboard login. *(**Never shipped** — remained password-only through v3.7.0.)*
- **Single-region deployment** — all services in `iad1` (US East). *(**Never shipped** — remained single-region through v3.7.0.)*

---

## Project Final Status — What Was Never Shipped

The following items appeared in earlier plans or roadmap sections but are **not present** in the final `v3.7.0` codebase. They are documented here for honest accounting of the project's scope.

### Planned but never shipped

| Item | Status | Notes |
|---|---|---|
| **MFA / TOTP** for dashboard login | ❌ Never shipped | Password-only login remained through v3.7.0 |
| **Session management UI** (list + revoke active sessions) | ❌ Never shipped | Refresh token rotation existed, but no user-facing session list |
| **`API_KEY_PEPPER` rotation automation** | ❌ Never shipped | Rotating the pepper invalidates all keys; no migration path was built |
| **SOC 2 Type I / II compliance** | ❌ Never shipped | No audit, no certification |
| **HIPAA / GDPR certification** | ❌ Never shipped | No compliance attestation |
| **Persistent audit log table for all actions** | ⚠️ Partial | `AdminAuditLog` shipped in v2.9.0 for admin actions only — not full user-action audit |
| **`POST /destinations/:id/test`** (dedicated endpoint) | ⚠️ Partial | Validation endpoint `POST /destinations/validate` shipped in v1.5.0; a separate `/destinations/:id/test` was never added |
| **Multi-region hosted deployment** | ❌ Never shipped | Remained single-region (iad1) through v3.7.0 |
| **Hindi localization** | ❌ Never shipped | EN / UR / AR shipped in v2.2.0; Hindi was in the original plan |
| **Rule builder UI** for `routingRules` | ❌ Never shipped | Routing rules remained API/Prisma-only |
| **`destinationSummary` `enc:v2:` prefix fix** | ❌ Never shipped | Dashboard summary remained cosmetic-only for v2 envelopes |
| **Automatic key expiry / cron-based rotation** | ❌ Never shipped | Rotation remained manual |
| **Vector / embedding RAG** | ❌ Never shipped | RAG remained PostgreSQL full-text search only |
| **Native iOS/Android apps** | ❌ Never shipped | PWA only |
| **Outbound Slack/Discord dry-run** | ❌ Never shipped | No safe probe exists without sending |
| **Test coverage percentage contract** | ❌ Never established | Tests added in v2.0/v2.1 but no stable coverage contract |
| **Exactly-once delivery guarantee** | ❌ Never shipped | At-least-once remains the guarantee |
| **e2e/load tests in every standard push CI run** | ❌ Never shipped | Playwright E2E and k6 load scripts exist but do not run on every push |

### Planned items that DID ship

For contrast, several items from the earlier v2.0 plan were delivered in later versions:

| Item | Shipped in |
|---|---|
| Bulk schedule delete-all | **v1.6.0** |
| Persistent admin audit records | **v2.9.0** |
| Automated test framework (Vitest/Playwright/Stryker/k6) | **v2.0.0 / v2.1.0** |
| Docker Compose self-hosting | **v3.2.0** |
| i18n (EN + UR + AR, not Hindi) | **v2.2.0** |
| Per-destination validation (via `/destinations/validate`) | **v1.5.0** |

---

## Release & Tag Reference

**28 version tags exist in the repository history.** Six of them have published GitHub Release objects. The remaining tags (`v1.6.0` – `v3.7.0`) exist as version markers; release preparation for those tags is being finalized as part of the project's closing documentation commit.

| Version tag | Tag type | GitHub Release? |
|---|---|---|
| `v1.0.0` | lightweight | ✅ Published |
| `v1.1.0` | annotated | ✅ Published |
| `v1.2.0` | annotated | ✅ Published |
| `v1.3.0` | annotated | ✅ Published |
| `v1.4.0` | annotated | ✅ Published |
| `v1.5.0` | annotated | ✅ Published |
| `v1.6.0` | lightweight | ⏳ Release being finalized |
| `v1.7.0` | lightweight | ⏳ Release being finalized |
| `v1.8.0` | lightweight | ⏳ Release being finalized |
| `v1.9.0` | lightweight | ⏳ Release being finalized |
| `v2.0.0` | lightweight | ⏳ Release being finalized |
| `v2.1.0` | annotated | ⏳ Release being finalized |
| `v2.2.0` | annotated | ⏳ Release being finalized |
| `v2.3.0` | annotated | ⏳ Release being finalized |
| `v2.4.0` | annotated | ⏳ Release being finalized |
| `v2.5.0` | annotated | ⏳ Release being finalized |
| `v2.6.0` | annotated | ⏳ Release being finalized |
| `v2.7.0` | annotated | ⏳ Release being finalized |
| `v2.8.0` | annotated | ⏳ Release being finalized |
| `v2.9.0` | annotated | ⏳ Release being finalized |
| `v3.0.0` | annotated | ⏳ Release being finalized |
| `v3.1.0` | annotated | ⏳ Release being finalized |
| `v3.2.0` | annotated | ⏳ Release being finalized |
| `v3.3.0` | annotated | ⏳ Release being finalized |
| `v3.4.0` | annotated | ⏳ Release being finalized |
| `v3.5.0` | annotated | ⏳ Release being finalized |
| `v3.6.0` | annotated | ⏳ Release being finalized |
| `v3.7.0` | annotated | ⏳ Release being finalized (final version) |

**Tag types:** `annotated` tags carry a message/tagger; `lightweight` tags point directly at a commit.

---

## Versioning Policy

This project followed [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **MAJOR** (`x.0.0`) — Breaking changes to public API or data schema
- **MINOR** (`1.x.0`) — New features, backward compatible
- **PATCH** (`1.0.x`) — Bug fixes, security patches

### Notes on non-standard version bumps

**v1.4 encryption format change (`enc:v1` → `enc:v2`)** was shipped in a MINOR version because:
- v1.3 data stayed decryptable (backward compat preserved)
- No API surface change
- No forced migration (rotation is opt-in via script)

This is the **"additive change" pattern** — new format is added, old format is preserved, migration is opt-in. By contrast, a MAJOR change would have *required* everyone to re-encrypt before upgrading.

**v3.6.0 license migration** was a material change to usage rights, but it did not change the HTTP API and thus was not treated as a SemVer MAJOR bump. It is a **licensing event**, not a code-breaking event. Consumers should read `LICENSE` directly.

---

## How to Read This Changelog

**The project is complete.** No future versions are planned. This changelog is the historical record of everything that shipped.

**If you're evaluating Relayon:**
- Start with the **v3.7.0** entry for the final feature set.
- Read **Project Final Status** to know what is *not* supported.
- Read `docs/SECURITY.md` and `docs/ARCHITECTURE.md` for the technical model.
- Understand that delivery is **at-least-once**, not exactly-once.

**If you're a recruiter or interviewer:**
- **The velocity is real** — 28 versions in 33 days. Every version was deployed and manually verified.
- **The honesty is real** — "Known Limitations" sections are as long as "Added" sections throughout. Bugs are documented, not hidden.
- **The testing gap was closed** — v1.0–v1.5 shipped with 0 unit tests; v2.0/v2.1 added Vitest + Playwright + Stryker + k6. The gap and its closure are both documented.
- **The safety focus is real** — v1.5's `__dryRun` in all 9 adapters was the single most important design decision. It prevents a class of production incidents that real iPaaS products have shipped with.
- **The licensing was corrected** — v3.6.0's migration from MIT to proprietary source-visible is documented, along with the MIT irrevocability carve-out for anyone who obtained a copy before 2026-11-20.

**If you're a security auditor:**
- The full threat model is in `docs/SECURITY.md`.
- Credential encryption details (AES-256-GCM + HKDF) are in v1.3.0 and v1.4.0 entries.
- Dry-run safety model is in v1.5.0.
- License change is in v3.6.0.
- Known gaps (no MFA, no SOC 2, single-region) are in **Project Final Status**.

**If you're a contributor or forker:**
- Read `LICENSE` first — Relayon is **source-visible but proprietary**. Modification, competing forks, resale and AI training require prior written permission from Zain Shah.
- `LICENSE-MIT-LEGACY` documents the historical MIT carve-out for v1.0.0–v1.5.0.
- The `CONTRIBUTING.md` guide is still accurate for development setup.

---

<div align="center">

**Relayon v3.7.0 — Final Release. Project officially complete.**

**28 versions · 33 days · 78 commits · 1 monorepo · 4 apps · 9 adapters · 0 → 189,657 lines of churn**

*Built with precision. Deployed on free tier. Powered by TypeScript.*

*Made with ❤️ in Pakistan*

</div>
```

---