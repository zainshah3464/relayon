import { Module } from '@nestjs/common';
import { ProcessingController } from './processing.controller';
import { ProcessingService } from './processing.service';
import { GroqService } from './groq.service';
import { TransformService } from './transform.service';

@Module({
  controllers: [ProcessingController],
  providers: [ProcessingService, GroqService, TransformService],
  exports: [ProcessingService],
})
export class ProcessingModule {}