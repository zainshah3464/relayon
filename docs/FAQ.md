# Relayon — Frequently Asked Questions

> **Straight answers about the product, implementation, security, operations and current limitations.**
>
> **Current project version:** `v3.7.0`  
> **Source snapshot:** `f4dd930eafd2ab61381bc1c049bb6cdbb7480235`  
> **Audit date:** 24 November 2026  
> **Repository:** [github.com/zainshah3464/relayon](https://github.com/zainshah3464/relayon)

This FAQ describes the audited `v3.7.0` source snapshot. It replaces the previous v1.5-era answers. Where behavior depends on the deployment, provider plan, environment variables or external service, that dependency is stated rather than presented as a universal guarantee.

---

## Table of Contents

- [General](#general)
- [Product Capabilities](#product-capabilities)
- [Getting Started](#getting-started)
- [Workflows, Events and Deliveries](#workflows-events-and-deliveries)
- [Sources and Destinations](#sources-and-destinations)
- [AI, RAG and BYOK](#ai-rag-and-byok)
- [Schedules, Versions and Configuration](#schedules-versions-and-configuration)
- [SDK, CLI, Playground and Tunnels](#sdk-cli-playground-and-tunnels)
- [Dashboard, PWA and Community](#dashboard-pwa-and-community)
- [Authentication and Security](#authentication-and-security)
- [Data, Reliability and Performance](#data-reliability-and-performance)
- [Deployment and Operations](#deployment-and-operations)
- [Testing and Development](#testing-and-development)
- [Pricing, Limits and Licensing](#pricing-limits-and-licensing)
- [Troubleshooting](#troubleshooting)
- [Roadmap and Project Status](#roadmap-and-project-status)
- [Contributing and Support](#contributing-and-support)
- [Technical References](#technical-references)

---

## General

### What is Relayon?

**Relayon is a webhook relay and integration automation platform.** It receives events from external services, verifies incoming requests, optionally enriches and transforms payloads, applies routing rules, and delivers events to configured destinations with retry and failure-management facilities.

A workflow is the configured pipeline connecting one incoming source to one or more destinations. A workflow can also be triggered by a database-backed schedule.

### What problem does Relayon solve?

Teams repeatedly implement the same integration plumbing:

- Receive webhooks and verify signatures.
- Prevent duplicate event ingestion.
- Transform payloads into the shape a destination expects.
- Route events to one or more systems.
- Retry transient delivery failures.
- Inspect failed deliveries and replay them.
- Track events and operational activity.

Relayon centralizes those responsibilities so integrations can be configured and operated without building a separate webhook service for every connection.

### Is Relayon only a webhook forwarder?

No. The platform includes the core relay pipeline plus workflow scheduling and version history, AI enrichment and an AI assistant, tenant integrations/BYOK, outbound customer webhooks, API keys, a TypeScript SDK, a CLI tunnel, a request playground, analytics, community features and platform administration.

These capabilities are not all part of the same execution path. For example, the inbound webhook pipeline is separate from the customer-facing outbound webhook outbox.

### Is Relayon production-ready?

The repository contains production-oriented mechanisms: signature verification, atomic ingest coordination, tenant-aware access controls, encrypted credentials, retry and DLQ handling, operational health endpoints, CI workflows, integration tests and a container deployment path.

That does **not** mean every deployment is automatically production-safe. Production readiness still depends on correct secret management, database and Redis availability, backups, monitoring, provider limits, network controls, deployment configuration and operational response. A passing CI run is not a certification or a guarantee that every third-party integration will always succeed.

### Is Relayon a hosted product or self-hostable software?

Both deployment paths are represented in the repository:

- A split Vercel/serverless deployment for the dashboard, API, ingress and workers.
- A Docker Compose deployment path for operators who prefer containerized, long-running services.

Self-hosting still requires the operator to supply and maintain the required databases, Redis, secrets, storage, backups, TLS/networking and monitoring.

### Who is Relayon for?

- Developers who need to receive and route webhook events.
- Small teams building internal integrations.
- Operators who need delivery history, retries and dead-letter recovery.
- Teams that want scheduled workflows or AI-assisted event handling.
- Developers who want a typed SDK or a local webhook tunnel.
- Operators who want to inspect and deploy the source themselves, subject to the repository license.

### What is Relayon not?

Relayon is not the system of record for a customer's payments, orders, CRM or other business domain. It transports and processes integration events. A successful adapter response does not prove that the destination's downstream business process completed correctly.

Relayon also does not claim globally exactly-once delivery, full offline application behavior, a hardened operating-system sandbox for arbitrary adapters, or active-active multi-region processing.

---

## Product Capabilities

### What are the main platform components?

Relayon is organized as a monorepo with four application workspaces and shared packages:

| Component | Main responsibility |
|---|---|
| **Dashboard** | Angular user interface, authentication flows, workflow controls, event and delivery views, settings and product features. |
| **API** | NestJS control plane for identity, tenants, workflows, destinations, API keys, schedules, versions, integrations, AI, admin and other product modules. |
| **Ingress** | Express public event edge. Resolves workflows, verifies signatures, applies ingest controls and queues accepted events. |
| **Workers** | Background processing, AI enrichment, transformations, routing, destination adapters, retries, schedules and recovery. |

The four applications communicate through HTTP and shared infrastructure where appropriate. They are separate runtime boundaries, not one monolithic process.

### Which major capabilities exist in v3.7.0?

The audited source includes:

- Multi-tenant identity and authentication.
- Workflow and destination management.
- Five incoming signature-verification source types.
- Event ingest, idempotency, rate/quota controls and asynchronous processing.
- JSONata transformation and conditional routing.
- Destination adapter registry and external adapter loading.
- Retry handling, circuit breaker behavior and DLQ operations.
- Scheduled workflow triggers and workflow version history.
- Encrypted connector/provider credentials and tenant BYOK integrations.
- AI event enrichment and an AI assistant with tool support.
- PostgreSQL full-text-search-based knowledge retrieval.
- Customer-facing outbound webhooks backed by a transactional outbox.
- API keys, scoped access and OAuth/email account flows.
- Usage/billing groundwork and tenant quota controls.
- Analytics, tracking/presence and platform administration.
- Community posts/replies, reactions, moderation and templates.
- Request playground and local CLI tunnel.
- OpenAPI documentation and a typed TypeScript SDK.
- PWA-related install/update/network behavior, localization and SEO/SSR-related support.
- Docker Compose deployment support.

The existence of a module does not imply every feature is enabled on every hosted plan or deployment.

### Does Relayon have a visual workflow builder like Zapier?

The dashboard provides workflow configuration and management. The product's workflow model is configuration-oriented; do not assume it offers the same canvas-style visual automation editor or breadth of app integrations as large automation marketplaces.

### Can Relayon replace Zapier, Make or n8n?

That depends on the integration set and operational requirements. Relayon focuses on webhook ingestion, processing, routing and delivery, with the platform capabilities listed above. Products such as Zapier, Make and n8n have different integration catalogs, execution models, user experiences and commercial terms. Compare the exact connectors, triggers, limits, hosting requirements and support model before migrating a production workflow.

### How is Relayon different from a webhook inspector?

A webhook inspector primarily captures and displays requests for debugging. Relayon's core purpose is to process events and deliver them to configured destinations, while also providing retries, delivery records, routing and operational controls. The playground is a debugging feature within the broader platform; it is not the whole product.

---

## Getting Started

### Where can I open the hosted dashboard?

The project documentation identifies the hosted dashboard at:

- [https://relayon.vercel.app](https://relayon.vercel.app)

Availability and functionality depend on the current hosted deployment. The source snapshot in this FAQ is not a live uptime guarantee.

### What are the service health URLs?

The audited project guide lists these hosted endpoints:

| Service | Health URL |
|---|---|
| Dashboard | [relayon.vercel.app](https://relayon.vercel.app) |
| API | [relayon-api.vercel.app/api/health](https://relayon-api.vercel.app/api/health) |
| Ingress | [relayon-ingress.vercel.app/health](https://relayon-ingress.vercel.app/health) |
| Workers | [relayon-workers.vercel.app/internal/health](https://relayon-workers.vercel.app/internal/health) |

A health response is a point-in-time check. It does not prove that every external provider, queue, destination or background schedule is healthy.

### How do I create my first workflow?

1. Sign in to the dashboard.
2. Open **Workflows** and create a workflow.
3. Choose the source type and configure its signing secret.
4. Add one or more destinations and configure their connection details.
5. Save the workflow and copy its ingress endpoint.
6. Register that endpoint with the source provider.
7. Send a provider test event or use the playground.
8. Inspect the event and its individual deliveries in the dashboard.

The exact fields shown depend on the selected source and destination adapter.

### What does the webhook endpoint look like?

The ingress route uses this shape:

```text
POST https://<your-ingress-host>/webhook/{tenantId}/{workflowId}
```

The hosted ingress host documented for the current deployment is `relayon-ingress.vercel.app`. Self-hosted deployments must use their own ingress hostname.

### How do I test a workflow safely?

Use the playground or the source provider's test-event feature to exercise the incoming path. Destination validation can perform schema checks and, where an adapter supports a safe probe, a dry-run check. A dry-run is not the same as sending a real delivery payload; see [Sources and Destinations](#sources-and-destinations).

### Where is the API documentation?

The API bootstrap exposes Swagger/OpenAPI. The audited project guide lists:

- [Swagger UI](https://relayon-api.vercel.app/api/docs)
- [OpenAPI JSON](https://relayon-api.vercel.app/api/openapi.json)

For an exhaustive and current route list, use the OpenAPI document and the controllers in the same source revision as the deployment. A hand-maintained API reference may lag behind newly added modules.

---

## Workflows, Events and Deliveries

### What is a workflow?

A workflow is the central configuration object. It identifies the incoming source and signing secret, optional AI enrichment settings, a transform expression, routing rules, active state and attached destinations.

### What happens when a webhook arrives?

At a high level:

1. Ingress resolves the tenant and workflow.
2. It preserves the original request body bytes for signature verification.
3. It verifies the source signature.
4. It applies tenant quota and ingest controls.
5. It atomically coordinates idempotency, rate limiting and queue acceptance through Redis.
6. It returns an acknowledgement after the event is accepted into the queue.
7. Workers consume the event and apply optional enrichment, transformation and routing.
8. The event is persisted and selected destination deliveries are created.
9. Workers invoke destination adapters and update delivery state.
10. Failed retryable deliveries are delayed and retried; exhausted deliveries can move to the DLQ.

The API/dashboard then expose the resulting event and delivery information.

### Does Ingress perform the whole workflow synchronously?

No. Ingress is designed as a fast acceptance boundary. It verifies and queues accepted events; Workers perform the slower processing and outbound delivery work. This separation helps prevent a slow destination or AI provider from holding the original webhook request open.

### What is the difference between an event and a delivery?

An **event** represents one inbound webhook or scheduled trigger. A **delivery** represents sending that event to one particular destination.

One event can have multiple deliveries. Its processing state and each destination's delivery state are separate. An event can be processed even when one delivery is pending, retrying, delivered or in the DLQ.

### Does Relayon guarantee exactly-once delivery?

No. The system is designed around deduplication and at-least-once-style processing behavior, but it does not provide a global exactly-once guarantee across Redis, MongoDB, PostgreSQL and third-party providers.

A worker crash, network timeout or provider ambiguity can create cases where an operation may be attempted again. Destinations should be made idempotent where possible.

### How does duplicate prevention work?

Ingress uses Redis-backed idempotency coordination. The current implementation can use an `X-Idempotency-Key` header or a request-derived correlation identifier as part of its idempotency handling. The atomic Redis operation also coordinates rate limiting and queue insertion.

This prevents many duplicate ingests, but consumers should not treat it as a universal exactly-once guarantee. Provider retries, key choice and retention windows matter.

### What happens when a worker crashes?

Work is coordinated through persistent infrastructure rather than only in-process memory. The worker and queue recovery design handles interrupted work and retries, but recovery is bounded by the state still available in Redis and the databases. Operators should monitor queue age, pending work and worker health.

### What is the retry policy?

Deliveries use destination retry configuration and delayed retry scheduling. The worker classifies failures and schedules retryable deliveries; repeated failures can exhaust the configured attempts and move the delivery to the DLQ.

Do not assume every error is retryable or that all destinations have identical provider rate limits. Inspect the destination's retry policy and the worker's current error classification.

### What is the Dead Letter Queue?

The DLQ holds deliveries that exhausted their retry path or otherwise reached a terminal failure state. Operators can inspect the error, correct destination configuration or permissions, and replay the delivery where supported. Replaying a delivery can cause the destination to receive it again; use idempotency at the destination when duplicate side effects would be harmful.

### What is the circuit breaker?

The delivery layer includes circuit-breaker behavior intended to stop repeatedly calling an unhealthy destination. It is a protection mechanism, not a replacement for fixing the destination or monitoring its state. Consult the current worker implementation and operational logs for the exact thresholds in the deployed revision.

### Does a successful HTTP 2xx mean the business operation completed?

No. It means the destination adapter received a successful HTTP response according to its contract. The destination may still queue, reject later, or fail its own downstream processing.

---

## Sources and Destinations

### Which incoming sources are supported for signature verification?

The audited ingress implementation documents five source types:

- Stripe
- GitHub
- Shopify
- Slack
- Generic HMAC

The verifier uses timing-safe comparison. Timestamp-based checks apply to source formats that provide timestamps, with a documented default tolerance of 300 seconds. Exact header formats and verification rules are source-specific.

### Can I receive a webhook from a provider that is not in that list?

The generic HMAC source type provides a general signed-webhook path. It does not automatically implement every vendor's proprietary signature scheme. If a provider uses a different authentication protocol, verify whether the current ingress source supports it before relying on it.

### Which built-in destination adapters are included?

The current core adapter catalogue documented in the source includes nine built-in adapters:

1. HTTP
2. Slack
3. Email (Resend)
4. Google Sheets
5. Discord
6. Airtable
7. Notion
8. PostgreSQL
9. MongoDB

The repository also contains an external adapter loading mechanism. Do not count an externally supplied adapter as a built-in provider integration.

### Can I add a custom destination adapter?

The worker adapter registry and external adapter loader provide extension points. Adapter code must follow the expected adapter contract and error behavior. It must also honor the dry-run contract: validation must not accidentally send a real message, email, insert or other side effect.

The external adapter execution controls include worker-thread/time and memory boundaries. They should not be described as a hardened OS/container security sandbox. Only load code you trust and apply deployment-level isolation appropriate to your threat model.

### Does “Test connection” send a real message or write a record?

The destination validation path has schema validation and optional worker-side dry-run behavior. The dry-run contract is designed to avoid real destination writes. The probe depends on adapter type:

- HTTP uses a request without a delivery body (documented as a `HEAD` probe).
- Email uses a provider authentication/API check rather than sending an email.
- Google Sheets checks spreadsheet metadata rather than appending a row.
- Airtable checks base/table metadata rather than creating a record.
- Notion checks data-source metadata rather than creating a page.
- PostgreSQL uses a read-only connectivity check such as `SELECT 1`.
- MongoDB uses a ping rather than inserting a document.
- Slack and Discord webhook URLs cannot be safely verified with a real message-free webhook request; validation can report configuration shape without proving the webhook will accept a message.

Adapter probe details can change with provider APIs. Verify the adapter implementation in the deployed revision before treating a validation result as a full end-to-end test.

### Does a green dry-run guarantee the real delivery will work?

No. A dry-run validates configuration shape and, where possible, basic reachability or authentication. It does not test the actual payload mapping, destination-side business rules, real message delivery, provider rate limits at send time or downstream processing.

Always perform a controlled end-to-end test before relying on a new destination in production.

### Does Relayon support custom JSON transformations?

Yes. The event pipeline supports JSONata-based transformation. The expression is evaluated by the worker processing path with bounded execution behavior. A transform error should be inspected in the event/worker logs; it does not mean the original source payload was malformed.

### Can I route events conditionally?

Yes. Workflow routing rules can evaluate JSONata expressions and select destination IDs. If no routing rule matches, the event may be processed without creating deliveries for destinations. Review the workflow's rules and event processing details when an event has no expected deliveries.

---

## AI, RAG and BYOK

### What AI features exist?

The source includes AI event enrichment and a separate AI assistant. Event enrichment operates in the workflow processing pipeline. The assistant supports conversational help and registered tool actions. They are different features with different permissions and execution paths.

### Which AI providers can tenants connect?

The tenant integration provider types documented in the current source include:

- Groq
- OpenAI
- Anthropic
- Resend (email provider integration)

Provider support and the operations available for each provider are not necessarily identical. The provider resolver and validators define the current behavior.

### What does BYOK mean?

BYOK means **Bring Your Own Key**. A tenant can save its own supported provider key so eligible features use that provider account rather than relying only on the platform-level environment key.

BYOK provider keys are different from destination credentials. For example, an OpenAI key used for AI features is not the same thing as a Slack webhook URL used by a workflow destination.

### How does provider key selection work?

The audited resolver follows this general order:

1. Look for an active integration key for the current tenant and provider.
2. Decrypt the tenant key in the tenant context.
3. If no usable tenant key exists, fall back to the platform environment key for that provider.
4. Cache the resolved result briefly (documented as 60 seconds) and invalidate it when integration settings change.

Provider key validation calls the provider's API with a bounded timeout and returns a validation result. Only authorized tenant roles (owner/admin) can manage integration keys through the integration controller.

### Does the AI assistant use vector embeddings?

Do not describe the audited RAG implementation as vector or embedding similarity search. The current `RagService` uses **PostgreSQL full-text search** with fallback tiers:

1. `websearch_to_tsquery`
2. `plainto_tsquery`
3. Keyword OR matching
4. Full-phrase `ILIKE`

Knowledge retrieval applies tenant-aware filtering so shared knowledge and tenant-specific knowledge are searched under the current access condition. The inspected implementation does not use an embedding database for this retrieval path.

### Can AI output be trusted as authoritative data?

No. AI output is probabilistic and may be incomplete or incorrect. Validate AI-derived fields before using them for financial, security-sensitive or irreversible actions. The workflow's source payload remains the authoritative input from the source provider.

### What happens if an AI provider is unavailable?

Provider availability, tenant key validity, platform fallback configuration, rate limits and provider quotas all affect AI operations. AI enrichment has graceful-degradation behavior in the processing path, but do not assume every assistant action or provider-dependent feature can complete without the provider. Check worker/API logs and the integration validation result.

### Is prompt injection completely solved?

No system should claim that. Workflow prompts and retrieved or event-provided content can influence model output. Treat AI output as untrusted input, restrict tool permissions, validate structured outputs and do not let model-generated text bypass normal authorization or business validation.

---

## Schedules, Versions and Configuration

### Can a workflow run without an incoming webhook?

Yes. A workflow can be triggered by a database-backed schedule. The schedule stores a cron expression, timezone, payload template, active state and next/last run timestamps. The generated event then enters the normal processing pipeline.

### Are schedules stored in process memory?

No. The schedule state is persisted in PostgreSQL. Workers claim due schedules using database coordination so multiple ticks do not simply rely on a local in-memory timer.

### Can I trigger a scheduled workflow immediately?

The product includes a run-now operation. It triggers a schedule without waiting for its next cron time. The normal scheduled cadence is maintained separately from the manual trigger.

### What timezone format is used?

Schedules use IANA timezone identifiers, for example `Asia/Karachi` or `America/New_York`. Use a valid IANA name rather than a numeric offset if the schedule needs daylight-saving-aware behavior.

### Does the scheduler run by itself on every deployment?

The scheduler requires the appropriate worker tick to be invoked. In serverless deployments this generally means a configured external scheduler/cron invoking the internal schedule route. In the Docker Compose deployment, the cron sidecar invokes the worker operations on a loop. If the tick is not running, due schedules will not execute merely because their database rows exist.

### Does Relayon keep workflow history?

Yes. Workflow versioning stores immutable configuration snapshots for supported create/update/import/restore operations. The dashboard can show history and compare versions. A restore creates a new version rather than rewriting the historical sequence.

### Is version diff semantic?

No. The documented diff is line-based. Whitespace or formatting changes can appear even when the effective configuration behavior is equivalent.

### Can workflows be imported or synchronized as YAML/Git configuration?

The project history and source include workflow YAML/Git sync functionality. Exact commands, schema and supported synchronization modes should be taken from the current CLI/docs in the same source revision; do not assume every dashboard setting is represented in the YAML format.

### Is time-travel a database point-in-time restore?

No. The platform's time-travel feature should not be confused with a complete PostgreSQL/MongoDB point-in-time recovery system. It is a product-level historical/inspection capability with the limits of the data and snapshots it records.

---

## SDK, CLI, Playground and Tunnels

### Is there a TypeScript SDK?

Yes. The repository contains `packages/sdk`, a typed TypeScript SDK generated from the OpenAPI specification. Use the SDK version compatible with the API deployment. If routes or response schemas have changed, regenerate or update the SDK from the matching OpenAPI document.

### Is there a CLI?

Yes. The repository contains `packages/cli`. One of its documented developer capabilities is opening a tunnel so a hosted ingress endpoint can forward test webhooks to a local development service.

### What is the tunnel used for?

A tunnel lets a developer test local webhook handling without deploying the local application publicly. The CLI establishes the session and the platform's ingress/tunnel components coordinate request forwarding. Tunnel URLs and sessions should be treated as temporary development access, not permanent production ingress endpoints.

### What is the playground?

The playground captures requests for debugging and exposes them through the dashboard's playground experience. It is useful for inspecting request shape and testing integrations. It is not a substitute for signature verification and end-to-end tests against the actual source provider.

### Are SDK and CLI licenses the same as MIT?

Do not infer licensing from old badges or metadata. The audited repository contains a proprietary source-visible license, and copies of that license are present in the SDK and CLI packages. Read the checked-in `LICENSE` and the package-specific notices before using, modifying, redistributing or embedding these packages.

---

## Dashboard, PWA and Community

### What can I manage from the dashboard?

The audited dashboard includes feature areas for workflows, events, destinations, schedules, workflow versions, DLQ, analytics, settings, AI assistant, community, playground and platform administration. The exact menu items depend on role, feature flags and deployment configuration.

### Does Relayon have an admin console?

Yes. The repository includes platform administration UI and API modules. The audited feature map includes platform overview, tenants, users, health/traffic, audit-related views, moderation, impersonation, feature flags and time-travel tools. These are privileged capabilities and must be restricted to authorized platform administrators.

### Does Relayon have community features?

The source includes community posts, replies, solution marking, likes, flags, moderation actions, announcement sharing and template import-related functionality. Availability and moderation behavior depend on the deployed feature configuration.

### Does Relayon support multiple languages?

The audited dashboard translation bundle includes English, Urdu and Arabic dictionaries. Urdu and Arabic views support right-to-left presentation where configured. Do not claim that every page, server message or third-party provider response is fully localized.

### Is Relayon a native mobile app?

No native iOS or Android application is established by the audited source. The dashboard includes PWA-related support such as install prompts, update notifications, network status/offline messaging and service-worker caching behavior.

### Does PWA support mean the entire dashboard works offline?

No. Installability and selected offline/network behaviors do not imply full offline operation. Authenticated data, API actions, event processing and provider calls still require their relevant services.

### Does the dashboard use server-side rendering?

The repository contains SSR/prerender and SEO-related dashboard files and services. That does not mean every authenticated dashboard route is server-rendered. Check the route/render configuration for the specific page.

---

## Authentication and Security

### Which authentication methods exist?

The audited source includes password-based authentication, refresh-token handling, Google/GitHub OAuth-related flows, email verification and password recovery. API keys provide programmatic access with scopes. Exact login options depend on environment configuration and the enabled provider credentials.

### Are API keys supported?

Yes. API keys are stored with metadata such as environment, scopes, expiry/revocation and rotation lineage. The raw secret is not intended to be retrievable after creation. Copy it when it is issued and store it in a secret manager.

### Are API keys equivalent to user passwords?

No. API keys are programmatic credentials with their own scopes and lifecycle. Use the narrowest scopes required, protect the raw key and revoke/rotate it if exposed.

### Are credentials encrypted at rest?

The project implements credential encryption using AES-256-GCM and tenant-derived keys via HKDF, with key identifiers to support keyring-based rotation. This protection applies to supported persisted credential values. It does not mean the server never sees plaintext: the service must decrypt a credential when it uses that credential to call a provider.

### Are webhook payloads end-to-end encrypted?

Do not claim end-to-end encryption. Relayon processes payloads, transforms them and delivers them, so the runtime must be able to read the data. Database encryption-at-rest and transport encryption are different from end-to-end encryption.

### Is every database table protected by PostgreSQL RLS?

No. The repository contains explicit PostgreSQL RLS policies and an apply script, but the audited policy coverage is not universal across every table. RLS is one layer of defense in depth; tenant-scoped application queries and authorization checks remain essential. Do not describe the database as having blanket RLS coverage.

### Is tenant isolation guaranteed by RLS alone?

No. Tenant isolation combines application-level tenant scoping, authorization and selected database RLS policies. Privileged admin paths require especially careful authorization. RLS should not be treated as a substitute for checking the caller's role and tenant context.

### Is the external adapter loader a hardened sandbox?

No. The audited controls include worker-thread execution and time/memory boundaries. These are useful execution controls but are not equivalent to an OS-level container/VM sandbox. Only load trusted adapter code and apply additional isolation for untrusted workloads.

### Does Relayon have SOC 2, HIPAA or GDPR certification?

The audited source snapshot does not establish SOC 2 or HIPAA certification. GDPR compliance is not something that can be inferred from the presence of privacy pages or security controls. Compliance requires organizational processes, contracts, policies, operational evidence and, where applicable, independent assessment. Do not treat this FAQ as a compliance attestation.

### Does Relayon guarantee an SLA?

No SLA is established by this source snapshot. Hosted service availability and response commitments should be taken only from an explicit current service agreement.

### What should I do if a credential or encryption key is exposed?

Treat the incident as a secret compromise:

1. Restrict access and stop further exposure.
2. Rotate the affected platform/provider credential using the provider's own controls.
3. Update the Relayon environment or tenant integration value.
4. If an encryption keyring key was exposed, preserve required old key material long enough to decrypt existing ciphertext, then follow the controlled re-encryption/rotation procedure.
5. Regenerate destination credentials that may have been decrypted by an attacker.
6. Review access, application and provider logs for suspicious use.
7. Document the incident and verify that all services use the intended keyring.

Do not remove an old encryption key before confirming that all ciphertext encrypted under its key ID has been migrated or is no longer needed.

---

## Data, Reliability and Performance

### Which databases does Relayon use?

The audited architecture uses three main stores:

| Store | Primary responsibility |
|---|---|
| PostgreSQL | Transactional/control-plane records such as tenants, users, workflows, destinations, schedules, versions, API keys, integrations, outbox and product metadata. |
| MongoDB | Flexible event and delivery documents, including payload-oriented records. |
| Redis | Queues, idempotency/rate-limit coordination, caches, streams and short-lived operational state. |

They are separate systems with different data ownership and failure modes. They are not interchangeable replicas.

### Why use both PostgreSQL and MongoDB?

PostgreSQL handles relational ownership, constraints and transactional state. MongoDB handles flexible event/delivery documents and variable payload shapes. The split avoids forcing every source payload into a rigid relational schema, but it introduces cross-store coordination and operational complexity.

### Is Redis the permanent source of truth for workflows?

No. Workflow configuration and other durable control-plane records are stored in PostgreSQL. Redis is used for queues and coordination. Redis persistence and recovery still matter because queued work and ephemeral coordination state can be affected by Redis availability and configuration.

### What happens if Redis is unavailable?

Ingress cannot safely complete the normal atomic queue-acceptance path. Requests may be rejected rather than acknowledged as accepted. Workers also depend on Redis for queue coordination. Restore Redis connectivity and inspect source-provider retries and queue state before assuming every event was accepted.

### What happens if MongoDB is unavailable?

Event and delivery persistence can fail even if an event was accepted into Redis. Check worker errors and queue recovery behavior. Do not manually discard queued work until you understand whether the event was persisted and whether reprocessing could duplicate side effects.

### What happens if PostgreSQL is unavailable?

Control-plane operations that need tenant/workflow/destination/schedule data can fail. Workers may also need PostgreSQL to load current configuration or claim schedules. Restore database availability and validate migrations/connection limits before resuming normal traffic.

### Does Relayon support multi-region active-active processing?

The audited v3.7.0 source describes a single-region deployment. It does not establish a globally coordinated active-active architecture with cross-region queues and replicated state. Treat multi-region as future infrastructure work unless a later implementation explicitly documents and tests it.

### Does the platform have unlimited event retention?

No. Event retention and analytics depend on the MongoDB configuration and retention policy, along with the capacity and backup plan of the deployment. MongoDB TTL behavior is not a long-term analytics warehouse. Export or archive data separately if long-term retention is required.

### How should I think about throughput?

Throughput depends on worker invocation frequency, batch/time budgets, Redis and database capacity, provider latency, rate limits, payload size and concurrency. Increasing batch size can improve throughput but also increases memory/network use and the risk of exhausting an invocation budget. Tune using observed queue age, worker duration, error rates and provider latency rather than a fixed events-per-day claim.

### Does a delivery response prove the destination stored the data?

No. It proves only what the adapter can observe from the destination response. If the destination asynchronously processes requests, a later failure may not be visible to Relayon.

---

## Deployment and Operations

### What deployment options are documented?

The source supports two broad deployment models:

- **Split serverless deployment:** dashboard, API, ingress and workers deployed as separate services/functions.
- **Docker Compose:** containerized application services with supporting infrastructure and a cron sidecar to invoke worker operations.

The Docker path is a real repository deployment option; do not describe self-hosted Docker as merely planned.

### Does the serverless deployment need cron?

Yes. Background processing and scheduled workflows require the worker operations to be invoked. Serverless functions do not remain alive as permanent background daemons. Configure an external scheduler for the required internal worker routes and protect them with the configured cron secret.

### Which worker routes are important operationally?

The audited architecture identifies these worker operations:

- `POST /internal/process`
- `POST /internal/deliver`
- `POST /internal/schedule/tick`
- `POST /internal/schedule/run-now`
- `POST /internal/egress/dry-run`

The API also has an outbox tick route for customer-facing webhook delivery. Verify exact route paths and authorization requirements against the deployed controllers/OpenAPI before configuring an external scheduler.

### What does the Docker Compose cron sidecar do?

The audited Compose deployment uses a cron sidecar to invoke recurring internal operations, including event processing, delivery, schedule ticks and the API outbox tick. This is how the container deployment keeps background work moving without depending on serverless invocation schedules.

### Which services need the encryption keyring?

The API and Workers must be configured consistently with the encryption key material needed to read and write encrypted credentials. A mismatch can make previously stored credentials unreadable. Keep keyring values in a secret manager and deploy coordinated changes.

### What should I monitor?

At minimum:

- Dashboard, API, ingress and worker health.
- PostgreSQL, MongoDB and Redis connectivity.
- Incoming queue depth and oldest queued-event age.
- Pending/delayed delivery counts and retry backlog.
- DLQ count and oldest DLQ age.
- Worker duration, failures and timeouts.
- Schedule tick freshness and overdue schedules.
- Outbox backlog and oldest pending outbox event.
- AI provider validation, quota and rate-limit failures.
- Destination provider errors and circuit-breaker state.
- Database connection pressure, storage and backup status.
- Secret/keyring consistency across API and Workers.

### Are health endpoints enough for monitoring?

No. Health endpoints are useful checks, but queue age, DLQ growth, schedule freshness, outbox backlog and provider-specific errors require application-level monitoring. A service can be reachable while its background work is stalled.

### Do I need backups?

Yes. The operator is responsible for backup and restore planning appropriate to the chosen infrastructure. Back up PostgreSQL and MongoDB, and plan Redis persistence/recovery based on the role of Redis in the deployment. Test restoration procedures; a backup that has never been restored is not a verified recovery plan.

---

## Testing and Development

### Does the project have unit tests?

The v3.7.0 repository contains test/spec files and a Tests workflow. The old FAQ statement that the project had zero unit tests is stale and must not be carried forward.

The existence of tests does not mean every module or edge case is covered. Review the current test suite, CI output and coverage reports for the exact tested areas.

### What does CI test?

The audited repository's Tests workflow includes unit/coverage, integration and RLS-related jobs. Other CI workflows handle build/typecheck or repository validation tasks. Exact job names and gates can change; inspect `.github/workflows/` at the target commit.

### Does a passing CI run prove production correctness?

No. CI validates the test cases and build checks that are actually configured. It cannot guarantee every third-party provider behavior, production secret, DNS/network path, deployment setting or customer payload.

### How do I run the project locally?

The repository is an npm-workspaces monorepo. Use the root package scripts and workspace-specific instructions from the checked-out source revision. A typical local setup requires:

- A supported Node.js runtime and npm.
- PostgreSQL with the current Prisma migrations applied.
- MongoDB.
- Redis.
- Required environment variables and provider credentials for the features being tested.
- Dashboard/API/Ingress/Workers workspace processes as needed.

Do not copy old version-specific commands blindly; check the current root `package.json`, app package manifests and deployment docs.

### Which Node.js version should I use?

Use the version declared by the current repository toolchain and CI configuration. The audited source contains Node 20 Docker base images and Node 22 CI usage; check the current Dockerfiles, workflow files and package engine constraints before selecting a local runtime. These version declarations serve different environments and should not be silently conflated.

### Where should I report a bug?

Open an issue in the repository with a minimal reproduction, expected behavior, actual behavior, relevant version/commit, logs with secrets removed and steps to reproduce. Never attach live API keys, signing secrets, database URLs or customer payloads containing sensitive data.

---

## Pricing, Limits and Licensing

### Is Relayon free?

The source repository is available for inspection, but hosted infrastructure costs depend on the provider plans and usage chosen by the operator. The older FAQ's blanket `$0/month` statement and fixed free-tier capacity estimates are not reliable guarantees for v3.7.0.

Check the current Vercel, database, Redis, AI-provider, email-provider and monitoring plan terms directly. Free tiers can change, enforce fair-use restrictions or stop being suitable as traffic grows.

### Are there fixed event-per-day limits?

Do not rely on a universal event-per-day number. Effective capacity depends on deployment resources, queue invocation frequency, worker batch/time budgets, database connection limits, Redis quotas, payload size and third-party provider limits. Tenant quotas may also apply according to the deployed configuration.

### Does Relayon include an SLA?

No SLA should be inferred from the source code or from a hosted demo URL. Only a current written service agreement can establish an SLA.

### What license applies to the repository?

The audited root `LICENSE` is titled **Relayon Proprietary Source-Visible License v1.0**, effective 20 November 2026. It is not the MIT license. The license grants the permissions and imposes the restrictions written in that file. Read the actual license before copying, modifying, redistributing, offering derivative hosted services or using the code in another product.

### Why do some files still say MIT?

The audit found stale MIT labels in some project metadata, including the root README badge and Swagger/OpenAPI metadata, even though the checked-in `LICENSE` is proprietary source-visible. Treat the actual checked-in license text as the governing repository license and flag the metadata inconsistency for correction. Do not rely on an old badge as a grant of rights.

### Can I commercially use or redistribute Relayon?

Do not assume the old MIT-era FAQ permission still applies. The current proprietary source-visible license contains specific terms and restrictions. Read it carefully and obtain legal advice if your intended use involves commercial hosting, modification, redistribution, derivative works or competing services.

---

## Troubleshooting

### Webhooks return `401` or signature verification fails

Check:

1. The workflow uses the correct source type.
2. The configured secret is the provider's webhook signing secret, not an unrelated API key.
3. The expected signature header and format match that provider.
4. The original request body bytes are preserved by any proxy/middleware.
5. Timestamp tolerance and server clock are correct for timestamped signatures.
6. The secret has not been rotated at the provider without updating the workflow.

Inspect ingress logs with the correlation/request ID. Never log or paste the signing secret.

### The source receives an error instead of an acknowledgement

Check workflow lookup, signature verification, tenant quota, rate limiting and Redis connectivity. Ingress only acknowledges after its queue-acceptance path succeeds. If Redis is unavailable or the atomic ingest operation fails, the source should not be told the event was accepted.

### Events are accepted but not processed

Check:

- Workers health and deployment status.
- Whether `POST /internal/process` is being invoked.
- Redis incoming/processing queue depth and oldest age.
- PostgreSQL/MongoDB connectivity.
- `CRON_SECRET` and scheduler configuration.
- Worker logs for processing errors and time-budget exhaustion.

### Deliveries remain pending

Check whether the delivery worker route is being invoked, whether the egress queue is draining, and whether the destination adapter is blocked by provider errors or circuit-breaker behavior. Confirm the worker service can reach the destination host.

### A delivery repeatedly fails

Inspect the adapter error, credentials, endpoint URL, provider permissions, request/payload mapping, provider rate limits and retry classification. Correct the underlying issue before replaying. Replays can cause repeated side effects.

### Deliveries appear in the DLQ

The configured retry path has been exhausted or the delivery reached a terminal failure. Inspect the error and destination configuration, fix the cause, then replay only when it is safe to do so. Consider destination-side idempotency for duplicate protection.

### Scheduled workflows do not fire

Check:

1. The schedule is active.
2. The workflow is active.
3. The cron expression and IANA timezone are valid.
4. `nextRunAt` is due.
5. The schedule tick route is invoked by external cron or the Compose cron sidecar.
6. The worker has database and Redis connectivity.
7. The cron secret matches.

A schedule row by itself does not run a background timer in a serverless process.

### AI enrichment or assistant calls fail

Check the tenant BYOK key, provider validation result, platform fallback key, provider quota/rate limit, selected model and API/worker logs. Remember that event enrichment and the assistant are separate features and may use different code paths.

### A stored credential cannot be decrypted

Check that API and Workers have the correct encryption keyring and that every required key ID remains available. Do not delete an old key merely because a new key has been added. Restore the missing key material or follow the controlled re-encryption process before removing old key IDs.

### RAG does not return an expected result

The audited retrieval path uses PostgreSQL full-text search with keyword and phrase fallbacks, not vector embeddings. Check that the knowledge chunk exists, its tenant visibility is correct, the content is indexed and the query terms match the stored text.

### A custom adapter times out or is terminated

Check the adapter contract, execution duration, memory use and worker logs. The external loader has bounded execution controls, but those controls are not a full OS sandbox. Test the adapter in an isolated development environment and avoid loading untrusted code.

### PWA says offline but the dashboard action fails

PWA network/offline messaging and service-worker caching do not make all authenticated features available offline. Restore network connectivity and retry the action after confirming whether it was already submitted.

---

## Roadmap and Project Status

### What is the current version?

The audited project snapshot is **v3.7.0**, associated with commit `f4dd930eafd2ab61381bc1c049bb6cdbb7480235` on 24 November 2026.

### Why does the old documentation still say v1.5.0?

Several documentation files were last comprehensively updated during the v1.5 era, even though the repository history and code continued through later v2.x and v3.x tags. This FAQ is intended to replace the old v1.5 product-state answers with the audited v3.7.0 scope.

### Is v3.7.0 the final project version?

The audited project notes describe v3.7.0 as the project's completed/final snapshot as of 24 November 2026. That is a statement about the audited project state, not a promise that no future maintenance, fixes or releases can ever occur.

### Are there future feature commitments?

Do not treat older v2.0/v3.0 roadmap bullets as current commitments. The old roadmap predates many shipped features and is stale relative to the v3.7.0 source. Any future work should be confirmed through current repository issues, tags and maintainer statements.

---

## Contributing and Support

### Can I report bugs or request features?

Use the repository's issue tracker:

- [GitHub Issues](https://github.com/zainshah3464/relayon/issues)
- [GitHub Discussions](https://github.com/zainshah3464/relayon/discussions)

Include the version/commit, a concise problem statement, reproduction steps and sanitized logs. Feature requests are easier to evaluate when they explain the user problem, proposed behavior, alternatives and acceptance criteria.

### Can I submit AI-generated code?

A contributor is responsible for understanding, testing and maintaining every submitted line, regardless of how it was written. Adapter contributions must honor the adapter contract and must never perform real destination writes during a dry-run validation.

### How should I report a security issue?

Do not publish credentials, exploit details or customer data in a public issue. Use the repository's current private security-reporting process or the maintainer's verified security contact. Confirm the contact address from the current repository before sending sensitive details.

### What information should never be included in a support request?

Do not include:

- Passwords or refresh tokens.
- Raw API keys or provider keys.
- Webhook signing secrets.
- Encryption keyring values.
- Database connection strings.
- Private customer payloads or personal data.
- Unredacted authorization headers.

Use placeholders and redact tenant/user identifiers where they are not necessary for debugging.

---

## Technical References

The following links are pinned to the audited source snapshot where practical. If a deployment is running a different commit, inspect that commit rather than assuming the same implementation.

### Product and live endpoints

- [GitHub repository](https://github.com/zainshah3464/relayon)
- [Audited source commit](https://github.com/zainshah3464/relayon/commit/f4dd930eafd2ab61381bc1c049bb6cdbb7480235)
- [Hosted dashboard](https://relayon.vercel.app)
- [API health](https://relayon-api.vercel.app/api/health)
- [Ingress health](https://relayon-ingress.vercel.app/health)
- [Workers health](https://relayon-workers.vercel.app/internal/health)
- [Swagger UI](https://relayon-api.vercel.app/api/docs)
- [OpenAPI JSON](https://relayon-api.vercel.app/api/openapi.json)

### Core documentation

- [Architecture](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docs/ARCHITECTURE.md)
- [API reference](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docs/API_REFERENCE.md)
- [Database guide](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docs/DATABASE.md)
- [Security guide](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docs/SECURITY.md)
- [Deployment guide](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/DEPLOYMENT.md)
- [Testing guide](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docs/TESTING.md)
- [Changelog](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docs/CHANGELOG.md)
- [Roadmap](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docs/ROADMAP.md)
- [Troubleshooting](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docs/TROUBLESHOOTING.md)
- [Quick user guide](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docs/relayon-guide.md)
- [Workflow examples](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docs/workflow-examples.md)

### Important source areas

- [Dashboard](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/dashboard)
- [API](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/api)
- [Ingress](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/ingress)
- [Workers](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/apps/workers)
- [Prisma schema](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/packages/db/prisma/schema.prisma)
- [RLS policies](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/packages/db/prisma/rls/policies.sql)
- [SDK](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/packages/sdk)
- [CLI](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/packages/cli)
- [Docker Compose](https://github.com/zainshah3464/relayon/blob/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/docker-compose.yml)
- [GitHub Actions](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/.github/workflows)
- [Tests](https://github.com/zainshah3464/relayon/tree/f4dd930eafd2ab61381bc1c049bb6cdbb7480235/test)

---

**Last updated:** 2026-11-25  
**FAQ version:** v3.7.0  
**Basis:** Relayon source snapshot `f4dd930eafd2ab61381bc1c049bb6cdbb7480235` and the uploaded v1.5.0 FAQ, reconciled against the v3.7.0 architecture/features audit.

**Maintenance note:** When the source changes, re-check route paths, provider support, environment variables, test coverage, license metadata and deployment behavior before changing this FAQ. Do not copy old v1.5 claims forward without verification.
