import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OutboxPollerService } from './outbox-poller.service';
import { PrismaService } from '../prisma/prisma.service';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard';

@Controller('cron/outbox')
@UseGuards(CronSecretGuard)
export class OutboxPollerController {
  constructor(
    private readonly poller: OutboxPollerService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('tick')
  @HttpCode(HttpStatus.OK)
  tick() {
    return this.poller.pollAndDeliver();
  }

  @Get('stats')
  async stats() {
    const rows = await this.prisma.$queryRaw<
      Array<{ status: string; count: bigint }>
    >`
      SELECT status, COUNT(*) AS count FROM outbox_events GROUP BY status
    `;
    const map: Record<string, number> = {};
    for (const r of rows) map[r.status] = Number(r.count);

    const recent = await this.prisma.$queryRaw<
      Array<{ delivered: bigint; failed: bigint }>
    >`
      SELECT
        COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at > NOW() - INTERVAL '24 hours') AS delivered,
        COUNT(*) FILTER (WHERE status = 'failed' AND updated_at > NOW() - INTERVAL '24 hours') AS failed
      FROM outbox_events
    `;

    return {
      pending: map['pending'] ?? 0,
      delivered: map['delivered'] ?? 0,
      failed: map['failed'] ?? 0,
      last24h: {
        delivered: Number(recent[0]?.delivered ?? 0n),
        failed: Number(recent[0]?.failed ?? 0n),
      },
    };
  }

  @Post('retry')
  @HttpCode(HttpStatus.OK)
  async retry(@Query('id') id: string) {
    await this.prisma.$executeRaw`
      UPDATE outbox_events
      SET status = 'pending', attempt_count = 0, next_attempt_at = NOW(),
          last_error = NULL, updated_at = NOW()
      WHERE id = ${id}::uuid AND status = 'failed'
    `;
    return { retried: true, id };
  }
}