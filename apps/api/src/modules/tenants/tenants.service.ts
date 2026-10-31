import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateQuotaDto } from './dto/update-quota.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(tenantId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new NotFoundException('Tenant not found');
      return tenant;
    });
  }

  async updateMine(tenantId: string, dto: UpdateTenantDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.tenant.update({
        where: { id: tenantId },
        data: { ...(dto.name !== undefined && { name: dto.name }) },
      }),
    );
  }

  async updateQuota(tenantId: string, dto: UpdateQuotaDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.tenant.update({
        where: { id: tenantId },
        data: {
          ...(dto.eventsPerMonth !== undefined && {
            quotaEventsPerMonth: dto.eventsPerMonth,
          }),
          ...(dto.aiTokensPerMonth !== undefined && {
            quotaAiTokensPerMonth: dto.aiTokensPerMonth,
          }),
          ...(dto.quotaMode !== undefined && { quotaMode: dto.quotaMode }),
        },
        select: {
          id: true,
          quotaEventsPerMonth: true,
          quotaAiTokensPerMonth: true,
          quotaMode: true,
        },
      }),
    );
  }

  async listUsers(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }
}