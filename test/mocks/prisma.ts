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
  upsert: MockFn;
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
    upsert: vi.fn(),
  };
}

/**
 * Factory for a PrismaService mock. Every table we use across the app
 * is pre-created with all common methods as vi.fn(). Tests override
 * return values per call.
 *
 * ⚠️ Return type is `any` intentionally — keeps all existing tests
 * working without rewriting every single mock chain. Tests that need
 * strict types can cast locally.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makePrismaMock(): any {
  const tables = {
    // ── Core (v1.0) ──
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

    // ── v2.1 — auth ──
    emailVerification: makeTable(),
    passwordReset: makeTable(),

    // ── v2.3 — AI chat + knowledge ──
    chatSession: makeTable(),
    chatMessage: makeTable(),
    knowledgeChunk: makeTable(),

    // ── v2.4 — analytics + admin ──
    pageEvent: makeTable(),
    adminAuditLog: makeTable(),

    // ── v2.5 — community ──
    communityPost: makeTable(),
    communityReply: makeTable(),
    communityLike: makeTable(),
    communityFlag: makeTable(),

    // ── v2.8 — moderation ──
    moderationAction: makeTable(),
    announcementShare: makeTable(),

    // ── v3.0 — outbound webhooks + feature flags ──
    outboxEvent: makeTable(),
    webhookEndpoint: makeTable(),
    featureFlag: makeTable(),

    // ── v3.1 — CLI tunnel ──
    tunnelSession: makeTable(),

    // ── v3.5 — BYOK integrations ──
    tenantIntegration: makeTable(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    ...tables,
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    withTenant: vi.fn(async (_tid: string, fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    ),
    withoutTenant: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    ),
  };

  return prisma;
}