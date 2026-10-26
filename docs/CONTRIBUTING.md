
# Contributing to Relayon

> **How to contribute to Relayon — from bug reports to pull requests.**
>
> **Current version:** v1.5.0

Relayon is an open-source project (MIT licensed) and welcomes contributions of all sizes. This guide covers the workflow, conventions, and expectations.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Adding a Destination Adapter](#adding-a-destination-adapter)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [What We're Looking For](#what-were-looking-for)
- [What We Don't Accept](#what-we-dont-accept)
- [Getting Help](#getting-help)

---

## Code of Conduct

Be respectful. Be honest. Assume good faith. We're all here to build something useful.

Specific expectations:
- **No condescension.** Beginners are welcome. We were all beginners once.
- **No gatekeeping.** If a contribution is small but correct, accept it.
- **Critique code, not people.** "This function has a race condition" is fine. "You're an idiot" is not.
- **Ask before assuming.** If a design decision seems wrong, ask why before rewriting.

Violations result in a warning first, then a ban. No exceptions.

---

## Ways to Contribute

### You don't need to write code

| Contribution | Value |
|---|---|
| **Bug reports** with reproduction steps | Extremely high |
| **Documentation improvements** | Very high |
| **Typo fixes** | Welcome |
| **Translations** (Urdu, Hindi, Arabic) | Welcome |
| **Feature proposals** with use cases | Very high |
| **Screenshots** of your workflow using Relayon | High (for the README) |
| **Testing** on Windows / macOS / Linux | High |
| **Testing a specific adapter** (Slack, Sheets, MongoDB, etc.) | High — smoke test only covers HTTP |

### Code contributions

| Contribution | Value |
|---|---|
| **New destination adapters** (Linear, PagerDuty, Opsgenie, Kafka, S3, etc.) | Very high — see [Adding a Destination Adapter](#adding-a-destination-adapter) |
| **New signature verifiers** (Twilio, SendGrid, Slack Events API) | Very high |
| **Retry policy improvements** | High |
| **Unit tests** (currently 0 — see [TESTING.md](./TESTING.md)) | **Extremely high** — this is v2.0's biggest priority |
| **Performance optimizations** with benchmarks | High |
| **Bug fixes** | High |

**Note on unit tests:** After 5 versions in 5 days (v1.0 → v1.5), the codebase has zero unit tests. Every feature is verified manually via documented checklists (see [TESTING.md](./TESTING.md#feature-specific-manual-tests)). The manual checklists are the specification for the tests v2.0 will add. **Any test PR is welcomed and prioritized.**

---

## Development Setup

### Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| Node.js | 22.x | Runtime |
| npm | 10.x | Package manager |
| Git | Latest | Version control |
| Prisma CLI | 6.19.3 (pinned) | Migrations |

**Prisma is pinned on purpose.** `npx prisma generate` is banned in this project — it fetches the latest CLI which removed the `generate` command (v8.x). Always use the absolute-path invocation (see [ARCHITECTURE.md § 6](./ARCHITECTURE.md#6-npx-prisma-generate-is-banned)).

### Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/relayon.git
cd relayon
npm install
```

### Environment setup

Each app has its own `.env.example`. Copy them:

```bash
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example apps/api/.env.local
cp apps/ingress/.env.example apps/ingress/.env.local
cp apps/workers/.env.example apps/workers/.env.local
```

You'll need free accounts on:
- **[Neon](https://neon.tech)** — PostgreSQL
- **[MongoDB Atlas](https://cloud.mongodb.com)** — MongoDB (M0 free tier)
- **[Upstash](https://console.upstash.com)** — Redis (TCP, not REST)
- **[Groq](https://console.groq.com)** — AI (free tier)

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run once for each secret:

**v1.0 secrets:**
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CRON_SECRET`
- `IP_HASH_SALT`

**v1.2+ secrets:**
- `API_KEY_PEPPER` — used for SHA-256 hashing of API keys. **Must be stable forever** — rotating it invalidates all issued API keys.

**v1.3+ secrets:**
- `CONNECTOR_ENCRYPTION_KEY` — 64 hex chars (32 bytes). **Must be identical in `apps/api/.env.local` and `apps/workers/.env.local`.** Mismatched keys = all encrypted credentials become unreadable.

**v1.4+ (recommended, replaces v1.3 singular key):**
- `CONNECTOR_ENCRYPTION_KEYS` — comma-separated `kid:hexkey` pairs. First key = current encryption key; all keys available for decryption. Format:
  ```
  CONNECTOR_ENCRYPTION_KEYS=key-2026-10:<64hex>,key-2026-01:<64hex>
  ```
  For local dev, one key is fine: `CONNECTOR_ENCRYPTION_KEYS=dev-2026-10:<64hex>`

**v1.4+ API env (needed for schedule run-now):**
- `WORKERS_URL` — `http://localhost:3003` locally, `https://relayon-workers.vercel.app` in prod
- `CRON_SECRET` — same value as Workers (already listed above)

**Optional toggles:**
- `FULL_CONFIG_ENCRYPTION=true` (v1.5) — encrypts every non-metadata config field, not just secret fields. Default is `false`.

### Run migrations

```bash
npm run db:generate
npm run db:deploy
```

If you're starting from scratch (no DB tables yet):

```bash
npm run db:migrate -- --name init
```

**Current migration history (v1.5):**
- `init` (v1.0) — base schema
- `add_routing_rules` (v1.1) — conditional routing
- `api_keys_scopes` (v1.2) — API keys with scopes
- `v13_schedules_and_versions` (v1.3) — scheduled workflows + versioning
- *(v1.4 and v1.5 require no migrations — adapters and encryption are data-layer changes only)*

### Run all services

In **4 separate terminals**:

```bash
npm run dev:api        # :3001
npm run dev:ingress    # :3002
npm run dev:workers    # :3003
npm run dev:dashboard  # :4200
```

Dashboard opens at **http://localhost:4200**. Sign up once, then you're in.

### Verify setup

```bash
npm run typecheck    # 0 errors expected
npm run build:dashboard && npm run build:api && npm run build:ingress && npm run build:workers
```

**Expected workers log** (v1.5 — 9 adapters, 3 routers):

```
[AdapterRegistry] Adapter registered: http → HttpAdapter
[AdapterRegistry] Adapter registered: slack → SlackAdapter
[AdapterRegistry] Adapter registered: email → EmailAdapter
[AdapterRegistry] Adapter registered: sheets → SheetsAdapter
[AdapterRegistry] Adapter registered: discord → DiscordAdapter
[AdapterRegistry] Adapter registered: airtable → AirtableAdapter
[AdapterRegistry] Adapter registered: notion → NotionAdapter
[AdapterRegistry] Adapter registered: postgres → PostgresAdapter
[AdapterRegistry] Adapter registered: mongodb → MongoDbAdapter
[RouterExplorer] Mapped {/internal/schedule/tick, POST} route
[RouterExplorer] Mapped {/internal/schedule/run-now, POST} route
[RouterExplorer] Mapped {/internal/egress/dry-run, POST} route
```

If you see **9 adapters** but fewer routers, or **fewer than 9 adapters**, something is misconfigured. Check the `EgressModule` providers array.

---

## Making Changes

### Branch naming

```
feat/add-linear-adapter
fix/retry-policy-off-by-one
docs/update-api-reference
refactor/extract-signature-verifiers
```

Prefix matches the commit type (`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`).

### Keep branches focused

One branch = one logical change. If you find a typo while working on a feature, submit the typo fix as a **separate PR**. Small, focused PRs get merged faster.

### Before you code

For **bug fixes** and **small features** (under 100 lines), just code and PR.

For **large features** (new adapter, new endpoint family, schema changes), **open an issue first**. Describe:
- What problem are you solving?
- What's the proposed approach?
- What alternatives did you consider?

This prevents wasted work on something that doesn't fit the roadmap.

**Special case — encryption or `__dryRun` changes:** Always open an issue first, even for small changes. These are the two areas where a subtle bug has severe consequences (data exposure or unexpected writes to live destinations). See [What We Don't Accept](#what-we-dont-accept).

---

## Adding a Destination Adapter

**This is the most common contribution.** Since v1.2, adding an adapter is a **single-file change** — the registry auto-discovers adapters via `@DestinationAdapter` decorator, so no `egress.module.ts` edits are needed beyond adding the class to `providers`.

### The 4 things every adapter must do

1. **Extend `DeliveryAdapter`** — implement the `send(ctx: DeliveryContext): Promise<AdapterResult>` method
2. **Register the decorator** — `@DestinationAdapter({ type, displayName, configSchema })`
3. **Honor `__dryRun`** — if `ctx.config.__dryRun === true`, run a **safe probe that does NOT write to the destination** (see below)
4. **Return a well-formed `AdapterResult`** — `{ success, statusCode, latencyMs, responseBody, error, retryable }`

### Template

```typescript
import { Injectable } from '@nestjs/common';
import { DestinationAdapter } from './plugin.decorator';
import type { AdapterResult, DeliveryAdapter, DeliveryContext } from './types';

const TIMEOUT_MS = 10_000;

@Injectable()
@DestinationAdapter({
  type: 'linear',                    // ← unique, lowercase
  displayName: 'Linear',             // ← shown in dashboard dropdown
  configSchema: {
    required: ['apiKey', 'teamId'],
    optional: ['labelIds'],
  },
})
export class LinearAdapter implements DeliveryAdapter {
  readonly type = 'linear';

  async send(ctx: DeliveryContext): Promise<AdapterResult> {
    const started = Date.now();
    const apiKey = ctx.config['apiKey'];
    const teamId = ctx.config['teamId'];

    // 1. Config validation
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      return this.error("missing 'apiKey'", started);
    }
    if (typeof teamId !== 'string' || teamId.length === 0) {
      return this.error("missing 'teamId'", started);
    }

    // 2. Dry-run — safe probe, NO write
    if (ctx.config['__dryRun'] === true) {
      try {
        const res = await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: '{ viewer { id } }' }),
        });
        return {
          success: res.ok,
          statusCode: res.status,
          latencyMs: Date.now() - started,
          responseBody: res.ok ? 'Linear API key valid' : 'Invalid Linear key',
          error: res.ok ? null : `Linear: ${res.status}`,
          retryable: false,
        };
      } catch (err) {
        return {
          success: false,
          statusCode: 0,
          latencyMs: Date.now() - started,
          responseBody: '',
          error: err instanceof Error ? err.message : String(err),
          retryable: false,
        };
      }
    }

    // 3. Real delivery
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `mutation { issueCreate(input: { teamId: "${teamId}", title: "..." }) { success } }`,
        }),
        signal: controller.signal,
      });

      const bodyText = await res.text();
      const ok = res.ok;

      return {
        success: ok,
        statusCode: res.status,
        latencyMs: Date.now() - started,
        responseBody: bodyText.slice(0, 500),
        error: ok ? null : `Linear: ${res.status}`,
        retryable: !ok && (res.status >= 500 || res.status === 429),
      };
    } catch (err) {
      return {
        success: false,
        statusCode: 0,
        latencyMs: Date.now() - started,
        responseBody: '',
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private error(msg: string, started: number): AdapterResult {
    return {
      success: false,
      statusCode: 0,
      latencyMs: Date.now() - started,
      responseBody: '',
      error: `linear adapter: ${msg}`,
      retryable: false,
    };
  }
}
```

### `__dryRun` — the critical safety rule

**If you skip this, we can't merge the PR.** Without `__dryRun` handling, the dashboard's "Test connection" button will send a real message/email/row to the destination — every time a user clicks validate. That is a data-leak bug.

Every adapter MUST check `ctx.config.__dryRun === true` **before** the real `fetch` call and use a safe probe instead. Approved probes:

| Adapter type | Safe probe |
|---|---|
| HTTP-like (REST APIs) | `HEAD` or `GET` to a metadata endpoint |
| Auth-only | `GET /whoami` or `/me` with the API key |
| Database | `SELECT 1` / `ping` |
| Webhook (Slack, Discord) | URL format check only — cannot be tested without sending |

**Slack and Discord are the safe exception:** their webhooks cannot be probed without sending a message. For those, return `success: true` with a message like `"config valid — cannot be tested without sending"`. This is the safest possible behavior.

### Register in `egress.module.ts`

Since v1.2, the registry auto-discovers via `DiscoveryService`, but the adapter **class must still be listed in `providers`** for NestJS to instantiate it:

```typescript
// apps/workers/src/modules/egress/egress.module.ts

import { LinearAdapter } from './adapters/linear.adapter';

@Module({
  providers: [
    // ... existing 9 ...
    LinearAdapter,  // ← add here
  ],
})
```

That's it. On restart, you'll see `[AdapterRegistry] Adapter registered: linear → LinearAdapter`.

### Update the frontend form

The destination modal in `apps/dashboard/src/app/features/workflows/workflow-detail.component.ts` has an `@switch` on `destForm.controls.type.value` with a `@case` per adapter. You need to add:

1. A `<option value="linear">Linear</option>` in the `<select>`
2. A `@case ('linear') { ... }` block with form fields for required config
3. Form controls in `destForm` group (e.g., `linearApiKey`, `linearTeamId`)
4. Config builder in `buildDestinationConfig()` switch

See the existing `@case ('notion')` block as a template.

### Test your adapter manually

The smoke test only covers HTTP. To test a new adapter:

1. **Dry-run:** Dashboard → workflow → + Add destination → select your type → fill fields → click "Test connection" → expect green checkmark, **and confirm nothing was sent** to the destination
2. **Real delivery:** Save destination → trigger a webhook or run-now → check destination received the payload
3. **Failure path:** Use a fake API key → expect `401`/`403` on dry-run + `success: false` with retryable classification on real delivery
4. **Retry behavior:** Point at a `500` endpoint → expect delivery to enter `queue:egress:delayed` and retry with backoff

Document the manual test result in your PR description.

---

## Commit Convention

We use **[Conventional Commits](https://www.conventionalcommits.org/)**.

### Format

```
<type>(<scope>): <short summary>

<optional body>

<optional footer>
```

### Types

| Type | Meaning | Example |
|---|---|---|
| `feat` | New feature | `feat(ingress): add Twilio signature verifier` |
| `fix` | Bug fix | `fix(workers): correct Groq timeout parsing` |
| `perf` | Performance | `perf(ingress): reduce cold start by 100ms` |
| `docs` | Documentation only | `docs(readme): update architecture diagram` |
| `refactor` | Code change, no feature/fix | `refactor(api): extract tenant guard` |
| `test` | Adding/fixing tests | `test(shared): add signature verifier tests` |
| `chore` | Tooling, deps, config | `chore(deps): bump prisma to 6.19.3` |
| `ci` | CI configuration | `ci: add smoke test job` |

### Scopes (optional but recommended)

`api`, `ingress`, `workers`, `dashboard`, `db`, `shared`, `docs`, `deploy`, `crypto`, `adapters`, `schedule`, `versions`

### Examples

Good:
```
feat(adapters): add Linear destination adapter
fix(ingress): handle Shopify base64 signature correctly
docs(api): clarify DLQ replay semantics
refactor(crypto): extract keyring loader
perf(workers): batch Prisma query for N events
```

Bad (rejected):
```
Update code
Fixed stuff
WIP
asdf
```

### Commit body — when to include

Include a body when the **why** isn't obvious from the title:

```
fix(workers): skip app.listen on Vercel serverless

Vercel's serverless runtime calls the handler directly and manages
the HTTP server itself. Calling app.listen() in the serverless
context crashes the function with "No exports found in module".

Fix: export the Express instance as default. Local dev still calls
app.listen via the VERCEL env var check.

Refs: https://vercel.com/docs/functions/runtimes/node-js
```

---

## Pull Request Process

### 1. Sync your fork

```bash
git checkout main
git pull upstream main
git checkout -b feat/your-branch
```

### 2. Make your changes

Write code. Add tests where it matters (any test is better than none). Update docs if you changed behavior.

### 3. Verify locally

```bash
npm run typecheck
npm run build:dashboard && npm run build:api && npm run build:ingress && npm run build:workers
```

Both must pass. **CI will run the same checks**, so local failures mean CI failures.

If your change touches encryption or adapters, also manually run the relevant test from [TESTING.md](./TESTING.md#feature-specific-manual-tests).

### 4. Commit

```bash
git add .
git commit -m "feat(adapters): add Linear destination adapter"
```

### 5. Push and open PR

```bash
git push origin feat/your-branch
```

Then open a PR at `https://github.com/zainshah3464/relayon/compare`.

### PR title

Same format as the commit message. Squashed commits inherit the PR title.

### PR description

Use this template:

```markdown
## What
Brief description of the change.

## Why
Problem being solved. Link to issue if applicable.

## How
Approach taken. Mention tradeoffs if any.

## Testing
- [ ] `npm run typecheck` passes
- [ ] All 4 builds pass
- [ ] Smoke test passes (if deploy changes)
- [ ] Manual test performed (see TESTING.md — describe what you tested)
- [ ] For adapter PRs: `__dryRun` confirmed to NOT write to destination

## Safety checklist (for encryption/dry-run changes only)
- [ ] Change does not expose plaintext secrets in API responses
- [ ] Change does not weaken `enc:v2:` envelope validation
- [ ] If touching `crypto-box.ts`, both API and Workers copies are updated identically
- [ ] If adding an adapter, `ctx.config.__dryRun` is checked before any write

## Screenshots (if UI change)
Before/After.
```

### Review process

- I (Zain) review every PR within **48 hours** (usually faster).
- I'll either approve, request changes, or explain why the PR is out of scope.
- "Request changes" is not personal — it's about the code.
- If we disagree, we discuss. If we still disagree, my call as maintainer decides.

### Merge strategy

- **Squash and merge** for feature/fix PRs (one commit per feature).
- **Rebase and merge** for small fixes (preserve commit messages).
- Never "merge commits" (avoids noise).

---

## What We're Looking For

### High priority (v1.5 → v2.0)

1. **Unit tests** — currently 0. The manual checklists in [TESTING.md](./TESTING.md) are the specification. Any test PR is prioritized over feature PRs.
2. **New destination adapters** — Linear, PagerDuty, Opsgenie, Kafka, AWS S3, Google BigQuery, ClickHouse. Follow [Adding a Destination Adapter](#adding-a-destination-adapter).
3. **New signature verifiers** — Twilio, SendGrid, Slack Events API (not just webhooks)
4. **Retry policy improvements** — per-destination overrides, jitter, dead-letter after success
5. **Observability** — OpenTelemetry spans, Prometheus metrics
6. **Documentation** — any docs improvement is accepted

**Already shipped (do not re-add):** Discord (v1.2), Airtable (v1.3), Notion (v1.3), PostgreSQL (v1.4), MongoDB (v1.4)

### Medium priority

- **Smoke test expansion** — add version snapshot + restore check, API key verify check, dry-run validation check
- **Dashboard UX** improvements (charts, filters, bulk actions)
- **Performance optimizations** (with benchmarks showing the win)
- **Accessibility** improvements (WCAG AA compliance)
- **Internationalization** (i18n for dashboard)
- **Error messages** that are more actionable

### Low priority

- Code style changes without functional benefit
- Dependency bumps (unless for security)
- "Modernization" refactors (unless fixing a real problem)

---

## What We Don't Accept

| Category | Why |
|---|---|
| **Dependencies without justification** | Every dep adds attack surface, bundle size, and maintenance burden |
| **Breaking changes in minor versions** | Use `feat!:` for breaking, and expect heavy scrutiny |
| **Tests that just test mocks** | A test that mocks Prisma and asserts Prisma was called is worthless |
| **LLM output tests** | AI is non-deterministic; test the boundaries, not the content |
| **Reformatting existing code** without discussion | Diffs become unreadable |
| **AI-generated PRs without review** | If you submit it, you own it — understand every line |
| **"Cleanup" PRs that touch 50 files** | Scope creep — split into focused PRs |
| **Adding console.log statements** | Use the structured `logger` |
| **Hardcoded secrets or credentials** | Even in tests. Use env vars. |

### Safety-critical rejections (v1.3+)

These are **hard rejections** — we will not merge even with a good-faith explanation, because the failure modes are severe:

| Category | Why |
|---|---|
| **Adapter PRs that don't honor `__dryRun`** | Testing a destination would write real data. Data-leak bug. |
| **PRs that weaken encryption validation** | e.g., removing auth tag verification, allowing truncated envelope, downgrade to CBC. Encryption is not a place for "just make it work." |
| **PRs that store secrets as plaintext in new fields** | If you add a new adapter with a new secret field, add it to `SECRET_CONFIG_KEYS`. Non-negotiable. |
| **PRs that change crypto envelope format without backward compat** | `enc:v1:` data must stay decryptable. New formats must be additive (`enc:v3:` alongside v1/v2). |
| **PRs that add `.env` files or leak secrets in test fixtures** | Even test Slack webhooks. Use placeholders. |
| **PRs that bypass `timingSafeEqual`** | Any signature or hash comparison must be timing-safe. Naive `a === b` is rejected. |
| **PRs that add `eval()` / `Function()` / `vm`** | Zero code execution surface. Use JSONata for user expressions. |

**Why these are hard rejections:** Each of these has caused real production incidents at companies far larger than this project. We cannot take "I'll fix it in a follow-up" for any of them.

---

## Getting Help

| Channel | Use for |
|---|---|
| **GitHub Issues** | Bug reports, feature requests |
| **GitHub Discussions** | Questions, ideas, show-and-tell |
| **Email** | Security disclosures (see `SECURITY.md`) |

**Response time (solo maintainer):**
- Bug reports: 24-72 hours
- Feature requests: 3-7 days
- PR reviews: 48 hours
- Security disclosures: 24 hours

**If you haven't heard back in a week**, ping the issue/PR. I might have missed it.

---

## First Contribution?

Look for issues labeled **`good first issue`** — these are scoped to be completed in a few hours and have clear acceptance criteria.

If none fit, open an issue describing what you'd like to work on and I'll help scope it.

**Easy first PRs:**
- Fix a typo in any of the 11 docs files
- Add a test for a pure function (any function, any file)
- Add a screenshot of your Relayon workflow to `docs/screenshots/`
- Add an error message that's more actionable than what's there
- Improve a section of this CONTRIBUTING guide

---

## License

By contributing, you agree that your contributions will be licensed under the **MIT License** (see `LICENSE`).

---

Thank you for contributing. Every bug report, every typo fix, every new adapter makes Relayon better for someone else.
```

---