import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decryptConfig } from '../../lib/crypto-box';
import type { Provider } from './provider-validators';

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

@Injectable()
export class ProviderKeyResolver {
  private readonly logger = new Logger(ProviderKeyResolver.name);
  private cache = new Map<string, { value: ResolvedKey | null; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async resolve(tenantId: string, provider: Provider): Promise<ResolvedKey | null> {
    const cacheKey = `${tenantId}:${provider}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let resolved: ResolvedKey | null = null;

    // 1. Tenant key
    try {
      const row = await this.prisma.withTenant(tenantId, (tx) =>
        tx.tenantIntegration.findFirst({
          where: { tenantId, provider, isActive: true },
        }),
      );
      if (row) {
        try {
          const decrypted = decryptConfig({ key: row.encryptedKey }, tenantId)[
            'key'
          ] as string;
          resolved = { key: decrypted, model: row.model, source: 'tenant' };
        } catch (err) {
          this.logger.error(
            `Failed to decrypt key for ${tenantId}/${provider}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Tenant key lookup failed for ${tenantId}/${provider}: ${err instanceof Error ? err.message : err}`,
      );
    }

    // 2. Platform fallback
    if (!resolved) {
      const envKey = this.config.get<string>(PLATFORM_ENV[provider].key);
      const envModel = PLATFORM_ENV[provider].model
        ? this.config.get<string>(PLATFORM_ENV[provider].model!) ?? null
        : null;
      if (envKey && envKey.length > 0) {
        resolved = { key: envKey, model: envModel, source: 'platform' };
      }
    }

    this.cache.set(cacheKey, { value: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
    return resolved;
  }

  invalidate(tenantId: string, provider: Provider): void {
    this.cache.delete(`${tenantId}:${provider}`);
  }
}