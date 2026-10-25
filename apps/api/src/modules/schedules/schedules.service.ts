import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import parser from 'cron-parser';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertScheduleDto } from './dto/upsert-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string, workflowId: string) {
    await this.assertWorkflow(tenantId, workflowId);
    return this.prisma.workflowSchedule.findUnique({ where: { workflowId } });
  }

  async upsert(tenantId: string, workflowId: string, dto: UpsertScheduleDto) {
    await this.assertWorkflow(tenantId, workflowId);

    const timezone = dto.timezone ?? 'UTC';
    const nextRunAt = this.nextRun(dto.cronExpression, timezone);

    const existing = await this.prisma.workflowSchedule.findUnique({
      where: { workflowId },
    });

    if (existing) {
      return this.prisma.workflowSchedule.update({
        where: { workflowId },
        data: {
          cronExpression: dto.cronExpression,
          timezone,
          payloadTemplate: (dto.payloadTemplate ?? {}) as never,
          isActive: dto.isActive ?? true,
          nextRunAt,
        },
      });
    }

    return this.prisma.workflowSchedule.create({
      data: {
        workflowId,
        cronExpression: dto.cronExpression,
        timezone,
        payloadTemplate: (dto.payloadTemplate ?? {}) as never,
        isActive: dto.isActive ?? true,
        nextRunAt,
      },
    });
  }

  async remove(tenantId: string, workflowId: string) {
    await this.assertWorkflow(tenantId, workflowId);
    const existing = await this.prisma.workflowSchedule.findUnique({
      where: { workflowId },
    });
    if (!existing) throw new NotFoundException('Schedule not found');
    await this.prisma.workflowSchedule.delete({ where: { workflowId } });
    return { deleted: true, workflowId };
  }

  async runNow(tenantId: string, workflowId: string) {
    await this.assertWorkflow(tenantId, workflowId);

    const schedule = await this.prisma.workflowSchedule.findUnique({
      where: { workflowId },
    });
    if (!schedule) {
      throw new NotFoundException('No schedule configured for this workflow');
    }

    const workersUrl = process.env['WORKERS_URL'];
    const cronSecret = process.env['CRON_SECRET'];
    if (!workersUrl || !cronSecret) {
      throw new BadRequestException(
        'WORKERS_URL and CRON_SECRET must be configured for run-now',
      );
    }

    const res = await fetch(`${workersUrl}/internal/schedule/run-now`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': cronSecret,
      },
      body: JSON.stringify({ workflowId }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadRequestException(
        `Workers returned ${res.status}: ${detail.slice(0, 200)}`,
      );
    }

    const body = (await res.json()) as Record<string, unknown>;

    await this.prisma.workflowSchedule.update({
      where: { workflowId },
      data: { lastRunAt: new Date() },
    });

    return {
      triggered: true,
      workflowId,
      correlationId: body['correlationId'] ?? null,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Pause or resume all schedules belonging to the tenant.
   * On resume, recomputes nextRunAt for each — paused schedules
   * would otherwise fire immediately on resume (their nextRunAt is in the past).
   */
  async bulkSetActive(
    tenantId: string,
    active: boolean,
  ): Promise<{ updated: number }> {
    const workflows = await this.prisma.workflow.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const workflowIds = workflows.map((w) => w.id);

    const schedules = await this.prisma.workflowSchedule.findMany({
      where: { workflowId: { in: workflowIds } },
    });

    if (schedules.length === 0) return { updated: 0 };

    if (!active) {
      const result = await this.prisma.workflowSchedule.updateMany({
        where: { workflowId: { in: workflowIds }, isActive: true },
        data: { isActive: false },
      });
      return { updated: result.count };
    }

    // Resume: recompute nextRunAt per schedule
    let updated = 0;
    for (const s of schedules) {
      if (s.isActive) continue;
      const nextRunAt = this.nextRun(s.cronExpression, s.timezone);
      await this.prisma.workflowSchedule.update({
        where: { id: s.id },
        data: { isActive: true, nextRunAt },
      });
      updated++;
    }
    return { updated };
  }

  /** Validates a cron expression and returns the next fire time. */
  nextRun(cronExpression: string, timezone = 'UTC'): Date {
    try {
      const interval = parser.parseExpression(cronExpression, {
        currentDate: new Date(),
        tz: timezone,
      });
      return interval.next().toDate();
    } catch (err) {
      throw new BadRequestException(
        `Invalid cron expression: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async assertWorkflow(tenantId: string, workflowId: string) {
    const wf = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId },
      select: { id: true },
    });
    if (!wf) throw new NotFoundException('Workflow not found');
  }
}