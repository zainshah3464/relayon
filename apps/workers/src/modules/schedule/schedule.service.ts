import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import parser from 'cron-parser';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { INCOMING_QUEUE, type QueuedEvent } from '../../lib/queues';
import { logger } from '../../lib/logger';

const MAX_PER_TICK = 25;

export interface ScheduleTickResult {
  due: number;
  enqueued: number;
  skipped: number;
  deactivated: number;
  durationMs: number;
}

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Serverless-safe cron: called by the external cron every 5 minutes.
   * Claims due schedules atomically, enqueues a synthetic event into the
   * normal ingress queue, and advances nextRunAt.
   */
  async tick(): Promise<ScheduleTickResult> {
    const startedAt = Date.now();
    const now = new Date();

    const result: ScheduleTickResult = {
      due: 0,
      enqueued: 0,
      skipped: 0,
      deactivated: 0,
      durationMs: 0,
    };

    const due = await this.prisma.workflowSchedule.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
      orderBy: { nextRunAt: 'asc' },
      take: MAX_PER_TICK,
      include: {
        workflow: {
          select: { id: true, tenantId: true, sourceType: true, isActive: true },
        },
      },
    });

    result.due = due.length;

    for (const schedule of due) {
      const workflow = schedule.workflow;

      if (!workflow.isActive) {
        await this.prisma.workflowSchedule.update({
          where: { id: schedule.id },
          data: { isActive: false },
        });
        result.deactivated++;
        continue;
      }

      const nextRunAt = this.computeNextRun(
        schedule.cronExpression,
        schedule.timezone,
        now,
      );

      if (!nextRunAt) {
        await this.prisma.workflowSchedule.update({
          where: { id: schedule.id },
          data: { isActive: false },
        });
        this.logger.error(
          `schedule.invalid_cron workflow=${workflow.id} expr=${schedule.cronExpression}`,
        );
        result.deactivated++;
        continue;
      }

      // Atomic claim — another worker may have advanced this row already
      const claimed = await this.prisma.workflowSchedule.updateMany({
        where: { id: schedule.id, nextRunAt: { lte: now } },
        data: { lastRunAt: now, nextRunAt },
      });

      if (claimed.count !== 1) {
        result.skipped++;
        continue;
      }

      const event: QueuedEvent = {
        correlationId: randomUUID(),
        tenantId: workflow.tenantId,
        workflowId: workflow.id,
        sourceType: workflow.sourceType,
        receivedAt: now.toISOString(),
        rawPayload: {
          type: 'relayon.schedule.trigger',
          scheduledAt: now.toISOString(),
          cronExpression: schedule.cronExpression,
          timezone: schedule.timezone,
          data: (schedule.payloadTemplate ?? {}) as Record<string, unknown>,
        },
        headers: { 'x-relayon-trigger': 'schedule' },
        ipHash: null,
        userAgent: 'relayon-scheduler',
        idempotencyKey: `schedule:${schedule.id}:${now.toISOString()}`,
      };

      await this.redis.raw.lpush(INCOMING_QUEUE, JSON.stringify(event));
      result.enqueued++;

      logger.info('schedule.enqueued', {
        workflowId: workflow.id,
        correlationId: event.correlationId,
        nextRunAt: nextRunAt.toISOString(),
      });
    }

    result.durationMs = Date.now() - startedAt;
    logger.info('schedule.tick_complete', { ...result });
    return result;
  }

  async status() {
    const now = new Date();
    const [active, dueNow, nextUp] = await Promise.all([
      this.prisma.workflowSchedule.count({ where: { isActive: true } }),
      this.prisma.workflowSchedule.count({
        where: { isActive: true, nextRunAt: { lte: now } },
      }),
      this.prisma.workflowSchedule.findFirst({
        where: { isActive: true, nextRunAt: { gt: now } },
        orderBy: { nextRunAt: 'asc' },
        select: {
          workflowId: true,
          cronExpression: true,
          timezone: true,
          nextRunAt: true,
        },
      }),
    ]);

    return { active, dueNow, next: nextUp, timestamp: now.toISOString() };
  }

  private computeNextRun(
    cronExpression: string,
    timezone: string,
    from: Date,
  ): Date | null {
    try {
      const interval = parser.parseExpression(cronExpression, {
        currentDate: from,
        tz: timezone,
      });
      return interval.next().toDate();
    } catch {
      return null;
    }
  }
}