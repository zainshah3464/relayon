import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';

// ⚠️ Mock `diff` to avoid module-load hang
vi.mock('diff', () => ({
  createTwoFilesPatch: vi.fn(
    (oldFile: string, newFile: string, oldStr: string, newStr: string) => {
      if (oldStr === newStr) return '';
      return `--- ${oldFile}\n+++ ${newFile}\n@@ -1,1 +1,1 @@\n-old\n+new\n`;
    },
  ),
  structuredPatch: vi.fn(
    (_oldFile: string, _newFile: string, oldStr: string, newStr: string) => {
      if (oldStr === newStr) return { hunks: [] };
      return {
        hunks: [
          {
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            lines: ['-old', '+new'],
          },
        ],
      };
    },
  ),
}));

import { WorkflowVersionsService } from './workflow-versions.service';
import { makePrismaMock } from '../../../../../test/mocks/prisma';

describe('WorkflowVersionsService', () => {
  let service: WorkflowVersionsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new WorkflowVersionsService(prisma as never);
  });

  describe('capture', () => {
    it('creates v1 on first capture', async () => {
      prisma.workflow.findFirst.mockResolvedValue({
        id: 'wf-1',
        name: 'Test',
        sourceType: 'stripe',
        sourceConfig: { secret: 'enc:...' },
        enrichmentEnabled: false,
        enrichmentPrompt: null,
        transformExpression: null,
        routingRules: [],
        isActive: true,
        destinations: [],
      });
      prisma.workflowVersion.findFirst.mockResolvedValue(null);
      prisma.workflowVersion.create.mockResolvedValue({});
      prisma.workflowVersion.findMany.mockResolvedValue([]);

      await service.capture('wf-1', 't-1', 'user-1', 'Initial');

      expect(prisma.workflowVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workflowId: 'wf-1',
          tenantId: 't-1',
          version: 1,
          message: 'Initial',
          createdBy: 'user-1',
        }),
      });
    });

    it('increments version number', async () => {
      prisma.workflow.findFirst.mockResolvedValue({
        id: 'wf-1',
        name: 'Test',
        sourceType: 'stripe',
        sourceConfig: {},
        enrichmentEnabled: false,
        enrichmentPrompt: null,
        transformExpression: null,
        routingRules: [],
        isActive: true,
        destinations: [],
      });
      prisma.workflowVersion.findFirst.mockResolvedValue({ version: 5 });
      prisma.workflowVersion.create.mockResolvedValue({});
      prisma.workflowVersion.findMany.mockResolvedValue([]);

      await service.capture('wf-1', 't-1', null, 'Update');

      expect(prisma.workflowVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ version: 6 }),
      });
    });

    it('prunes versions beyond 50', async () => {
      prisma.workflow.findFirst.mockResolvedValue({
        id: 'wf-1',
        name: 'Test',
        sourceType: 'stripe',
        sourceConfig: {},
        enrichmentEnabled: false,
        enrichmentPrompt: null,
        transformExpression: null,
        routingRules: [],
        isActive: true,
        destinations: [],
      });
      prisma.workflowVersion.findFirst.mockResolvedValue({ version: 50 });
      prisma.workflowVersion.create.mockResolvedValue({});
      prisma.workflowVersion.findMany.mockResolvedValue([
        { id: 'old-1' },
        { id: 'old-2' },
      ]);
      prisma.workflowVersion.deleteMany.mockResolvedValue({ count: 2 });

      await service.capture('wf-1', 't-1', null, null);

      expect(prisma.workflowVersion.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['old-1', 'old-2'] } },
      });
    });

    it('silently no-ops for missing workflow', async () => {
      prisma.workflow.findFirst.mockResolvedValue(null);
      await expect(
        service.capture('missing', 't-1', null, 'msg'),
      ).resolves.toBeUndefined();
      expect(prisma.workflowVersion.create).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('replaces destinations and creates new version', async () => {
      // ⚠️ FIX — workflow.findFirst is called TWICE:
      //   1. get()       → needs only { id }
      //   2. capture()   → needs full object with destinations array
      prisma.workflow.findFirst
        .mockResolvedValueOnce({ id: 'wf-1' }) // get()
        .mockResolvedValue({
          // capture() — full object
          id: 'wf-1',
          name: 'Old Name',
          sourceType: 'stripe',
          sourceConfig: { secret: 'enc:x' },
          enrichmentEnabled: false,
          enrichmentPrompt: null,
          transformExpression: null,
          routingRules: [],
          isActive: true,
          destinations: [],
        });

      prisma.workflowVersion.findFirst.mockResolvedValue({
        version: 1,
        snapshot: {
          name: 'Old Name',
          sourceType: 'stripe',
          sourceConfig: { secret: 'enc:x' },
          enrichmentEnabled: false,
          destinations: [
            { type: 'http', name: 'Old Dest', config: { url: 'https://x.com' } },
          ],
        },
      });
      prisma.destination.deleteMany.mockResolvedValue({ count: 1 });
      prisma.workflow.update.mockResolvedValue({});
      prisma.workflow.findUnique.mockResolvedValue({ id: 'wf-1' });
      prisma.workflowVersion.create.mockResolvedValue({});
      prisma.workflowVersion.findMany.mockResolvedValue([]);

      await service.restore('t-1', 'wf-1', 1, 'user-1');

      expect(prisma.destination.deleteMany).toHaveBeenCalledWith({
        where: { workflowId: 'wf-1' },
      });
      expect(prisma.workflow.update).toHaveBeenCalledWith({
        where: { id: 'wf-1' },
        data: expect.objectContaining({
          name: 'Old Name',
          destinations: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ name: 'Old Dest', type: 'http' }),
            ]),
          }),
        }),
        include: { destinations: true },
      });
    });

    it('throws for missing version', async () => {
      prisma.workflow.findFirst.mockResolvedValue({ id: 'wf-1' });
      prisma.workflowVersion.findFirst.mockResolvedValue(null);

      await expect(
        service.restore('t-1', 'wf-1', 99, null),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('diff', () => {
    it('returns identical:true for same version', async () => {
      const snapshot = { name: 'X', sourceType: 'stripe', destinations: [] };
      prisma.workflow.findFirst.mockResolvedValue({ id: 'wf-1' });
      prisma.workflowVersion.findFirst
        .mockResolvedValueOnce({ version: 1, snapshot })
        .mockResolvedValueOnce({ version: 1, snapshot });

      const result = await service.diff('t-1', 'wf-1', 1, 1);

      expect(result.identical).toBe(true);
      expect(result.unified).toBe('');
      expect(result.structured.split).toEqual([]);
    });

    it('returns unified + split rows for different versions', async () => {
      prisma.workflow.findFirst.mockResolvedValue({ id: 'wf-1' });
      prisma.workflowVersion.findFirst
        .mockResolvedValueOnce({ version: 1, snapshot: { name: 'Old' } })
        .mockResolvedValueOnce({ version: 2, snapshot: { name: 'New' } });

      const result = await service.diff('t-1', 'wf-1', 1, 2);

      expect(result.identical).toBe(false);
      expect(result.unified).toContain('-');
      expect(result.unified).toContain('+');
      expect(result.stats.removed).toBeGreaterThan(0);
      expect(result.stats.added).toBeGreaterThan(0);
      expect(result.structured.split.length).toBeGreaterThan(0);
    });
  });
});