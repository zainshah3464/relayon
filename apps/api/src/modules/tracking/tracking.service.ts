import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashVisitor, pruneReferrer } from '../../lib/visitor-hash';
import { parseUA } from '../../lib/ua-parser';
import type { PageViewEventDto } from './dto/track.dto';

/**
 * Fire-and-forget tracking. Never throws — tracking failures must not
 * break the UI. Batched writes via createMany for throughput.
 */
@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(opts: {
    events: PageViewEventDto[];
    ip: string | undefined;
    userAgent: string | undefined;
    tenantId: string | null;
  }): Promise<void> {
    try {
      const ua = parseUA(opts.userAgent);
      if (ua.isBot) return;

      const ipHash = hashVisitor(opts.ip);

      const rows = opts.events
        .filter((e) => this.isValidPath(e.path))
        .map((e) => ({
          tenantId: opts.tenantId,
          path: this.normalizePath(e.path),
          referrer: pruneReferrer(e.referrer),
          ipHash,
          browser: ua.browser,
          os: ua.os,
          device: ua.device,
          country: e.country?.toUpperCase().slice(0, 2) ?? null,
          sessionId: e.sessionId.slice(0, 64),
          eventType: e.eventType,
          eventName: e.eventName?.slice(0, 80) ?? null,
          properties: (e.properties ?? {}) as never,
        }));

      if (rows.length === 0) return;

      await this.prisma.withoutTenant((c) => c.pageEvent.createMany({ data: rows }));
    } catch (err) {
      this.logger.error(
        `tracking.record_failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private isValidPath(path: string): boolean {
    return typeof path === 'string' && path.startsWith('/') && path.length > 0;
  }

  private normalizePath(path: string): string {
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id')
      .slice(0, 500);
  }
}