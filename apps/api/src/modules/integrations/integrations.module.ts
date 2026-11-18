import { Global, Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { ProviderKeyResolver } from './provider-resolver';

@Global()
@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, ProviderKeyResolver],
  exports: [ProviderKeyResolver],
})
export class IntegrationsModule {}