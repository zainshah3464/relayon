import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDestinationDto,
  UpdateDestinationDto,
} from './dto/destination.dto';
import { ValidateDestinationDto } from './dto/validate-destination.dto';
import { encryptConfig, encryptConfigAll, redactConfig } from '../../lib/crypto-box';

type DestinationRow = {
  id: string;
  workflowId: string;
  type: string;
  name: string;
  config: unknown;
  enabled: boolean;
  retryPolicy: unknown;
  createdAt: Date;
  updatedAt: Date;
};

interface ValidationResult {
  ok: boolean;
  layer: 'schema' | 'connectivity' | 'both';
  errors: Array<{ field: string; message: string }>;
  warnings: string[];
  dryRun: {
    attempted: boolean;
    success: boolean;
    latencyMs: number;
    detail: string;
  } | null;
}

@Injectable()
export class DestinationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, workflowId: string) {
    await this.assertWorkflow(tenantId, workflowId);
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.destination.findMany({
        where: { workflowId },
        orderBy: { createdAt: 'asc' },
      }),
    );
    return rows.map((r) => this.toClient(r));
  }

  async create(
    tenantId: string,
    workflowId: string,
    dto: CreateDestinationDto,
  ) {
    await this.assertWorkflow(tenantId, workflowId);

    const config = dto.config ?? {};
    const encrypted =
      process.env['FULL_CONFIG_ENCRYPTION'] === 'true'
        ? encryptConfigAll(config, tenantId)
        : encryptConfig(config, tenantId);

    const created = await this.prisma.withTenant(tenantId, (tx) =>
      tx.destination.create({
        data: {
          workflowId,
          tenantId,
          type: dto.type,
          name: dto.name,
          config: encrypted as never,
          enabled: dto.enabled ?? true,
        },
      }),
    );

    return this.toClient(created);
  }

  async update(tenantId: string, id: string, dto: UpdateDestinationDto) {
    const dest = await this.prisma.withTenant(tenantId, (tx) =>
      tx.destination.findFirst({ where: { id, tenantId } }),
    );
    if (!dest) throw new NotFoundException('Destination not found');

    let nextConfig: Record<string, unknown> | undefined;

    if (dto.config !== undefined) {
      const existing = (dest.config ?? {}) as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...existing };

      for (const [key, value] of Object.entries(dto.config)) {
        // Client sent the redaction mask back — keep the stored ciphertext
        if (value === '••••••••') continue;
        merged[key] = value;
      }

      const encryptionFn =
        process.env['FULL_CONFIG_ENCRYPTION'] === 'true'
          ? encryptConfigAll
          : encryptConfig;
      nextConfig = encryptionFn(merged, tenantId);
    }

    const updated = await this.prisma.withTenant(tenantId, (tx) =>
      tx.destination.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(nextConfig !== undefined && { config: nextConfig as never }),
          ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        },
      }),
    );

    return this.toClient(updated);
  }

  async remove(tenantId: string, id: string) {
    const dest = await this.prisma.withTenant(tenantId, (tx) =>
      tx.destination.findFirst({ where: { id, tenantId } }),
    );
    if (!dest) throw new NotFoundException('Destination not found');
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.destination.delete({ where: { id } }),
    );
    return { deleted: true, id };
  }

  /**
   * Two-layer validation:
   *   1. Schema check — required keys present, basic shape correct
   *   2. Connectivity (optional dryRun) — delegates to workers, which
   *      runs the real adapter against a test payload without writing
   *      to the destination (adapters honour ctx.config.__dryRun).
   */
  async validate(
    tenantId: string,
    dto: ValidateDestinationDto,
  ): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: string[] = [];

    const required = this.requiredKeys(dto.type);
    for (const key of required) {
      const value = dto.config[key];
      if (value === undefined || value === null || value === '') {
        errors.push({ field: key, message: `'${key}' is required for ${dto.type}` });
      }
    }

    const shapeError = this.shapeCheck(dto.type, dto.config);
    if (shapeError) errors.push(shapeError);

    if (errors.length > 0) {
      await this.persistValidation(
        dto.destinationId,
        tenantId,
        false,
        errors.map((e) => e.message).join('; '),
      );
      return {
        ok: false,
        layer: 'schema',
        errors,
        warnings,
        dryRun: null,
      };
    }

    if (!dto.dryRun) {
      return {
        ok: true,
        layer: 'schema',
        errors: [],
        warnings,
        dryRun: null,
      };
    }

    // Delegate to workers for a real adapter dry-run
    const workersUrl = process.env['WORKERS_URL'];
    const cronSecret = process.env['CRON_SECRET'];
    if (!workersUrl || !cronSecret) {
      warnings.push('Dry-run skipped: WORKERS_URL or CRON_SECRET not configured');
      return { ok: true, layer: 'schema', errors: [], warnings, dryRun: null };
    }

    const started = Date.now();
    try {
      const res = await fetch(`${workersUrl}/internal/egress/dry-run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cron-Secret': cronSecret,
        },
        body: JSON.stringify({
          type: dto.type,
          config: dto.config,
          tenantId,
        }),
      });

      const body = (await res.json()) as {
        ok?: boolean;
        statusCode?: number;
        latencyMs?: number;
        error?: string;
      };

      const success = res.ok && body.ok === true;
      if (!success) {
        errors.push({
          field: 'config',
          message: body.error ?? `Dry-run returned ${res.status}`,
        });
      }

      await this.persistValidation(
        dto.destinationId,
        tenantId,
        success,
        success ? null : body.error ?? `Dry-run returned ${res.status}`,
      );

      return {
        ok: success,
        layer: 'both',
        errors,
        warnings,
        dryRun: {
          attempted: true,
          success,
          latencyMs: body.latencyMs ?? Date.now() - started,
          detail: body.error ?? `HTTP ${body.statusCode ?? res.status}`,
        },
      };
    } catch (err) {
      warnings.push(
        `Dry-run failed to reach workers: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { ok: true, layer: 'schema', errors: [], warnings, dryRun: null };
    }
  }

  private async persistValidation(
    destinationId: string | undefined,
    tenantId: string,
    ok: boolean,
    error: string | null,
  ): Promise<void> {
    if (!destinationId) return;
    const owned = await this.prisma.withTenant(tenantId, (tx) =>
      tx.destination.findFirst({
        where: { id: destinationId, tenantId },
        select: { id: true },
      }),
    );
    if (!owned) return;
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.destination.update({
        where: { id: destinationId },
        data: {
          lastValidatedAt: new Date(),
          lastValidationOk: ok,
          lastValidationError: error ? error.slice(0, 500) : null,
        },
      }),
    );
  }

  private requiredKeys(type: string): string[] {
    switch (type) {
      case 'http':
        return ['url'];
      case 'slack':
        return ['webhookUrl'];
      case 'email':
        return ['apiKey', 'to', 'from'];
      case 'sheets':
        return ['spreadsheetId', 'range', 'serviceAccountEmail', 'privateKey'];
      case 'discord':
        return ['webhookUrl'];
      case 'airtable':
        return ['apiKey', 'baseId', 'tableName'];
      case 'notion':
        return ['apiKey', 'dataSourceId', 'titleProperty'];
      case 'postgres':
        return ['connectionString', 'table'];
      case 'mongodb':
        return ['connectionString', 'database', 'collection'];
      default:
        return [];
    }
  }

  private shapeCheck(
    type: string,
    config: Record<string, unknown>,
  ): { field: string; message: string } | null {
    if (type === 'http' || type === 'slack' || type === 'discord') {
      const url = config['url'] ?? config['webhookUrl'];
      if (typeof url === 'string' && !url.startsWith('https://') && !url.startsWith('http://')) {
        return { field: 'url', message: 'URL must start with http:// or https://' };
      }
    }
    if (type === 'postgres' || type === 'mongodb') {
      const cs = config['connectionString'];
      if (typeof cs === 'string') {
        if (type === 'postgres' && !/^postgres(ql)?:\/\//.test(cs)) {
          return { field: 'connectionString', message: 'Must start with postgresql://' };
        }
        if (type === 'mongodb' && !/^mongodb(\+srv)?:\/\//.test(cs)) {
          return { field: 'connectionString', message: 'Must start with mongodb:// or mongodb+srv://' };
        }
      }
    }
    if (type === 'airtable') {
      const baseId = config['baseId'];
      if (typeof baseId === 'string' && !/^app[a-zA-Z0-9]{14,}$/.test(baseId)) {
        return { field: 'baseId', message: 'Airtable base ID must start with "app" and be 17+ chars' };
      }
    }
    return null;
  }

  private toClient(row: DestinationRow) {
    return {
      ...row,
      config: redactConfig((row.config ?? {}) as Record<string, unknown>),
    };
  }

  private async assertWorkflow(tenantId: string, workflowId: string) {
    const wf = await this.prisma.withTenant(tenantId, (tx) =>
      tx.workflow.findFirst({
        where: { id: workflowId, tenantId },
        select: { id: true },
      }),
    );
    if (!wf) throw new NotFoundException('Workflow not found');
  }
}