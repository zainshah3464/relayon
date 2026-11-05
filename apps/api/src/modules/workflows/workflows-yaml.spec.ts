import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { makePrismaMock } from '../../../../../test/mocks/prisma';

vi.mock('jsonata', () => ({
  default: vi.fn(() => ({
    evaluate: vi.fn(async () => ({ ok: true })),
  })),
}));

describe('WorkflowsService — YAML', () => {
  let service: WorkflowsService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let versions: { capture: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = makePrismaMock();
    versions = { capture: vi.fn() };
    service = new WorkflowsService(prisma as never, versions as never);
  });

  describe('exportYaml', () => {
    it('redacts secrets to ${...} placeholders', async () => {
      prisma.workflow.findFirst.mockResolvedValue({
        id: 'wf-1',
        name: 'Stripe Flow',
        sourceType: 'stripe',
        sourceConfig: { secret: 'whsec_real_secret' },
        enrichmentEnabled: true,
        enrichmentPrompt: null,
        transformExpression: null,
        routingRules: [],
        isActive: true,
        destinations: [
          {
            id: 'd1',
            type: 'slack',
            name: 'Alerts',
            config: { webhookUrl: 'https://hooks.slack.com/xyz' },
            enabled: true,
            retryPolicy: {},
          },
        ],
      });

      const yaml = await service.exportYaml('t-1', 'wf-1');

      expect(yaml).toContain('${SOURCE_SECRET}');
      expect(yaml).toContain('${SLACK_WEBHOOKURL}');
      expect(yaml).not.toContain('whsec_real_secret');
      expect(yaml).not.toContain('https://hooks.slack.com/xyz');
    });

    it('includes apiVersion and kind', async () => {
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

      const yaml = await service.exportYaml('t-1', 'wf-1');
      expect(yaml).toContain('apiVersion: relayon/v1');
      expect(yaml).toContain('kind: Workflow');
    });
  });

  describe('importYaml', () => {
    const validYaml = `apiVersion: relayon/v1
kind: Workflow
metadata:
  name: Imported Flow
spec:
  sourceType: stripe
  sourceConfig:
    secret: whsec_real_value
  enrichmentEnabled: true
  destinations:
    - type: http
      name: Hook
      config:
        url: https://example.com
      enabled: true`;

    it('rejects YAML with ${...} placeholders', async () => {
      const withPlaceholder = validYaml.replace('whsec_real_value', '${SECRET}');

      await expect(
        service.importYaml('t-1', withPlaceholder, null, 'create'),
      ).rejects.toThrow(/placeholder/i);
    });

    it('rejects invalid apiVersion', async () => {
      const badYaml = validYaml.replace('relayon/v1', 'relayon/v2');
      await expect(
        service.importYaml('t-1', badYaml, null, 'create'),
      ).rejects.toThrow(/apiVersion/);
    });

    it('rejects missing metadata.name', async () => {
      const noName = validYaml.replace('Imported Flow', '');
      await expect(
        service.importYaml('t-1', noName, null, 'create'),
      ).rejects.toThrow(/name/i);
    });

    it('creates workflow + destinations in create mode', async () => {
      prisma.workflow.create.mockResolvedValue({
        id: 'new-wf',
        name: 'Imported Flow',
        _count: { destinations: 1 },
      });

      const result = await service.importYaml('t-1', validYaml, 'user-1', 'create');

      expect(result.id).toBe('new-wf');
      expect(result.destinationsCreated).toBe(1);
      expect(result.updated).toBe(false);
      expect(versions.capture).toHaveBeenCalled();
    });

    // ⚠️ FIX #3 — inline version capture needs full workflow + version mocks
    it('upserts by name in upsert mode', async () => {
      prisma.workflow.findFirst.mockResolvedValue({ id: 'existing-wf' });
      // update() returns workflow WITH destinations (inline capture uses it)
      prisma.workflow.update.mockResolvedValue({
        id: 'existing-wf',
        name: 'Imported Flow',
        sourceType: 'stripe',
        sourceConfig: {},
        enrichmentEnabled: false,
        enrichmentPrompt: null,
        transformExpression: null,
        routingRules: [],
        isActive: true,
        destinations: [],
      });
      // Inline version capture inside update() needs these mocks
      prisma.workflowVersion.findFirst.mockResolvedValue({ version: 1 });
      prisma.workflowVersion.create.mockResolvedValue({});

      prisma.destination.deleteMany.mockResolvedValue({});
      prisma.destination.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importYaml('t-1', validYaml, 'user-1', 'upsert');

      expect(result.updated).toBe(true);
      expect(result.id).toBe('existing-wf');
      expect(prisma.destination.deleteMany).toHaveBeenCalled();
      expect(prisma.destination.createMany).toHaveBeenCalled();
    });
  });
});