# Relayon — Production Deployment Guide

Target: Vercel Hobby ($0) + Neon + Upstash + MongoDB Atlas + Groq + Cloudinary + Resend.

## 0. Prerequisites

- GitHub repo pushed to `main`
- Neon PostgreSQL created (use **pooled** connection string)
- Upstash Redis created (`rediss://` TCP URL)
- MongoDB Atlas M0 created (`0.0.0.0/0` allowed)
- Groq API key created
- Vercel account connected to GitHub

## 1. Local production checks

```bash
npm ci
npm run db:generate
npm run typecheck
npm run build:dashboard && npm run build:api && npm run build:ingress && npm run build:workers
```

## 2. Database migration (before first deploy)

```bash
cd packages/db
DATABASE_URL="postgresql://...neon...?sslmode=require" npx prisma migrate deploy
cd ../..
```

## 3. Create 4 Vercel projects

From **vercel.com/new → Import Git Repository**, create one project per app.

| Vercel Project | Root Directory | Framework Preset | Build Command | Output Directory |
|---|---|---|---|---|
| `relayon-dashboard` | `apps/dashboard` | Angular | `npm run build` | `dist/dashboard/browser` |
| `relayon-api` | `apps/api` | NestJS | auto | auto |
| `relayon-ingress` | `apps/ingress` | Express | auto | auto |
| `relayon-workers` | `apps/workers` | NestJS | auto | auto |

For API, Ingress, Workers: in **Settings → Build & Development**, enable
**"Include source files outside of the Root Directory in the Build Step"**.

Node version: **22.x**. Region: same as Neon/Upstash (e.g. Singapore).

## 4. Environment variable matrix

| Variable | Dashboard | API | Ingress | Workers |
|---|---|---|---|---|
| `NODE_ENV` | — | `production` | `production` | `production` |
| `DATABASE_URL` | — | ✅ | ✅ | ✅ |
| `MONGODB_URI` | — | ✅ | — | ✅ |
| `MONGODB_DB_NAME` | — | ✅ | — | ✅ |
| `UPSTASH_REDIS_TCP_URL` | — | — | ✅ | ✅ |
| `GROQ_API_KEY` | — | — | — | ✅ |
| `GROQ_MODEL` | — | — | — | ✅ |
| `GROQ_TIMEOUT_MS` | — | — | — | `6000` |
| `GROQ_MAX_TOKENS` | — | — | — | `1024` |
| `GROQ_TEMPERATURE` | — | — | — | `0.2` |
| `JWT_SECRET` | — | ✅ | — | — |
| `JWT_EXPIRES_IN` | — | `15m` | — | — |
| `JWT_REFRESH_EXPIRES_IN` | — | `7d` | — | — |
| `IP_HASH_SALT` | — | — | ✅ | — |
| `WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` | — | — | `300` | — |
| `CRON_SECRET` | — | — | — | ✅ |
| `BATCH_SIZE` | — | — | — | `3` |
| `TIME_BUDGET_MS` | — | — | — | `7000` |
| `ADAPTER_TIMEOUT_MS` | — | — | — | `6000` |
| `CORS_ORIGIN` | — | dashboard URL | dashboard URL | — |
| `SENTRY_DSN` | — | optional | optional | optional |

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 5. Deploy order

1. **API** → deploy → copy `https://relayon-api.vercel.app`
2. **Ingress** → deploy → copy `https://relayon-ingress.vercel.app`
3. **Workers** → deploy → copy `https://relayon-workers.vercel.app`
4. **Dashboard** → ensure `environment.prod.ts` URLs match → deploy

Update `CORS_ORIGIN` on API and Ingress to the dashboard domain, then redeploy both.

## 6. External cron (required on Hobby)

Vercel Hobby cron runs once per day only. Use **cron-job.org** (free, 1-minute interval):

| Job | Method | URL | Header | Schedule |
|---|---|---|---|---|
| Process | POST | `https://relayon-workers.vercel.app/internal/process` | `X-Cron-Secret: <secret>` | Every 5 min |
| Deliver | POST | `https://relayon-workers.vercel.app/internal/deliver` | `X-Cron-Secret: <secret>` | Every 5 min |

Alternative: Upstash QStash (1,000 messages/day free, 10 schedules, retries + DLQ).

## 7. Smoke test

```bash
CRON_SECRET=<workers-secret> npm run smoke
```

## 8. CI

GitHub Actions `.github/workflows/ci.yml` runs typecheck + build on every push/PR.
`keep-alive.yml` pings health every 12 hours.

## 9. Rollback

Vercel → Project → Deployments → last good deployment → **⋯ → Promote to Production**.

## 10. Limits & upgrade path

- Hobby = non-commercial use. Commercial → Vercel Pro ($20/mo).
- Hobby = 1 concurrent build; 4 projects deploy sequentially.
- Groq free tier rate limit — batching + cache already implemented.
- Upstash free 10K commands/day.
- MongoDB M0 512 MB — TTL indexes auto-delete old events.

## 11. Post-deploy checklist

- [ ] API health `{"status":"ok"}`
- [ ] Ingress health `{"status":"ok"}`
- [ ] Workers health `{"status":"ok"}`
- [ ] Dashboard login works
- [ ] Create workflow + destination
- [ ] Send webhook → event visible
- [ ] DLQ replay works
- [ ] `npm run smoke` passes
- [ ] Cron-job.org executions show 200
- [ ] Sentry (if configured) shows no errors
```

---