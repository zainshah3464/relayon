import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { DeliveryAdapter } from './types';
import {
  DESTINATION_ADAPTER_METADATA,
  type DestinationAdapterMetadata,
} from './plugin.decorator';
import { AdapterLoaderService } from './loader/adapter-loader.service';

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
    private readonly external: AdapterLoaderService,
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
        this.logger.warn(`Adapter ${className} has no send() — skipped`);
        continue;
      }

      if (this.byType.has(meta.type)) {
        this.logger.warn(`Duplicate adapter type '${meta.type}' — ignored`);
        continue;
      }

      this.byType.set(meta.type, {
        instance: instance as DeliveryAdapter,
        meta,
      });
      this.logger.log(`Adapter registered: ${meta.type} → ${className}`);
    }

    if (this.byType.size === 0) {
      this.logger.error('No built-in destination adapters registered');
    }

    this.logger.log(
      `Registry ready: ${this.byType.size} built-in + ${this.external.list().length} external`,
    );

    void this.scanner;
  }

  get(type: string): RegisteredAdapter | null {
    const builtin = this.byType.get(type);
    if (builtin) return builtin;

    const ext = this.external.get(type);
    if (ext) {
      return {
        instance: ext,
        meta: {
          type,
          displayName: type,
          fields: [],
        },
      };
    }
    return null;
  }

  list() {
    const builtins = Array.from(this.byType.values()).map((r) => ({
      type: r.meta.type,
      displayName: r.meta.displayName,
      trust: 'builtin' as const,
      version: '1.0.0',
      source: 'builtin' as const,
      fields: r.meta.fields,
      testPayload: r.meta.testPayload ?? null,
    }));

    const externals = this.external.list().map((e) => ({
      ...e,
      testPayload: null,
    }));

    return [...builtins, ...externals];
  }

  has(type: string): boolean {
    return this.byType.has(type) || this.external.get(type) !== null;
  }
}