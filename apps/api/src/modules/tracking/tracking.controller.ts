import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { TrackingService } from './tracking.service';
import { TrackBatchDto } from './dto/track.dto';

/**
 * PUBLIC endpoint — no auth required. Called via sendBeacon/fetch keepalive
 * from browser. Must be fast and never fail loudly.
 */
@Controller('track')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async track(@Body() dto: TrackBatchDto, @Req() req: Request): Promise<void> {
    const tenantId = this.extractTenantId(req);

    const country =
      typeof req.headers['x-vercel-ip-country'] === 'string'
        ? (req.headers['x-vercel-ip-country'] as string)
        : undefined;

    if (country) {
      for (const e of dto.events) {
        if (!e.country) e.country = country;
      }
    }

    await this.tracking.record({
      events: dto.events,
      ip: this.clientIp(req),
      userAgent: req.headers['user-agent'],
      tenantId,
    });
  }

  private clientIp(req: Request): string | undefined {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string') return fwd.split(',')[0]!.trim();
    return req.ip;
  }

  private extractTenantId(req: Request): string | null {
    const tid = req.headers['x-tenant-id'];
    if (typeof tid === 'string' && /^[0-9a-f-]{36}$/i.test(tid)) return tid;
    return null;
  }
}