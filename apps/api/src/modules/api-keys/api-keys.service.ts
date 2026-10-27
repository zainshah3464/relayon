import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

const PEPPER = process.env['API_KEY_PEPPER'] ?? 'relayon-dev-pepper-change-in-prod';
const KEY_TTL_DAYS = 90;
const ROTATION_GRACE_HOURS = 24; // old key keeps working for 24h after rotate

export interface IssuedApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  environment: string;
  expiresAt: string | null;
  createdAt: string;
  /** Raw key — returned ONCE. Never stored, never retrievable again. */
  rawKey: string;
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        environment: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
    return keys;
  }

  async create(tenantId: string, dto: CreateApiKeyDto): Promise<IssuedApiKey> {
    const env = dto.environment ?? 'live';
    const envTag = env === 'live' ? 'live' : 'test';
    const randomPart = randomBytes(24).toString('hex'); // 48 hex chars
    const prefix = `rlk_${envTag}_${randomBytes(4).toString('hex')}`;
    const rawKey = `${prefix}_${randomPart}`;
    const keyHash = this.hashKey(rawKey);

    const expiresAt = dto.neverExpires
      ? null
      : new Date(Date.now() + KEY_TTL_DAYS * 24 * 3600_000);

    const created = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name: dto.name,
        prefix,
        keyHash,
        scopes: dto.scopes,
        environment: env,
        expiresAt,
      },
    });

    return {
      id: created.id,
      name: created.name,
      prefix: created.prefix,
      scopes: created.scopes,
      environment: created.environment,
      expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
      createdAt: created.createdAt.toISOString(),
      rawKey,
    };
  }

  async revoke(tenantId: string, id: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });
    if (!key) throw new NotFoundException('API key not found');

    await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return { revoked: true, id };
  }

  /**
   * Rotates an API key: issues a new raw key (same scopes, env, expiry),
   * and schedules the old key for revocation after ROTATION_GRACE_HOURS.
   *
   * During grace window BOTH keys work — gives clients time to deploy.
   * The `rotatedFromId` tracks lineage for audit.
   */
  async rotate(
    tenantId: string,
    id: string,
    actorId: string | null,
  ): Promise<{
    oldKeyId: string;
    newKey: IssuedApiKey;
    oldKeyRevokeAt: string;
  }> {
    const old = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });
    if (!old) throw new NotFoundException('API key not found');
    if (old.revokedAt) throw new NotFoundException('API key already revoked');

    const envTag = old.environment === 'live' ? 'live' : 'test';
    const randomPart = randomBytes(24).toString('hex');
    const prefix = `rlk_${envTag}_${randomBytes(4).toString('hex')}`;
    const rawKey = `${prefix}_${randomPart}`;
    const keyHash = this.hashKey(rawKey);

    const graceUntil = new Date(
      Date.now() + ROTATION_GRACE_HOURS * 3600_000,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      // Schedule old key for revocation at graceUntil, but keep
      // `revokedAt` null so verify() continues to accept it.
      await tx.apiKey.update({
        where: { id: old.id },
        data: {
          // `expiresAt` is honoured by verify(), so we cap it at graceUntil
          // if the original expiry was further out.
          expiresAt:
            old.expiresAt && old.expiresAt < graceUntil
              ? old.expiresAt
              : graceUntil,
        },
      });

      return tx.apiKey.create({
        data: {
          tenantId,
          name: `${old.name} (rotated)`,
          prefix,
          keyHash,
          scopes: old.scopes,
          environment: old.environment,
          expiresAt: old.expiresAt,
        },
      });
    });

    await this.prisma.apiKeyRotation.create({
      data: {
        tenantId,
        oldKeyId: old.id,
        newKeyId: created.id,
        rotatedBy: actorId,
        graceUntil,
      },
    });

    return {
      oldKeyId: old.id,
      newKey: {
        id: created.id,
        name: created.name,
        prefix: created.prefix,
        scopes: created.scopes,
        environment: created.environment,
        expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
        createdAt: created.createdAt.toISOString(),
        rawKey,
      },
      oldKeyRevokeAt: graceUntil.toISOString(),
    };
  }

  async rotationHistory(
    tenantId: string,
  ): Promise<
    Array<{
      id: string;
      oldKeyId: string;
      newKeyId: string;
      rotatedBy: string | null;
      graceUntil: string;
      createdAt: string;
    }>
  > {
    const rows = await this.prisma.apiKeyRotation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return rows.map((r) => ({
      id: r.id,
      oldKeyId: r.oldKeyId,
      newKeyId: r.newKeyId,
      rotatedBy: r.rotatedBy,
      graceUntil: r.graceUntil.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Verify raw key — used by ApiKeyGuard.
   * Returns { tenantId, scopes } on success, null on failure.
   * Timing-safe compare for stored hash.
   */
  async verify(rawKey: string): Promise<{
    tenantId: string;
    apiKeyId: string;
    scopes: string[];
  } | null> {
    // Key must match rlk_<env>_<8hex>_<48hex>
    const match = rawKey.match(/^rlk_(live|test)_([a-f0-9]{8})_([a-f0-9]{48})$/);
    if (!match) return null;

    const prefix = `rlk_${match[1]}_${match[2]}`;
    const record = await this.prisma.apiKey.findUnique({
      where: { prefix },
    });
    if (!record) return null;
    if (record.revokedAt) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    const expectedHash = record.keyHash;
    const actualHash = this.hashKey(rawKey);

    // timing-safe compare of hex strings
    const a = Buffer.from(expectedHash, 'hex');
    const b = Buffer.from(actualHash, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    // Update last-used (fire-and-forget)
    this.prisma.apiKey
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return {
      tenantId: record.tenantId,
      apiKeyId: record.id,
      scopes: record.scopes,
    };
  }

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(`${PEPPER}:${rawKey}`).digest('hex');
  }
}