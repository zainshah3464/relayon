/**
 * @relayon/sdk — Official SDK for the Relayon webhook relay platform.
 *
 * Two ways to use:
 *
 *   1. Explicit (fully typed):
 *      import { createRelayonClient, sdk } from '@relayon/sdk';
 *      const client = createRelayonClient({ apiKey: 'rlk_live_...' });
 *      const { data, error } = await sdk.Workflows_list({ client });
 *
 *   2. Convenience (auto-injects client):
 *      import { createRelayon } from '@relayon/sdk';
 *      const relayon = createRelayon({ apiKey: 'rlk_live_...' });
 *      const { data, error } = await relayon.Workflows_list();
 */
import { createClient, createConfig } from './generated/client/index.js';
import * as sdk from './generated/sdk.gen.js';

export * from './generated/types.gen.js';
export * from './generated/sdk.gen.js';
export { createClient, createConfig } from './generated/client/index.js';
export { sdk };

export interface RelayonOptions {
  /** API key from Settings → API Keys. Takes precedence over accessToken. */
  apiKey?: string;
  /** JWT from /api/auth/login. Used for user-scoped operations. */
  accessToken?: string;
  /** Override API URL (default: production). */
  baseUrl?: string;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
  /** Custom fetch implementation (retries, logging, Next.js caching). */
  fetch?: typeof fetch;
  /** Request timeout in ms (default: 30_000). */
  timeoutMs?: number;
}

// ═══════════════════════════════════════════════════════════════
// Explicit usage — fully typed, tree-shakeable
// ═══════════════════════════════════════════════════════════════

export function createRelayonClient(opts: RelayonOptions) {
  if (!opts.apiKey && !opts.accessToken) {
    throw new Error('Relayon: provide either apiKey or accessToken');
  }

  const authHeaders: Record<string, string> = {};
  if (opts.apiKey) authHeaders['X-API-Key'] = opts.apiKey;
  else if (opts.accessToken) authHeaders['Authorization'] = `Bearer ${opts.accessToken}`;

  return createClient(
    createConfig({
      baseUrl: opts.baseUrl ?? 'https://relayon-api.vercel.app',
      headers: {
        'Content-Type': 'application/json',
        'X-Relayon-SDK': '3.0.0',
        'X-Relayon-SDK-Language': 'typescript',
        ...authHeaders,
        ...opts.headers,
      },
      fetch: opts.fetch,
    }),
  );
}

// ═══════════════════════════════════════════════════════════════
// Convenience usage — Proxy auto-injects client
// ═══════════════════════════════════════════════════════════════

type SdkModule = typeof sdk;
type SdkFn = (...args: never[]) => unknown;

type BoundSdk = {
  [K in keyof SdkModule]: SdkModule[K] extends (args: infer A) => infer R
    ? A extends { client?: unknown }
      ? (args?: Omit<A, 'client'>) => R
      : SdkModule[K]
    : SdkModule[K];
};

export type RelayonClient = {
  readonly fetchClient: ReturnType<typeof createRelayonClient>;
} & BoundSdk;

export function createRelayon(opts: RelayonOptions): RelayonClient {
  const fetchClient = createRelayonClient(opts);

  return new Proxy({ fetchClient } as RelayonClient, {
    get(target, prop) {
      if (prop in target) return Reflect.get(target, prop);

      if (typeof prop === 'string' && prop in sdk) {
        const fn = (sdk as Record<string, SdkFn>)[prop];
        if (typeof fn === 'function') {
          return (args: Record<string, unknown> = {}) =>
            (fn as (a: Record<string, unknown>) => unknown)({
              ...args,
              client: fetchClient,
            });
        }
      }

      return undefined;
    },
  });
}