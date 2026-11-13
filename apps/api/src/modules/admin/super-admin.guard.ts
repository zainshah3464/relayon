import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

/**
 * Super-admin guard — separate from tenant RBAC.
 * role (owner/admin/viewer) is TENANT-scoped.
 * isSuperAdmin is PLATFORM-scoped. This guard checks ONLY the platform flag.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Auth required');

    // Fetch fresh from DB — never trust JWT claims for super-admin
    const dbUser = await this.prisma.withoutTenant((c) =>
      c.user.findUnique({
        where: { id: user.sub },
        select: { isSuperAdmin: true },
      }),
    );

    if (!dbUser?.isSuperAdmin) {
      throw new ForbiddenException('Super admin access required');
    }

    return true;
  }
}