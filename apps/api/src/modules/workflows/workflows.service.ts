import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { load, dump } from 'js-yaml';
import jsonata from 'jsonata';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

const SECRET_KEYS = new Set(['secret', 'apiKey', 'privateKey', 'webhookUrl']);
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
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.workflow.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { destinations: true } } },
    });
  }

  async get(tenantId: string, id: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: { destinations: true },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async create(tenantId: string, dto: CreateWorkflowDto) {
    return this.prisma.workflow.create({
      data: {
        tenantId,
        name: dto.name,
        sourceType: dto.sourceType,
        sourceConfig: (dto.sourceConfig ?? {}) as Prisma.InputJsonValue,
        enrichmentEnabled: dto.enrichmentEnabled ?? false,
        enrichmentPrompt: dto.enrichmentPrompt,
        transformExpression: dto.transformExpression,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateWorkflowDto) {
    await this.get(tenantId, id);
    return this.prisma.workflow.update({
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
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.workflow.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ─────────────────────────────────────────────────────────────
  // YAML EXPORT
  // ─────────────────────────────────────────────────────────────

  async exportYaml(tenantId: string, workflowId: string): Promise<string> {
    const wf = await this.get(tenantId, workflowId);

    const doc: WorkflowYaml = {
      apiVersion: 'relayon/v1',
      kind: 'Workflow',
      metadata: { name: wf.name },
      spec: {
        sourceType: wf.sourceType,
        sourceConfig: this.redactConfig(
          (wf.sourceConfig ?? {}) as Record<string, unknown>,
          'SOURCE',
        ),
        enrichmentEnabled: wf.enrichmentEnabled,
        enrichmentPrompt: wf.enrichmentPrompt,
        transformExpression: wf.transformExpression,
        isActive: wf.isActive,
        destinations: wf.destinations.map((d) => ({
          type: d.type,
          name: d.name,
          config: this.redactConfig(
            (d.config ?? {}) as Record<string, unknown>,
            d.type.toUpperCase(),
          ),
          enabled: d.enabled,
        })),
      },
    };

    return dump(doc, { noRefs: true, lineWidth: 120 });
  }

  // ─────────────────────────────────────────────────────────────
  // YAML IMPORT
  // ─────────────────────────────────────────────────────────────

  async importYaml(
    tenantId: string,
    yamlText: string,
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

    const placeholderChecks = this.collectPlaceholders(doc);
    if (placeholderChecks.length > 0) {
      throw new BadRequestException(
        `Unresolved secret placeholder(s): ${placeholderChecks.join(', ')}. Replace \${...} with real values before import.`,
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
      include: { destinations: true },
    });

    return {
      id: created.id,
      name: created.name,
      destinationsCreated: created.destinations?.length ?? 0,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // TRANSFORM PREVIEW
  // ─────────────────────────────────────────────────────────────

  /**
   * Compile + evaluate a JSONata expression against a sample payload.
   * Compile-once per call, 2000ms timeout. Used by the workflow editor
   * to validate transforms before saving.
   */
  async previewTransform(
    expression: string,
    samplePayload: unknown,
  ): Promise<{
    ok: boolean;
    result: unknown;
    error: string | null;
    durationMs: number;
  }> {
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

  private redactConfig(
    config: Record<string, unknown>,
    namespace: string,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (SECRET_KEYS.has(key) && value !== null && value !== '') {
        out[key] = `${SECRET_PLACEHOLDER_PREFIX}${namespace}_${key.toUpperCase()}}`;
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        out[key] = this.redactConfig(
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
      if (typeof value === 'string' && value.startsWith(SECRET_PLACEHOLDER_PREFIX)) {
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