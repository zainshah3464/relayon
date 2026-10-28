import { Module } from '@nestjs/common';
import { EgressModule } from '../egress/egress.module';
import { ProcessingController } from './processing.controller';
import { ProcessingService } from './processing.service';
import { GroqService } from './groq.service';
import { TransformService } from './transform.service';
import { RoutingService } from './routing.service';

@Module({
  imports: [EgressModule],
  controllers: [ProcessingController],
  providers: [ProcessingService, GroqService, TransformService, RoutingService],
  exports: [ProcessingService],
})
export class ProcessingModule {}