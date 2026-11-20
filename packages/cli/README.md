# @relayon/cli

**Forward Relayon webhooks to your localhost — ngrok alternative.**

Permanent URLs. Zero setup. Free with your Relayon account.

## Install

```bash
# One-off
npx @relayon/cli listen --port 3000

# Or globally
npm install -g @relayon/cli
relayon listen --port 3000
```

## Usage

```bash
# API key mode (recommended)
export RELAYON_API_KEY=rlk_live_...
npx @relayon/cli listen --port 3000 --label stripe-dev

# JWT mode (alternative)
export RELAYON_TOKEN=eyJhbGc...
npx @relayon/cli listen --port 3000

# Self-hosted Relayon
npx @relayon/cli listen --port 3000 \
  --api-url http://localhost:3001 \
  --api-key rlk_test_...
```

## What you get

```
  RELAYON TUNNEL

  Webhook URL:  https://relayon-ingress.vercel.app/t/a1b2c3d4e5f6g7h8
  Forwarding →  http://localhost:3000/
  Expires:      11/17/2026, 3:42:00 PM

  14:32:01  POST    /                          342B  200  12ms
  14:32:15  POST    /                          1.2KB 200  8ms
  14:33:02  POST    /                          342B  500  45ms
```

## Features

- **Permanent URLs** per `--label` — same URL across restarts (24h window)
- **SSE auto-reconnect** — survives Vercel 10s timeout, network drops
- **Buffered playback** — 200 requests replayed on reconnect
- **Buffered headers** — sensitive headers stripped (Authorization, Cookie)
- **Timeout + error reporting** — localhost down = clear message

## Differences from ngrok

| | ngrok | @relayon/cli |
|---|---|---|
| URL | Changes each session | **Permanent** (per label, 24h) |
| Signup | New account | Your existing Relayon account |
| Free tier | 40 conn/min | Unlimited (through your quota) |
| Setup | Separate service | `npx` |

## Troubleshooting

**`localhost:3000 not running`** — start your dev server first.

**`SSE 401`** — invalid API key. Regenerate in Settings → API Keys.

**Webhooks delayed** — normal (< 100ms typical). They buffer in Redis then stream.

**URL expired** — 24h TTL. Same `--label` = same URL if within window.



## License

**Proprietary source-visible.** Copyright (c) 2026 **Zain Shah**. All rights reserved.

This CLI is **free to install and run** — including on commercial projects and client work. You do **not** need to pay or ask permission to use `npx @relayon/cli` or `npm install -g @relayon/cli`.

### ✅ You MAY
- Install the CLI globally or run via `npx`
- Use it on any project — personal, commercial, client-facing, internal
- Read the source code for auditing, learning, and security review
- Contribute improvements via Pull Request (contributions are assigned to the Licensor upon merge)

### ❌ You MAY NOT (without written permission)
- **Modify** the source code for your own deployment or redistribution
- **Fork** it to build or promote a competing webhook tunnel / relay / iPaaS product
- **Resell, sublicense, or redistribute** the package (modified or unmodified) under your own name
- **Train machine-learning models** on the source code (including code-generation LLMs)
- **Remove** copyright headers, license notices, or author attribution

### 📄 Full terms
See [`LICENSE`](./LICENSE) (shipped inside this package).

### 📧 Permission requests
Email **zainshahzs110@gmail.com** with subject line **"Relayon Permission Request — [Your Name]"**.

> **Historical note (transparency):** Early versions of this CLI were published under the MIT License during the development phase, as a placeholder default — not as a deliberate licensing decision. Under copyright law, **MIT grants are irrevocable** for any copy already obtained before **November 20, 2026**; those specific versions remain usable under MIT by whoever downloaded them. **All versions published on or after November 20, 2026 are governed by the proprietary source-visible license above.** No new MIT grants are made going forward.
```

---