import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.workflow.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { destinations: true } },
      },
    });
  }

  async get(tenantId: string, id: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: { destinations: true },
    });
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }
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
}