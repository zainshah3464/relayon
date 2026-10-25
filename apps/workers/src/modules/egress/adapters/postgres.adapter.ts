import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolConfig } from 'pg';
import format from 'pg-format';
import { DestinationAdapter } from './plugin.decorator';
import type { AdapterResult, DeliveryAdapter, DeliveryContext } from './types';

const TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 5_000;
const MAX_POOL_PER_DEST = 3;

@Injectable()
@DestinationAdapter({
  type: 'postgres',
  displayName: 'PostgreSQL',
  configSchema: {
    required: ['connectionString', 'table'],
    optional: ['columns', 'onConflict', 'ssl'],
  },
})
export class PostgresAdapter implements DeliveryAdapter, OnModuleDestroy {
  readonly type = 'postgres';
  private readonly logger = new Logger(PostgresAdapter.name);

  private readonly pools = new Map<string, Pool>();
  private readonly poolMeta = new Map<string, { connectionString: string }>();

  async onModuleDestroy(): Promise<void> {
    for (const pool of this.pools.values()) {
      await pool.end().catch(() => undefined);
    }
    this.pools.clear();
    this.poolMeta.clear();
  }

  async send(ctx: DeliveryContext): Promise<AdapterResult> {
    const started = Date.now();

    const connectionString = ctx.config['connectionString'];
    const table = ctx.config['table'];
    const columns = ctx.config['columns'];
    const onConflict = ctx.config['onConflict'];
    const ssl = ctx.config['ssl'];

    if (typeof connectionString !== 'string' || connectionString.length === 0) {
      return this.error("missing 'connectionString'", started);
    }
    if (
      typeof table !== 'string' ||
      !/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(table)
    ) {
      return this.error("invalid 'table' — use 'table' or 'schema.table'", started);
    }

    const pool = this.getPool(ctx.destinationId, connectionString, ssl === true);

    if (ctx.config['__dryRun'] === true) {
      try {
        const client = await pool.connect();
        try {
          await client.query('SELECT 1');
          return {
            success: true,
            statusCode: 200,
            latencyMs: Date.now() - started,
            responseBody: JSON.stringify({ dryRun: true, reachable: true }),
            error: null,
            retryable: false,
          };
        } finally {
          client.release();
        }
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

    try {
      const { sql, values } = this.buildQuery(
        table,
        (columns && typeof columns === 'object' && !Array.isArray(columns)
          ? (columns as Record<string, string>)
          : {}) as Record<string, string>,
        ctx.payload,
        typeof onConflict === 'string' ? onConflict : undefined,
      );

      const client = await pool.connect();
      const timer = setTimeout(
        () => client.release(new Error(`PostgreSQL query exceeded ${TIMEOUT_MS}ms`)),
        TIMEOUT_MS,
      );

      try {
        const result = await client.query(sql, values);
        clearTimeout(timer);

        return {
          success: true,
          statusCode: 200,
          latencyMs: Date.now() - started,
          responseBody: JSON.stringify({
            rowCount: result.rowCount,
            command: result.command,
          }).slice(0, 500),
          error: null,
          retryable: false,
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string }).code;

      const retryable =
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === '40001' ||
        code === '40P01' ||
        code === '53300' ||
        /timeout/i.test(message);

      return {
        success: false,
        statusCode: 0,
        latencyMs: Date.now() - started,
        responseBody: '',
        error: `PostgreSQL: ${message}`,
        retryable,
      };
    }
  }

  /**
   * Builds INSERT ... VALUES query. Identifiers are quoted with %I
   * (validated by regex above). Values use $N parameterization.
   * No SQL injection surface.
   */
  private buildQuery(
    table: string,
    columnsMap: Record<string, string>,
    payload: unknown,
    onConflict: string | undefined,
  ): { sql: string; values: unknown[] } {
    const record = this.flattenToRecord(payload, columnsMap);
    const colNames = Object.keys(record);

    if (colNames.length === 0) {
      // Fallback: single jsonb column named "payload"
      const sql = format('INSERT INTO %I (%I) VALUES ($1)', table, 'payload');
      return { sql, values: [payload] };
    }

    const values = colNames.map((c) => record[c]);
    const identifiers = format('%I', table);
    const colList = colNames.map((c) => format('%I', c)).join(', ');
    const placeholders = colNames.map((_, i) => `$${i + 1}`).join(', ');

    let finalSql = `INSERT INTO ${identifiers} (${colList}) VALUES (${placeholders})`;

    if (onConflict) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(onConflict)) {
        throw new Error(`Invalid onConflict column "${onConflict}"`);
      }
      const conflictCol = format('%I', onConflict);
      const updateList = colNames
        .filter((c) => c !== onConflict)
        .map((c) => `${format('%I', c)} = EXCLUDED.${format('%I', c)}`)
        .join(', ');

      finalSql += updateList
        ? ` ON CONFLICT (${conflictCol}) DO UPDATE SET ${updateList}`
        : ` ON CONFLICT (${conflictCol}) DO NOTHING`;
    }

    return { sql: finalSql, values };
  }

  private flattenToRecord(
    payload: unknown,
    columnsMap: Record<string, string>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    if (Object.keys(columnsMap).length === 0) {
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
          if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) out[k] = v;
        }
      }
      return out;
    }

    for (const [path, columnName] of Object.entries(columnsMap)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName)) continue;
      out[columnName] = this.getPath(payload, path);
    }
    return out;
  }

  private getPath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let cur: unknown = obj;
    for (const p of parts) {
      if (cur === null || cur === undefined) return null;
      if (typeof cur !== 'object') return null;
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur === undefined ? null : cur;
  }

  private getPool(
    destinationId: string,
    connectionString: string,
    ssl: boolean,
  ): Pool {
    const existing = this.pools.get(destinationId);
    const meta = this.poolMeta.get(destinationId);

    if (existing && meta?.connectionString === connectionString) {
      return existing;
    }

    if (existing) {
      this.logger.warn(`Pool config changed for ${destinationId} — recreating`);
      existing.end().catch(() => undefined);
    }

    const cfg: PoolConfig = {
      connectionString,
      max: MAX_POOL_PER_DEST,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      ...(ssl ? { ssl: { rejectUnauthorized: true } } : {}),
    };

    const pool = new Pool(cfg);
    pool.on('error', (err) => {
      this.logger.error(`PG pool error (${destinationId}): ${err.message}`);
    });

    this.pools.set(destinationId, pool);
    this.poolMeta.set(destinationId, { connectionString });
    return pool;
  }

  private error(msg: string, started: number): AdapterResult {
    return {
      success: false,
      statusCode: 0,
      latencyMs: Date.now() - started,
      responseBody: '',
      error: `postgres adapter: ${msg}`,
      retryable: false,
    };
  }
}