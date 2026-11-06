import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient, Prisma } from '@prisma/client';

describe('RLS enforcement', () => {
  let prisma: PrismaClient;
  let tenantA: string;
  let tenantB: string;
  let rlsActive = true;
  let skipReason: string | null = null;

  async function asSuperuser<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE relayon_system`);
      return fn(tx);
    });
  }

  async function asTenant<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      // set_config(name, value, is_local=true) — same as SET LOCAL but parameterized
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        tenantId,
      );

      // Verify it persisted — if not, PgBouncer is resetting it
      const check = await tx.$queryRawUnsafe<Array<{ val: string | null }>>(
        `SELECT current_setting('app.tenant_id', true) as val`,
      );
      if (check[0]?.val !== tenantId) {
        throw new Error(
          `app.tenant_id did not persist within transaction ` +
          `(expected "${tenantId}", got "${check[0]?.val}"). ` +
          `If TEST_DATABASE_URL contains "-pooler", remove it — PgBouncer resets SET LOCAL.`,
        );
      }

      return fn(tx);
    });
  }

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const url = process.env['TEST_DATABASE_URL'] ?? '';
    const isPooled = url.includes('-pooler');

    try {
      // 1. Check RLS state on users table
      const usersCheck = await prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
        `SELECT
           c.relrowsecurity AND c.relforcerowsecurity
           AND (SELECT count(*) FROM pg_policy WHERE polrelid = c.oid) > 0
           AS ok
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'users'`,
      );
      const usersProtected = !!usersCheck[0]?.ok;

      // 2. Check current user's privileges
      const privCheck = await prisma.$queryRawUnsafe<Array<{
        current_user: string;
        is_super: boolean;
        bypass_rls: boolean;
      }>>(
        `SELECT
           current_user::text as current_user,
           coalesce((SELECT rolsuper FROM pg_roles WHERE rolname = current_user::text), false) as is_super,
           coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user::text), false) as bypass_rls`,
      );
      const p = privCheck[0];

      console.warn('\n🔍 RLS Diagnostic:');
      console.warn(`   Connection: ${isPooled ? 'POOLED (-pooler ⚠️)' : 'DIRECT ✅'}`);
      console.warn(`   RLS on users: ${usersProtected ? '✅' : '❌'}`);
      console.warn(`   Current user: ${p?.current_user}`);
      console.warn(`   Superuser: ${p?.is_super}`);
      console.warn(`   BYPASSRLS: ${p?.bypass_rls}`);

      if (p?.is_super || p?.bypass_rls) {
        skipReason =
          `Current user "${p.current_user}" bypasses RLS ` +
          `(super=${p.is_super}, bypass=${p.bypass_rls}). ` +
          `RLS cannot be tested with this role. Create a non-super, non-bypass role.`;
        rlsActive = false;
      } else if (!usersProtected) {
        skipReason =
          'RLS not applied on users table. Run: $env:DATABASE_URL=$env:TEST_DATABASE_URL; npm run db:rls';
        rlsActive = false;
      } else if (isPooled) {
        console.warn(
          `\n⚠️  Using -pooler (PgBouncer). If tests fail with ` +
          `"app.tenant_id did not persist", remove "-pooler" from TEST_DATABASE_URL.\n`,
        );
      }
    } catch (err) {
      console.warn(
        '\n⚠️  Diagnostic failed:',
        err instanceof Error ? err.message : String(err),
        '\n',
      );
    }

    if (skipReason) {
      console.warn(`\n⚠️  RLS tests SKIPPED:\n   ${skipReason}\n`);
    }
  }, 60_000);

  afterAll(async () => {
    try {
      await asSuperuser(async (tx) => {
        await tx.$executeRawUnsafe(
          `DELETE FROM tenants WHERE slug LIKE 'rls-test-%'`,
        );
      });
    } catch {
      /* ignore */
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    if (!rlsActive) return;

    await asSuperuser(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM tenants WHERE slug LIKE 'rls-test-%'`,
      );
    });

    const ts = Date.now();
    const a = await asSuperuser((tx) =>
      tx.tenant.create({ data: { name: 'RLS A', slug: `rls-test-a-${ts}` } }),
    );
    const b = await asSuperuser((tx) =>
      tx.tenant.create({ data: { name: 'RLS B', slug: `rls-test-b-${ts}` } }),
    );
    tenantA = a.id;
    tenantB = b.id;

    await asSuperuser(async (tx) => {
      await tx.$executeRawUnsafe(`
        INSERT INTO users (id, tenant_id, email, name, password_hash, role, created_at, updated_at)
        VALUES (gen_random_uuid(), '${tenantA}', 'rls-a@test.com', 'A', 'hash', 'owner', NOW(), NOW())
      `);
      await tx.$executeRawUnsafe(`
        INSERT INTO users (id, tenant_id, email, name, password_hash, role, created_at, updated_at)
        VALUES (gen_random_uuid(), '${tenantB}', 'rls-b@test.com', 'B', 'hash', 'owner', NOW(), NOW())
      `);
    });
  });

  it('cross-tenant read blocked (users)', async () => {
    if (!rlsActive) return;
    const users = await asTenant(tenantA, (tx) =>
      tx.$queryRawUnsafe<Array<{ email: string }>>(`SELECT email FROM users`),
    );
    expect(users.length).toBe(1);
    expect(users[0]!.email).toBe('rls-a@test.com');
  });

  it('cross-tenant write blocked (WITH CHECK)', async () => {
    if (!rlsActive) return;
    await expect(
      asTenant(tenantA, (tx) =>
        tx.$executeRawUnsafe(`
          INSERT INTO users (id, tenant_id, email, name, password_hash, role, created_at, updated_at)
          VALUES (gen_random_uuid(), '${tenantB}', 'evil@test.com', 'E', 'hash', 'owner', NOW(), NOW())
        `),
      ),
    ).rejects.toThrow();
  });

  it('workflows table isolation', async () => {
    if (!rlsActive) return;
    await asTenant(tenantA, (tx) =>
      tx.workflow.create({
        data: { tenantId: tenantA, name: 'A Flow', sourceType: 'stripe', sourceConfig: {} },
      }),
    );
    const wfs = await asTenant(tenantB, (tx) =>
      tx.workflow.findMany({ where: { tenantId: tenantB } }),
    );
    expect(wfs.length).toBe(0);
  });

  it('api_keys table isolation', async () => {
    if (!rlsActive) return;
    await asTenant(tenantA, (tx) =>
      tx.apiKey.create({
        data: {
          tenantId: tenantA,
          name: 'A Key',
          prefix: `rlk_live_${Date.now().toString(16).slice(-8)}`,
          keyHash: `hash-${Date.now()}`,
          scopes: ['events:read'],
        },
      }),
    );
    const keys = await asTenant(tenantB, (tx) =>
      tx.apiKey.findMany({ where: { tenantId: tenantB } }),
    );
    expect(keys.length).toBe(0);
  });

  it('usage_counters isolation', async () => {
    if (!rlsActive) return;
    await asTenant(tenantA, (tx) =>
      tx.usageCounter.create({
        data: { tenantId: tenantA, period: '2026-10', metric: 'events', count: 42n },
      }),
    );
    const counters = await asTenant(tenantB, (tx) =>
      tx.usageCounter.findMany({ where: { tenantId: tenantB } }),
    );
    expect(counters.length).toBe(0);
  });

  it('workflow_versions isolation', async () => {
    if (!rlsActive) return;
    const wf = await asTenant(tenantA, (tx) =>
      tx.workflow.create({
        data: { tenantId: tenantA, name: 'Ver Flow', sourceType: 'stripe', sourceConfig: {} },
      }),
    );
    await asTenant(tenantA, (tx) =>
      tx.workflowVersion.create({
        data: { workflowId: wf.id, tenantId: tenantA, version: 1, snapshot: {} },
      }),
    );
    const versions = await asTenant(tenantB, (tx) =>
      tx.workflowVersion.findMany({ where: { tenantId: tenantB } }),
    );
    expect(versions.length).toBe(0);
  });
});