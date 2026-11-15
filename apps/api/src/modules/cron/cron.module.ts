import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard';

@Module({
  controllers: [CronController],
  providers: [CronSecretGuard],
})
export class CronModule {}