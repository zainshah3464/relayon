import { Module } from '@nestjs/common';
import { DlqController } from './dlq.controller';
import { DlqService } from './dlq.service';

@Module({
  controllers: [DlqController],
  providers: [DlqService],
})
export class DlqModule {}