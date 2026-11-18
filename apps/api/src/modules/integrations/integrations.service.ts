import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptConfig, REDACTED } from '../../lib/crypto-box';
import { validateProviderKey, type Provider } from './provider-validators';
import { ProviderKeyResolver } from './provider-resolver';
import { UpsertIntegrationDto } from './dto/integration.dto';

const TEST_RATE_LIMIT_MS = 60_000;
const TEST_RATE_MAX = 5;
const rateLimitMap = new Map<string, number[]>();

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: ProviderKeyResolver,
  ) {}

  async list(tenantId: string) {
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantIntegration.findMany({
        where: { tenantId },
        orderBy: { provider: 'asc' },
      }),
    );
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      apiKey: REDACTED,
      model: r.model,
      isActive: r.isActive,
      lastValidatedAt: r.lastValidatedAt,
      lastValidationOk: r.lastValidationOk,
      validationError: r.validationError,
      lastUsedAt: r.lastUsedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async upsert(tenantId: string, dto: UpsertIntegrationDto, actorId: string) {
    const validation = await validateProviderKey(
      dto.provider as Provider,
      dto.apiKey,
    );
    if (!validation.ok) {
      throw new BadRequestException(
        `Key validation failed: ${validation.error ?? 'unknown error'}`,
      );
    }

    const encrypted = encryptConfig({ key: dto.apiKey }, tenantId)[
      'key'
    ] as string;

    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantIntegration.findUnique({
        where: { tenantId_provider: { tenantId, provider: dto.provider } },
      }),
    );

    const saved = await this.prisma.withTenant(tenantId, (tx) =>
      existing
        ? tx.tenantIntegration.update({
            where: { id: existing.id },
            data: {
              encryptedKey: encrypted,
              model: dto.model ?? null,
              isActive: dto.isActive ?? true,
              lastValidatedAt: new Date(),
              lastValidationOk: true,
              validationError: null,
            },
          })
        : tx.tenantIntegration.create({
            data: {
              tenantId,
              provider: dto.provider,
              encryptedKey: encrypted,
              model: dto.model ?? null,
              isActive: dto.isActive ?? true,
              lastValidatedAt: new Date(),
              lastValidationOk: true,
              validationError: null,
            },
          }),
    );

    this.resolver.invalidate(tenantId, dto.provider as Provider);
    this.logger.log(
      `BYOK ${existing ? 'updated' : 'created'} tenant=${tenantId} provider=${dto.provider} by=${actorId}`,
    );

    return {
      id: saved.id,
      provider: saved.provider,
      apiKey: REDACTED,
      model: saved.model,
      isActive: saved.isActive,
      lastValidatedAt: saved.lastValidatedAt,
      lastValidationOk: saved.lastValidationOk,
      availableModels: validation.models,
    };
  }

  async remove(tenantId: string, provider: string) {
    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantIntegration.findUnique({
        where: { tenantId_provider: { tenantId, provider } },
      }),
    );
    if (!existing) throw new NotFoundException('Integration not found');
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantIntegration.delete({ where: { id: existing.id } }),
    );
    this.resolver.invalidate(tenantId, provider as Provider);
    return { deleted: true };
  }

  async toggle(tenantId: string, provider: string) {
    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantIntegration.findUnique({
        where: { tenantId_provider: { tenantId, provider } },
      }),
    );
    if (!existing) throw new NotFoundException('Integration not found');
    const updated = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantIntegration.update({
        where: { id: existing.id },
        data: { isActive: !existing.isActive },
      }),
    );
    this.resolver.invalidate(tenantId, provider as Provider);
    return { isActive: updated.isActive };
  }

  async test(tenantId: string, provider: string, apiKey: string) {
    const now = Date.now();
    const arr = (rateLimitMap.get(tenantId) ?? []).filter(
      (t) => now - t < TEST_RATE_LIMIT_MS,
    );
    if (arr.length >= TEST_RATE_MAX) {
      throw new HttpException(
        `Too many tests. Max ${TEST_RATE_MAX}/min.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    arr.push(now);
    rateLimitMap.set(tenantId, arr);

    return validateProviderKey(provider as Provider, apiKey);
  }

  async status(tenantId: string) {
    const integrations = await this.list(tenantId);
    const providerMap = new Map(integrations.map((i) => [i.provider, i]));

    const result: Record<
      string,
      {
        source: 'tenant' | 'platform' | 'none';
        hasIntegration: boolean;
        isActive: boolean;
        model: string | null;
        lastValidationOk: boolean | null;
      }
    > = {};

    for (const provider of ['groq', 'openai', 'anthropic', 'resend'] as Provider[]) {
      const integration = providerMap.get(provider);
      const resolved = await this.resolver.resolve(tenantId, provider);
      result[provider] = {
        source: resolved?.source ?? 'none',
        hasIntegration: !!integration,
        isActive: integration?.isActive ?? false,
        model: resolved?.model ?? null,
        lastValidationOk: integration?.lastValidationOk ?? null,
      };
    }
    return result;
  }
}