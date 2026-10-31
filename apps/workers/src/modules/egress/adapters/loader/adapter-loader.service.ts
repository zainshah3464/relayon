import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { ManifestSchema, type Manifest } from './manifest.schema';
import type { SandboxResponse } from './types';
import type { AdapterResult, DeliveryAdapter, DeliveryContext } from '../types';

const ADAPTERS_DIR =
  process.env['RELAYON_EXTERNAL_ADAPTERS_DIR'] ??
  resolve(process.cwd(), 'adapters');
const SANDBOX_TIMEOUT_MS = 5_000;

interface LoadedAdapter {
  manifest: Manifest;
  instance: DeliveryAdapter;
}

@Injectable()
export class AdapterLoaderService implements OnModuleInit {
  private readonly logger = new Logger(AdapterLoaderService.name);
  private readonly loaded = new Map<string, LoadedAdapter>();

  async onModuleInit(): Promise<void> {
    try {
      const dirStat = await stat(ADAPTERS_DIR);
      if (!dirStat.isDirectory()) {
        this.logger.log(`External adapters dir not found — skipping`);
        return;
      }
    } catch {
      this.logger.log(`External adapters dir missing — skipping`);
      return;
    }

    const entries = await readdir(ADAPTERS_DIR);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      try {
        await this.loadAdapter(join(ADAPTERS_DIR, entry));
      } catch (err) {
        this.logger.error(
          `Failed to load ${entry}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    this.logger.log(`Loaded ${this.loaded.size} external adapter(s)`);
  }

  private async loadAdapter(dir: string): Promise<void> {
    const manifestRaw = await readFile(join(dir, 'manifest.json'), 'utf8');

    let manifestJson: unknown;
    try {
      manifestJson = JSON.parse(manifestRaw);
    } catch {
      throw new Error('manifest.json is not valid JSON');
    }

    const parsed = ManifestSchema.safeParse(manifestJson);
    if (!parsed.success) {
      throw new Error(
        `manifest validation: ${parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      );
    }
    const manifest = parsed.data;

    const entrypointPath = resolve(dir, manifest.entrypoint);
    if (!entrypointPath.startsWith(resolve(dir) + '/')) {
      throw new Error(`path traversal in entrypoint "${manifest.entrypoint}"`);
    }

    const entrypointStat = await stat(entrypointPath).catch(() => null);
    if (!entrypointStat?.isFile()) {
      throw new Error(`entrypoint not found: ${manifest.entrypoint}`);
    }

    if (this.loaded.has(manifest.type)) {
      throw new Error(`duplicate adapter type "${manifest.type}"`);
    }

    const instance: DeliveryAdapter = {
      type: manifest.type,
      send: (ctx) => this.runSandboxed(manifest, entrypointPath, ctx),
    };

    this.loaded.set(manifest.type, { manifest, instance });
    this.logger.log(
      `External adapter loaded: ${manifest.type} (${manifest.trust}, v${manifest.version})`,
    );
  }

  private async runSandboxed(
    manifest: Manifest,
    entrypointPath: string,
    ctx: DeliveryContext,
  ): Promise<AdapterResult> {
    const started = Date.now();

    if (manifest.trust === 'trusted') {
      return {
        success: false, statusCode: 0, latencyMs: 0, responseBody: '',
        error: 'External adapters must declare trust="sandboxed"',
        retryable: false,
      };
    }

    return new Promise<AdapterResult>((resolvePromise) => {
      const worker = new Worker(
        resolve(__dirname, 'sandbox-runner.js'),
        {
          workerData: {
            entrypointPath,
            config: ctx.config,
            payload: ctx.payload,
            context: {
              eventId: ctx.eventId,
              correlationId: ctx.correlationId,
              attemptNumber: ctx.attemptNumber,
            },
            timeoutMs: SANDBOX_TIMEOUT_MS,
          },
          resourceLimits: {
            maxOldGenerationSizeMb: 64,
            maxYoungGenerationSizeMb: 16,
            stackSizeMb: 2,
          },
        },
      );

      const killTimer = setTimeout(() => {
        worker.terminate().catch(() => undefined);
        resolvePromise({
          success: false, statusCode: 0,
          latencyMs: Date.now() - started, responseBody: '',
          error: `Sandbox exceeded ${SANDBOX_TIMEOUT_MS}ms — worker killed`,
          retryable: true,
        });
      }, SANDBOX_TIMEOUT_MS + 500);

      worker.on('message', (msg: { kind: string; result?: SandboxResponse; error?: string }) => {
        if (msg.kind === 'result' && msg.result) {
          clearTimeout(killTimer);
          worker.terminate().catch(() => undefined);
          resolvePromise({
            ...msg.result,
            latencyMs: msg.result.latencyMs || Date.now() - started,
          });
        } else if (msg.kind === 'error') {
          clearTimeout(killTimer);
          worker.terminate().catch(() => undefined);
          resolvePromise({
            success: false, statusCode: 0,
            latencyMs: Date.now() - started, responseBody: '',
            error: msg.error ?? 'Sandbox error',
            retryable: false,
          });
        }
      });

      worker.on('error', (err) => {
        clearTimeout(killTimer);
        resolvePromise({
          success: false, statusCode: 0,
          latencyMs: Date.now() - started, responseBody: '',
          error: `Sandbox crash: ${err.message}`,
          retryable: false,
        });
      });
    });
  }

  list(): Array<{
    type: string;
    displayName: string;
    trust: 'sandboxed' | 'trusted';
    version: string;
    source: 'external';
    fields: Manifest['fields'];
  }> {
    return Array.from(this.loaded.values()).map(({ manifest }) => ({
      type: manifest.type,
      displayName: manifest.displayName,
      trust: manifest.trust,
      version: manifest.version,
      source: 'external' as const,
      fields: manifest.fields,
    }));
  }

  get(type: string): DeliveryAdapter | null {
    return this.loaded.get(type)?.instance ?? null;
  }
}