# Relayon — FAQ

> **Frequently asked questions — honestly answered.**

Every answer here reflects the **actual v1.0.0 production state** as of 2026-10-22. No marketing speak. No promises about features that don't exist.

---

## Table of Contents

- [General](#general)
- [Comparison](#comparison)
- [Getting Started](#getting-started)
- [Pricing & Limits](#pricing--limits)
- [Technical](#technical)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Product & Roadmap](#product--roadmap)
- [Contributing](#contributing)

---

## General

### What is Relayon, in one sentence?

**Relayon is a webhook relay platform** — it receives webhooks from sources like Stripe, GitHub, Shopify, and Slack, enriches them with AI, transforms them, and delivers them to any destination reliably.

### What problem does Relayon solve?

Every SaaS company writes the same integration code over and over:
- Stripe webhook → Slack
- Shopify order → Google Sheets
- GitHub PR → Jira
- Support ticket → CRM

This is repetitive, error-prone, and expensive. Relayon turns it into **configuration, not code**.

### Is Relayon production-ready?

**Yes, but with caveats.** v1.0.0 is deployed and functional at `https://relayon.vercel.app`. It handles real webhooks, real AI enrichment, real deliveries, real retries, real DLQs. **However:**
- No SOC 2 / HIPAA / GDPR certification yet
- No SLA guarantee
- No automated backups on free tier
- No unit tests yet (smoke test only)
- Solo-maintained (24-72h response time)

If you need enterprise compliance today, use Zapier/Make. If you want a working free-tier platform you can inspect, fork, and extend — Relayon works.

### Is this a real product or a portfolio project?

**Both.** It's a real deployed product (nobody stops you from using it), and it's designed as a portfolio piece to demonstrate senior-level engineering. The architecture, testing, documentation, and deployment discipline are all production-grade.

### Who is it for?

- **Indie developers** who want to integrate Stripe/GitHub/Shopify without writing glue code
- **Small teams** who need webhook reliability but can't afford Zapier ($200-500/month)
- **Engineers** who want to self-host or fork a webhook platform
- **Recruiters** evaluating a candidate's systems engineering work

---

## Comparison

### How is Relayon different from Zapier?

| Aspect | Zapier | Relayon |
|---|---|---|
| **Pricing** | $20–500/month | Free tier ($0) |
| **Auth** | OAuth to 6000+ apps | Webhooks only (5 sources) |
| **AI enrichment** | Newer, paid add-on | Built-in, free (Groq) |
| **Self-hosted** | No | Fork and deploy anywhere |
| **Data ownership** | Your data on Zapier servers | Your data on your Neon/Atlas |
| **Vendor lock-in** | Workflows can't be exported | Full source code, MIT license |
| **App count** | 6000+ integrations | 4 destinations (HTTP, Slack, Email, Sheets) |
| **Reliability** | Enterprise SLA | Best-effort, DLQ-based |

**When to use Zapier:** You need 6000+ app integrations, OAuth, and enterprise SLAs.

**When to use Relayon:** You have webhooks, need AI enrichment, want to keep your own data, and don't want to pay $200/month for glue code.

### How is Relayon different from Make (Integromat)?

Same answer as Zapier. Make is more visual, more app integrations, more expensive. Relayon is API-first, self-hostable, free.

### How is Relayon different from n8n?

**n8n** is closer to Relayon than Zapier — both are self-hostable, both are open-source-ish. Differences:
- **n8n** requires a **persistent server** (Node process running 24/7). Relayon is **serverless** (Vercel functions).
- **n8n** is visual workflow builder. Relayon is config-based (no visual builder).
- **n8n** costs $0 self-hosted but needs $5-20/month server. Relayon is $0 on Vercel Hobby.

**When to use n8n:** You want visual workflows and don't mind paying for a server.

**When to use Relayon:** You want serverless, config-based, Vercel-native.

### How is Relayon different from webhook.site?

**webhook.site** is a debugging tool — it captures webhooks and shows you the payload. It doesn't deliver them anywhere.

**Relayon** is a delivery platform — it takes webhooks and routes them to real destinations with retries, DLQ, and AI enrichment.

---

## Getting Started

### What's the fastest way to try Relayon?

1. Open `https://relayon.vercel.app`
2. Sign up (email + password)
3. Create a workflow (name + source type + signing secret)
4. Add a destination (e.g., `https://httpbin.org/post`)
5. Copy the webhook URL
6. Send a webhook → check the Events page

**Time to first delivery:** ~3 minutes.

### How do I send my first test webhook?

The dashboard shows the webhook URL after you create a workflow:
```
https://relayon-ingress.vercel.app/webhook/{tenantId}/{workflowId}
```

**To send it:**
```bash
curl -X POST https://relayon-ingress.vercel.app/webhook/{tenantId}/{workflowId} \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=...,v1=..." \
  -d '{"event":"test"}'
```

The signature must be **HMAC-SHA256** of `{timestamp}.{body}` using your workflow's signing secret. See `docs/API_REFERENCE.md` for per-source signature details.

### Why do webhooks take 2 hours to deliver?

**Because Vercel Hobby's cron limitation.** Vercel Hobby allows only **1 cron per project, once per day**. So we use **external cron** (GitHub Actions, cron-job.org, or Upstash QStash) to trigger `/internal/process` and `/internal/deliver` on a schedule.

**You can trigger them manually** at any time for immediate processing:
```bash
curl -X POST https://relayon-workers.vercel.app/internal/process \
  -H "X-Cron-Secret: <your-secret>"
```

**To get 2-minute delivery instead of 2-hour:** Use Upstash QStash (free tier, 1-minute intervals) — see `DEPLOYMENT.md` for setup.

### What signing secret do I use for Stripe?

Stripe gives you a **webhook signing secret** (starts with `whsec_`). It's different from your API key. Find it at:
- Stripe Dashboard → Developers → Webhooks → your endpoint → **Signing secret**

Paste that into Relayon's workflow creation form.

### Can I use Relayon without a signing secret?

**No.** Signature verification is mandatory for all sources. A workflow with no secret rejects **all** webhooks. This is deliberate — fail-closed rather than fail-open.

---

## Pricing & Limits

### Is Relayon really free?

**Yes, for the free tier.** The full stack runs on:
- **Vercel Hobby** — $0 (100GB bandwidth)
- **Neon** — $0 (0.5GB storage)
- **MongoDB Atlas M0** — $0 (512MB)
- **Upstash Redis** — $0 (10K commands/day)
- **Groq** — $0 (14,400 requests/day)
- **Sentry** — $0 (5K errors/month)

**Total: $0/month.**

### What are the free tier limits?

| Service | Free Tier | Hit When |
|---|---|---|
| **Vercel** | 100GB bandwidth, 100GB-hours | ~50K monthly visitors |
| **Neon** | 0.5GB storage, 191 compute hrs | ~50K events, 10K tenants |
| **MongoDB M0** | 512MB storage | ~500K events (30-day TTL) |
| **Upstash Redis** | 10K commands/day | ~3K events/day |
| **Groq** | 14,400 requests/day | ~10K enriched events/day |
| **Sentry** | 5K errors/month | Small team usage |

**Rule of thumb:** Relayon is free for **up to ~3K events/day**. Above that, you'll need to upgrade one or more services.

### When should I upgrade?

| Trigger | Upgrade | Cost |
|---|---|---|
| **>3K events/day** | Upstash Pro | $5/mo |
| **>10K enriched events/day** | Groq paid tier | ~$0.05/1K requests |
| **>500K events stored** | MongoDB M2 | $9/mo |
| **>50K monthly visitors** | Vercel Pro | $20/mo |
| **Commercial use** | Vercel Pro | $20/mo (Hobby forbids commercial) |
| **Enterprise compliance** | Vercel Enterprise + Neon Scale | Contact sales |

### Does Vercel Hobby forbid commercial use?

**Yes.** Vercel's [Fair Use Policy](https://vercel.com/docs/limits/fair-use-policy) says Hobby is for **non-commercial** use. If you use Relayon for a business, upgrade to Vercel Pro ($20/mo). The code doesn't care — this is a Vercel ToS issue, not a Relayon one.

---

## Technical

### Why 4 separate apps instead of 1 monolith?

**Serverless constraints require it.** Vercel functions have:
- 10s (Hobby) function duration
- Stateless execution (no shared memory)
- Cold starts (200-1500ms per invocation)

A monolith would need to:
- Load ALL dependencies for every request (slow cold start)
- Handle webhook parsing AND AI AND delivery in one invocation (10s timeout)

Splitting into 4 apps:
- **Ingress** has only Express + ioredis → fast cold start (~500ms)
- **API** has NestJS + Prisma → medium cold start (~800ms)
- **Workers** has full AI stack → slow cold start (~1200ms), but batching amortizes it

**Result:** Each app is optimized for its workload.

### Why PostgreSQL **and** MongoDB?

**Different workloads, different databases.**

**PostgreSQL (ACID-critical):**
- Tenants, users, workflows, destinations
- Foreign keys, transactions, `FOR UPDATE` locks
- **Rule:** If losing a row breaks money or trust, it goes here.

**MongoDB (append-only):**
- Events, deliveries
- 30-day TTL indexes (auto-delete)
- `Mixed` types for arbitrary payloads
- **Rule:** If losing a row just makes a dashboard slightly wrong, it goes here.

Two databases = two connection pools = higher cold start. But separating them means a MongoDB write failure doesn't corrupt transactional state.

### Why Redis instead of Kafka/RabbitMQ/SQS?

**Cost.** Kafka/RabbitMQ start at $20-50/month. Upstash Redis is **free** for 10K commands/day.

**Redis covers everything we need:**
- `LPUSH`/`RPOP` → FIFO queue
- `RPOPLPUSH` → atomic move (at-least-once)
- `ZADD`/`ZRANGEBYSCORE` → scheduled retries
- `SET NX EX` → idempotency
- `INCR` → rate limiting
- `GET`/`SET` → cache

**Redis doesn't cover:** durability guarantees. If Upstash loses an `LPUSH` before persisting, the event is lost. **Mitigation:** Ingress returns `500` on `LPUSH` failure — source retries.

### How does at-least-once delivery work?

Every event is **guaranteed to be delivered at least once**, possibly more:

1. Ingress `LPUSH` event to `queue:events:incoming`
2. Worker `RPOPLPUSH` event to `queue:events:processing` (**atomic move**)
3. Worker processes event → writes to MongoDB
4. Worker `LREM` event from `queue:events:processing` (**ack**)

**If worker crashes between steps 2 and 4**, the event stays in `processing` queue. A recovery scan re-queues events stuck >5 minutes.

**Duplicate prevention:**
- MongoDB `correlationId` is **unique** — duplicate insert fails
- HTTP adapter sends `Idempotency-Key: {eventId}:{destinationId}` header
- Ingress Redis idempotency `SET NX` on body-hash prevents source duplicates

**Result:** Duplicates possible but rare, and every layer has a dedup mechanism.

### Why do cold starts take 3-8 seconds?

Vercel's serverless functions are **not** always running. After ~15 minutes of inactivity, Vercel kills the function. The next request:

1. Starts a new Node.js process (~1s)
2. Loads `node_modules` (~1-3s)
3. Initializes Prisma, Mongoose, Config (~1-2s)
4. Boots NestJS (~500ms)

**Total: ~3-8 seconds** for the first request.

**Subsequent requests** are **100-200ms** (warm).

**Mitigations:**
- **Keep-alive ping** every 12 hours (already in GitHub Actions)
- **Batch larger** (`BATCH_SIZE=3` to 10) to amortize cold start across more events
- **Upgrade to Vercel Pro** (keeps functions warm longer)

### Can I run Relayon without Vercel?

**Yes.** All 4 apps are standard Node.js:
- **Dashboard** — Static Angular build → any CDN
- **API / Ingress / Workers** — NestJS/Express → any Node.js host (Fly.io, Railway, Render, self-hosted VPS)

See `DEPLOYMENT.md` for the VPS deployment section.

### Can I use a different AI provider instead of Groq?

**Yes.** The `GroqService` is a thin wrapper around `groq-sdk`. Swap it for:
- **OpenAI SDK** — same interface, different provider
- **Anthropic SDK** — different interface, need refactor
- **Ollama** — local LLM, free but needs GPU
- **WebLLM** — browser-based, no server

**Effort:** ~2 hours to swap the provider in `workers/src/modules/processing/groq.service.ts`.

---

## Security

### Is my data safe?

**Mostly, with honest caveats.**

**What's covered:**
- ✅ Multi-tenant isolation (application + database layer)
- ✅ JWT auth with refresh rotation
- ✅ HMAC signature verification (timing-safe)
- ✅ Encrypted connections (HTTPS, `rediss://`, `sslmode=require`)
- ✅ Rate limiting on all endpoints
- ✅ Secrets in Vercel environment variables (encrypted at rest)
- ✅ IP hashing (raw IPs never stored)

**What's NOT covered:**
- ❌ **`sourceConfig.secret` and `destination.config` are plaintext in PostgreSQL** — anyone with DB access sees them
- ❌ **Webhook payloads stored plaintext in MongoDB** — anyone with DB access sees them
- ❌ **No MFA/TOTP** for dashboard login
- ❌ **No SOC 2 / HIPAA / GDPR certification**
- ❌ **No automated backups** on free tier

See `docs/SECURITY.md` for the full threat model.

### Where are my secrets stored?

**Three places:**

1. **Infrastructure secrets** (JWT_SECRET, DATABASE_URL, GROQ_API_KEY) → Vercel environment variables (encrypted at rest, AES-256)
2. **Per-workflow secrets** (Stripe/GitHub HMAC secret) → PostgreSQL `workflows.source_config` **plaintext JSON**
3. **Per-destination secrets** (Slack webhook URL, Resend API key, Sheets private key) → PostgreSQL `destinations.config` **plaintext JSON**

**For production use with sensitive data:** encrypt `sourceConfig` and `destination.config` at the application layer before storing. This is **not implemented in v1.0** but planned for v2.0.

### Can someone replay my webhooks?

**Depends on the source:**

- **Stripe, Slack** — No, they include timestamps. Requests outside 300s window are rejected.
- **GitHub, Shopify, Generic** — Yes, if attacker captures a valid request. No timestamp in signature. **Mitigation:** Provide `X-Event-Id` header for idempotency. Duplicates are deduped but the first one still processes.

**Fix (planned v1.1):** Add optional timestamp header for all sources.

### What happens if my JWT_SECRET leaks?

**Attackers can forge tokens for any user.** Mitigation:

1. Rotate `JWT_SECRET` in Vercel env vars
2. Redeploy API
3. All existing access tokens become invalid immediately
4. All refresh tokens also invalid (they're hashed with `JWT_REFRESH_SECRET`, which should also be rotated)
5. All users must re-login

**Time to remediate:** ~5 minutes (rotate both secrets, redeploy).

### Is the AI prompt injection vulnerable?

**Partially mitigated.**

- Users can customize `enrichmentPrompt` per workflow
- A malicious prompt could trick the LLM into returning unexpected JSON
- **Mitigation:** The enriched payload is stored as-is. It's the user's own prompt — their problem if they craft it badly.
- **Not a multi-tenant risk:** Each tenant's enrichment is scoped to their own workflows.

**For external-facing LLM endpoints:** add prompt injection guard. Relayon doesn't have one because it's not a user-facing AI chat — it's a batch enrichment pipeline.

---

## Troubleshooting

### Webhooks return 401 "invalid signature"

**Most common causes (in order):**

1. **Wrong secret** — you're using Stripe's API key instead of the webhook signing secret
2. **Wrong signature format** — Stripe uses `t=...,v1=...`; GitHub uses `sha256=...`
3. **Body was modified** — proxies or middleware that mutate the body break HMAC
4. **Timestamp outside tolerance** — for Stripe/Slack, if server clock is off by >300s

**Debug:**
```bash
# Verify your secret with a manual signature
node -e "
const crypto = require('crypto');
const body = '{\"test\":1}';
const secret = 'whsec_your_secret';
const timestamp = Math.floor(Date.now() / 1000);
const signed = timestamp + '.' + body;
const sig = crypto.createHmac('sha256', secret).update(signed).digest('hex');
console.log('t=' + timestamp + ',v1=' + sig);
"
```

Paste the output as `Stripe-Signature` header and send the exact body. If it works manually but fails from the source, the source is sending something different.

### Delivery is stuck in "pending" forever

**Cause:** `/internal/deliver` cron isn't running.

**Fix:**
```bash
# Manually trigger
curl -X POST https://relayon-workers.vercel.app/internal/deliver \
  -H "X-Cron-Secret: <your-secret>"
```

**Prevent:** Set up GitHub Actions cron (see `DEPLOYMENT.md`). Vercel Hobby's built-in cron only runs **once per day** — not enough for prompt delivery.

### "Max retries exhausted" but I want to keep trying

**Fix:** Increase `max_attempts` in destination's `retryPolicy`:
```json
{
  "max_attempts": 10,
  "backoff_ms": [10000, 30000, 60000, 300000, 900000, 1800000, 3600000]
}
```

**Or:** Manually replay from DLQ — resets `attemptCount` to 0.

### Cold starts are killing my latency

**Fixes (in order of impact):**

1. **Upgrade to Vercel Pro** ($20/mo) — keeps functions warm longer
2. **Keep-alive cron** every 12 hours — pings `/api/health` to prevent suspension
3. **Accept it** — real users see this only on first request of the day

### Enrichment is slow (>5s)

**Cause:** Groq free tier queues requests under load.

**Fixes:**
- Increase Redis cache TTL (default 1h → 6h)
- Batch more events per call (`BATCH_SIZE` 3 → 10)
- Reduce `GROQ_MAX_TOKENS` (1024 → 512)
- Upgrade to Groq paid tier ($0.05/1K requests)

**See:** `docs/TROUBLESHOOTING.md` for 20+ more issues.

---

## Product & Roadmap

### What's on the roadmap?

See `docs/ROADMAP.md` for the full list. Summary:

**v1.1 (Q1 2027):** Unit tests, API keys UI, destination test button, audit logs
**v1.2 (Q2 2027):** Charts, bulk DLQ actions, conditional routing, 6 more adapters, i18n
**v2.0 (Q3-Q4 2027):** SAML SSO, Row-level security, SOC 2, multi-region, self-hosted

### What's NOT on the roadmap?

- Zapier-style visual builder
- Mobile apps
- Blockchain / NFT features
- Custom LLM fine-tuning
- Real-time WebSocket updates

See `docs/ROADMAP.md` for reasoning.

### Can I suggest a feature?

**Yes.** Open an issue at [github.com/zainshah3464/relayon/issues](https://github.com/zainshah3464/relayon/issues) with:
- Problem statement
- Proposed solution
- Alternatives considered
- Success criteria

Vague proposals get closed. Specific proposals get prioritized.

### When will [feature X] be added?

**Honest answer:** When either (a) I have time, or (b) someone sponsors it, or (c) enough users request it.

This is a solo-maintained project. No roadmap commitment beyond what's documented in `docs/ROADMAP.md`.

---

## Contributing

### Can I contribute?

**Yes.** See `docs/CONTRIBUTING.md` for the full guide. Summary:

**High-value contributions:**
- New destination adapters (Discord, Airtable, Notion)
- New signature verifiers (Twilio, SendGrid)
- Unit tests (currently 0)
- Documentation improvements
- Bug reports with reproduction steps

**How to start:** Look for issues labeled `good first issue`.

### Do you accept AI-generated PRs?

**Yes, but you own them.** If you submit it, you must understand every line. AI-generated PRs that break things or introduce subtle bugs will be rejected, same as any other bad PR.

### How fast do PRs get reviewed?

**48 hours.** Usually faster. Solo maintainer, best-effort.

### Can I fork and use Relayon commercially?

**Yes.** It's MIT licensed. You can:
- Fork it
- Modify it
- Sell it as a service
- Use it for your company

**Attribution appreciated but not required** (that's what MIT means).

**However:** If you use Vercel Hobby for commercial purposes, you violate Vercel's ToS. Upgrade to Vercel Pro if you go commercial.

---

## Still Have Questions?

- **Bugs:** [github.com/zainshah3464/relayon/issues](https://github.com/zainshah3464/relayon/issues)
- **Questions:** [github.com/zainshah3464/relayon/discussions](https://github.com/zainshah3464/relayon/discussions)
- **Security:** `zainshahzs110@gmail.com` (do not open public issue)
- **Everything else:** `zainshahzs110@gmail.com`

**Response time:** 24-72 hours for non-urgent, 24 hours for security.

---

**Last updated:** 2026-10-22 (v1.0.0)
```

---