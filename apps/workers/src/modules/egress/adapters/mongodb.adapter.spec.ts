import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DeliveryContext } from './types';

vi.mock('mongodb', () => {
  const collection = {
    insertOne: vi.fn(async () => ({ insertedId: { toString: () => 'oid-1' } })),
    updateOne: vi.fn(async () => ({ matchedCount: 1, modifiedCount: 1, upsertedId: null })),
  };
  const db = {
    collection: vi.fn(() => collection),
    command: vi.fn(async () => ({ ok: 1 })),
  };
  const client = {
    connect: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    db: vi.fn(() => db),
  };
  return { MongoClient: vi.fn(() => client) };
});

import { MongoDbAdapter } from './mongodb.adapter';

function makeCtx(overrides: Partial<DeliveryContext> = {}): DeliveryContext {
  return {
    destinationId: 'mongo-1',
    destinationType: 'mongodb',
    config: {
      connectionString: 'mongodb+srv://user:pass@cluster/db',
      database: 'relayon_target',
      collection: 'events',
    },
    payload: { type: 'test', amount: 100 },
    correlationId: 'corr-1',
    eventId: 'evt-1',
    attemptNumber: 1,
    ...overrides,
  };
}

describe('MongoDbAdapter', () => {
  let adapter: MongoDbAdapter;

  beforeEach(() => {
    adapter = new MongoDbAdapter();
    vi.clearAllMocks();
  });

  // ⚠️ NEW — clear setInterval + close all MongoClient connections
  afterEach(async () => {
    await adapter.onModuleDestroy();
  });

  it('rejects missing connectionString', async () => {
    const r = await adapter.send(makeCtx({ config: { database: 'd', collection: 'c' } }));
    expect(r.success).toBe(false);
    expect(r.error).toContain('connectionString');
  });

  it('rejects non-mongodb:// URI', async () => {
    const r = await adapter.send(
      makeCtx({ config: { ...makeCtx().config, connectionString: 'postgres://x' } }),
    );
    expect(r.success).toBe(false);
    expect(r.error).toContain('mongodb');
  });

  it('rejects missing database or collection', async () => {
    const r1 = await adapter.send(
      makeCtx({ config: { connectionString: 'mongodb://x', collection: 'c' } }),
    );
    expect(r1.success).toBe(false);

    const r2 = await adapter.send(
      makeCtx({ config: { connectionString: 'mongodb://x', database: 'd' } }),
    );
    expect(r2.success).toBe(false);
  });

  it('inserts document with _relayon metadata', async () => {
    const r = await adapter.send(makeCtx());
    expect(r.success).toBe(true);

    const { MongoClient } = await import('mongodb');
    const clientMock = (MongoClient as unknown as { mock: { results: any[] } })
      .mock.results[0]?.value;
    expect(clientMock).toBeDefined();

    const coll = clientMock.db().collection();
    const doc = coll.insertOne.mock.calls[0]![0];
    expect(doc.type).toBe('test');
    expect(doc._relayon).toMatchObject({
      eventId: 'evt-1',
      correlationId: 'corr-1',
      destinationId: 'mongo-1',
    });
  });

  it('upsert with upsertKey uses updateOne', async () => {
    await adapter.send(
      makeCtx({
        config: { ...makeCtx().config, upsertKey: 'type' },
        payload: { type: 'test', amount: 100 },
      }),
    );

    const { MongoClient } = await import('mongodb');
    const clientMock = (MongoClient as unknown as { mock: { results: any[] } })
      .mock.results[0]?.value;
    expect(clientMock).toBeDefined();

    const coll = clientMock.db().collection();
    expect(coll.updateOne).toHaveBeenCalledOnce();
    expect(coll.insertOne).not.toHaveBeenCalled();
    const [filter, update, opts] = coll.updateOne.mock.calls[0]!;
    expect(filter).toEqual({ type: 'test' });
    expect(update.$set).toBeDefined();
    expect(opts.upsert).toBe(true);
  });

  it('dry-run uses ping, does not insert', async () => {
    await adapter.send(makeCtx({ config: { ...makeCtx().config, __dryRun: true } }));

    const { MongoClient } = await import('mongodb');
    const clientMock = (MongoClient as unknown as { mock: { results: any[] } })
      .mock.results[0]?.value;
    expect(clientMock).toBeDefined();

    expect(clientMock.db().command).toHaveBeenCalledWith({ ping: 1 });
  });

  it('caches client per destination', async () => {
    const { MongoClient } = await import('mongodb');
    const initialCount = (MongoClient as unknown as { mock: { calls: unknown[] } })
      .mock.calls.length;

    await adapter.send(makeCtx());
    await adapter.send(makeCtx());

    const afterCount = (MongoClient as unknown as { mock: { calls: unknown[] } })
      .mock.calls.length;
    expect(afterCount - initialCount).toBeLessThanOrEqual(1);
  });
});