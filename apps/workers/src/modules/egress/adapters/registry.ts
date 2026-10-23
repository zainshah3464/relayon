import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { DeliveryAdapter } from './types';
import {
  DESTINATION_ADAPTER_METADATA,
  type DestinationAdapterMetadata,
} from './plugin.decorator';

export interface RegisteredAdapter {
  instance: DeliveryAdapter;
  meta: DestinationAdapterMetadata;
}

@Injectable()
export class AdapterRegistry implements OnModuleInit {
  private readonly logger = new Logger(AdapterRegistry.name);
  private readonly byType = new Map<string, RegisteredAdapter>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    const providers = this.discovery.getProviders();

    for (const wrapper of providers) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object') continue;

      const proto = Object.getPrototypeOf(instance);
      if (!proto || typeof proto !== 'object') continue;

      const className = proto.constructor?.name;
      if (!className) continue;

      const meta = this.reflector.get<DestinationAdapterMetadata>(
        DESTINATION_ADAPTER_METADATA,
        proto.constructor,
      );
      if (!meta) continue;

      if (typeof (instance as DeliveryAdapter).send !== 'function') {
        this.logger.warn(
          `Adapter ${className} has @DestinationAdapter but no send() method — skipped`,
        );
        continue;
      }

      if (this.byType.has(meta.type)) {
        this.logger.warn(
          `Duplicate adapter type '${meta.type}' (${className}) — ignoring duplicate`,
        );
        continue;
      }

      this.byType.set(meta.type, {
        instance: instance as DeliveryAdapter,
        meta,
      });
      this.logger.log(`Adapter registered: ${meta.type} → ${className}`);
    }

    if (this.byType.size === 0) {
      this.logger.error('No destination adapters registered — delivery will fail');
    }

    // Keep scanner referenced so Nest doesn't tree-shake the import
    void this.scanner;
  }

  get(type: string): RegisteredAdapter | null {
    return this.byType.get(type) ?? null;
  }

  list(): Array<{ type: string; displayName: string; configSchema: unknown }> {
    return Array.from(this.byType.values()).map((r) => ({
      type: r.meta.type,
      displayName: r.meta.displayName,
      configSchema: r.meta.configSchema,
    }));
  }

  has(type: string): boolean {
    return this.byType.has(type);
  }
}