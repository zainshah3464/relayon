import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { hashVisitor } from '../../../lib/visitor-hash';

const IMPERSONATION_TTL_MINUTES = 15;

export interface ImpersonationResult {
  accessToken: string;
  expiresAt: string;
  tenant: { id: string; name: string; slug: string };
  admin: { id: string; email: string; name: string };
  auditLogId: string;
}

@Injectable()
export class ImpersonationService {
  private readonly logger = new Logger(ImpersonationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async start(
    adminId: string,
    tenantId: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<ImpersonationResult> {
    const admin = await this.prisma.withoutTenant((c) =>
      c.user.findUnique({
        where: { id: adminId },
        select: { id: true, email: true, name: true, isSuperAdmin: true },
      }),
    );
    if (!admin?.isSuperAdmin) {
      throw new BadRequestException('Only super-admins can impersonate');
    }

    const tenant = await this.prisma.withoutTenant((c) =>
      c.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true },
      }),
    );
    if (!tenant) throw new NotFoundException('Tenant not found');

    const expiresAt = new Date(
      Date.now() + IMPERSONATION_TTL_MINUTES * 60_000,
    );
    const sessionId = randomUUID();

    const accessToken = await this.jwt.signAsync(
      {
        sub: admin.id,
        email: admin.email,
        role: 'owner',
        tenantId: tenant.id,
        act: 'impersonate',
        actBy: admin.email,
        sid: sessionId,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: `${IMPERSONATION_TTL_MINUTES}m`,
      },
    );

    const auditLog = await this.prisma.withoutTenant((c) =>
      c.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'impersonate_start',
          targetType: 'tenant',
          targetId: tenant.id,
          metadata: {
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
            userAgent: userAgent?.slice(0, 200) ?? null,
          },
          ipHash: hashVisitor(ip),
          impersonatedTenantId: tenant.id,
          sessionToken: createHash('sha256').update(sessionId).digest('hex'),
          expiresAt,
        },
      }),
    );

    this.logger.warn(
      `IMPERSONATION START: admin=${admin.email} → tenant=${tenant.slug} (audit=${auditLog.id})`,
    );

    return {
      accessToken,
      expiresAt: expiresAt.toISOString(),
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      admin: { id: admin.id, email: admin.email, name: admin.name },
      auditLogId: auditLog.id,
    };
  }

  async end(
    adminId: string,
    auditLogId: string,
    ip: string | undefined,
  ): Promise<{ ended: boolean }> {
    const log = await this.prisma.withoutTenant((c) =>
      c.adminAuditLog.findFirst({
        where: {
          id: auditLogId,
          adminId,
          action: 'impersonate_start',
        },
      }),
    );
    if (!log) throw new NotFoundException('Impersonation session not found');

    const durationMs = Date.now() - log.createdAt.getTime();

    await this.prisma.withoutTenant((c) =>
      c.adminAuditLog.create({
        data: {
          adminId,
          action: 'impersonate_end',
          targetType: 'tenant',
          targetId: log.impersonatedTenantId,
          metadata: {
            startAuditLogId: auditLogId,
            durationMs,
          },
          ipHash: hashVisitor(ip),
          impersonatedTenantId: log.impersonatedTenantId,
        },
      }),
    );

    this.logger.warn(
      `IMPERSONATION END: admin=${adminId} after ${Math.round(durationMs / 1000)}s`,
    );

    return { ended: true };
  }

  async listActive(): Promise<
    Array<{
      auditLogId: string;
      adminEmail: string;
      tenantName: string;
      startedAt: string;
      expiresAt: string;
    }>
  > {
    const since = new Date(Date.now() - IMPERSONATION_TTL_MINUTES * 60_000);

    const logs = await this.prisma.withoutTenant((c) =>
      c.adminAuditLog.findMany({
        where: { action: 'impersonate_start', createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
      }),
    );

    const endLogs = await this.prisma.withoutTenant((c) =>
      c.adminAuditLog.findMany({
        where: { action: 'impersonate_end', createdAt: { gte: since } },
        select: { metadata: true },
      }),
    );

    const endedLogIds = new Set<string>();
    for (const e of endLogs) {
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      if (typeof meta['startAuditLogId'] === 'string') {
        endedLogIds.add(meta['startAuditLogId']);
      }
    }

    const active = logs.filter((l) => !endedLogIds.has(l.id));
    if (active.length === 0) return [];

    const adminIds = [...new Set(active.map((l) => l.adminId))];
    const tenantIds = [
      ...new Set(
        active.map((l) => l.impersonatedTenantId).filter(Boolean) as string[],
      ),
    ];

    const [admins, tenants] = await Promise.all([
      this.prisma.withoutTenant((c) =>
        c.user.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, email: true },
        }),
      ),
      this.prisma.withoutTenant((c) =>
        c.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        }),
      ),
    ]);

    const adminMap = new Map(admins.map((a) => [a.id, a.email]));
    const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

    return active.map((l) => ({
      auditLogId: l.id,
      adminEmail: adminMap.get(l.adminId) ?? 'unknown',
      tenantName: l.impersonatedTenantId
        ? tenantMap.get(l.impersonatedTenantId) ?? 'unknown'
        : 'unknown',
      startedAt: l.createdAt.toISOString(),
      expiresAt: l.expiresAt?.toISOString() ?? '',
    }));
  }
}