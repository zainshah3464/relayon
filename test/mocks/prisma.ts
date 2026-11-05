import { vi } from 'vitest';

type MockFn = ReturnType<typeof vi.fn>;

interface TableMock {
  findUnique: MockFn;
  findFirst: MockFn;
  findMany: MockFn;
  create: MockFn;
  createMany: MockFn;
  update: MockFn;
  updateMany: MockFn;
  delete: MockFn;
  deleteMany: MockFn;
  count: MockFn;
  aggregate: MockFn;
  groupBy: MockFn;
}

function makeTable(): TableMock {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  };
}

/**
 * Factory for a PrismaService mock. Every tenant table is pre-created
 * with all common methods as vi.fn(). Tests override return values
 * per call. `withTenant` / `withoutTenant` transparently delegate to
 * the mock itself so tests don't need to know about RLS wrapping.
 */
export function makePrismaMock(): {
  tenant: TableMock;
  user: TableMock;
  workflow: TableMock;
  destination: TableMock;
  workflowVersion: TableMock;
  workflowSchedule: TableMock;
  apiKey: TableMock;
  apiKeyRotation: TableMock;
  usageCounter: TableMock;
  refreshToken: TableMock;
  $transaction: MockFn;
  $queryRaw: MockFn;
  $executeRaw: MockFn;
  withTenant: MockFn;
  withoutTenant: MockFn;
} {
  const tables = {
    tenant: makeTable(),
    user: makeTable(),
    workflow: makeTable(),
    destination: makeTable(),
    workflowVersion: makeTable(),
    workflowSchedule: makeTable(),
    apiKey: makeTable(),
    apiKeyRotation: makeTable(),
    usageCounter: makeTable(),
    refreshToken: makeTable(),
  };

  const prisma = {
    ...tables,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    withTenant: vi.fn(async (_tid: string, fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    ),
    withoutTenant: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    ),
  };

  return prisma;
}