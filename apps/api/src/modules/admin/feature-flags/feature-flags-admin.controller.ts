import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../super-admin.guard';
import { FeatureFlagService } from '../../../common/feature-flags/feature-flag.service';

class UpdateFlagDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPct?: number;

  @IsOptional()
  tenantOverrides?: Record<string, boolean>;
}

@Controller('admin/feature-flags')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class FeatureFlagsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagService,
  ) {}

  @Get()
  list() {
    return this.prisma.withoutTenant((c) =>
      c.featureFlag.findMany({ orderBy: { key: 'asc' } }),
    );
  }

  @Patch(':key')
  async update(@Param('key') key: string, @Body() dto: UpdateFlagDto) {
    const updated = await this.prisma.withoutTenant((c) =>
      c.featureFlag.update({
        where: { key },
        data: {
          ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
          ...(dto.rolloutPct !== undefined && { rolloutPct: dto.rolloutPct }),
          ...(dto.tenantOverrides !== undefined && {
            tenantOverrides: dto.tenantOverrides as Prisma.InputJsonValue,
          }),
        },
      }),
    );
    // Immediately refresh cache so change takes effect
    await this.flags.refresh();
    return updated;
  }
}