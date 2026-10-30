// common/decorators/index.ts
import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role as PrismaRole } from '../../generated/prisma/enums.js';
import { Role as AppRole } from '../enums/role.enum.js';


export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: AppRole[]) => SetMetadata('roles', roles);

export type AuthUser = {
  id: string;
  sessionId: string;
  email: string;
  fullName: string;
  role: PrismaRole;
  isActive: boolean;
};
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);