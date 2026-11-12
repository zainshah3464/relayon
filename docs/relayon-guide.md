# Relayon — Quick Guide

Relayon is a serverless-native webhook relay platform. It receives webhooks, optionally enriches them with AI, transforms the payload, and delivers to one or more destinations with at-least-once guarantees.

## Core Concepts

### Workflows
A workflow is the unit of configuration. It has:
- **Source type**: Stripe, GitHub, Shopify, Slack, or Generic (HMAC)
- **Source secret**: The signing secret used to verify webhook authenticity
- **Optional AI enrichment**: Groq-powered summarize/classify/extract
- **Optional transform**: JSONata expression to reshape the payload
- **Destinations**: One or more HTTP/Slack/Email/Sheets/Discord/Airtable/Notion/PG/Mongo targets

### Webhook URL
Each workflow has a unique URL: https://relayon-ingress.vercel.app/webhook/{tenantId}/{workflowId}

Paste this into your source platform (Stripe dashboard, GitHub webhook settings, etc.).

### Destinations
Supported destination types:
- **HTTP** — any URL, POST/PUT/PATCH, custom headers
- **Slack** — incoming webhook URL
- **Discord** — webhook URL
- **Email** — Resend API
- **Google Sheets** — service account + spreadsheet
- **Airtable** — personal access token + base + table
- **Notion** — integration token + data source
- **PostgreSQL** — connection string + table
- **MongoDB** — connection string + database + collection

All credentials are encrypted at rest with AES-256-GCM. You only see masked values after saving.

## Common Tasks

### Creating a workflow
1. Go to **Workflows** → **+ New workflow**
2. Name it, pick source type, paste the signing secret
3. Toggle AI enrichment if you want summaries/classification
4. Click **Create**

Then:
5. Open the workflow → **+ Add destination**
6. Configure the destination (e.g. Slack webhook URL)
7. Test connection → **Add**

### Getting the webhook URL
Open the workflow → **Copy webhook URL** button. Paste into your source platform.

### Testing without a real webhook
Open the workflow → **Test run** → paste a sample payload → see what the pipeline would produce (enrichment + transform + routing). No delivery happens, no DB writes.

## Dead Letter Queue (DLQ)

When a delivery fails 5 times (with exponential backoff), it moves to the DLQ. From `/dlq`:
- **Replay** — retry a single failed delivery
- **Discard** — remove permanently
- **Bulk replay** — retry many at once (max 100)

## Quotas

Each tenant has monthly quotas:
- **Events/month** (default 10,000 on free tier)
- **AI tokens/month** (default 100,000)

When exceeded:
- **Hard mode**: Requests return 429
- **Soft mode**: Requests allowed up to 2× limit with warning headers

Owners can adjust quotas in **Settings → Quota override**.

## Troubleshooting

### Webhook returns 401
Signature verification failed. Check that the secret in Relayon matches the signing secret in the source platform exactly.

### Delivery stuck in "delivering"
Auto-recovers within 5 minutes. If persists, check the destination URL is reachable.

### DLQ filling up
Check the destination config — common causes are expired tokens, wrong URLs, or unreachable endpoints. Fix the destination, then bulk-replay.