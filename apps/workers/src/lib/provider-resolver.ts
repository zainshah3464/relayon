import { PrismaClient } from '@prisma/client';
import { decryptConfig } from './crypto-box';

export type Provider = 'groq' | 'openai' | 'anthropic' | 'resend';

export interface ResolvedKey {
  key: string;
  model: string | null;
  source: 'tenant' | 'platform';
}

const CACHE_TTL_MS = 60_000;

const PLATFORM_ENV: Record<Provider, { key: string; model?: string }> = {
  groq: { key: 'GROQ_API_KEY', model: 'GROQ_MODEL' },
  openai: { key: 'OPENAI_API_KEY' },
  anthropic: { key: 'ANTHROPIC_API_KEY' },
  resend: { key: 'RESEND_API_KEY' },
};

const cache = new Map<string, { value: ResolvedKey | null; expiresAt: number }>();

let prismaClient: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prismaClient) prismaClient = new PrismaClient();
  return prismaClient;
}

export async function resolveProviderKey(
  tenantId: string,
  provider: Provider,
): Promise<ResolvedKey | null> {
  const cacheKey = `${tenantId}:${provider}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let resolved: ResolvedKey | null = null;

  // 1. Tenant key
  try {
    const prisma = getPrisma();
    const row = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return tx.tenantIntegration.findFirst({
        where: { tenantId, provider, isActive: true },
      });
    });

    if (row) {
      try {
        const decrypted = decryptConfig({ key: row.encryptedKey }, tenantId)[
          'key'
        ] as string;
        resolved = { key: decrypted, model: row.model, source: 'tenant' };
      } catch {
        // decryption failed — fall through to platform
      }
    }
  } catch {
    // DB error — fall through to platform
  }

  // 2. Platform fallback
  if (!resolved) {
    const envKey = process.env[PLATFORM_ENV[provider].key];
    const envModel = PLATFORM_ENV[provider].model
      ? process.env[PLATFORM_ENV[provider].model!] ?? null
      : null;
    if (envKey) resolved = { key: envKey, model: envModel, source: 'platform' };
  }

  cache.set(cacheKey, { value: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
  return resolved;
}

export function invalidateProviderKey(tenantId: string, provider: Provider): void {
  cache.delete(`${tenantId}:${provider}`);
}