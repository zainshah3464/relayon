import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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