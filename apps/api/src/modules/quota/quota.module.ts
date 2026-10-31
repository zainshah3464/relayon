import { Module } from '@nestjs/common';
import { QuotaController } from './quota.controller';
import { QuotaService } from './quota.service';
import { UsageExportService } from './usage-export.service';
import { UsageExportController } from './usage-export.controller';

@Module({
  controllers: [QuotaController, UsageExportController],
  providers: [QuotaService, UsageExportService],
  exports: [QuotaService],
})
export class QuotaModule {}