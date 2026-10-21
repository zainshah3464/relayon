import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  sub: string;
  email: string;
  role: 'owner' | 'admin' | 'viewer';
  tenantId: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtUser | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);