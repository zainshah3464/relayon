import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { makePrismaMock } from '../../../../../test/mocks/prisma';

describe('SchedulesService (API)', () => {
  let service: SchedulesService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new SchedulesService(prisma as never);
  });

  describe('nextRun', () => {
    it('computes next run from cron', () => {
      const next = service.nextRun('0 9 * * *', 'UTC');
      expect(next).toBeInstanceOf(Date);
      expect(next.getUTCHours()).toBe(9);
    });

    it('handles hourly cron', () => {
      const next = service.nextRun('0 * * * *');
      expect(next.getUTCMinutes()).toBe(0);
    });

    it('throws on invalid cron', () => {
      expect(() => service.nextRun('not-a-cron')).toThrow(BadRequestException);
    });
  });

  describe('upsert', () => {
    it('creates new schedule', async () => {
      prisma.workflow.findFirst.mockResolvedValue({ id: 'wf-1' });
      prisma.workflowSchedule.findUnique.mockResolvedValue(null);
      prisma.workflowSchedule.create.mockResolvedValue({ id: 'sched-1' });

      await service.upsert('t-1', 'wf-1', { cronExpression: '0 9 * * *' });

      expect(prisma.workflowSchedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workflowId: 'wf-1',
          cronExpression: '0 9 * * *',
          timezone: 'UTC',
          isActive: true,
          nextRunAt: expect.any(Date),
        }),
      });
    });

    it('updates existing schedule', async () => {
      prisma.workflow.findFirst.mockResolvedValue({ id: 'wf-1' });
      prisma.workflowSchedule.findUnique.mockResolvedValue({ id: 'sched-1' });
      prisma.workflowSchedule.update.mockResolvedValue({});

      await service.upsert('t-1', 'wf-1', {
        cronExpression: '*/30 * * * *',
        timezone: 'America/New_York',
      });

      expect(prisma.workflowSchedule.update).toHaveBeenCalledWith({
        where: { workflowId: 'wf-1' },
        data: expect.objectContaining({
          cronExpression: '*/30 * * * *',
          timezone: 'America/New_York',
        }),
      });
    });

    it('rejects unknown workflow', async () => {
      prisma.workflow.findFirst.mockResolvedValue(null);
      await expect(
        service.upsert('t-1', 'missing', { cronExpression: '0 9 * * *' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkSetActive', () => {
    it('pauses all schedules', async () => {
      prisma.workflow.findMany.mockResolvedValue([{ id: 'wf-1' }, { id: 'wf-2' }]);
      prisma.workflowSchedule.findMany.mockResolvedValue([{ id: 's1', isActive: true }]);
      prisma.workflowSchedule.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkSetActive('t-1', false);

      expect(result.updated).toBe(2);
    });

    it('resume recomputes nextRunAt for each', async () => {
      prisma.workflow.findMany.mockResolvedValue([{ id: 'wf-1' }, { id: 'wf-2' }]);
      prisma.workflowSchedule.findMany.mockResolvedValue([
        { id: 's1', isActive: false, cronExpression: '0 9 * * *', timezone: 'UTC' },
        { id: 's2', isActive: false, cronExpression: '*/30 * * * *', timezone: 'UTC' },
      ]);
      prisma.workflowSchedule.update.mockResolvedValue({});

      const result = await service.bulkSetActive('t-1', true);

      expect(result.updated).toBe(2);
      expect(prisma.workflowSchedule.update).toHaveBeenCalledTimes(2);
      const calls = prisma.workflowSchedule.update.mock.calls;
      for (const call of calls) {
        const next = call[0].data.nextRunAt as Date;
        expect(next.getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('returns 0 when no workflows', async () => {
      prisma.workflow.findMany.mockResolvedValue([]);
      // ⚠️ ADDED — bulkSetActive queries schedules after workflows; must mock empty list
      prisma.workflowSchedule.findMany.mockResolvedValue([]);
      const result = await service.bulkSetActive('t-1', false);
      expect(result.updated).toBe(0);
    });
  });

  describe('bulkDelete', () => {
    it('deletes all schedules for tenant', async () => {
      prisma.workflow.findMany.mockResolvedValue([{ id: 'wf-1' }, { id: 'wf-2' }]);
      prisma.workflowSchedule.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkDelete('t-1');

      expect(result.deleted).toBe(3);
      expect(prisma.workflowSchedule.deleteMany).toHaveBeenCalledWith({
        where: { workflowId: { in: ['wf-1', 'wf-2'] } },
      });
    });
  });
});