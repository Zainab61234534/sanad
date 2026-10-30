import { CanActivate, ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { Role } from "../../generated/prisma/browser.js";
import { Reflector } from "@nestjs/core";

// common/decorators/roles.decorator.ts
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

// common/guards/roles.guard.ts
