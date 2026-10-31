import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Tenant-scoped transaction. Required for ALL queries against
   * RLS-enabled tables. `set_config(..., true)` is transaction-local.
   */
  async withTenant<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }

  /**
   * Cross-tenant operations ONLY. Temporarily assumes `relayon_system`
   * role (BYPASSRLS + table grants) inside a transaction.
   *
   * Uses `SET LOCAL ROLE` (transaction-scoped) — Postgres automatically
   * reverts the role on COMMIT/ROLLBACK. No `RESET ROLE` needed, and
   * importantly NO try/finally: if `fn()` throws, we don't run a second
   * failing statement that would mask the original error with 25P02
   * "current transaction is aborted".
   *
   * Legitimate uses: schedule tick (all tenants), signup (tenant
   * doesn't exist yet), API key prefix lookup (tenant unknown),
   * refresh-token lookup by hash (tenant unknown).
   *
   * NEVER pass user-supplied tenant filters to this method without
   * explicit WHERE tenant_id enforcement in the caller.
   */
  async withoutTenant<T>(
    fn: (client: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE relayon_system`);
      return fn(tx);
    });
  }
}