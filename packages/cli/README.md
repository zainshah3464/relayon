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

MIT
```

---