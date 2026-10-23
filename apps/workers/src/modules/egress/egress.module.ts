import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { EgressController } from './egress.controller';
import { EgressService } from './egress.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { AdapterRegistry } from './adapters/registry';
import { HttpAdapter } from './adapters/http.adapter';
import { SlackAdapter } from './adapters/slack.adapter';
import { EmailAdapter } from './adapters/email.adapter';
import { SheetsAdapter } from './adapters/sheets.adapter';
import { DiscordAdapter } from './adapters/discord.adapter';

@Module({
  imports: [DiscoveryModule],
  controllers: [EgressController],
  providers: [
    EgressService,
    CircuitBreakerService,
    AdapterRegistry,
    HttpAdapter,
    SlackAdapter,
    EmailAdapter,
    SheetsAdapter,
    DiscordAdapter,
  ],
  exports: [EgressService, AdapterRegistry],
})
export class EgressModule {}