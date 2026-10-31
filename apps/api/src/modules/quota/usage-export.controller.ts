import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { UsageExportService } from './usage-export.service';
import { startCsvResponse, writeCsvRow } from '../../lib/csv-stream';

@Controller('usage')
@UseGuards(JwtAuthGuard)
export class UsageExportController {
  constructor(private readonly usage: UsageExportService) {}

  @Get('export')
  async export(
    @CurrentUser() user: JwtUser,
    @Query('period') period: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const p = this.resolvePeriod(period);
    startCsvResponse(
      res,
      `relayon-usage-${user.tenantId.slice(0, 8)}-${p}.csv`,
    );
    writeCsvRow(res, ['period', 'metric', 'used', 'limit', 'remaining', 'updated_at']);

    for await (const row of this.usage.streamUsage(user.tenantId, p)) {
      writeCsvRow(res, [row.period, row.metric, row.used, row.limit, row.remaining, row.updatedAt]);
    }

    res.end();
  }

  private resolvePeriod(input: string | undefined): string {
    if (input && /^\d{4}-\d{2}$/.test(input)) return input;
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}