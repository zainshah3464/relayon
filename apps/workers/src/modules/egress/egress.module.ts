import { Module } from '@nestjs/common';
import { EgressController } from './egress.controller';
import { EgressService } from './egress.service';
import { CircuitBreakerService } from './circuit-breaker.service';

@Module({
  controllers: [EgressController],
  providers: [EgressService, CircuitBreakerService],
  exports: [EgressService],
})
export class EgressModule {}