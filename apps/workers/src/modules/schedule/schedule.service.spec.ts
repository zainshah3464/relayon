import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ScheduleService } from './schedule.service';
import { makePrismaMock } from '../../../../../test/mocks/prisma';

vi.mock('../../lib/queues', () => ({
  INCOMING_QUEUE: 'queue:events:incoming',
}));

describe('ScheduleService (workers)', () => {
  let service: ScheduleService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: { raw: { lpush: Mock } };

  beforeEach(() => {
    prisma = makePrismaMock();
    redis = { raw: { lpush: vi.fn(async () => 1) } };
    service = new ScheduleService(prisma as never, redis as never);
  });

  describe('tick', () => {
    it('returns empty stats when no due schedules', async () => {
      prisma.workflowSchedule.findMany.mockResolvedValue([]);
      const result = await service.tick();

      expect(result.due).toBe(0);
      expect(result.enqueued).toBe(0);
      expect(redis.raw.lpush).not.toHaveBeenCalled();
    });

    it('claims due schedule and enqueues synthetic event', async () => {
      const workflow = {
        id: 'wf-1',
        tenantId: 't-1',
        sourceType: 'generic',
        isActive: true,
      };
      const schedule = {
        id: 'sched-1',
        cronExpression: '*/15 * * * *',
        timezone: 'UTC',
        payloadTemplate: { report: 'daily' },
        isActive: true,
        nextRunAt: new Date(Date.now() - 1000),
        workflow,
      };
      prisma.workflowSchedule.findMany.mockResolvedValue([schedule]);
      prisma.workflowSchedule.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.tick();

      expect(result.due).toBe(1);
      expect(result.enqueued).toBe(1);
      expect(redis.raw.lpush).toHaveBeenCalledOnce();

      const [queue, payload] = redis.raw.lpush.mock.calls[0]!;
      expect(queue).toBe('queue:events:incoming');
      const event = JSON.parse(payload);
      expect(event.workflowId).toBe('wf-1');
      expect(event.tenantId).toBe('t-1');
      expect(event.rawPayload.type).toBe('relayon.schedule.trigger');
      expect(event.rawPayload.data).toEqual({ report: 'daily' });
    });

    it('atomic claim skips if updateMany returns 0 (another worker won)', async () => {
      const workflow = { id: 'wf-1', tenantId: 't-1', sourceType: 'generic', isActive: true };
      prisma.workflowSchedule.findMany.mockResolvedValue([
        {
          id: 'sched-1',
          cronExpression: '*/15 * * * *',
          timezone: 'UTC',
          payloadTemplate: {},
          isActive: true,
          nextRunAt: new Date(Date.now() - 1000),
          workflow,
        },
      ]);
      prisma.workflowSchedule.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.tick();

      expect(result.skipped).toBe(1);
      expect(result.enqueued).toBe(0);
      expect(redis.raw.lpush).not.toHaveBeenCalled();
    });

    it('deactivates schedule for inactive workflow', async () => {
      const workflow = { id: 'wf-1', tenantId: 't-1', sourceType: 'generic', isActive: false };
      prisma.workflowSchedule.findMany.mockResolvedValue([
        {
          id: 'sched-1',
          cronExpression: '*/15 * * * *',
          timezone: 'UTC',
          payloadTemplate: {},
          isActive: true,
          nextRunAt: new Date(Date.now() - 1000),
          workflow,
        },
      ]);
      prisma.workflowSchedule.update.mockResolvedValue({});

      const result = await service.tick();

      expect(result.deactivated).toBe(1);
      expect(prisma.workflowSchedule.update).toHaveBeenCalledWith({
        where: { id: 'sched-1' },
        data: { isActive: false },
      });
    });

    it('deactivates schedule with invalid cron expression', async () => {
      const workflow = { id: 'wf-1', tenantId: 't-1', sourceType: 'generic', isActive: true };
      prisma.workflowSchedule.findMany.mockResolvedValue([
        {
          id: 'sched-1',
          cronExpression: 'this-is-not-cron',
          timezone: 'UTC',
          payloadTemplate: {},
          isActive: true,
          nextRunAt: new Date(Date.now() - 1000),
          workflow,
        },
      ]);
      prisma.workflowSchedule.update.mockResolvedValue({});

      const result = await service.tick();

      expect(result.deactivated).toBe(1);
    });
  });

  describe('runNow', () => {
    it('enqueues event immediately', async () => {
      prisma.workflowSchedule.findUnique.mockResolvedValue({
        id: 'sched-1',
        cronExpression: '0 9 * * *',
        timezone: 'UTC',
        payloadTemplate: { report: 'manual' },
        workflow: { id: 'wf-1', tenantId: 't-1', sourceType: 'generic', isActive: true },
      });

      const result = await service.runNow('wf-1');

      expect(result.correlationId).toBeDefined();
      expect(redis.raw.lpush).toHaveBeenCalledOnce();
      const payload = JSON.parse(redis.raw.lpush.mock.calls[0]![1]);
      expect(payload.rawPayload.type).toBe('relayon.schedule.manual');
    });

    it('throws for unknown workflow', async () => {
      prisma.workflowSchedule.findUnique.mockResolvedValue(null);
      await expect(service.runNow('missing')).rejects.toThrow();
    });

    it('rejects inactive workflow', async () => {
      prisma.workflowSchedule.findUnique.mockResolvedValue({
        workflow: { id: 'wf-1', isActive: false, tenantId: 't-1', sourceType: 'generic' },
      });
      await expect(service.runNow('wf-1')).rejects.toThrow(/inactive/i);
    });
  });
});