# Relayon — Troubleshooting

> **Common issues, their root causes, and the fixes that actually work.**
>
> **Current version:** v1.5.0

Every issue in this document was **encountered during v1.0–v1.5 development and deployment** and has been verified as a real fix. Nothing here is theoretical.

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
- [Encryption & Key Rotation (v1.3+)](#encryption--key-rotation-v13)
- [Scheduled Workflows (v1.3+)](#scheduled-workflows-v13)
- [Workflow Versioning & Diff (v1.3+)](#workflow-versioning--diff-v13)
- [Adapters (v1.2–v1.5)](#adapters-v12v15)
- [Destination Validation & Dry-Run (v1.5)](#destination-validation--dry-run-v15)
- [API Keys (v1.2+)](#api-keys-v12)
- [Dashboard UI Gotchas](#dashboard-ui-gotchas)
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
cd ../.. && npm run dev:dashboard
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

**Cause:** On Windows, Prisma's query engine `.dll` is locked by any running process that has loaded `@prisma/client`. `prisma generate` can't replace it while it's locked.

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
2. `npx prisma` runs from a context where `node_modules/.bin` isn't in `PATH`, so it fetches `prisma@latest` (which is now `8.0.0-rc.x` and has no `generate` command)

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

### `prisma migrate dev` ran on production — how to recover

**Symptom:** You accidentally ran `npm run db:migrate` (which generates new migrations) instead of `npm run db:deploy` (which applies pending migrations only) on production Neon.

**Why it's a problem:** `prisma migrate dev` can:
- Fail mid-migration, leaving schema in an inconsistent state
- Prompt interactively (blocking in CI)
- Regenerate migration files, which if pushed, changes future deploy behavior

**Fix:**
1. Check `packages/db/prisma/migrations/` — is there a **new** folder you didn't commit before?
2. If yes: delete it locally, do NOT commit
3. Restore DB from `pg_dump` backup (Neon → Restore to timestamp on free tier)
4. Apply only pending migrations: `npm run db:deploy`

**Prevention (v1.0 rule, still true in v1.5):** Never run `db:migrate` on production. Only `db:deploy`. Always `pg_dump` before.

---

## Vercel Deployment

### "No exports found in module ... main.js" (Workers/Ingress)

**Symptom:**
```
No exports found in module "/var/task/apps/workers/src/main.js".
Did you forget to export a function or a server?
Node.js process exited with exit status: 1.
```

**Cause:** Vercel serverless requires a **default export handler**. Calling `app.listen()` doesn't work — Vercel manages the HTTP server.

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
if (!process.env.VERCEL) app.listen(3002);
```

---

### "Include source files outside of Root Directory" — why is it needed?

**Cause:** In a monorepo, `packages/db` and `packages/shared` are at the repo root. But the app (`apps/api`) is deployed from a subdirectory. Vercel needs to access both.

**Fix:** In every app project's Settings:
- **Build & Development → Include source files outside of the Root Directory in the Build Step** → **ON**

Without this, `@prisma/client` and other workspace packages won't resolve.

---

### Deployment stuck on an old commit

**Cause:** Vercel's GitHub webhook silently broke, or "Ignored Build Step" is skipping builds.

**Fix:**
1. **Settings → Build & Development → Ignored Build Step** — set to **Automatic**
2. **Settings → Git → Disconnect** → **Reconnect** the repo
3. Manually **Redeploy** with "Use existing Build Cache" **unchecked**
4. If still stuck, push a `--allow-empty` commit to force trigger

---

### Build cache serving stale files

**Symptom:** Build passes but app behaves like an old version.

**Fix:** Always uncheck **"Use existing Build Cache"** when redeploying manually.

---

### `PrismaClientInitializationError: Query engine library not found`

**Symptom:** API/Workers deploy succeeds, but every request returns:
```
PrismaClientInitializationError: Query engine library for current platform "rhel-openssl-3.0.x" could not be found.
```

**Cause:** Prisma's `binaryTargets` in `schema.prisma` doesn't include Vercel's Amazon Linux 2023 runtime target.

**Fix:** Update `packages/db/prisma/schema.prisma`:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}
```

Then `npm run db:generate` and commit the regenerated `@prisma/client`. Redeploy.

**Why both targets:** `native` = local dev (Windows/Mac/Linux). `rhel-openssl-3.0.x` = Vercel Node runtime. Both needed.

---

## Runtime Errors

### `GroqError: timeout must be an integer`

**Symptom:** Workers crash on first request.

```
GroqError: timeout must be an integer
    at validatePositiveInteger (groq-sdk/core.js:703)
```

**Cause:** Environment variables are **strings**. `config.get<number>('GROQ_TIMEOUT_MS')` only satisfies TypeScript — at runtime it's `"6000"`, not `6000`.

**Fix:**
```typescript
// ❌ Wrong
const timeout = config.get<number>('GROQ_TIMEOUT_MS') ?? 20000;

// ✅ Correct
const timeout = parseInt(config.get<string>('GROQ_TIMEOUT_MS') ?? '20000', 10);
```

Same pattern applies to `ADAPTER_TIMEOUT_MS`, `BATCH_SIZE`, `TIME_BUDGET_MS`.

---

### `CLI.UNKNOWN_COMMAND: No command registered for 'generate'`

**Cause:** `npx prisma generate` fetched `prisma@latest` (`8.0.0-rc.x`) which removed the `generate` command.

**Fix:**
1. Pin exact version in root and workspace `package.json`: `"prisma": "6.19.3"`
2. Delete `package-lock.json`, run `npm install`
3. In Vercel build command, use absolute path
4. Never use `npx` in build scripts

---

### MongoDB `MongooseServerSelectionError`

**Cause:** Atlas IP whitelist doesn't include Vercel's IPs, or credentials are wrong.

**Fix:**
1. Atlas → Network Access → Add IP → `0.0.0.0/0` (allow all — for free tier)
2. Verify URI in env: `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority`
3. If password contains special chars (`@`, `:`, `/`), URL-encode them (`@` → `%40`)

---

### `Schema validation failed, no changes applied` on `db:deploy`

**Cause:** Local Prisma schema and DB migrations are out of sync (someone edited `schema.prisma` but didn't create a migration).

**Fix:**
1. Run `npx prisma migrate dev --name <descriptive-name>` locally — this creates a new migration
2. Commit the migration folder to Git
3. On next deploy, `db:deploy` will apply it

**Never edit already-applied migrations.** They are immutable once shipped.

---

## Delivery & Retries

### Deliveries stuck in `pending` forever

**Cause:** `/internal/deliver` isn't being triggered, OR `nextAttemptAt` is in the future and no cron is running.

**Diagnose:**
```bash
curl https://relayon-workers.vercel.app/internal/egress/stats \
  -H "X-Cron-Secret: <secret>"
```

**Fix:**
- If `pending > 0` and no cron → set up external cron (see `DEPLOYMENT.md`)
- If `pending = 0` but events don't deliver → check destination config

**Manually trigger:**
```bash
curl -X POST https://relayon-workers.vercel.app/internal/deliver \
  -H "X-Cron-Secret: <secret>"
```

---

### Circuit breaker permanently open

**Symptom:** All deliveries to a destination retry indefinitely, no actual HTTP attempts made.

**Cause:** `circuit:dest:{id}` counter in Redis stuck above threshold (5).

**Diagnose:** Upstash console → Data Browser → search `circuit:dest:`

**Fix:**
- Wait 300 seconds (auto-closes after TTL)
- OR delete the key manually in Upstash console
- AND verify the destination is actually healthy before it retries

---

### Max retries exhausted but reason is unclear

**Symptom:** Delivery in DLQ, `dlqReason: 'Max retry attempts exhausted'`, but `lastResponse.statusCode: 0`.

**Cause:** Adapter never reached the destination — network error or timeout.

**Check `attempts` array in MongoDB:**
```javascript
db.deliveries.findOne({ _id: ObjectId("...") })
// attempts[].error will say "Adapter timed out" or "ECONNREFUSED"
```

**Common causes:**
- Destination URL unreachable from Vercel's region
- Destination requires IP allowlist (Vercel IPs change)
- Timeout too short (`ADAPTER_TIMEOUT_MS` default 15s)

---

### Slack destination fails with "missing or invalid 'webhookUrl'"

**Symptom:** DLQ entry with:
```json
{ "code": "network_error", "message": "slack adapter: missing or invalid 'webhookUrl'" }
```

**Cause (from v1.3 chat):** Two possibilities:
1. The webhook URL stored doesn't start with `https://hooks.slack.com/` — the adapter's local validation rejects it before ever calling Slack
2. The webhook URL was created with dummy test data (e.g., `https://hooks.slack.com/services/FAKE/TEST/URL`) — this passes the local check, but Slack API returns `404` because the webhook doesn't actually exist

**Diagnose:**
```javascript
// Prisma Studio → destinations → your destination → config
// Or:
db.destinations.findOne({ name: 'Test Slack' })
// Then check config.webhookUrl — is it enc:v2:... (encrypted, expected)
```

**Fix:**
- If config shows `enc:v2:...` but delivery fails → the **decrypted** URL is invalid. Re-save the destination with a real webhook URL.
- If config shows plaintext `https://hooks.slack.com/services/FAKE/...` → this is a fake URL from testing. Re-save with a real one.

**Critical:** This is **not a bug** — it's the adapter correctly rejecting an invalid Slack webhook. Two DLQ entries from fake URLs is expected behavior in testing.

**Verification trick:** After creating a Slack destination, decrypt and check via the API:
```bash
curl -H "Authorization: Bearer <jwt>" \
  https://relayon-api.vercel.app/api/workflows/<id>/destinations
```
Should return `{"config": {"webhookUrl": "••••••••"}}` — redacted, not ciphertext, not plaintext.

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

**Cause:** `GROQ_MODEL` references a model not available in your Groq region.

**Fix:**
```bash
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY" | grep '"id"'
```

Set `GROQ_MODEL` to one that's listed. Known-good:
- `openai/gpt-oss-120b` (recommended)
- `openai/gpt-oss-20b` (faster)
- `llama-3.3-70b-versatile` (if available)

**Note:** Model availability varies by region.

---

### Enrichment slow (>5s per event)

**Cause:** Groq free tier can queue requests during peak hours.

**Fix:**
- Increase cache TTL (`groq.enrich` caches 1h by default)
- Batch more events (`BATCH_SIZE`)
- Reduce `GROQ_MAX_TOKENS`
- Consider Groq paid tier

---

## Authentication

### "Invalid or expired token" on every request

**Cause:** JWT_SECRET changed, invalidating all tokens.

**Fix:** Log in again. If login fails, verify:
```bash
curl https://relayon-api.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}'
```

---

### "Invalid email or password" even with correct credentials

**Cause (most common):** Password stored with one bcrypt cost, compared with another. Or user created via a different auth path.

**Fix:**
- Verify user exists: `SELECT email, role FROM users WHERE email = '...'`
- Check `password_hash` starts with `$2a$` or `$2b$` (bcrypt marker)

---

### Auto-logout after 15 minutes

**Cause:** By design. Access tokens expire in 15 minutes.

**Fix:** The dashboard's `authInterceptor` refreshes silently. If getting logged out instead, verify:
- `JWT_REFRESH_SECRET` set on API
- `refresh_tokens` table has valid row
- Network tab shows `/api/auth/refresh` returning 200

---

### `curl: The system cannot find the file specified` (Windows CMD)

**Symptom:** Running a curl command like:
```cmd
curl -H "Authorization: Bearer <jwt-token>" https://relayon-api.vercel.app/api/workflows
```
Returns:
```
The system cannot find the file specified.
```

**Cause:** `<` and `>` are **redirection operators** in Windows CMD. `<jwt-token>` is interpreted as "redirect from file named jwt-token" — which doesn't exist.

**Fix:** Use the actual token, not the placeholder. And **always** use `%JWT%` variable for long tokens:

```cmd
set JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

curl -H "Authorization: Bearer %JWT%" ^
  https://relayon-api.vercel.app/api/workflows/YOUR_WORKFLOW_ID/destinations
```

**In PowerShell:**
```powershell
$JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
curl -H "Authorization: Bearer $JWT" `
  https://relayon-api.vercel.app/api/workflows/YOUR_WORKFLOW_ID/destinations
```

**Rule:** Never use `<placeholder>` in CMD. Always paste the real value or use a variable.

---

### Getting a real JWT for manual testing

**Step 1 — Login and grab the token:**
```cmd
curl -X POST https://relayon-api.vercel.app/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"zain@acme.com\",\"password\":\"YOUR_PASSWORD\"}"
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "user": { ... }
}
```

**Step 2 — Use it:**
```cmd
set JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

curl -H "Authorization: Bearer %JWT%" ^
  https://relayon-api.vercel.app/api/workflows
```

**If you don't remember the password:** Skip JWT testing — verify via Prisma Studio (local DB) instead. All encryption/state checks can be done there without a token.

---

## Cron & Automation

### GitHub Actions cron doesn't run at scheduled time

**Cause:** GitHub Actions schedule is **best-effort**. Expected delay: 10-60 minutes. Under load, can skip entirely.

**Fix:** Use `workflow_dispatch` for manual triggers, or cron-job.org (1-min interval), or Upstash QStash.

---

### Vercel cron doesn't fire every 2 hours

**Cause:** Vercel Hobby allows **1 cron per project, once per day**. Hard limit.

**Fix:** Use external cron (cron-job.org, GitHub Actions, QStash), or upgrade to Vercel Pro.

---

### Schedule tick returns `{due: 0, enqueued: 0}` forever

**Cause (v1.3+):** Nothing is due. Possible reasons:
1. `nextRunAt` is in the future (schedule not yet reached)
2. Schedule `isActive: false` (paused or deactivated)
3. External cron isn't hitting `/internal/schedule/tick` at all
4. The workflow itself is inactive

**Diagnose via Prisma Studio:**
```sql
-- All schedules
SELECT workflow_id, cron_expression, is_active, next_run_at, last_run_at
FROM workflow_schedules;
```

**Diagnose via workers status endpoint:**
```cmd
curl https://relayon-workers.vercel.app/internal/schedule/status ^
  -H "X-Cron-Secret: <secret>"
```

**Fix depending on cause:**
- If `next_run_at` is future → wait, or click "Run now" in dashboard
- If `is_active = false` → click "Resume" in dashboard
- If external cron not calling tick → add it to cron-job.org
- If workflow inactive → activate workflow

**Force a test:**
```sql
-- Set nextRunAt to past (via Prisma Studio)
UPDATE workflow_schedules
SET next_run_at = NOW() - INTERVAL '1 minute'
WHERE workflow_id = 'YOUR_WORKFLOW_ID';
```
Then hit tick. Should return `{enqueued: 1}`.

---

## Performance

### API cold start takes 3-8 seconds

**Cause:** NestJS + Prisma + Mongoose + Config initialization on cold start.

**Expected:** First request after idle → 3-8s. Subsequent → 100-200ms.

**Fix:** Use keep-alive GitHub Actions workflow pinging `/api/health` every 12 hours. Or accept it.

---

### Dashboard loads slowly on first visit

**Cause:** Angular bundle (~310 KB v1.0, ~340 KB v1.5) fetched from CDN.

**Fix:** Verify CDN caching works: `curl -I https://relayon.vercel.app` — check `cache-control` header.

---

## Encryption & Key Rotation (v1.3+)

### `CONNECTOR_ENCRYPTION_KEY must be 64 hex chars`

**Cause:** Env var is missing, wrong length, or has non-hex characters.

**Fix:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
This prints 64 hex chars. Paste (don't include quotes, don't include whitespace) into `CONNECTOR_ENCRYPTION_KEY` or `CONNECTOR_ENCRYPTION_KEYS`.

---

### `Unsupported state or unable to authenticate data` on delivery

**Cause:** API and Workers have **different** encryption keys. API encrypted data with key A, Workers tries to decrypt with key B → GCM auth tag fails.

**Fix:**
1. Open `apps/api/.env.local` — copy the exact value of `CONNECTOR_ENCRYPTION_KEY` (or `_KEYS`)
2. Open `apps/workers/.env.local` — paste the same value
3. **In production (Vercel):** Same on both projects' env vars
4. Restart both services

**Verification:**
```bash
# Both must be identical
grep CONNECTOR_ENCRYPTION apps/api/.env.local
grep CONNECTOR_ENCRYPTION apps/workers/.env.local
```

**v1.4+ note:** `CONNECTOR_ENCRYPTION_KEYS` (plural) also must match. Format: `kid1:hexkey1,kid2:hexkey2`. **Same kid, same key, same order** in both apps.

---

### Secrets showing plaintext in Prisma Studio

**Symptom:** Open `destinations` table → `config` column shows `{"webhookUrl": "https://hooks.slack.com/..."}` instead of `{"webhookUrl": "enc:v2:..."}`.

**Cause (from v1.3):** Two possibilities:
1. `destinations.service.ts` didn't call `encryptConfig()` — code wasn't deployed or hasn't restarted
2. The field isn't in `SECRET_CONFIG_KEYS` — e.g., HTTP `url` and `method` are **intentionally plaintext** (not secrets)

**Verify by destination type:**

| Type | Encrypted fields |
|---|---|
| `slack`, `discord` | `webhookUrl` |
| `email` | `apiKey`, `privateKey` |
| `sheets` | `privateKey` |
| `airtable`, `notion` | `apiKey` |
| `postgres`, `mongodb` | `connectionString` |
| `http` | **None** — `url`/`method`/`headers` are plaintext by design |

**HTTP destination is NOT a bug** — `url` is an endpoint (not a secret), and it's rendered in the dashboard summary. If you want full encryption including `url`, set `FULL_CONFIG_ENCRYPTION=true` (v1.5+).

**If a real secret field (e.g., `webhookUrl` on Slack) is plaintext:**
1. Check Workers startup log — did it log `encryptConfig` being called?
2. Verify `destinations.service.ts` imports `encryptConfig` from `crypto-box`
3. Restart API
4. Re-save the destination

---

### `Unknown kid "key-2026-01"` after rotation

**Symptom:** Delivery moves to DLQ with:
```json
{ "message": "Credential decryption failed: Unknown kid \"key-2026-01\" — is this key still present in CONNECTOR_ENCRYPTION_KEYS?" }
```

**Cause:** An encrypted envelope exists in the DB that was encrypted with `key-2026-01`, but that key was removed from the env var **before** the rotation script re-encrypted all data.

**Fix (in order of preference):**
1. **Re-add the missing key:** Put `key-2026-01:<hex>` back into `CONNECTOR_ENCRYPTION_KEYS`. Redeploy. Delivery succeeds. Then run rotation script to re-encrypt, THEN remove old key.
2. **Or restore from backup:** If key is lost forever, the affected rows are unrecoverable.
3. **Or re-save affected destinations:** If you only have a few destinations, delete and recreate them with fresh credentials.

**Prevention (from v1.4 runbook):**
- **Never** remove a key from the ring without running the rotation script first
- **Verify** rotation completed: `SELECT config FROM destinations` should show only `enc:v2:<current-kid>:...`
- **Wait 24h** after rotation before removing the old key

---

### `enc:v2:` migration from `enc:v1:` — is it required?

**Short answer:** No. v1.4 code decrypts `enc:v1:` envelopes automatically (tries every key in the ring). Migration is **opt-in** for key rotation, not required for v1.4 to work.

**When to migrate:**
- You want to rotate the encryption key (security hygiene, compliance)
- You're removing an old key from the ring

**How to migrate:**
```bash
npm run build:api
node scripts/rotate-encryption-key.mjs
```

Script iterates every workflow and destination, decrypts with any matching key, re-encrypts with current key. **Idempotent** — safe to run multiple times.

---

## Scheduled Workflows (v1.3+)

### `Cannot PUT /api/workflows/:id/schedule` (404 error in dashboard)

**Symptom (v1.3–v1.4 real bug, from chat):**
- Dashboard shows "Cannot PUT /api/workflows/a3c1f122.../schedule"
- Or "Cannot PUT" in the schedule card error area
- API logs show **no route** for `/api/workflows/:workflowId/schedule`

**Cause (the actual v1.4 bug):** `SchedulesModule` was **never imported in `apps/api/src/app.module.ts`**. The controller file existed, the service existed, but the module was never registered — so NestJS never mapped the routes at runtime. TypeScript build passed because module wiring isn't typechecked.

**Fix:**
1. Open `apps/api/src/app.module.ts`
2. Ensure `SchedulesModule` is in `imports`:
   ```typescript
   import { SchedulesModule } from './modules/schedules/schedules.module';

   @Module({
     imports: [
       // ... other modules
       SchedulesModule,  // ← must be here
     ],
   })
   export class AppModule {}
   ```
3. Save → API auto-restarts (watch mode)
4. Verify in API logs:
   ```
   [RoutesResolver] SchedulesController {/api/workflows/:workflowId/schedule}
   [RouterExplorer] Mapped {/api/workflows/:workflowId/schedule, GET} route
   [RouterExplorer] Mapped {/api/workflows/:workflowId/schedule, PUT} route
   [RouterExplorer] Mapped {/api/workflows/:workflowId/schedule, DELETE} route
   [RouterExplorer] Mapped {/api/workflows/:workflowId/schedule/run-now, POST} route
   ```

**Missing route = module not imported.** This is the most common NestJS gotcha. If a route 404s but the controller file exists, check `app.module.ts` first.

---

### `Cannot POST .../schedule/run-now` (v1.4)

**Cause:** `WORKERS_URL` or `CRON_SECRET` missing in API env. The run-now endpoint forwards to Workers, so it needs both.

**Fix:**
```env
# apps/api/.env.local
WORKERS_URL=http://localhost:3003
CRON_SECRET=<same as workers' secret>
```

For Vercel production: add both env vars to the API project, redeploy.

---

### Run-now button shows "✓ Triggered" but no event appears

**Cause:** The trigger succeeded at API level, but Workers didn't actually enqueue the event — or the external cron isn't processing the queue.

**Diagnose:**
```cmd
# Check if event is in the queue
curl https://relayon-workers.vercel.app/internal/status ^
  -H "X-Cron-Secret: <secret>"
```

If `incoming > 0` → event is queued but processing cron isn't running. Manually trigger:
```cmd
curl -X POST https://relayon-workers.vercel.app/internal/process ^
  -H "X-Cron-Secret: <secret>"
```

If `incoming = 0` → event was processed but delivery may have failed. Check Events page for the correlation ID returned by run-now.

---

### `runNow` fails with "Workflow is inactive"

**Cause (v1.4):** The workflow is set to `isActive: false`, but the schedule itself might still be active.

**Fix:** Activate the workflow in the dashboard. The schedule will then fire normally on the next cron tick, and run-now will work.

---

### Bulk pause/resume returning `updated: 0`

**Cause (v1.5):** You have no schedules, or all schedules are already in the target state.

**Verify:**
```sql
SELECT COUNT(*) FROM workflow_schedules WHERE is_active = true;
-- If 0, pause-all correctly returns {updated: 0}
```

This is **not an error** — it's accurate reporting.

---

### Bulk routes not working (404 on `/api/schedules/bulk/pause-all`)

**Cause (v1.5):** `SchedulesBulkController` not registered in `SchedulesModule`.

**Fix:**
1. Open `apps/api/src/modules/schedules/schedules.module.ts`
2. Ensure both controllers are registered:
   ```typescript
   @Module({
     controllers: [SchedulesController, SchedulesBulkController],  // ← both
     providers: [SchedulesService],
     exports: [SchedulesService],
   })
   export class SchedulesModule {}
   ```
3. Check API logs for `/api/schedules/bulk/pause-all` mapping

**Why a separate controller:** `@Controller('workflows/:workflowId/schedule')` conflicts with `/bulk/pause-all` — the router would match `bulk` as `:workflowId`. Separate `@Controller('schedules')` avoids the conflict.

---

## Workflow Versioning & Diff (v1.3+)

### Version history shows only v1 after multiple edits

**Cause:** The version capture hook isn't firing on updates. `WorkflowsService.update()` should call `WorkflowVersionsService.capture()`.

**Fix:**
1. Check `workflows.service.ts` — does `update()` call `this.versions.capture(...)` at the end?
2. Check `WorkflowsModule` — is `WorkflowVersionsService` in `providers`?
3. Restart API. Make an edit. Check `GET /workflows/:id/versions`.

---

### `GET /versions/:id` returns `404 Not Found`

**Cause:** Version doesn't exist for this tenant. Either the workflow is new (no versions yet) or the tenant check failed.

**Verify:**
```javascript
// Prisma Studio → workflow_versions table
// Filter by workflowId and tenantId
```

If empty → versions were never captured (see previous issue).

---

### Restore creates new version but destinations are missing

**Cause:** Not a bug — restore **deletes all destinations and recreates them from the snapshot**. Their UUIDs change. Any external system referencing old destination IDs will need updating.

**Verify:**
1. Check the new version's snapshot: `GET /workflows/:id/versions/:v` — does `snapshot.destinations` have the expected entries?
2. Check the actual destinations: `GET /workflows/:id/destinations` — same count?

If snapshot has destinations but actual doesn't → bug in restore transaction. Check API logs for `$transaction` errors.

---

### Diff returns `identical: true` for versions that are clearly different

**Cause:** One of two things:
1. The snapshots really are byte-equal (empty edit, no-op update)
2. The snapshots are structurally equal but the diff compares JSON-stringified version (whitespace-sensitive)

**Verify:**
```bash
curl -H "Authorization: Bearer %JWT%" ^
  https://relayon-api.vercel.app/api/workflows/YOUR_ID/versions/1
curl -H "Authorization: Bearer %JWT%" ^
  https://relayon-api.vercel.app/api/workflows/YOUR_ID/versions/2
```
Compare `snapshot` objects. If they're equal → `identical: true` is correct.

**Known limitation:** Diff is line-based on pretty-printed JSON. Reordering keys with same values will show as a diff even though data is semantically identical.

---

### Diff output is enormous / unreadable

**Cause:** Large snapshots (many destinations, long transform expressions) produce many diff lines.

**Fix:** The endpoint caps at context=3 lines by default. Frontend renders with color-coding and scroll. If a specific diff is unusable, download the two snapshots separately and compare manually.

---

## Adapters (v1.2–v1.5)

### `Cannot find module 'pg-format'` or TypeScript error on `pg-format` import

**Cause (v1.4):** `pg-format` has no `@types/pg-format` package on npm.

**Fix:** Add a module declaration in `apps/workers/src/types.d.ts`:

```typescript
declare module 'pg-format' {
  const format: {
    (format: string, ...args: unknown[]): string;
    ident: (val: string) => string;
    literal: (val: unknown) => string;
    string: (val: string) => string;
  };
  export default format;
}
```

Then `npm run typecheck` should pass.

---

### `diff@7` import fails with ESM error

**Symptom (v1.5):**
```
Error [ERR_REQUIRE_ESM]: require() of ES Module /node_modules/diff/libesm/index.js not supported
```

**Cause:** `diff@7` is ESM-first. NestJS CommonJS build can't `import` it directly.

**Fix (the one that works):** Use `require()` with a type assertion:

```typescript
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createTwoFilesPatch } = require('diff') as {
  createTwoFilesPatch: (
    oldFile: string,
    newFile: string,
    oldStr: string,
    newStr: string,
    oldHeader?: string,
    newHeader?: string,
    options?: { context?: number },
  ) => string;
};
```

**Not the fix:** Adding `esModuleInterop: true` — that doesn't help ESM-only packages in a CommonJS context.

---

### Airtable adapter returns `422 Unprocessable Entity`

**Cause (v1.3):** Payload field names don't match Airtable column names, and `typecast: false` (default).

**Fix:**
1. In Airtable → your base → your table → verify column names are exactly as expected
2. In destination config, set `"typecast": true` to allow Airtable to coerce types
3. If column names differ from payload keys, either:
   - Rename Airtable columns to match, OR
   - Add a JSONata transform to reshape the payload before delivery

**Example:** If Airtable has a column named `Event Type` (with space), the payload field must be `"Event Type"` (with space).

---

### Notion adapter returns `404 Not Found` even with valid credentials

**Cause (v1.3):** Notion integration isn't **shared** with the target database. Notion's API returns `404` for resources the integration doesn't have access to (security through obscurity).

**Fix:**
1. Open the Notion database in your browser
2. Click `•••` (top right) → `Connections` → `Add connections`
3. Select your integration
4. Save → retry the delivery

**Verification:** You can also test via:
```bash
curl https://api.notion.com/v1/data_sources/<dataSourceId> \
  -H "Authorization: Bearer <apiKey>" \
  -H "Notion-Version: 2026-03-11"
```
If this returns `404`, the integration isn't shared. If it returns `200`, the destination should work.

---

### PostgreSQL adapter `ECONNREFUSED`

**Cause:** Connection string is wrong, SSL is misconfigured, or the PG server is rejecting Vercel's IP.

**Fix:**
1. Verify `connectionString` includes `?sslmode=require` for cloud-hosted Postgres (Neon, Supabase, RDS)
2. Test the connection from the destination modal → "Test connection" (v1.5+). This runs `SELECT 1` without inserting.
3. If `SELECT 1` fails but psql works locally → check that the PG server allows `0.0.0.0/0` or Vercel's IP range
4. Check Workers logs for exact error (`ETIMEDOUT` vs `ECONNREFUSED` vs `28P01` auth failure)

**`28P01` = authentication failed.** Double-check user/password in the connection string.

---

### PostgreSQL adapter `relation "events" does not exist`

**Cause:** Table specified in config doesn't exist, or `search_path` isn't set correctly.

**Fix:**
1. In destination config, `table` can be `"events"` (uses default search_path) or `"myschema.events"` (explicit schema)
2. If using `"events"`, ensure `search_path` on the PG side includes the target schema
3. Regex validation rejects anything not matching `^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$` — dots are allowed for schema.table

**Verify table exists:**
```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name = 'events';
```

---

### PostgreSQL adapter `column "event_type" does not exist`

**Cause:** `columns` mapping is wrong, or payload doesn't have the path being mapped.

**Fix:**
- `columns: { "type": "event_type" }` means "extract payload.type, insert into event_type column"
- If payload is `{ "data": { "type": "..." } }`, the mapping needs `{ "data.type": "event_type" }`
- If no columns mapped, adapter falls back to single `payload` JSONB column — verify that column exists
- Run `Test connection` first (v1.5) — dry-run does `SELECT 1` only, won't reveal column mismatches. Real delivery will.

---

### MongoDB adapter `MongoServerSelectionError`

**Cause:** Connection string format wrong, IP not allowed in Atlas, or credentials wrong.

**Fix:**
1. URI must start with `mongodb://` or `mongodb+srv://`
2. Atlas → Network Access → allow Vercel IPs (`0.0.0.0/0` for free tier)
3. If password has `@`, `:`, `/`, or other special chars → URL-encode (`@` → `%40`)
4. Test via destination "Test connection" (v1.5) — runs `ping`, doesn't insert

---

### MongoDB adapter documents missing `_relayon` metadata

**Cause:** Adapter uses `_relayon` field to store event metadata. If missing, either:
1. The destination wasn't using the MongoDB adapter (wrong type)
2. An older code version is deployed

**Verify:**
```javascript
db.events.findOne()  // check for _relayon field
```

If missing → redeploy Workers with latest code.

---

### Discord adapter — webhook URL rejected

**Cause (v1.2):** URL doesn't start with `https://discord.com/api/webhooks/`.

**Fix:** Discord webhook URLs have this exact format:
```
https://discord.com/api/webhooks/<webhook_id>/<webhook_token>
```
If you have an old `discordapp.com` URL, replace with `discord.com`. Discord migrated their domain in 2022.

---

### Adapter not appearing in dropdown after adding

**Cause (v1.2+):** The `@DestinationAdapter` decorator is present, but the adapter class isn't in `EgressModule.providers`.

**Fix:**
1. Open `apps/workers/src/modules/egress/egress.module.ts`
2. Add the new adapter to `providers`:
   ```typescript
   providers: [
     // ... existing
     YourNewAdapter,  // ← add here
   ]
   ```
3. Restart Workers
4. Verify startup log shows `[AdapterRegistry] Adapter registered: <type> → <ClassName>`

---

## Destination Validation & Dry-Run (v1.5)

### Validate endpoint returns `401 Unauthorized`

**Symptom (v1.5, from chat):**
```cmd
curl -X POST http://localhost:3001/api/destinations/validate ^
  -H "Authorization: Bearer b6d7d62****************************" ^
  -H "Content-Type: application/json" ^
  -d "{\"type\":\"http\",\"config\":{}}"
# {"statusCode":401,"error":"Unauthorized","message":"Invalid or expired token"}
```

**Cause:** Two issues combined:
1. **`Bearer` prefix missing** — should be `Authorization: Bearer <token>`, not `Authorization: <token>`
2. **Token is fake/masked** — `b6d7d62****...` is not a real JWT

**Fix:**
1. Get a real JWT (see [Getting a real JWT](#getting-a-real-jwt-for-manual-testing))
2. Use `Bearer` prefix
3. Use `%JWT%` variable in CMD to avoid shell parsing issues

**Not a bug:** 401 is correct behavior — the endpoint is properly guarded. The test was wrong, not the server.

---

### Test connection button shows "✓ Connection verified" but 0ms latency

**Symptom (v1.5, from chat):** Dashboard shows:
```
✓ Connection verified
HTTP 200 · 0ms
```

**Cause:** Two possibilities:
1. **HTTP HEAD returns 405/4xx fast** — some servers respond to HEAD in <1ms from edge. Real latency is sub-1ms.
2. **Latency calculation bug** — `Date.now() - started` where `started` was set inside the dry-run branch instead of at the top of `send()`.

**Verify:**
- Test against `https://httpbin.org/post` — should show 200-500ms (real network round-trip)
- Test against `https://httpbin.org/status/500` — should show `✗ Validation failed` with `Reachable but returned 500`

**If both return 0ms → bug in HTTP adapter's dry-run latency calculation.** Check that `started` is set at the very beginning of `send()` before the `__dryRun` branch.

**If real URLs show real latency but fast URLs show 0ms → not a bug.** HEAD is just fast.

---

### Validate returns `layer: 'schema'` instead of `layer: 'both'`

**Cause (v1.5):** Workers unreachable from API. The dry-run was skipped because:
- `WORKERS_URL` not set on API
- `CRON_SECRET` mismatch between API and Workers
- Workers deployment is down

**Diagnose:**
```bash
# From API's context, can it reach Workers?
curl -X POST $WORKERS_URL/internal/egress/dry-run \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"http","config":{"url":"https://httpbin.org/post"}}'
```

**Response tells you:**
- `401` → `CRON_SECRET` mismatch
- `404` → Workers route missing (module not imported)
- `500` → Workers internal error (check logs)
- `200` → Workers reachable; the issue was API not sending request — verify API env

**Graceful fallback:** If Workers unreachable, `layer: 'schema'` with a warning is returned — the config still validates for schema. This is by design.

---

### Dry-run sent a real Slack message

**This is the v1.5 safety bug that was caught before ship.**

**Cause:** If the Slack adapter doesn't honor `ctx.config.__dryRun`, the "Test connection" button calls the real webhook → real message sent to channel.

**Fix:** Every adapter **must** check `__dryRun === true` before the real `fetch`. For Slack/Discord (which can't be probed without sending), return:
```typescript
if (ctx.config['__dryRun'] === true) {
  return {
    success: true,
    statusCode: 200,
    latencyMs: Date.now() - started,
    responseBody: 'config valid — Slack webhooks cannot be tested without sending a message',
    error: null,
    retryable: false,
  };
}
```

**Verify no message sent:** After clicking "Test connection" on a Slack destination, check the Slack channel. If a "Relayon test" or "Validation payload" message appears, the adapter is missing the `__dryRun` check.

**For contributors:** Adding a new adapter without `__dryRun` handling will be rejected in PR review (see `CONTRIBUTING.md`).

---

## API Keys (v1.2+)

### `X-API-Key` returns `401 Unauthorized`

**Cause:** One of:
1. Key format invalid (doesn't match `rlk_<live|test>_<8hex>_<48hex>`)
2. Key revoked (`revokedAt` set)
3. Key expired (`expiresAt` < now)
4. Key hash mismatch (`API_KEY_PEPPER` changed)
5. Wrong environment (used `rlk_test_*` in production)

**Diagnose:**
```bash
# Check key exists in DB
SELECT prefix, scopes, environment, expires_at, revoked_at
FROM api_keys
WHERE prefix = 'rlk_live_ab12cd34';
```

**Fix depending on cause:**
- Revoked → create new key
- Expired → create new key with longer TTL or `neverExpires: true`
- `API_KEY_PEPPER` changed → **all keys invalid**. This is a breaking change, documented. Must reissue all keys.

---

### `403 Forbidden` with "Missing scope(s): workflows:write"

**Cause:** The API key was created with insufficient scopes. E.g., you have `workflows:read` but tried to `POST /api/workflows`.

**Fix:**
1. Create a new key with the needed scope (you cannot edit an existing key's scopes)
2. Revoke the old key
3. Deploy the new key to your application

**Available scopes:**
```
events:read, workflows:read, workflows:write, destinations:read,
destinations:write, dlq:read, dlq:write, analytics:read
```

**JWT sessions bypass scopes** — dashboard always has full tenant access. Scope enforcement is only for API keys.

---

### Rotated API key — old key still working after 24h

**Cause (v1.5):** The grace window caps old key's `expiresAt` at `now + 24h`. If it's still working past 24h, either:
1. `expiresAt` wasn't actually updated during rotate (bug in transaction)
2. Verify logic in `ApiKeysService.verify()` doesn't check `expiresAt`

**Verify in DB:**
```sql
SELECT id, prefix, expires_at, revoked_at
FROM api_keys
WHERE id = 'old-key-id';
```

`expires_at` should be `~now + 24h` from when rotate was called. If it's `null` or `>24h`, rotate didn't cap it correctly.

**Workaround:** Manually revoke with `DELETE /api/api-keys/:id`. Immediate effect.

---

### `prefix` collision on API key create

**Symptom:** Rare `409 Conflict` from `api_keys.prefix` unique constraint.

**Cause:** 8-hex prefix = 4 bytes = 32 bits of randomness. Collision probability is ~1 in 4 billion — extremely rare but theoretically possible under massive volume.

**Fix:** Just retry the create. If it happens frequently, that's a signal of a bigger issue (e.g., broken `randomBytes`).

**Not fixed in v1.5** — no auto-retry. Accepted as negligible.

---

## Dashboard UI Gotchas

### Version history button, schedule card, or Airtable/Notion dropdown missing

**This is the v1.3 bug that shipped a whole release late.**

**Symptom (from chat screenshot):**
- Workflow detail page has no "Version history" button
- No "Scheduled trigger" card
- "+ Add destination" dropdown doesn't include Airtable or Notion
- Only HTTP / Slack / Email / Sheets show

**Cause:** `apps/dashboard/src/app/features/workflows/workflow-detail.component.ts` was **never updated** in v1.3. The new `WorkflowScheduleCardComponent` and `WorkflowVersionsDrawerComponent` files existed on disk but were **never imported** into `workflow-detail.component.ts`. Angular had no reason to render them.

**The last v1.3 commit only pushed `package.json`** — the actual component file was never committed. This is what happens when you trust `git status` without checking which files are staged.

**Fix:**
1. Open `workflow-detail.component.ts`
2. Add imports:
   ```typescript
   import { WorkflowScheduleCardComponent } from './workflow-schedule-card.component';
   import { WorkflowVersionsDrawerComponent } from './workflow-versions-drawer.component';
   ```
3. Add to `@Component.imports`:
   ```typescript
   imports: [
     CommonModule, RouterLink, ReactiveFormsModule, FormsModule,
     WorkflowScheduleCardComponent,     // ← was missing
     WorkflowVersionsDrawerComponent,   // ← was missing
   ],
   ```
4. Add `<app-workflow-schedule-card [workflowId]="wf.id" />` in template
5. Add `@if (showVersions()) { <app-workflow-versions-drawer ... /> }` block
6. Add `showVersions = signal(false)` to class
7. Add Airtable/Notion options to the `<select>` in destination modal
8. Add `@case ('airtable')` and `@case ('notion')` blocks

**Verify:**
- Local: `npm run typecheck` → 0 errors
- Browser: refresh workflow detail → 3 buttons top-right (Copy / Export / Version history)
- Schedule card visible under webhook URL
- "+ Add destination" dropdown → 9 options

**Prevention:** Always run the UI test locally before pushing. If you added a component file, verify it renders — `git add` doesn't guarantee it's imported anywhere.

---

### `destinationSummary` shows "Slack/Discord webhook" for `enc:v2:` envelopes

**Symptom (from chat):** Destination card shows `Slack/Discord webhook` instead of `•••••••• (encrypted)` — despite the DB storing `enc:v2:` properly.

**Cause:** The `destinationSummary()` function in `workflow-detail.component.ts` checks `.startsWith('enc:v1:')`, but v1.4+ uses `enc:v2:`.

```typescript
// ❌ Current (v1.3 code)
if (typeof cfg['webhookUrl'] === 'string')
  return (cfg['webhookUrl'] as string).startsWith('enc:v1:')
    ? '•••••••• (encrypted)'
    : 'Slack/Discord webhook';

// ✅ Should be (v1.5+)
const wu = cfg['webhookUrl'] as string;
if (wu.startsWith('enc:v1:') || wu.startsWith('enc:v2:')) {
  return '•••••••• (encrypted)';
}
return 'Slack/Discord webhook';
```

**Status:** Cosmetic bug, not fixed in v1.5. Added to v2.0 roadmap. Workaround: ignore the display — DB and API are correct.

---

### Chart shows blank / axes render "Invalid Date"

**Symptom (v1.2):** Time-series chart is empty, or X-axis labels show "Invalid Date".

**Cause:** MongoDB `$dateTrunc` returns `Date` objects, but the API was passing them to the frontend as-is. Angular's `| date` pipe chokes on raw `Date` from JSON (it expects ISO string or timestamp).

**Fix:**
1. In `analytics.service.ts` (backend), convert all `_id` values (which are `Date` objects) to `.toISOString()` before response
2. In chart component, ensure `new Date(p.ts)` used for X-axis computation

**Verify:** Check the `/api/analytics/timeseries` response — `ts` field should be `"2026-10-25T00:00:00Z"` (string), not a Date object.

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

**Healthy state:** `processing` should always be near 0. If it grows, `recoverStuck` isn't running.

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

**Healthy state:** `delivered24h >> dlq`. If `dlq > 5%` of `delivered24h`, investigate destination config.

---

### Check list of registered adapters

```bash
curl https://relayon-workers.vercel.app/internal/adapters \
  -H "X-Cron-Secret: <secret>"
```

Expected (v1.5 — 9 adapters):
```json
[
  { "type": "http", ... },
  { "type": "slack", ... },
  { "type": "email", ... },
  { "type": "sheets", ... },
  { "type": "discord", ... },
  { "type": "airtable", ... },
  { "type": "notion", ... },
  { "type": "postgres", ... },
  { "type": "mongodb", ... }
]
```

**If less than 9:** An adapter class isn't in `EgressModule.providers`.

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
- `attempts` — array with `statusCode`, `latencyMs`, `error`
- `lastResponse` — most recent response snippet

---

### Check circuit breaker state

**In Upstash console** → Data Browser → search `circuit:dest:`

Each key shows the current failure count. `>= 5` means circuit is open.

---

### Check encryption round-trip

**Prisma Studio → destinations → your destination → config**

Expected for encrypted destinations:
```json
{ "webhookUrl": "enc:v2:key-2026-10:..." }
```

If plaintext on a secret field → not encrypted. See [Secrets showing plaintext](#secrets-showing-plaintext-in-prisma-studio).

**API response check:**
```bash
curl -H "Authorization: Bearer %JWT%" ^
  https://relayon-api.vercel.app/api/workflows/YOUR_ID/destinations
```

Expected: `{"config": {"webhookUrl": "••••••••"}}` — masked, not ciphertext, not plaintext.

---

### Verify a specific API route is mapped (v1.3+)

**API and Workers startup logs** show every mapped route:
```
[Nest] LOG [RouterExplorer] Mapped {/api/workflows/:workflowId/schedule, PUT} route
```

**If a route is missing from logs but the controller file exists → module not imported in `app.module.ts`.** This is the single most common NestJS runtime bug (bit us in v1.3 and v1.4).

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