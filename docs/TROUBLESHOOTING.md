
# Relayon — Troubleshooting

> **Common issues, their root causes, and the fixes that actually work.**

Every issue in this document was **encountered during the v1.0 deployment** and has been verified as a real fix. Nothing here is theoretical.

---

## Table of Contents

- [Local Development](#local-development)
- [Database & Prisma](#database--prisma)
- [Vercel Deployment](#vercel-deployment)
- [Runtime Errors](#runtime-errors)
- [Delivery & Retries](#delivery--retries)
- [AI Enrichment](#ai-enrichment)
- [Authentication](#authentication)
- [Cron & Automation](#cron--automation)
- [Performance](#performance)
- [Diagnostics](#diagnostics)

---

## Local Development

### `npm run dev:dashboard` fails with "Application bundle generation failed"

**Symptom:**
```
✘ [ERROR] NG5002: Opening tag "span" not terminated.
```

**Cause:** An Angular template has an unclosed tag, usually because of a malformed `[class.xxx/opacity]` binding.

**Fix:** Tailwind modifiers (`/20`, `hover:`, `md:`) **cannot be used in Angular property bindings**. Refactor to `@if` control flow:

```html
<!-- ❌ Wrong -->
<span [class.bg-rose/20]="isError">...</span>

<!-- ✅ Correct -->
@if (isError) {
  <span class="bg-rose/20">...</span>
}
```

---

### `ng serve` hangs at "Component HMR has been enabled" for >60s

**Cause:** First build is slow (cold cache).

**Fix:**
```bash
cd apps/dashboard
rmdir /s /q .angular\cache
cd ../..
npm run dev:dashboard
```

The second build will be under 5 seconds.

---

## Database & Prisma

### `EPERM: operation not permitted, rename query_engine-windows.dll.node`

**Symptom:**
```
Error:
EPERM: operation not permitted, rename 'node_modules\.prisma\client\query_engine-windows.dll.node.tmpXXXX' -> 'query_engine-windows.dll.node'
```

**Cause:** On Windows, Prisma's query engine `.dll` file is locked by any running process that has loaded `@prisma/client`. `prisma generate` can't replace it while it's locked.

**Fix:**
```cmd
# 1. Stop all dev servers (Ctrl+C in each terminal)
# 2. Kill any orphan node processes
taskkill /f /im node.exe

# 3. Verify no processes remain
tasklist | findstr /i node

# 4. Delete leftover .tmp files
del /f /q node_modules\.prisma\client\query_engine-windows.dll.node.tmp*

# 5. Regenerate
npm run db:generate
```

**Prevention:** Always stop servers before `db:generate` or `npm install`.

**If still failing:** VS Code's Prisma extension also locks the file. Disable the extension for this workspace, or close VS Code and run the command from a plain terminal.

---

### `Invalid environment configuration: { NODE_ENV: ["...received '\tproduction'"] }`

**Symptom:**
```json
{ NODE_ENV: ["Invalid enum value. Expected 'development' | 'production' | 'test', received '\tproduction'"] }
```

**Cause:** A **tab character (`\t`)** snuck into the `NODE_ENV` env var during copy-paste. Very common when pasting from docs, Slack, or Excel.

**Fix (Vercel):**
1. Project → Settings → Environment Variables
2. Click on `NODE_ENV`
3. **Select all, delete, then manually type** `production` (don't paste)
4. Save → Redeploy

**Fix (local `.env.local`):**
```bash
# Check for invisible characters
cat -A apps/ingress/.env.local | head -5
# Or in PowerShell
Get-Content apps/ingress/.env.local | Format-Hex
```

Delete and re-type the value manually.

**Prevention:** Use `.trim()` in Zod schemas for enum-like values:
```typescript
NODE_ENV: z.string().trim().pipe(z.enum(['development', 'production', 'test']))
```

---

### `Error: P1001: Can't reach database server at ...`

**Cause:** Neon connection URL is wrong, or SSL is disabled.

**Fix:**
1. Verify the URL includes `?sslmode=require`
2. Test connectivity:
   ```bash
   psql "postgresql://user:pass@host/db?sslmode=require" -c "SELECT 1"
   ```
3. Confirm Neon project is not suspended (free tier pauses after 7 days idle)

---

### `prisma: command not found` during Vercel build

**Symptom:**
```
sh: line 1: prisma: command not found
npm error code 127
```

**Cause:** Two common reasons:
1. `prisma` is in `devDependencies` but Vercel installs with `NODE_ENV=production` (skips dev deps)
2. `npx prisma` runs from a context where `node_modules/.bin` isn't in `PATH`, so it fetches `prisma@latest` (which is now `8.0.0-rc.25` and has no `generate` command)

**Fix (the one that works):**

**Root `package.json`:**
```json
"dependencies": {
  "prisma": "6.19.3",
  "@prisma/client": "6.19.3"
}
```
Exact version, not `^6.2.0`.

**Vercel → Settings → Build Command:**
```bash
node ./node_modules/prisma/build/index.js generate --schema=./packages/db/prisma/schema.prisma && npm run build
```

**Do NOT use `npx`** in build commands. `npx` downloads latest if local binary is missing.

---

## Vercel Deployment

### "No exports found in module ... main.js" (Workers/Ingress)

**Symptom:**
```
No exports found in module "/var/task/apps/workers/src/main.js".
Did you forget to export a function or a server?
Node.js process exited with exit status: 1.
```

**Cause:** Vercel serverless requires a **default export handler**. Calling `app.listen()` doesn't work — Vercel manages the HTTP server. The function must return a callable `(req, res) => void`.

**Fix (NestJS):**

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

let cachedServer: any = null;

async function createApp() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('internal');
  await app.init();
  return app;
}

export default async function handler(req: any, res: any) {
  if (!cachedServer) {
    const app = await createApp();
    cachedServer = app.getHttpAdapter().getInstance();
  }
  return cachedServer(req, res);
}

if (!process.env.VERCEL) {
  (async () => {
    const app = await createApp();
    await app.listen(3003);
  })();
}
```

**Fix (Express):**

```typescript
const app = createApp();
export default app;

if (!process.env.VERCEL) {
  app.listen(3002);
}
```

**Also add `vercel.json`:**
```json
{
  "version": 2,
  "builds": [{ "src": "src/main.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "src/main.ts" }]
}
```

---

### "Include source files outside of Root Directory" — why is it needed?

**Cause:** In a monorepo, `packages/db` and `packages/shared` are at the repo root. But the app (`apps/api`) is deployed from a subdirectory. Vercel needs to access both.

**Fix:** In every app project's Settings:
- **Build & Development → Include source files outside of the Root Directory in the Build Step** → **ON**

Without this, `@prisma/client` and other workspace packages won't resolve.

---

### Deployment stuck on an old commit

**Symptom:** Every push triggers a deploy, but the deployed commit SHA stays at `d44e994` (or another old SHA) instead of the latest.

**Cause:** Vercel's GitHub webhook silently broke, or "Ignored Build Step" is skipping builds.

**Fix:**
1. **Settings → Build & Development → Ignored Build Step** — set to **Automatic** (clear custom command)
2. **Settings → Git → Disconnect** → **Reconnect** the repo
3. Manually **Redeploy** with "Use existing Build Cache" **unchecked**
4. If still stuck, push a `--allow-empty` commit to force trigger

---

### Build cache serving stale files

**Symptom:** Build passes but app behaves like an old version.

**Fix:** Always uncheck **"Use existing Build Cache"** when redeploying manually:
```
Deployments → latest → ⋯ → Redeploy → ☐ Use existing Build Cache → Redeploy
```

---

## Runtime Errors

### `GroqError: timeout must be an integer`

**Symptom:** Workers crash on first request.

```
GroqError: timeout must be an integer
    at validatePositiveInteger (groq-sdk/core.js:703)
```

**Cause:** Environment variables are **strings**. `config.get<number>('GROQ_TIMEOUT_MS')` only satisfies TypeScript — at runtime it's `"6000"`, not `6000`. Groq SDK rejects string.

**Fix:**
```typescript
// ❌ Wrong
const timeout = config.get<number>('GROQ_TIMEOUT_MS') ?? 20000;

// ✅ Correct
const timeout = parseInt(config.get<string>('GROQ_TIMEOUT_MS') ?? '20000', 10);
```

Same pattern applies to `ADAPTER_TIMEOUT_MS`, `BATCH_SIZE`, `TIME_BUDGET_MS`, and any numeric env var.

---

### `CLI.UNKNOWN_COMMAND: No command registered for 'generate'`

**Symptom:** Vercel build fails with:
```
✘ [CLI.UNKNOWN_COMMAND] No command registered for `generate`
→ List every command: prisma --help
```

**Cause:** `npx prisma generate` fetched `prisma@latest` (`8.0.0-rc.25`) which removed the `generate` command (replaced by new workflow).

**Fix:**
1. Pin exact version in root and workspace `package.json`: `"prisma": "6.19.3"`
2. Delete `package-lock.json`, run `npm install` to regenerate
3. In Vercel build command, use absolute path:
   ```
   node ./node_modules/prisma/build/index.js generate --schema=./packages/db/prisma/schema.prisma
   ```
4. Never use `npx` in build scripts

---

### MongoDB `MongooseServerSelectionError`

**Cause:** Atlas IP whitelist doesn't include Vercel's IPs, or credentials are wrong.

**Fix:**
1. Atlas → Network Access → Add IP → `0.0.0.0/0` (allow all — for free tier)
2. Verify URI in env: `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority`
3. If password contains special chars (`@`, `:`, `/`), URL-encode them (`@` → `%40`)

---

## Delivery & Retries

### Deliveries stuck in `pending` forever

**Cause:** `/internal/deliver` isn't being triggered, OR `nextAttemptAt` is in the future and no cron is running.

**Diagnose:**
```bash
# Check pending count
curl https://relayon-workers.vercel.app/internal/egress/stats \
  -H "X-Cron-Secret: <secret>"
```

**Fix:**
- If `pending > 0` and no cron → set up GitHub Actions cron (see `DEPLOYMENT.md`)
- If `pending = 0` but events don't deliver → check destination config

**Manually trigger:**
```bash
curl -X POST https://relayon-workers.vercel.app/internal/deliver \
  -H "X-Cron-Secret: <secret>"
```

---

### Circuit breaker permanently open

**Symptom:** All deliveries to a destination retry indefinitely, no actual HTTP attempts made.

**Cause:** `circuit:dest:{id}` counter in Redis stuck above threshold.

**Diagnose:**
```bash
# In Upstash console → Data Browser → search `circuit:dest:`
# Value will show the current failure count
```

**Fix:**
- Wait 300 seconds (circuit auto-closes after TTL)
- OR manually delete the key in Upstash console
- AND verify the destination is actually healthy before it retries

---

### Max retries exhausted but reason is unclear

**Symptom:** Delivery in DLQ, `dlqReason: 'Max retry attempts exhausted'`, but `lastResponse.statusCode: 0`.

**Cause:** Adapter never reached the destination — network error or timeout.

**Check `attempts` array in MongoDB:**
```javascript
db.deliveries.findOne({ _id: ObjectId("...") })
// Look at attempts[].error — will say "Adapter timed out" or "ECONNREFUSED"
```

**Common causes:**
- Destination URL is unreachable from Vercel's region
- Destination requires IP allowlist (Vercel IPs change)
- Timeout too short (`ADAPTER_TIMEOUT_MS` default 15s)

---

## AI Enrichment

### Enrichment always fails with `401 Unauthorized`

**Cause:** `GROQ_API_KEY` invalid or expired.

**Fix:**
```bash
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"
```
If this fails, generate a new key at https://console.groq.com.

---

### Enrichment always fails with `404 model_not_found`

**Cause:** `GROQ_MODEL` env var references a model not available in your Groq region.

**Fix:**
```bash
# List available models
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY" | grep '"id"'
```

Set `GROQ_MODEL` to one that's listed. Known-good models as of v1.0:
- `openai/gpt-oss-120b` (recommended)
- `openai/gpt-oss-20b` (faster)
- `llama-3.3-70b-versatile` (if available in your region)

**Note:** Model availability varies by region. `llama-3.3-70b-versatile` is NOT available in all accounts.

---

### Enrichment slow (>5s per event)

**Cause:** Groq free tier can queue requests during peak hours.

**Fix:**
- Increase cache TTL (`groq.enrich` caches for 1h by default)
- Batch more events per call (increase `BATCH_SIZE`)
- Reduce `GROQ_MAX_TOKENS` if summaries are getting verbose
- Consider upgrading to Groq paid tier ($0.05/1K requests)

---

## Authentication

### "Invalid or expired token" on every request

**Cause:** JWT_SECRET changed on server, invalidating all existing tokens.

**Fix:** Log in again. If login also fails, verify:
```bash
curl https://relayon-api.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}'
```
If this fails, check API logs for `JWT_SECRET` errors.

---

### "Invalid email or password" even with correct credentials

**Cause (most common):** Password stored with one bcrypt cost, compared with another. Or the user was created via a different auth path.

**Fix:**
- Verify the user exists in PostgreSQL: `SELECT email, role FROM users WHERE email = '...'`
- Check `password_hash` starts with `$2a$` or `$2b$` (bcrypt marker)
- If not, the user was created via an older schema — reset the password

---

### Auto-logout after 15 minutes

**Cause:** This is by design. Access tokens expire in 15 minutes.

**Fix:** The dashboard's `authInterceptor` refreshes silently. If you're getting logged out instead, verify:
- `JWT_REFRESH_SECRET` is set on API
- `refreshTokens` table in PostgreSQL has a valid row
- Network tab shows the `/api/auth/refresh` call returning 200

---

## Cron & Automation

### GitHub Actions cron doesn't run at scheduled time

**Cause:** GitHub Actions schedule is **best-effort**. Expected delay: 10-60 minutes. Under load, can skip entirely.

**Fix:** This is expected behavior. For tighter timing:
- Use `workflow_dispatch` to manually trigger
- Or use [cron-job.org](https://cron-job.org) (free, 1-min interval)
- Or use [Upstash QStash](https://upstash.com/qstash) (retries + DLQ)

---

### Vercel cron doesn't fire every 2 hours

**Cause:** Vercel Hobby allows **1 cron per project, once per day**. That's the hard limit.

**Fix:**
- Use external cron (GitHub Actions, cron-job.org, QStash)
- Or upgrade to Vercel Pro ($20/mo) for more frequent crons
- Vercel reads the `crons` array in `vercel.json` but silently ignores any cron that fires more than once per day on Hobby

---

## Performance

### API cold start takes 3-8 seconds

**Cause:** NestJS + Prisma + Mongoose + Config initialization on cold start.

**Expected:** First request after idle → 3-8s. Subsequent requests → 100-200ms (warm).

**Fix:** Can't eliminate cold starts on Vercel Hobby. Mitigations:
- Use a **keep-alive** GitHub Actions workflow that pings `/api/health` every 12 hours
- Or upgrade to Vercel Pro (keeps functions warm longer)
- Or accept it (real users only see the first request; subsequent requests are fast)

---

### Dashboard loads slowly on first visit

**Cause:** Angular bundle (~310 KB) is fetched from Vercel CDN.

**Fix:**
- Verify CDN caching is working: `curl -I https://relayon.vercel.app` — check `cache-control: public, max-age=31536000, immutable` for assets
- Check the browser Network tab for the largest assets
- Lazy-loaded feature chunks should be under 15 KB each

---

## Diagnostics

### Check queue depth

```bash
curl https://relayon-workers.vercel.app/internal/status \
  -H "X-Cron-Secret: <secret>"
```

Response:
```json
{ "incoming": 5, "processing": 0, "egress": 12, "timestamp": "..." }
```

Healthy state: `processing` should always be near 0. If it grows, `recoverStuck` isn't running.

---

### Check egress health

```bash
curl https://relayon-workers.vercel.app/internal/egress/stats \
  -H "X-Cron-Secret: <secret>"
```

Response:
```json
{ "pending": 12, "delayed": 3, "delivered24h": 308, "dlq": 2 }
```

Healthy state: `delivered24h >> dlq`. If `dlq > 5%` of `delivered24h`, investigate destination config.

---

### Check individual event lifecycle

**In MongoDB:**
```javascript
db.events.findOne({ correlationId: "a1578194-..." })
```

Look at:
- `status` — should be `processed` or `failed`
- `enrichment.error` — if set, Groq failed
- `error` — if set, transform failed

**Deliveries for the event:**
```javascript
db.deliveries.find({ eventId: "<mongo-id-from-above>" })
```

Look at:
- `status` — `delivered`, `dlq`, `pending`, `delivering`
- `attempts` — array of attempts, each with `statusCode`, `latencyMs`, `error`
- `lastResponse` — most recent response snippet

---

### Check circuit breaker state

**In Upstash console** → Data Browser → search `circuit:dest:`

Each key shows the current failure count. `>= 5` means circuit is open (deliveries paused for this destination).

---

## Still Stuck?

1. **Search existing issues** at [github.com/zainshah3464/relayon/issues](https://github.com/zainshah3464/relayon/issues)
2. **Open a new issue** with:
   - Which service is failing (API / Ingress / Workers / Dashboard)
   - Exact error message (copy-paste, not paraphrase)
   - Your environment (local / Vercel / Docker)
   - Steps to reproduce
3. **For security issues**, email `zainshahzs110@gmail.com` (do not open a public issue)

**Response time:** 24-72 hours for non-urgent issues, 24 hours for security.
```

---