import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('PostgreSQL connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Cross-tenant operations ONLY (e.g. schedule tick across all tenants).
   * Uses `SET LOCAL ROLE` — Postgres auto-reverts on COMMIT/ROLLBACK.
   * No RESET ROLE, no try/finally, so original errors aren't masked.
   */
  async withoutTenant<T>(
    fn: (client: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE relayon_system`);
      return fn(tx as unknown as PrismaClient);
    });
  }
}