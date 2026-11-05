import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DeliveryContext } from './types';

// Mock 'pg' — module-scoped singleton
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    connect: vi.fn(async () => ({
      query: vi.fn(async () => ({ rowCount: 1, command: 'INSERT', rows: [] })),
      release: vi.fn(),
    })),
    end: vi.fn(async () => undefined),
    on: vi.fn(),
  })),
}));

import { PostgresAdapter } from './postgres.adapter';

function makeCtx(overrides: Partial<DeliveryContext> = {}): DeliveryContext {
  return {
    destinationId: 'pg-1',
    destinationType: 'postgres',
    config: {
      connectionString: 'postgresql://user:pass@localhost/db?sslmode=require',
      table: 'events',
    },
    payload: { type: 'test', amount: 100 },
    correlationId: 'corr-1',
    eventId: 'evt-1',
    attemptNumber: 1,
    ...overrides,
  };
}

describe('PostgresAdapter', () => {
  let adapter: PostgresAdapter;

  beforeEach(() => {
    adapter = new PostgresAdapter();
    vi.clearAllMocks();
  });

  // ⚠️ NEW — close all PG pools to avoid hanging event loop
  afterEach(async () => {
    await adapter.onModuleDestroy();
  });

  it('rejects missing connectionString', async () => {
    const r = await adapter.send(makeCtx({ config: { table: 'events' } }));
    expect(r.success).toBe(false);
    expect(r.error).toContain('connectionString');
  });

  it('rejects invalid table name (SQL injection prevention)', async () => {
    const r = await adapter.send(
      makeCtx({
        config: { connectionString: 'postgresql://x', table: 'users; DROP TABLE' },
      }),
    );
    expect(r.success).toBe(false);
    expect(r.error).toContain('table');
  });

  it('accepts schema.table format', async () => {
    const r = await adapter.send(
      makeCtx({ config: { ...makeCtx().config, table: 'public.events' } }),
    );
    expect(r.success).toBe(true);
  });

  it('inserts using $N parameterized query', async () => {
    await adapter.send(makeCtx({ payload: { type: 'test', amount: 100 } }));

    const { Pool } = await import('pg');
    const poolMock = (Pool as unknown as { mock: { results: any[] } })
      .mock.results[0]!.value;
    expect(poolMock).toBeDefined();

    const connectResult = poolMock.connect.mock.results[0]!.value;
    const client = await connectResult;
    expect(client.query).toHaveBeenCalledOnce();
    const [sql, params] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO');
    expect(sql).toContain('$1');
    expect(params).toEqual(expect.arrayContaining(['test', 100]));
  });

  it('supports column mapping via columns config', async () => {
    await adapter.send(
      makeCtx({
        config: {
          ...makeCtx().config,
          columns: { 'data.amount': 'amount_cents' },
        },
        payload: { data: { amount: 5000 } },
      }),
    );

    const { Pool } = await import('pg');
    const poolMock = (Pool as unknown as { mock: { results: any[] } })
      .mock.results[0]!.value;
    const connectResult = poolMock.connect.mock.results[0]!.value;
    const client = await connectResult;
    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('amount_cents');
  });

  it('adds ON CONFLICT ... DO UPDATE when onConflict set', async () => {
    await adapter.send(
      makeCtx({
        config: { ...makeCtx().config, onConflict: 'type' },
        payload: { type: 'test', amount: 100 },
      }),
    );

    const { Pool } = await import('pg');
    const poolMock = (Pool as unknown as { mock: { results: any[] } })
      .mock.results[0]!.value;
    const connectResult = poolMock.connect.mock.results[0]!.value;
    const client = await connectResult;
    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('DO UPDATE');
  });

  it('dry-run uses SELECT 1 (verify connection only)', async () => {
    await adapter.send(makeCtx({ config: { ...makeCtx().config, __dryRun: true } }));

    const { Pool } = await import('pg');
    const poolMock = (Pool as unknown as { mock: { results: any[] } })
      .mock.results[0]!.value;
    const connectResult = poolMock.connect.mock.results[0]!.value;
    const client = await connectResult;
    const [sql] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('SELECT 1');
  });

  it('reuses pool for same destination (caching)', async () => {
    const { Pool } = await import('pg');
    const initialCount = (Pool as unknown as { mock: { calls: unknown[] } })
      .mock.calls.length;

    await adapter.send(makeCtx());
    await adapter.send(makeCtx());

    const afterCount = (Pool as unknown as { mock: { calls: unknown[] } })
      .mock.calls.length;
    expect(afterCount - initialCount).toBeLessThanOrEqual(1);
  });

  it('detects SQL state 40P01 (deadlock) as retryable', async () => {
    // Warm up pool so it's cached
    await adapter.send(makeCtx());

    const { Pool } = await import('pg');
    const poolMock = (Pool as unknown as { mock: { results: any[] } })
      .mock.results[0]!.value;

    // Override next connect() to return client whose query rejects
    poolMock.connect.mockImplementationOnce(async () => ({
      query: vi.fn().mockRejectedValueOnce(
        Object.assign(new Error('deadlock detected'), { code: '40P01' }),
      ),
      release: vi.fn(),
    }));

    const r = await adapter.send(makeCtx());
    expect(r.success).toBe(false);
    expect(r.retryable).toBe(true);
  });
});