import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateWebhookSecret } from './standard-webhooks';
import { encryptConfig } from '../../lib/crypto-box';

const MASKED = '••••••••';

export interface CreateEndpointInput {
  url: string;
  description?: string;
  eventTypes?: string[];
}

@Injectable()
export class WebhookEndpointsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.webhookEndpoint.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
    );

    return rows.map((r) => ({
      id: r.id,
      url: r.url,
      description: r.description,
      eventTypes: r.eventTypes,
      isActive: r.isActive,
      consecutiveFailures: r.consecutiveFailures,
      lastSuccessAt: r.lastSuccessAt,
      lastFailureAt: r.lastFailureAt,
      createdAt: r.createdAt,
      secret: MASKED,
    }));
  }

  async create(tenantId: string, input: CreateEndpointInput) {
    const url = this.validateUrl(input.url);
    const eventTypes = this.validateEventTypes(input.eventTypes ?? []);

    const plaintextSecret = generateWebhookSecret();
    const encryptedSecret = encryptConfig(
      { secret: plaintextSecret },
      tenantId,
    )['secret'] as string;

    const created = await this.prisma.withTenant(tenantId, (tx) =>
      tx.webhookEndpoint.create({
        data: {
          tenantId,
          url,
          secret: encryptedSecret,
          description: input.description?.slice(0, 200) ?? null,
          eventTypes,
        },
      }),
    );

    return {
      id: created.id,
      url: created.url,
      eventTypes: created.eventTypes,
      secret: plaintextSecret,
      note: 'Store this secret on your server. It will not be shown again.',
    };
  }

  async remove(tenantId: string, id: string): Promise<{ deleted: true }> {
    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.webhookEndpoint.findFirst({ where: { id, tenantId } }),
    );
    if (!existing) throw new NotFoundException('Endpoint not found');

    await this.prisma.withTenant(tenantId, (tx) =>
      tx.webhookEndpoint.delete({ where: { id } }),
    );
    return { deleted: true };
  }

  async toggle(tenantId: string, id: string): Promise<{ isActive: boolean }> {
    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.webhookEndpoint.findFirst({ where: { id, tenantId } }),
    );
    if (!existing) throw new NotFoundException('Endpoint not found');

    const updated = await this.prisma.withTenant(tenantId, (tx) =>
      tx.webhookEndpoint.update({
        where: { id },
        data: { isActive: !existing.isActive },
      }),
    );
    return { isActive: updated.isActive };
  }

  private validateUrl(raw: string): string {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new BadRequestException('Invalid URL');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new BadRequestException('URL must be http:// or https://');
    }
    if (process.env['NODE_ENV'] === 'production') {
      const host = parsed.hostname;
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
        host.endsWith('.internal')
      ) {
        throw new BadRequestException('URL points to a private address');
      }
    }
    return parsed.toString().slice(0, 500);
  }

  private validateEventTypes(types: string[]): string[] {
    if (types.length > 20) throw new BadRequestException('Max 20 event types');
    const VALID = new Set([
      'workflow.created',
      'workflow.updated',
      'workflow.deleted',
      'event.received',
      'delivery.succeeded',
      'delivery.failed',
      'dlq.entry_created',
      'quota.warning',
      'quota.exceeded',
    ]);
    for (const t of types) {
      if (!VALID.has(t)) throw new BadRequestException(`Unknown event type: ${t}`);
    }
    return [...new Set(types)];
  }
}