import { Module } from '@nestjs/common';
import { TunnelController } from './tunnel.controller';
import { TunnelService } from './tunnel.service';

@Module({
  controllers: [TunnelController],
  providers: [TunnelService],
  exports: [TunnelService],
})
export class TunnelModule {}