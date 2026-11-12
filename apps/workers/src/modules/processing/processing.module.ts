import { Module } from '@nestjs/common';
import { EgressModule } from '../egress/egress.module';
import { ProcessingController } from './processing.controller';
import { ProcessingService } from './processing.service';
import { GroqService } from './groq.service';
import { TransformService } from './transform.service';
import { RoutingService } from './routing.service';
import { AiRateLimiterService } from './ai-rate-limiter.service';

@Module({
  imports: [EgressModule],
  controllers: [ProcessingController],
  providers: [
    ProcessingService,
    GroqService,
    TransformService,
    RoutingService,
    AiRateLimiterService, 
  ],
  exports: [ProcessingService],
})
export class ProcessingModule {}