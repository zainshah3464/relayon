import { Module } from '@nestjs/common';
import { QuotaController } from './quota.controller';
import { QuotaService } from './quota.service';
import { UsageExportService } from './usage-export.service';
import { UsageExportController } from './usage-export.controller';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [QuotaController, UsageExportController],
  providers: [QuotaService, UsageExportService],
  exports: [QuotaService],
})
export class QuotaModule {}