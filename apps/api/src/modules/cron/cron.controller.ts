import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { withAdvisoryLock, lockId } from '../../common/cron/pg-cron-lock';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard';

@Controller('cron')
@UseGuards(CronSecretGuard)
export class CronController {
  constructor(private readonly prisma: PrismaService) {}

  // ── Daily cleanup: page_events older than 90 days ────────────
  @Post('retention-cleanup')
  @HttpCode(HttpStatus.OK)
  async retentionCleanup(@Query('dryRun') dryRun?: string) {
    const isDryRun = dryRun === 'true' || dryRun === '1';

    return withAdvisoryLock(
      this.prisma,
      lockId('retention-cleanup'),
      async () => {
        const cutoff = new Date(Date.now() - 90 * 24 * 3600_000);

        if (isDryRun) {
          const rows = await this.prisma.$queryRaw<Array<{ c: bigint }>>`
            SELECT COUNT(*) AS c FROM page_events WHERE created_at < ${cutoff}
          `;
          return { dryRun: true, wouldDelete: Number(rows[0]?.c ?? 0n) };
        }

        const deleted = await this.prisma.$executeRaw`
          DELETE FROM page_events WHERE created_at < ${cutoff}
        `;
        return { dryRun: false, deleted };
      },
    ).then((r) => (r.ran ? r.result : { skipped: 'lock_held' as const }));
  }

  // ── Daily cleanup: old email verification + reset tokens ─────
  @Post('token-cleanup')
  @HttpCode(HttpStatus.OK)
  async tokenCleanup(@Query('dryRun') dryRun?: string) {
    const isDryRun = dryRun === 'true' || dryRun === '1';

    return withAdvisoryLock(
      this.prisma,
      lockId('token-cleanup'),
      async () => {
        const cutoff = new Date(Date.now() - 7 * 24 * 3600_000);

        if (isDryRun) {
          const [e, r] = await Promise.all([
            this.prisma.withoutTenant((c) =>
              c.emailVerification.count({ where: { createdAt: { lt: cutoff } } }),
            ),
            this.prisma.withoutTenant((c) =>
              c.passwordReset.count({ where: { createdAt: { lt: cutoff } } }),
            ),
          ]);
          return {
            dryRun: true,
            wouldDelete: { emailVerifications: e, passwordResets: r },
          };
        }

        const [emailTokens, resetTokens] = await Promise.all([
          this.prisma.withoutTenant((c) =>
            c.emailVerification.deleteMany({ where: { createdAt: { lt: cutoff } } }),
          ),
          this.prisma.withoutTenant((c) =>
            c.passwordReset.deleteMany({ where: { createdAt: { lt: cutoff } } }),
          ),
        ]);
        return {
          dryRun: false,
          emailTokensDeleted: emailTokens.count,
          resetTokensDeleted: resetTokens.count,
        };
      },
    ).then((r) => (r.ran ? r.result : { skipped: 'lock_held' as const }));
  }

  // ── Weekly cleanup: admin audit log older than 1 year ────────
  @Post('audit-cleanup')
  @HttpCode(HttpStatus.OK)
  async auditCleanup(@Query('dryRun') dryRun?: string) {
    const isDryRun = dryRun === 'true' || dryRun === '1';

    return withAdvisoryLock(
      this.prisma,
      lockId('audit-cleanup'),
      async () => {
        const cutoff = new Date(Date.now() - 365 * 24 * 3600_000);

        if (isDryRun) {
          const n = await this.prisma.withoutTenant((c) =>
            c.adminAuditLog.count({ where: { createdAt: { lt: cutoff } } }),
          );
          return { dryRun: true, wouldDelete: n };
        }

        const deleted = await this.prisma.withoutTenant((c) =>
          c.adminAuditLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
        );
        return { dryRun: false, deleted: deleted.count };
      },
    ).then((r) => (r.ran ? r.result : { skipped: 'lock_held' as const }));
  }
}