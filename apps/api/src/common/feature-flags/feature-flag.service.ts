import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';

interface CachedFlag {
  enabled: boolean;
  rolloutPct: number;
  overrides: Record<string, boolean>;
}

const CACHE_TTL_MS = 30_000;

@Injectable()
export class FeatureFlagService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagService.name);
  private cache = new Map<string, CachedFlag>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.refresh().catch(() => undefined);
    setInterval(() => this.refresh().catch(() => undefined), CACHE_TTL_MS);
  }

  async refresh(): Promise<void> {
    try {
      const rows = await this.prisma.withoutTenant((c) => c.featureFlag.findMany());
      const next = new Map<string, CachedFlag>();
      for (const r of rows) {
        next.set(r.key, {
          enabled: r.isEnabled,
          rolloutPct: r.rolloutPct,
          overrides: (r.tenantOverrides ?? {}) as Record<string, boolean>,
        });
      }
      this.cache = next;
    } catch (err) {
      this.logger.warn(
        `Feature flag refresh failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  isEnabled(key: string, tenantId: string | null): boolean {
    const flag = this.cache.get(key);
    if (!flag) return false;

    if (tenantId && flag.overrides[tenantId] !== undefined) {
      return flag.overrides[tenantId]!;
    }
    if (!flag.enabled) return false;
    if (flag.rolloutPct >= 100) return true;
    if (!tenantId) return false;

    const bucket = this.hashTenant(tenantId) % 100;
    return bucket < flag.rolloutPct;
  }

  allFor(tenantId: string | null): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const key of this.cache.keys()) {
      out[key] = this.isEnabled(key, tenantId);
    }
    return out;
  }

  private hashTenant(id: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h;
  }
}