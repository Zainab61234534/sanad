import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Role } from "../../generated/prisma/enums.js";
import { Reflector } from "@nestjs/core";
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user;
    return !!user && roles.includes(user.role);
  }
}