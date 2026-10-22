# Contributing to Relayon

> **How to contribute to Relayon — from bug reports to pull requests.**

Relayon is an open-source project (MIT licensed) and welcomes contributions of all sizes. This guide covers the workflow, conventions, and expectations.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
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

### Code contributions

| Contribution | Value |
|---|---|
| **New destination adapters** (Discord, Airtable, Notion, Linear) | Very high |
| **New signature verifiers** (Twilio, SendGrid, Shopify GDPR) | Very high |
| **Retry policy improvements** | High |
| **Performance optimizations** with benchmarks | High |
| **Unit tests** (currently 0) | High |
| **Bug fixes** | High |

---

## Development Setup

### Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| Node.js | 22.x | Runtime |
| npm | 10.x | Package manager |
| Git | Latest | Version control |
| Prisma CLI | 6.19.3 (pinned) | Migrations |

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
- **[Upstash](https://console.upstash.com)** — Redis
- **[Groq](https://console.groq.com)** — AI (free tier)

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run once for each secret (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET`, `IP_HASH_SALT`).

### Run migrations

```bash
npm run db:generate
npm run db:deploy
```

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

---

## Making Changes

### Branch naming

```
feat/add-discord-adapter
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

`api`, `ingress`, `workers`, `dashboard`, `db`, `shared`, `docs`, `deploy`

### Examples

Good:
```
feat(workers): add Airtable destination adapter
fix(ingress): handle Shopify base64 signature correctly
docs(api): clarify DLQ replay semantics
refactor(shared): extract hashIp helper
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

Write code. Add tests where it matters. Update docs if you changed behavior.

### 3. Verify locally

```bash
npm run typecheck
npm run build:dashboard && npm run build:api && npm run build:ingress && npm run build:workers
```

Both must pass. **CI will run the same checks**, so local failures mean CI failures.

### 4. Commit

```bash
git add .
git commit -m "feat(workers): add Discord destination adapter"
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
- [ ] Added unit tests (if applicable)

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

### High priority

1. **New destination adapters** — Discord, Airtable, Notion, Linear, PagerDuty, Opsgenie
2. **New signature verifiers** — Twilio, SendGrid, Slack Events API (not just webhooks)
3. **Retry policy improvements** — per-destination overrides, jitter, dead-letter after success
4. **Observability** — OpenTelemetry spans, Prometheus metrics
5. **Unit tests** — literally any test file is welcome
6. **Documentation** — any docs improvement is accepted

### Medium priority

- Dashboard UX improvements (charts, filters, bulk actions)
- Performance optimizations (with benchmarks showing the win)
- Accessibility improvements (WCAG AA compliance)
- Internationalization (i18n for dashboard)
- Error messages that are more actionable

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

---

## License

By contributing, you agree that your contributions will be licensed under the **MIT License** (see `LICENSE`).

---

Thank you for contributing. Every bug report, every typo fix, every new adapter makes Relayon better for someone else.
```

---