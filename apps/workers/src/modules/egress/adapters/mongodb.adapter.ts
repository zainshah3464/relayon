import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { MongoClient, type Db } from 'mongodb';
import { DestinationAdapter } from './plugin.decorator';
import type { AdapterResult, DeliveryAdapter, DeliveryContext } from './types';

const CONNECT_TIMEOUT_MS = 5_000;
const OPERATION_TIMEOUT_MS = 10_000;
const CLIENT_IDLE_MS = 60_000;

interface ClientEntry {
  client: MongoClient;
  uri: string;
  lastUsedAt: number;
}

@Injectable()
@DestinationAdapter({
  type: 'mongodb',
  displayName: 'MongoDB',
  configSchema: {
    required: ['connectionString', 'database', 'collection'],
    optional: ['upsertKey'],
  },
})
export class MongoDbAdapter implements DeliveryAdapter, OnModuleDestroy {
  readonly type = 'mongodb';
  private readonly logger = new Logger(MongoDbAdapter.name);

  private readonly clients = new Map<string, ClientEntry>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Sweep idle clients every 30s — frees resources on long-lived workers
    this.sweepTimer = setInterval(() => this.sweepIdleClients(), 30_000);
    this.sweepTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    for (const entry of this.clients.values()) {
      await entry.client.close().catch(() => undefined);
    }
    this.clients.clear();
  }

  async send(ctx: DeliveryContext): Promise<AdapterResult> {
    const started = Date.now();

    const connectionString = ctx.config['connectionString'];
    const database = ctx.config['database'];
    const collection = ctx.config['collection'];
    const upsertKey = ctx.config['upsertKey'];

    if (typeof connectionString !== 'string' || connectionString.length === 0) {
      return this.error("missing 'connectionString'", started);
    }
    if (!/^mongodb(\+srv)?:\/\//.test(connectionString)) {
      return this.error("invalid 'connectionString' — must start with mongodb:// or mongodb+srv://", started);
    }
    if (typeof database !== 'string' || database.length === 0) {
      return this.error("missing 'database'", started);
    }
    if (typeof collection !== 'string' || collection.length === 0) {
      return this.error("missing 'collection'", started);
    }

    try {
      const client = await this.getClient(ctx.destinationId, connectionString);

      if (ctx.config['__dryRun'] === true) {
        try {
          const db: Db = client.db(database);
          await db.command({ ping: 1 });
          return {
            success: true,
            statusCode: 200,
            latencyMs: Date.now() - started,
            responseBody: JSON.stringify({ dryRun: true, reachable: true }),
            error: null,
            retryable: false,
          };
        } catch (err) {
          return {
            success: false,
            statusCode: 0,
            latencyMs: Date.now() - started,
            responseBody: '',
            error: err instanceof Error ? err.message : String(err),
            retryable: false,
          };
        }
      }

      const db: Db = client.db(database);
      const coll = db.collection(collection);

      const doc = this.toDocument(ctx.payload, ctx);

      const timer = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`MongoDB operation exceeded ${OPERATION_TIMEOUT_MS}ms`)), OPERATION_TIMEOUT_MS),
      );

      let result;
      if (typeof upsertKey === 'string' && upsertKey.length > 0) {
        const filter = this.buildFilter(doc, upsertKey);
        result = await Promise.race([
          coll.updateOne(filter, { $set: doc }, { upsert: true }),
          timer,
        ]);
        return this.success(started, {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedId: result.upsertedId?.toString() ?? null,
        });
      }

      result = await Promise.race([coll.insertOne(doc), timer]);
      return this.success(started, { insertedId: result.insertedId.toString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retryable =
        /timeout/i.test(message) ||
        /ECONNRESET/i.test(message) ||
        /server selection/i.test(message);

      return {
        success: false,
        statusCode: 0,
        latencyMs: Date.now() - started,
        responseBody: '',
        error: `MongoDB: ${message}`,
        retryable,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────

  private async getClient(destinationId: string, uri: string): Promise<MongoClient> {
    const existing = this.clients.get(destinationId);
    if (existing && existing.uri === uri) {
      existing.lastUsedAt = Date.now();
      return existing.client;
    }

    if (existing) {
      // Connection string changed — close old client
      await existing.client.close().catch(() => undefined);
      this.clients.delete(destinationId);
    }

    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
      connectTimeoutMS: CONNECT_TIMEOUT_MS,
      maxPoolSize: 3,
      minPoolSize: 0,
    });

    await client.connect();
    this.clients.set(destinationId, { client, uri, lastUsedAt: Date.now() });
    return client;
  }

  private sweepIdleClients(): void {
    const cutoff = Date.now() - CLIENT_IDLE_MS;
    for (const [id, entry] of this.clients.entries()) {
      if (entry.lastUsedAt < cutoff) {
        this.logger.log(`Closing idle Mongo client for ${id}`);
        entry.client.close().catch(() => undefined);
        this.clients.delete(id);
      }
    }
  }

  private toDocument(payload: unknown, ctx: DeliveryContext): Record<string, unknown> {
    const doc: Record<string, unknown> =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? { ...(payload as Record<string, unknown>) }
        : { payload };

    // Add relayon metadata (non-destructive; won't overwrite tenant fields)
    doc['_relayon'] = {
      eventId: ctx.eventId,
      correlationId: ctx.correlationId,
      destinationId: ctx.destinationId,
      attemptNumber: ctx.attemptNumber,
      deliveredAt: new Date(),
    };

    return doc;
  }

  private buildFilter(doc: Record<string, unknown>, upsertKey: string): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    for (const path of upsertKey.split(',').map((s) => s.trim())) {
      if (!path) continue;
      const value = this.getPath(doc, path);
      if (value !== undefined) {
        filter[path] = value;
      }
    }
    return filter;
  }

  private getPath(obj: Record<string, unknown>, path: string): unknown {
    let cur: unknown = obj;
    for (const p of path.split('.')) {
      if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
  }

  private success(started: number, body: Record<string, unknown>): AdapterResult {
    return {
      success: true,
      statusCode: 200,
      latencyMs: Date.now() - started,
      responseBody: JSON.stringify(body).slice(0, 500),
      error: null,
      retryable: false,
    };
  }

  private error(msg: string, started: number): AdapterResult {
    return {
      success: false,
      statusCode: 0,
      latencyMs: Date.now() - started,
      responseBody: '',
      error: `mongodb adapter: ${msg}`,
      retryable: false,
    };
  }
}