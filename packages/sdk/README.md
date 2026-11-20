# @relayon/sdk

Typed TypeScript SDK for [Relayon](https://relayon.vercel.app) — auto-generated from OpenAPI 3.1.

Zero runtime cost beyond `@hey-api/client-fetch` (~5KB). Tree-shakeable. Full IDE autocomplete on every endpoint.

## Install

```bash
npm install @relayon/sdk
```

## Quick start

```typescript
import { createRelayonClient, sdk } from '@relayon/sdk';

const client = createRelayonClient({
  apiKey: 'rlk_live_...',        // from Settings → API Keys
});

// camelCase functions — autocomplete shows all options
const { data, error } = await sdk.workflowsList({ client });

if (error) {
  console.error(error);
} else {
  console.log(data);
}
```

## Create a workflow

```typescript
import { createRelayonClient, sdk } from '@relayon/sdk';

const client = createRelayonClient({ apiKey: process.env.RELAYON_API_KEY! });

const { data: wf, error } = await sdk.workflowsCreate({
  client,
  body: {
    name: 'Stripe → Slack',
    sourceType: 'stripe',
    sourceConfig: { secret: 'whsec_...' },
    enrichmentEnabled: true,
  },
});

if (error) throw new Error(JSON.stringify(error));
console.log('Webhook URL:', `https://relayon-ingress.vercel.app/webhook/${wf.tenantId}/${wf.id}`);
```

## Convenience mode (Proxy)

For scripts, REPL, one-offs — client auto-injected:

```typescript
import { createRelayon } from '@relayon/sdk';

const relayon = createRelayon({ apiKey: process.env.RELAYON_API_KEY! });

// No `client` arg — auto-injected
const { data: workflows } = await relayon.workflowsList();
const { data: event } = await relayon.eventsGet({ path: { id: 'evt_abc' } });
```

## Auth modes

```typescript
// API key (server-to-server, long-lived)
createRelayon({ apiKey: 'rlk_live_...' });

// JWT (user-scoped, short-lived)
createRelayon({ accessToken: 'eyJhbGc...' });
```

## Custom fetch

```typescript
createRelayon({
  apiKey: '...',
  fetch: async (url, init) => {
    console.log('→', init?.method, url);
    const res = await fetch(url, init);
    console.log('←', res.status);
    return res;
  },
});
```

## Naming convention

SDK function names follow `controllerNameMethodName` in camelCase:

| REST endpoint | SDK function |
|---|---|
| `GET /api/workflows` | `workflowsList` |
| `POST /api/workflows` | `workflowsCreate` |
| `GET /api/workflows/:id` | `workflowsGet` |
| `GET /api/auth/me` | `authMe` |
| `POST /api/dlq/bulk-replay` | `dlqBulkReplay` |

## Regenerate after API changes

```bash
RELAYON_API_URL=http://localhost:3001 npm run sync
npm run generate
```

## License

**Proprietary source-visible.** Copyright (c) 2026 **Zain Shah**. All rights reserved.

This SDK is **free to install and use** in any project — personal or commercial. You do **not** need to pay, sign up for a paid plan, or ask permission to import it and call Relayon's API with it.

### ✅ You MAY
- `npm install @relayon/sdk` and use it in any application
- Use it commercially (SaaS, internal tools, client projects — anything)
- Read the source code for auditing, learning, and security review
- Contribute improvements via Pull Request (contributions are assigned to the Licensor upon merge)

### ❌ You MAY NOT (without written permission)
- **Modify** the source code for your own deployment or redistribution
- **Fork** it to build or promote a competing webhook relay / iPaaS product
- **Resell, sublicense, or redistribute** the package (modified or unmodified) under your own name
- **Train machine-learning models** on the source code (including code-generation LLMs)
- **Remove** copyright headers, license notices, or author attribution

### 📄 Full terms
See [`LICENSE`](./LICENSE) (shipped inside this package).

### 📧 Permission requests
Email **zainshahzs110@gmail.com** with subject line **"Relayon Permission Request — [Your Name]"**.

> **Historical note (transparency):** Early versions of this SDK were published under the MIT License during the development phase, as a placeholder default — not as a deliberate licensing decision. Under copyright law, **MIT grants are irrevocable** for any copy already obtained before **November 20, 2026**; those specific versions remain usable under MIT by whoever downloaded them. **All versions published on or after November 20, 2026 are governed by the proprietary source-visible license above.** No new MIT grants are made going forward.
```

---