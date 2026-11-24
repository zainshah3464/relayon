# Contributing to Relayon

> **Contribution guide for Relayon v3.7.0 — reporting issues, working in the monorepo, testing changes, and submitting pull requests.**
>
> **Current version:** v3.7.0  
> **Repository:** [github.com/zainshah3464/relayon](https://github.com/zainshah3464/relayon)

Relayon is a source-available project governed by the **Relayon Proprietary Source-Visible License v1.0**. The repository is publicly viewable, but it is **not an open-source-licensed project**. Before preparing or submitting a contribution, read the repository's [`LICENSE`](../LICENSE) in full, especially its rules about modifications, written permission, attribution, and contributions.

> **Important — contribution terms:** Section 2.3 of the current license states that code, documentation, or assets contributed through a Pull Request are assigned to the Licensor upon merge. Do not rely on this guide as a substitute for the full license or legal advice. If you are unsure whether your proposed contribution is permitted, contact the maintainer before doing the work.

This guide describes the repository workflow and engineering expectations. It does not grant rights beyond the license.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Before You Start](#before-you-start)
- [Development Setup](#development-setup)
- [Repository Layout](#repository-layout)
- [Making Changes](#making-changes)
- [Testing and Verification](#testing-and-verification)
- [Adding or Changing Destination Adapters](#adding-or-changing-destination-adapters)
- [Security-Sensitive Changes](#security-sensitive-changes)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Review Expectations](#review-expectations)
- [What We Look For](#what-we-look-for)
- [What We Will Not Accept](#what-we-will-not-accept)
- [Getting Help](#getting-help)
- [License and Attribution](#license-and-attribution)

---

## Code of Conduct

Be respectful, honest, and constructive. Assume good faith, and keep discussions focused on the work.

- **No condescension.** Explain technical concerns without insulting contributors.
- **No gatekeeping.** Clear, reproducible reports and focused documentation fixes are valuable.
- **Critique code, not people.** Describe the defect, risk, or trade-off.
- **Ask before assuming.** Discuss architectural changes before replacing established patterns.
- **Respect security reports.** Do not publish exploitable details before coordinating a fix.

Harassment, abuse, or repeated bad-faith behavior may result in participation being restricted.

---

## Ways to Contribute

You do not need to submit application code to help.

| Contribution | Useful examples |
|---|---|
| Bug reports | Reproduction steps, expected/actual behavior, logs with secrets removed |
| Documentation | Clarify setup, API behavior, deployment constraints, or recovery steps |
| Testing | Add unit, integration, E2E, smoke, or regression coverage |
| Adapter work | Fix an existing destination adapter or add a supported integration |
| Reliability | Retry classification, idempotency, queue recovery, DLQ behavior |
| Security | Responsible vulnerability reports and narrowly scoped fixes |
| Developer tooling | SDK, CLI, workflow sync, build, or local-development improvements |
| Accessibility and UX | Keyboard behavior, readable errors, responsive layout, accessible controls |
| Performance | Reproducible profiling and before/after measurements |

When reporting a bug, include the Relayon version or commit, runtime/OS, the affected service, exact steps, expected result, actual result, and relevant redacted logs.

Do not attach real API keys, passwords, webhook secrets, customer payloads, database URLs, or personal data to issues or pull requests.

---

## Before You Start

1. Read the relevant documentation under [`docs/`](.).
2. Search existing issues and pull requests for the same problem.
3. For a small, isolated correction, prepare a focused change.
4. For a new capability, public API change, schema change, new adapter, or architectural change, open an issue or discussion first.
5. For license-sensitive work, confirm permission with the maintainer before modifying or redistributing the source.

A proposal should explain:

- The problem and who it affects.
- The expected behavior.
- The proposed implementation area.
- Compatibility or migration implications.
- Security, reliability, and operational risks.
- How the change can be tested.

Do not assume that a feature is on an active roadmap simply because it appeared in an older version of this guide. Check the current repository and discuss scope with the maintainer.

---

## Development Setup

### Prerequisites

| Requirement | Version / detail |
|---|---|
| Node.js | `>=20.0.0` according to the root `package.json`; CI currently uses Node 22 |
| npm | Use the npm version compatible with the committed lockfile |
| Git | Current stable version |
| PostgreSQL | Required for database-backed development |
| Redis | Required for queue-backed flows |
| MongoDB | Required for event and delivery data paths |
| Prisma | Pinned to `6.19.3` in the root package manifest |

Use Node 22 when you want to match the current GitHub Actions CI environment. The package engine declaration is `>=20.0.0`; do not interpret the CI version as a different package-engine requirement.

### Clone and install

```bash
git clone https://github.com/zainshah3464/relayon.git
cd relayon

npm ci
```

Use `npm ci` for a reproducible install when working from the committed lockfile. If you intentionally change dependencies, update the lockfile and explain why.

### Environment configuration

Start from the environment example files in the relevant app/package directories. Keep local secrets in ignored `.env` or `.env.local` files; never commit them.

The monorepo contains separate runtime applications and shared packages. Configure the services you intend to run, including the database, Redis, MongoDB, authentication, encryption, and any optional integrations required by the feature under development.

Important practices:

- Keep API and Workers encryption configuration compatible wherever both services need to decrypt the same stored credentials.
- Keep API-key hashing configuration stable for the lifetime of issued keys; changing a pepper can invalidate existing keys.
- Use distinct local/test credentials and destinations. Do not point test runs at production systems.
- Use dummy credentials or local test doubles for automated tests.
- Do not copy production `.env` files into issue attachments, logs, screenshots, or pull requests.

The exact required environment variables depend on the service and feature. Treat the current `.env.example` files and configuration validation in source as authoritative; this guide intentionally does not maintain a second, potentially stale environment-variable inventory.

### Generate the Prisma client and apply migrations

The root scripts delegate database operations to the `db` workspace:

```bash
npm run db:generate
npm run db:deploy
```

For local schema development where a new migration is intended:

```bash
npm run db:migrate -- --name describe_the_change
```

Review the generated migration before committing it. Do not edit an already-applied migration to change deployed database history; add a new migration instead.

The Prisma CLI and client are pinned to `6.19.3`. Use the repository scripts rather than installing an arbitrary global Prisma version.

### Run the applications

Run each service in its own terminal:

```bash
npm run dev:api
npm run dev:ingress
npm run dev:workers
npm run dev:dashboard
```

The current local development scripts use these expected ports:

| Application | Local port |
|---|---:|
| API | `3001` |
| Ingress | `3002` |
| Workers | `3003` |
| Dashboard | `4200` |

The Dashboard is available at `http://localhost:4200` when its dev server starts successfully. Some workflows require all four applications and their backing services; a dashboard-only UI change may need fewer services.

---

## Repository Layout

Relayon is an npm-workspaces monorepo. The principal application boundaries are:

| Path | Responsibility |
|---|---|
| `apps/dashboard/` | Angular dashboard |
| `apps/api/` | NestJS control-plane API |
| `apps/ingress/` | HTTP webhook ingress |
| `apps/workers/` | Processing, delivery, schedules, and worker-side integrations |
| `packages/db/` | Prisma schema, generated client integration, and database scripts |
| `packages/shared/` | Shared application code |
| `packages/sdk/` | SDK generation and package |
| `scripts/` | Repository maintenance, smoke tests, and workflow tooling |
| `test/` | Integration, E2E, and load-test assets |
| `docs/` | Product, API, architecture, deployment, security, and operations documentation |

Keep changes inside the correct ownership boundary. Shared contracts should not be duplicated independently across apps when a shared package is the appropriate place.

---

## Making Changes

### Branch naming

Use a short, descriptive branch name:

```text
feat/add-destination-capability
fix/handle-retry-boundary
docs/update-contributing-guide
test/cover-api-key-rotation
refactor/extract-shared-validator
chore/update-tooling
```

Recommended prefixes:

- `feat` — new behavior
- `fix` — bug fix
- `docs` — documentation-only change
- `test` — tests or test infrastructure
- `refactor` — restructuring without intended behavior change
- `perf` — performance improvement
- `chore` — maintenance and tooling
- `ci` — CI workflow changes

### Keep changes focused

- One logical change per branch and pull request.
- Avoid unrelated formatting or generated-file churn.
- Update documentation when behavior, configuration, APIs, or operational procedures change.
- Add or update migrations when persistent schema changes require them.
- Preserve backward compatibility unless a breaking change has been explicitly approved.
- Do not commit build output, local environment files, credentials, or machine-specific artifacts.

### Generated files and SDK

If a change affects the OpenAPI contract or SDK inputs, use the repository's SDK scripts and include the expected generated changes:

```bash
npm run sdk:generate
npm run sdk:build
```

Do not hand-edit generated SDK output when the source contract is the correct place to make the change. Review the diff to ensure generation did not introduce unrelated changes.

### Workflow configuration

The repository provides workflow synchronization scripts:

```bash
npm run workflows:pull
npm run workflows:validate
npm run workflows:push
```

Use the validation command before proposing workflow-definition changes. Be careful with `push`: confirm the target environment and intended workflow changes before running it.

---

## Testing and Verification

Relayon has more than one test layer. Choose the narrowest relevant test while developing, then run broader checks before submitting.

### Root commands

| Command | Purpose |
|---|---|
| `npm run typecheck` | Type-check workspaces that expose a typecheck script |
| `npm run lint` | Run workspace lint scripts where configured |
| `npm test` | Run the root Vitest unit-test configuration |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:ui` | Open the Vitest UI |
| `npm run test:coverage` | Run unit tests with V8 coverage |
| `npm run test:integration` | Run the integration-test configuration |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Run Playwright in UI mode |
| `npm run test:e2e:full` | Run the full E2E directory |
| `npm run test:mutation` | Run Stryker mutation testing |
| `npm run test:mutation:critical` | Run the configured critical-file mutation scope |
| `npm run test:load` | Run the webhook ingress k6 load scenario |
| `npm run test:load:sustained` | Run the sustained ingress scenario |
| `npm run test:load:burst` | Run the burst ingress scenario |
| `npm run test:load:delivery` | Run the delivery-throughput scenario |
| `npm run smoke` | Run the repository smoke-test script |
| `npm run test:all` | Run unit, integration, and E2E commands sequentially |

Some test layers need local infrastructure, environment variables, browser installation, or external test services. Read the relevant test configuration and test files before running them.

### Suggested verification sequence

For most code changes:

```bash
npm run typecheck
npm test
npm run build:dashboard
npm run build:api
npm run build:ingress
npm run build:workers
```

For changes that touch integration boundaries, also run the relevant integration tests:

```bash
npm run test:integration
```

For user-facing flows, run the applicable Playwright tests:

```bash
npm run test:e2e
```

For queue, ingress, or delivery performance work, use the relevant k6 scenario and include the workload, environment, and before/after results in the pull request.

For deployment-sensitive changes, run the smoke test only against an explicitly configured test or approved deployment. Never run destructive or write-capable checks against production without authorization.

### Be precise about test claims

- Report exactly which commands you ran.
- Include whether each command passed, failed, or was not run.
- Include relevant failure output, with secrets and personal data removed.
- Do not claim full coverage because a subset of tests passed.
- Do not claim that CI runs every local test layer unless the current workflow configuration confirms it.

The current `.github/workflows/ci.yml` workflow installs dependencies, generates the Prisma client and SDK, type-checks workspaces, and builds the Dashboard, API, Ingress, and Workers. Do not describe that workflow as automatically running the complete unit/integration/E2E/load suite unless the workflow itself has been updated to do so.

---

## Adding or Changing Destination Adapters

Relayon has nine built-in destination adapter classes in the current Workers egress module:

- HTTP
- Slack
- Email
- Google Sheets
- Discord
- Airtable
- Notion
- PostgreSQL
- MongoDB

The codebase also contains an external adapter loader. These are two different extension paths; choose the one that matches the intended contribution.

### Built-in adapter path

Built-in adapters implement the `DeliveryAdapter` contract from the Workers egress adapter types. The contract includes:

```typescript
export interface DeliveryContext {
  destinationId: string;
  destinationType: string;
  config: Record<string, unknown>;
  payload: unknown;
  correlationId: string;
  eventId: string;
  attemptNumber: number;
}

export interface AdapterResult {
  success: boolean;
  statusCode: number;
  latencyMs: number;
  responseBody: string;
  error: string | null;
  retryable: boolean;
}

export interface DeliveryAdapter {
  readonly type: string;
  send(ctx: DeliveryContext): Promise<AdapterResult>;
}
```

When adding a built-in adapter, review the current neighboring implementations and update every integration point required by the feature, which may include:

1. The adapter implementation and its registration metadata/decorator.
2. The Workers egress module provider list so NestJS instantiates the class.
3. Destination-type validation and configuration handling.
4. API response/configuration behavior, where applicable.
5. Dashboard destination selection and configuration UI.
6. Secret-field handling and encryption configuration, where applicable.
7. Tests, documentation, and any relevant API/SDK contract.

Do not assume that adding a class alone makes an adapter available end-to-end. Verify the registry, backend validation, persistence, and UI paths.

### Adapter result and retry behavior

Return a complete `AdapterResult` on every path. In particular:

- `success` must reflect the actual outcome.
- `statusCode` should reflect the upstream response where one exists; use the established convention in neighboring adapters when no response exists.
- `latencyMs` should be measured for the attempt.
- `responseBody` should be bounded and must not expose credentials or sensitive upstream data.
- `error` should be actionable and safe to log.
- `retryable` must distinguish transient failures from permanent configuration or validation failures.

Use existing retry and circuit-breaker behavior rather than introducing a second retry loop inside an adapter. Set timeouts and ensure network operations are bounded. Avoid logging authorization headers, connection strings, tokens, or complete secret-bearing configuration objects.

### Dry-run and validation safety

A connection test must not unexpectedly create, update, send, or delete customer data. Follow the existing dry-run contract and behavior used by the adapter registry and dashboard. If a destination cannot be safely probed without performing a write, make that limitation explicit and do not silently perform a real delivery.

A dry-run implementation must be reviewed for side effects, not merely for a successful HTTP status.

### External adapter path

The Workers code includes an external adapter loader that reads adapter directories from:

```text
RELAYON_EXTERNAL_ADAPTERS_DIR
```

If the variable is not set, the loader uses the `adapters` directory under the process working directory. Each external adapter directory is expected to contain a `manifest.json` and the JavaScript entrypoint declared by that manifest.

The current manifest schema requires:

- `schemaVersion: 1`
- A lowercase adapter `type` matching the schema's format
- `displayName`
- Semver `version`
- `trust`
- `author`
- A `.js` `entrypoint`
- A `fields` array describing configuration fields

The supported field types in the current schema are `text`, `url`, `password`, `email`, `textarea`, `number`, `boolean`, `select`, `json`, and `string-array`.

The entrypoint must export a default object with a `send` function. The sandbox runner passes configuration, payload, and a limited context containing event ID, correlation ID, and attempt number.

**Important sandbox limitation:** The implementation uses Node.js worker threads, resource limits, a timeout, and a constrained HTTPS request bridge. This is not equivalent to hardened operating-system or container isolation. Do not describe it as a security boundary that makes arbitrary untrusted code safe. External adapter code still requires careful review and controlled deployment.

The loader currently rejects external adapters that declare `trust: "trusted"` at execution time; use the supported sandboxed mode and validate against the actual manifest schema and runtime contract.

---

## Security-Sensitive Changes

Changes involving authentication, authorization, tenant boundaries, cryptography, secrets, webhook verification, queues, or adapter execution require extra scrutiny.

At minimum:

- Preserve tenant scoping on every read and write path.
- Use timing-safe comparison for secret/signature/hash comparisons where required.
- Validate webhook signatures against the exact raw body and provider-specific signing rules.
- Do not weaken encryption envelope validation or key-derivation boundaries.
- Do not introduce plaintext secret persistence or return secret material in API responses.
- Keep API and Workers encryption behavior compatible for shared encrypted data.
- Do not log credentials, raw API keys, tokens, private payloads, or decrypted configuration.
- Bound network calls and worker execution with timeouts.
- Treat external adapter code and webhook payloads as untrusted input.
- Add regression tests for both successful and rejected/failed paths.
- Document migration and key-rotation implications.

The project does not have universal row-level security coverage across every table. Do not assume that database RLS replaces application-level tenant authorization. Preserve the explicit authorization checks in the relevant service and query paths.

If a change touches the encryption implementation, API-key verification, signature verification, or sandbox execution, explain the threat model and the failure modes addressed in the pull request.

---

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```text
<type>(<scope>): <short summary>

<optional body>

<optional footer>
```

Examples:

```text
feat(adapters): add destination configuration support
fix(ingress): reject invalid webhook signatures
test(api): cover API key rotation expiry
docs(contributing): refresh v3.7 contribution guide
refactor(workers): centralize retry classification
perf(processing): reduce redundant workflow reads
chore(deps): update approved dependency
ci: add integration test job
```

Use a scope when it improves clarity, such as `api`, `ingress`, `workers`, `dashboard`, `db`, `shared`, `sdk`, `docs`, `crypto`, `adapters`, `schedule`, or `ci`.

Avoid vague messages such as `update code`, `fix stuff`, `changes`, or `WIP`.

---

## Pull Request Process

### 1. Create a focused branch

```bash
git checkout main
git pull origin main
git checkout -b docs/update-contributing-guide
```

Use the repository's current contribution and license rules before creating or publishing a fork or modified copy. The license restricts unauthorized modification and derivative works.

### 2. Make the change

- Keep the diff focused.
- Follow nearby code conventions.
- Add tests for changed behavior.
- Update docs and generated artifacts when required.
- Include migrations for schema changes.
- Remove temporary debugging code.

### 3. Verify locally

Run the applicable typecheck, tests, and builds. Record the exact commands and outcomes in the PR. Do not mark checks as passed if they were not run.

### 4. Commit

```bash
git add <relevant-files>
git commit -m "docs(contributing): update contribution guide"
```

Avoid `git add .` when unrelated local files may be present.

### 5. Push and open a pull request

Only publish a branch or derivative changes when your intended contribution is permitted under the current license and any required permission has been obtained.

When authorized:

```bash
git push -u origin docs/update-contributing-guide
```

Open a pull request against the repository's intended base branch and link the related issue or discussion.

### Pull request description template

```markdown
## Summary
What changed?

## Motivation
What problem does this solve?

## Implementation
Which areas changed? Mention important trade-offs.

## Compatibility / Migration
Does this change affect APIs, persisted data, configuration, SDKs, or deployments?

## Testing
- [ ] `npm run typecheck`
- [ ] Relevant unit tests
- [ ] Relevant integration tests
- [ ] Relevant E2E tests
- [ ] Relevant builds
- [ ] Manual verification (describe exact steps)
- [ ] No production credentials or customer data included

## Security and reliability
- [ ] Tenant authorization reviewed
- [ ] Secrets are not logged or returned
- [ ] Timeouts and retry behavior reviewed
- [ ] Dry-run/test-connection behavior is side-effect safe
- [ ] Migration and rollback implications documented, if applicable

## Documentation
List updated documentation or explain why none is needed.

## License
I have read the current Relayon license and confirmed that this contribution is permitted under its terms. I understand the contribution provisions that apply upon merge.
```

Do not copy a copyright-assignment checkbox from an older guide without reading the current license and understanding the terms.

---

## Review Expectations

Review focuses on correctness, maintainability, compatibility, and operational safety.

A reviewer may ask for:

- A smaller or more focused diff.
- Tests for failure cases and edge conditions.
- Evidence for performance claims.
- Clarification of API or schema compatibility.
- Better handling of secrets, retries, timeouts, and tenant boundaries.
- Documentation for new configuration or operational behavior.

A request for changes is part of the engineering process, not a personal judgment. Do not assume a review deadline or merge guarantee; timing depends on maintainer availability and the complexity of the change.

---

## What We Look For

High-value contributions generally improve:

- Correctness of webhook ingestion and signature verification.
- Event processing, delivery reliability, retry classification, and DLQ recovery.
- Tenant isolation, authentication, authorization, and secret handling.
- Adapter correctness, configuration validation, and safe connection testing.
- Workflow scheduling, versioning, import/export, and synchronization.
- API and SDK consistency.
- Dashboard accessibility, responsive behavior, and actionable error states.
- Automated regression coverage and reproducible performance improvements.
- Setup, deployment, troubleshooting, and security documentation.

A focused bug fix with a regression test is often more valuable than a broad refactor without measurable benefit.

---

## What We Will Not Accept

The following are grounds for rejection:

- Hard-coded credentials, tokens, private keys, or production data.
- Logging or returning plaintext secrets or sensitive customer payloads.
- Changes that bypass tenant authorization or weaken authentication.
- Non-timing-safe comparisons in security-sensitive paths where constant-time comparison is required.
- Adapter validation that unexpectedly writes to a live destination.
- Unbounded network requests, retry loops, or worker execution.
- Unreviewed changes to encryption formats or key-derivation behavior.
- Unsafe dynamic code execution such as `eval()` or `Function()` for user-controlled expressions.
- Tests that only assert mock calls without validating meaningful behavior.
- Unjustified dependencies, unrelated formatting churn, or sweeping cleanup without an agreed scope.
- Generated output edited by hand when the source contract or generator should be changed.
- Claims of test coverage, performance, security, or compatibility that are not supported by evidence.
- Changes that remove required copyright notices, attribution, or other license-required material.
- Contributions that conflict with the current license or lack required written permission.

For security-sensitive work, a good-faith explanation does not replace the need to preserve the relevant security guarantees.

---

## Getting Help

Use the repository's GitHub issue and discussion facilities for ordinary project questions, reproducible bugs, and proposed work.

For a suspected vulnerability, follow the private reporting instructions in [`SECURITY.md`](./SECURITY.md). Do not publish exploit details, secrets, or customer data in a public issue.

When asking for help, include:

- The version or commit you are using.
- The service or package involved.
- Minimal reproduction steps.
- Relevant redacted logs and error messages.
- What you already tried.

---

## License and Attribution

Relayon is governed by the **Relayon Proprietary Source-Visible License v1.0**, effective November 20, 2026, according to the repository license file. It is not distributed under the MIT License.

The license contains restrictions on modification, derivative works, redistribution, competing products, AI training, trademark use, and removal of copyright or attribution notices. It also defines the contribution assignment terms that apply upon merge.

Before contributing:

1. Read the complete [`LICENSE`](../LICENSE).
2. Confirm that the proposed activity is allowed.
3. Obtain written permission from the Licensor where the license requires it.
4. Ensure that any contribution does not contain third-party material that you are not authorized to submit.
5. Preserve all required copyright, attribution, and branding notices.

The license file is the authoritative legal document. If this guide and the license differ, the license controls. For license questions, contact the Licensor using the contact details in the license or repository documentation.

---

Thank you for taking the time to improve Relayon. Clear reports, careful tests, safe integrations, and accurate documentation all help make the project more reliable.
