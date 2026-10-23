import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface VersionSummary {
  id: string;
  version: number;
  message: string | null;
  createdBy: string | null;
  createdAt: Date;
}

const MAX_VERSIONS_PER_WORKFLOW = 50;

@Injectable()
export class WorkflowVersionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Snapshots the CURRENT state of a workflow (including destinations)
   * as a new immutable version. Called after every create/update.
   */
  async capture(
    workflowId: string,
    tenantId: string,
    actorId: string | null,
    message: string | null,
  ): Promise<void> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId },
      include: { destinations: true },
    });
    if (!workflow) return;

    const last = await this.prisma.workflowVersion.findFirst({
      where: { workflowId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = (last?.version ?? 0) + 1;

    const snapshot = {
      name: workflow.name,
      sourceType: workflow.sourceType,
      sourceConfig: workflow.sourceConfig,
      enrichmentEnabled: workflow.enrichmentEnabled,
      enrichmentPrompt: workflow.enrichmentPrompt,
      transformExpression: workflow.transformExpression,
      routingRules: workflow.routingRules,
      isActive: workflow.isActive,
      destinations: workflow.destinations.map((d) => ({
        type: d.type,
        name: d.name,
        config: d.config,
        enabled: d.enabled,
        retryPolicy: d.retryPolicy,
      })),
    };

    await this.prisma.workflowVersion.create({
      data: {
        workflowId,
        tenantId,
        version: nextVersion,
        snapshot: snapshot as never,
        message,
        createdBy: actorId,
      },
    });

    // Trim old versions beyond the retention cap
    const excess = await this.prisma.workflowVersion.findMany({
      where: { workflowId },
      orderBy: { version: 'desc' },
      skip: MAX_VERSIONS_PER_WORKFLOW,
      select: { id: true },
    });

    if (excess.length > 0) {
      await this.prisma.workflowVersion.deleteMany({
        where: { id: { in: excess.map((v) => v.id) } },
      });
    }
  }

  async list(tenantId: string, workflowId: string): Promise<VersionSummary[]> {
    await this.assertOwnership(tenantId, workflowId);
    return this.prisma.workflowVersion.findMany({
      where: { workflowId, tenantId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        message: true,
        createdBy: true,
        createdAt: true,
      },
    });
  }

  async get(tenantId: string, workflowId: string, version: number) {
    await this.assertOwnership(tenantId, workflowId);
    const row = await this.prisma.workflowVersion.findFirst({
      where: { workflowId, tenantId, version },
    });
    if (!row) throw new NotFoundException(`Version ${version} not found`);
    return row;
  }

  /**
   * Restores a workflow to a previous snapshot. Destinations are replaced
   * wholesale (deleted + recreated) because their IDs are not stable across
   * versions. A new version is captured afterwards so history stays linear.
   */
  async restore(
    tenantId: string,
    workflowId: string,
    version: number,
    actorId: string | null,
  ) {
    const target = await this.get(tenantId, workflowId, version);
    const snap = target.snapshot as Record<string, unknown>;

    const destinations = Array.isArray(snap['destinations'])
      ? (snap['destinations'] as Array<Record<string, unknown>>)
      : [];

    await this.prisma.$transaction(async (tx) => {
      await tx.destination.deleteMany({ where: { workflowId } });

      await tx.workflow.update({
        where: { id: workflowId },
        data: {
          name: snap['name'] as string,
          sourceType: snap['sourceType'] as never,
          sourceConfig: (snap['sourceConfig'] ?? {}) as never,
          enrichmentEnabled: Boolean(snap['enrichmentEnabled']),
          enrichmentPrompt: (snap['enrichmentPrompt'] as string | null) ?? null,
          transformExpression:
            (snap['transformExpression'] as string | null) ?? null,
          routingRules: (snap['routingRules'] ?? []) as never,
          isActive:
            snap['isActive'] === undefined ? true : Boolean(snap['isActive']),
          destinations: {
            create: destinations.map((d) => ({
              type: d['type'] as never,
              name: d['name'] as string,
              config: (d['config'] ?? {}) as never,
              enabled: d['enabled'] === undefined ? true : Boolean(d['enabled']),
              retryPolicy: (d['retryPolicy'] ?? undefined) as never,
            })),
          },
        },
      });
    });

    await this.capture(
      workflowId,
      tenantId,
      actorId,
      `Restored from v${version}`,
    );

    return this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { destinations: true },
    });
  }

  private async assertOwnership(tenantId: string, workflowId: string) {
    const wf = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId },
      select: { id: true },
    });
    if (!wf) throw new NotFoundException('Workflow not found');
  }
}