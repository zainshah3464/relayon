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

MIT
```

---