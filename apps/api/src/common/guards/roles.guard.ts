import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { can, type Permission } from '@yaspectr/core';
import type { AuthenticatedUser } from '../../auth/session.service.js';
import { REQUIRED_PERMISSIONS, REQUIRED_ROLES } from '../decorators.js';

/**
 * Проверка прав. Работает поверх таблицы PERMISSIONS из @yaspectr/core —
 * той же самой, по которой фронт решает, что показывать. Один источник
 * правды: интерфейс не может предложить действие, которое сервер запретит,
 * и наоборот — спрятанная кнопка не заменяет проверку на сервере.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(REQUIRED_ROLES, targets);
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRED_PERMISSIONS,
      targets,
    );

    if (!requiredRoles?.length && !requiredPermissions?.length) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user) throw new ForbiddenException('Недостаточно прав');

    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Недостаточно прав');
    }

    if (requiredPermissions?.length) {
      const granted = requiredPermissions.every((permission) => can(user.role, permission));
      if (!granted) throw new ForbiddenException('Недостаточно прав');
    }

    return true;
  }
}
