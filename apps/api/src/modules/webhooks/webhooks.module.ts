import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { OutboxPollerService } from './outbox-poller.service';
import { OutboxPollerController } from './outbox-poller.controller';
import { WebhookEndpointsController } from './webhook-endpoints.controller';
import { WebhookEndpointsService } from './webhook-endpoints.service';

@Module({
  controllers: [OutboxPollerController, WebhookEndpointsController],
  providers: [OutboxService, OutboxPollerService, WebhookEndpointsService],
  exports: [OutboxService],
})
export class WebhooksModule {}