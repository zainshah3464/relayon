import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDestinationDto,
  UpdateDestinationDto,
} from './dto/destination.dto';

@Injectable()
export class DestinationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, workflowId: string) {
    await this.assertWorkflow(tenantId, workflowId);
    return this.prisma.destination.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    tenantId: string,
    workflowId: string,
    dto: CreateDestinationDto,
  ) {
    await this.assertWorkflow(tenantId, workflowId);
    return this.prisma.destination.create({
      data: {
        workflowId,
        type: dto.type,
        name: dto.name,
        config: dto.config as never,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateDestinationDto,
  ) {
    const dest = await this.prisma.destination.findFirst({
      where: { id, workflow: { tenantId } },
    });
    if (!dest) throw new NotFoundException('Destination not found');

    return this.prisma.destination.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.config !== undefined && { config: dto.config as never }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const dest = await this.prisma.destination.findFirst({
      where: { id, workflow: { tenantId } },
    });
    if (!dest) throw new NotFoundException('Destination not found');
    await this.prisma.destination.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async assertWorkflow(tenantId: string, workflowId: string) {
    const wf = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId },
      select: { id: true },
    });
    if (!wf) throw new NotFoundException('Workflow not found');
  }
}