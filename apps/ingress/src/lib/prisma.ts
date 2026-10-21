import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client.
 *
 * Note: Prisma adds ~300ms to cold starts. For Phase 7 (production
 * deployment), we'll either swap this for raw `pg` or cache workflow
 * config in Redis. For now, correctness > micro-optimization.
 */
export const prisma = new PrismaClient({
  log: process.env['NODE_ENV'] === 'development' ? ['error', 'warn'] : ['error'],
});