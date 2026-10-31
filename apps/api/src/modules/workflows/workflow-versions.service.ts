import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createTwoFilesPatch, structuredPatch } = require('diff') as {
  createTwoFilesPatch: (
    oldFile: string,
    newFile: string,
    oldStr: string,
    newStr: string,
    oldHeader?: string,
    newHeader?: string,
    options?: { context?: number },
  ) => string;
  structuredPatch: (
    oldFileName: string,
    newFileName: string,
    oldStr: string,
    newStr: string,
    oldHeader?: string,
    newHeader?: string,
    options?: { context?: number },
  ) => {
    hunks: Array<{
      oldStart: number;
      oldLines: number;
      newStart: number;
      newLines: number;
      lines: string[];
    }>;
  };
};

export interface VersionSummary {
  id: string;
  version: number;
  message: string | null;
  createdBy: string | null;
  createdAt: Date;
}

export interface SplitDiffRow {
  left: { lineNo: number | null; text: string; type: 'ctx' | 'del' | 'blank' };
  right: { lineNo: number | null; text: string; type: 'ctx' | 'add' | 'blank' };
}

export interface VersionDiffResult {
  fromVersion: number;
  toVersion: number;
  identical: boolean;
  stats: { added: number; removed: number };
  unified: string;
  structured: {
    hunks: Array<{
      oldStart: number;
      oldLines: number;
      newStart: number;
      newLines: number;
    }>;
    split: SplitDiffRow[];
  };
}

const MAX_VERSIONS_PER_WORKFLOW = 50;

@Injectable()
export class WorkflowVersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async capture(
    workflowId: string,
    tenantId: string,
    actorId: string | null,
    message: string | null,
  ): Promise<void> {
    await this.prisma.withTenant(tenantId, async (tx) => {
      const workflow = await tx.workflow.findFirst({
        where: { id: workflowId, tenantId },
        include: { destinations: true },
      });
      if (!workflow) return;

      const last = await tx.workflowVersion.findFirst({
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

      await tx.workflowVersion.create({
        data: {
          workflowId,
          tenantId,
          version: nextVersion,
          snapshot: snapshot as never,
          message,
          createdBy: actorId,
        },
      });

      const excess = await tx.workflowVersion.findMany({
        where: { workflowId },
        orderBy: { version: 'desc' },
        skip: MAX_VERSIONS_PER_WORKFLOW,
        select: { id: true },
      });

      if (excess.length > 0) {
        await tx.workflowVersion.deleteMany({
          where: { id: { in: excess.map((v) => v.id) } },
        });
      }
    });
  }

  async list(tenantId: string, workflowId: string): Promise<VersionSummary[]> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const wf = await tx.workflow.findFirst({
        where: { id: workflowId, tenantId },
        select: { id: true },
      });
      if (!wf) throw new NotFoundException('Workflow not found');

      return tx.workflowVersion.findMany({
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
    });
  }

  async get(tenantId: string, workflowId: string, version: number) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const wf = await tx.workflow.findFirst({
        where: { id: workflowId, tenantId },
        select: { id: true },
      });
      if (!wf) throw new NotFoundException('Workflow not found');

      const row = await tx.workflowVersion.findFirst({
        where: { workflowId, tenantId, version },
      });
      if (!row) throw new NotFoundException(`Version ${version} not found`);
      return row;
    });
  }

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

    // Single transaction: delete old destinations, update workflow,
    // recreate destinations (with tenantId) — all atomic.
    const restored = await this.prisma.withTenant(tenantId, async (tx) => {
      await tx.destination.deleteMany({ where: { workflowId } });

      return tx.workflow.update({
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
              tenantId, // ← v1.9: required field
              type: d['type'] as never,
              name: d['name'] as string,
              config: (d['config'] ?? {}) as never,
              enabled: d['enabled'] === undefined ? true : Boolean(d['enabled']),
              retryPolicy: (d['retryPolicy'] ?? undefined) as never,
            })),
          },
        },
        include: { destinations: true },
      });
    });

    // Snapshot the restore as a new version (capture runs its own tx).
    await this.capture(
      workflowId,
      tenantId,
      actorId,
      `Restored from v${version}`,
    );

    // Return fresh read inside tenant context (RLS-safe).
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.workflow.findUnique({
        where: { id: workflowId },
        include: { destinations: true },
      }),
    );
  }

  async diff(
    tenantId: string,
    workflowId: string,
    fromVersion: number,
    toVersion: number,
  ): Promise<VersionDiffResult> {
    const fromRow = await this.get(tenantId, workflowId, fromVersion);
    const toRow = await this.get(tenantId, workflowId, toVersion);

    const fromText = JSON.stringify(fromRow.snapshot, null, 2);
    const toText = JSON.stringify(toRow.snapshot, null, 2);

    if (fromText === toText) {
      return {
        fromVersion,
        toVersion,
        identical: true,
        stats: { added: 0, removed: 0 },
        unified: '',
        structured: { hunks: [], split: [] },
      };
    }

    const unified = createTwoFilesPatch(
      `v${fromVersion}`,
      `v${toVersion}`,
      fromText,
      toText,
      `Version ${fromVersion}`,
      `Version ${toVersion}`,
      { context: 3 },
    );

    const patch = structuredPatch(
      `v${fromVersion}`,
      `v${toVersion}`,
      fromText,
      toText,
      '',
      '',
      { context: 3 },
    );

    const split = this.buildSplitRows(patch.hunks);

    let added = 0;
    let removed = 0;
    for (const line of unified.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) added++;
      else if (line.startsWith('-') && !line.startsWith('---')) removed++;
    }

    return {
      fromVersion,
      toVersion,
      identical: false,
      stats: { added, removed },
      unified,
      structured: {
        hunks: patch.hunks.map((h) => ({
          oldStart: h.oldStart,
          oldLines: h.oldLines,
          newStart: h.newStart,
          newLines: h.newLines,
        })),
        split,
      },
    };
  }

  private buildSplitRows(
    hunks: Array<{ oldStart: number; newStart: number; lines: string[] }>,
  ): SplitDiffRow[] {
    const rows: SplitDiffRow[] = [];

    for (const hunk of hunks) {
      let oldNo = hunk.oldStart;
      let newNo = hunk.newStart;

      let i = 0;
      while (i < hunk.lines.length) {
        const line = hunk.lines[i]!;
        const marker = line[0];
        const text = line.slice(1);

        if (marker === ' ') {
          rows.push({
            left: { lineNo: oldNo++, text, type: 'ctx' },
            right: { lineNo: newNo++, text, type: 'ctx' },
          });
          i++;
          continue;
        }

        const deletions: Array<{ lineNo: number; text: string }> = [];
        while (i < hunk.lines.length && hunk.lines[i]![0] === '-') {
          deletions.push({ lineNo: oldNo++, text: hunk.lines[i]!.slice(1) });
          i++;
        }

        const additions: Array<{ lineNo: number; text: string }> = [];
        while (i < hunk.lines.length && hunk.lines[i]![0] === '+') {
          additions.push({ lineNo: newNo++, text: hunk.lines[i]!.slice(1) });
          i++;
        }

        const max = Math.max(deletions.length, additions.length);
        for (let k = 0; k < max; k++) {
          const del = deletions[k];
          const add = additions[k];
          rows.push({
            left: del
              ? { lineNo: del.lineNo, text: del.text, type: 'del' }
              : { lineNo: null, text: '', type: 'blank' },
            right: add
              ? { lineNo: add.lineNo, text: add.text, type: 'add' }
              : { lineNo: null, text: '', type: 'blank' },
          });
        }
      }
    }

    return rows;
  }
}