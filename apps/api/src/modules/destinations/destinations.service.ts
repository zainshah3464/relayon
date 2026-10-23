import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDestinationDto,
  UpdateDestinationDto,
} from './dto/destination.dto';
import { encryptConfig, redactConfig } from '../../lib/crypto-box';

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

@Injectable()
export class DestinationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, workflowId: string) {
    await this.assertWorkflow(tenantId, workflowId);
    const rows = await this.prisma.destination.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toClient(r));
  }

  async create(
    tenantId: string,
    workflowId: string,
    dto: CreateDestinationDto,
  ) {
    await this.assertWorkflow(tenantId, workflowId);

    const created = await this.prisma.destination.create({
      data: {
        workflowId,
        type: dto.type,
        name: dto.name,
        config: encryptConfig(dto.config ?? {}, tenantId) as never,
        enabled: dto.enabled ?? true,
      },
    });

    return this.toClient(created);
  }

  async update(tenantId: string, id: string, dto: UpdateDestinationDto) {
    const dest = await this.prisma.destination.findFirst({
      where: { id, workflow: { tenantId } },
    });
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

      nextConfig = encryptConfig(merged, tenantId);
    }

    const updated = await this.prisma.destination.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(nextConfig !== undefined && { config: nextConfig as never }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      },
    });

    return this.toClient(updated);
  }

  async remove(tenantId: string, id: string) {
    const dest = await this.prisma.destination.findFirst({
      where: { id, workflow: { tenantId } },
    });
    if (!dest) throw new NotFoundException('Destination not found');
    await this.prisma.destination.delete({ where: { id } });
    return { deleted: true, id };
  }

  private toClient(row: DestinationRow) {
    return {
      ...row,
      config: redactConfig((row.config ?? {}) as Record<string, unknown>),
    };
  }

  private async assertWorkflow(tenantId: string, workflowId: string) {
    const wf = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId },
      select: { id: true },
    });
    if (!wf) throw new NotFoundException('Workflow not found');
  }
}