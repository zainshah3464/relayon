import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface TenantStateAt {
  timestamp: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    createdAt: string;
  };
  workflows: Array<{
    id: string;
    name: string;
    sourceType: string;
    isActive: boolean;
    version: number;
    versionCreatedAt: string;
  }>;
  auditTrail: Array<{
    action: string;
    adminId: string;
    targetType: string | null;
    targetId: string | null;
    createdAt: string;
  }>;
  usage: Record<string, number>;
  note: string;
}

@Injectable()
export class TimeTravelService {
  constructor(private readonly prisma: PrismaService) {}

  async stateAt(tenantId: string, timestamp: Date): Promise<TenantStateAt> {
    if (timestamp > new Date()) {
      throw new BadRequestException('Cannot time-travel to the future');
    }

    const tenant = await this.prisma.withoutTenant((c) =>
      c.tenant.findUnique({ where: { id: tenantId } }),
    );
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Latest version per workflow at-or-before timestamp
    // ⚠️ tenant_id is TEXT (not uuid) — no ::uuid cast!
    const workflowRows = await this.prisma.withoutTenant((c) =>
      c.$queryRaw<
        Array<{
          id: string;
          name: string;
          source_type: string;
          is_active: boolean;
          version: number;
          version_created_at: Date;
        }>
      >`
        SELECT DISTINCT ON (wv.workflow_id)
          wv.workflow_id AS id,
          wv.snapshot->>'name' AS name,
          wv.snapshot->>'sourceType' AS source_type,
          COALESCE((wv.snapshot->>'isActive')::boolean, true) AS is_active,
          wv.version,
          wv.created_at AS version_created_at
        FROM workflow_versions wv
        WHERE wv.tenant_id = ${tenantId}
          AND wv.created_at <= ${timestamp}
        ORDER BY wv.workflow_id, wv.version DESC
      `,
    );

    // Filter out workflows that were deleted before timestamp
    const deletedRows = await this.prisma.withoutTenant((c) =>
      c.outboxEvent.findMany({
        where: {
          tenantId,
          eventType: 'workflow.deleted',
          createdAt: { lte: timestamp },
        },
        select: { payload: true },
      }),
    );
    const deletedIds = new Set<string>();
    for (const r of deletedRows) {
      const wfId = (r.payload as { data?: { workflowId?: string } })?.data
        ?.workflowId;
      if (typeof wfId === 'string') deletedIds.add(wfId);
    }
    const liveWorkflows = workflowRows.filter((w) => !deletedIds.has(w.id));

    const auditRows = await this.prisma.withoutTenant((c) =>
      c.adminAuditLog.findMany({
        where: {
          createdAt: { lte: timestamp },
          OR: [
            { impersonatedTenantId: tenantId },
            { targetId: tenantId, targetType: 'tenant' },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          action: true,
          adminId: true,
          targetType: true,
          targetId: true,
          createdAt: true,
        },
      }),
    );

    const period = `${timestamp.getUTCFullYear()}-${String(timestamp.getUTCMonth() + 1).padStart(2, '0')}`;
    const usageRows = await this.prisma.withoutTenant((c) =>
      c.usageCounter.findMany({ where: { tenantId, period } }),
    );

    const usage: Record<string, number> = {};
    for (const r of usageRows) usage[r.metric] = Number(r.count);

    return {
      timestamp: timestamp.toISOString(),
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        createdAt: tenant.createdAt.toISOString(),
      },
      workflows: liveWorkflows.map((w) => ({
        id: w.id,
        name: w.name,
        sourceType: w.source_type,
        isActive: w.is_active,
        version: w.version,
        versionCreatedAt: w.version_created_at.toISOString(),
      })),
      auditTrail: auditRows.map((a) => ({
        action: a.action,
        adminId: a.adminId,
        targetType: a.targetType,
        targetId: a.targetId,
        createdAt: a.createdAt.toISOString(),
      })),
      usage,
      note:
        'Workflows and audit trail are reconstructed from immutable snapshots. ' +
        'Events, deliveries, and presence are TTL-pruned and cannot be reconstructed.',
    };
  }

  async diff(tenantId: string, fromTs: Date, toTs: Date) {
    const [from, to] = await Promise.all([
      this.stateAt(tenantId, fromTs),
      this.stateAt(tenantId, toTs),
    ]);

    const fromIds = new Set(from.workflows.map((w) => w.id));
    const toIds = new Set(to.workflows.map((w) => w.id));

    const created = to.workflows.filter((w) => !fromIds.has(w.id));
    const deleted = from.workflows.filter((w) => !toIds.has(w.id));

    const changed: Array<{ id: string; name: string; changes: string[] }> = [];
    for (const fw of from.workflows) {
      const tw = to.workflows.find((w) => w.id === fw.id);
      if (!tw) continue;
      const changes: string[] = [];
      if (fw.name !== tw.name) changes.push(`name: "${fw.name}" → "${tw.name}"`);
      if (fw.isActive !== tw.isActive) changes.push(`active: ${fw.isActive} → ${tw.isActive}`);
      if (fw.sourceType !== tw.sourceType) changes.push('sourceType changed');
      if (changes.length > 0) changed.push({ id: fw.id, name: fw.name, changes });
    }

    return {
      from: fromTs.toISOString(),
      to: toTs.toISOString(),
      created,
      deleted,
      changed,
      netWorkflowCount: to.workflows.length - from.workflows.length,
    };
  }
}