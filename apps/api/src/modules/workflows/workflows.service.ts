import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { load, dump } from 'js-yaml';
import jsonata from 'jsonata';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowVersionsService } from './workflow-versions.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

const SECRET_KEYS = new Set([
  'secret',
  'apiKey',
  'privateKey',
  'webhookUrl',
  'token',
  'password',
]);
const SECRET_PLACEHOLDER_PREFIX = '${';

interface WorkflowYaml {
  apiVersion: 'relayon/v1';
  kind: 'Workflow';
  metadata: { name: string };
  spec: {
    sourceType: string;
    sourceConfig: Record<string, unknown>;
    enrichmentEnabled: boolean;
    enrichmentPrompt: string | null;
    transformExpression: string | null;
    routingRules: Array<{ when: string; destinationIds: string[] }>;
    isActive: boolean;
    destinations: Array<{
      type: string;
      name: string;
      config: Record<string, unknown>;
      enabled: boolean;
    }>;
  };
}

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: WorkflowVersionsService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.workflow.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { destinations: true } },
        schedule: {
          select: { cronExpression: true, isActive: true, nextRunAt: true },
        },
      },
    });
  }

  async get(tenantId: string, id: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: { destinations: true, schedule: true },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async create(
    tenantId: string,
    dto: CreateWorkflowDto,
    actorId: string | null,
  ) {
    const created = await this.prisma.workflow.create({
      data: {
        tenantId,
        name: dto.name,
        sourceType: dto.sourceType,
        sourceConfig: (dto.sourceConfig ?? {}) as Prisma.InputJsonValue,
        enrichmentEnabled: dto.enrichmentEnabled ?? false,
        enrichmentPrompt: dto.enrichmentPrompt,
        transformExpression: dto.transformExpression,
        routingRules: (dto.routingRules ?? []) as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
    });

    await this.versions.capture(created.id, tenantId, actorId, 'Initial version');
    return created;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateWorkflowDto,
    actorId: string | null,
  ) {
    await this.get(tenantId, id);

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sourceType !== undefined && { sourceType: dto.sourceType }),
        ...(dto.sourceConfig !== undefined && {
          sourceConfig: dto.sourceConfig as Prisma.InputJsonValue,
        }),
        ...(dto.enrichmentEnabled !== undefined && {
          enrichmentEnabled: dto.enrichmentEnabled,
        }),
        ...(dto.enrichmentPrompt !== undefined && {
          enrichmentPrompt: dto.enrichmentPrompt,
        }),
        ...(dto.transformExpression !== undefined && {
          transformExpression: dto.transformExpression,
        }),
        ...(dto.routingRules !== undefined && {
          routingRules: dto.routingRules as Prisma.InputJsonValue,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.versions.capture(
      id,
      tenantId,
      actorId,
      dto.name !== undefined ? `Renamed to "${dto.name}"` : 'Configuration updated',
    );

    return updated;
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.workflow.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ── YAML export / import ──────────────────────────────────────

  async exportYaml(tenantId: string, workflowId: string): Promise<string> {
    const wf = await this.get(tenantId, workflowId);

    const doc: WorkflowYaml = {
      apiVersion: 'relayon/v1',
      kind: 'Workflow',
      metadata: { name: wf.name },
      spec: {
        sourceType: wf.sourceType,
        sourceConfig: this.redactYamlConfig(
          (wf.sourceConfig ?? {}) as Record<string, unknown>,
          'SOURCE',
        ),
        enrichmentEnabled: wf.enrichmentEnabled,
        enrichmentPrompt: wf.enrichmentPrompt,
        transformExpression: wf.transformExpression,
        routingRules: Array.isArray(wf.routingRules)
          ? (wf.routingRules as Array<{ when: string; destinationIds: string[] }>)
          : [],
        isActive: wf.isActive,
        destinations: wf.destinations.map((d) => ({
          type: d.type,
          name: d.name,
          config: this.redactYamlConfig(
            (d.config ?? {}) as Record<string, unknown>,
            d.type.toUpperCase(),
          ),
          enabled: d.enabled,
        })),
      },
    };

    return dump(doc, { noRefs: true, lineWidth: 120 });
  }

  async importYaml(
    tenantId: string,
    yamlText: string,
    actorId: string | null,
  ): Promise<{ id: string; name: string; destinationsCreated: number }> {
    let parsed: unknown;
    try {
      parsed = load(yamlText);
    } catch (err) {
      throw new BadRequestException(
        `Invalid YAML: ${err instanceof Error ? err.message : 'parse error'}`,
      );
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('YAML must be an object');
    }

    const doc = parsed as Partial<WorkflowYaml>;
    if (doc.apiVersion !== 'relayon/v1' || doc.kind !== 'Workflow') {
      throw new BadRequestException(
        'Expected apiVersion "relayon/v1" and kind "Workflow"',
      );
    }

    const spec = doc.spec;
    const name = doc.metadata?.name;
    if (!name || typeof name !== 'string') {
      throw new BadRequestException('metadata.name is required');
    }
    if (!spec || typeof spec.sourceType !== 'string') {
      throw new BadRequestException('spec.sourceType is required');
    }

    const placeholders = this.collectPlaceholders(doc);
    if (placeholders.length > 0) {
      throw new BadRequestException(
        `Unresolved secret placeholder(s): ${placeholders.join(', ')}`,
      );
    }

    const created = await this.prisma.workflow.create({
      data: {
        tenantId,
        name,
        sourceType: spec.sourceType as never,
        sourceConfig: (spec.sourceConfig ?? {}) as Prisma.InputJsonValue,
        enrichmentEnabled: spec.enrichmentEnabled ?? false,
        enrichmentPrompt: spec.enrichmentPrompt ?? null,
        transformExpression: spec.transformExpression ?? null,
        routingRules: (spec.routingRules ?? []) as Prisma.InputJsonValue,
        isActive: spec.isActive ?? true,
        destinations: {
          create: (spec.destinations ?? []).map((d) => ({
            type: d.type as never,
            name: d.name,
            config: (d.config ?? {}) as Prisma.InputJsonValue,
            enabled: d.enabled ?? true,
          })),
        },
      },
      include: { _count: { select: { destinations: true } } },
    });

    await this.versions.capture(
      created.id,
      tenantId,
      actorId,
      'Imported from YAML',
    );

    return {
      id: created.id,
      name: created.name,
      destinationsCreated: created._count.destinations,
    };
  }

  async previewTransform(expression: string, samplePayload: unknown) {
    const started = Date.now();
    if (!expression || !expression.trim()) {
      return {
        ok: false,
        result: null,
        error: 'Expression is empty',
        durationMs: 0,
      };
    }

    let compiled: jsonata.Expression;
    try {
      compiled = jsonata(expression);
    } catch (err) {
      return {
        ok: false,
        result: null,
        error: `Compile error: ${err instanceof Error ? err.message : String(err)}`,
        durationMs: Date.now() - started,
      };
    }

    try {
      const result = await Promise.race<unknown>([
        compiled.evaluate(samplePayload),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Expression exceeded 2000ms timeout')),
            2000,
          ),
        ),
      ]);
      return {
        ok: true,
        result: result === undefined ? null : result,
        error: null,
        durationMs: Date.now() - started,
      };
    } catch (err) {
      return {
        ok: false,
        result: null,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - started,
      };
    }
  }

  async testRun(
    tenantId: string,
    workflowId: string,
    payload: unknown,
  ) {
    await this.get(tenantId, workflowId);

    const workersUrl = process.env['WORKERS_URL'];
    const cronSecret = process.env['CRON_SECRET'];
    if (!workersUrl || !cronSecret) {
      throw new BadRequestException(
        'WORKERS_URL and CRON_SECRET must be configured to use test-run',
      );
    }

    const res = await fetch(`${workersUrl}/internal/process/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': cronSecret,
      },
      body: JSON.stringify({ tenantId, workflowId, payload }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new BadRequestException(
        `Workers returned ${res.status}: ${detail.slice(0, 200)}`,
      );
    }

    return res.json();
  }

  private redactYamlConfig(
    config: Record<string, unknown>,
    namespace: string,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (SECRET_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
        out[key] = `${SECRET_PLACEHOLDER_PREFIX}${namespace}_${key.toUpperCase()}}`;
      } else if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        out[key] = this.redactYamlConfig(
          value as Record<string, unknown>,
          namespace,
        );
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  private collectPlaceholders(doc: Partial<WorkflowYaml>): string[] {
    const found: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (
        typeof value === 'string' &&
        value.startsWith(SECRET_PLACEHOLDER_PREFIX)
      ) {
        found.push(path);
      } else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          walk(v, `${path}.${k}`);
        }
      }
    };
    walk(doc, '');
    return found;
  }
}