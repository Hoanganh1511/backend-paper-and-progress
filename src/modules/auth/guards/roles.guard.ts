import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

// Dùng sau JwtAuthGuard: @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { role?: Role } }>();
    if (!user?.role || !required.includes(user.role)) {
      throw new ForbiddenException('Không đủ quyền truy cập');
    }
    return true;
  }
}
