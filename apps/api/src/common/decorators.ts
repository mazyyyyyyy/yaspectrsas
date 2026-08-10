import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@prisma/client';
import type { Permission } from '@yaspectr/core';
import type { AuthenticatedUser } from '../auth/session.service.js';

/**
 * Маршрут доступен без аутентификации.
 *
 * Защита включена по умолчанию для всего приложения, а исключения помечаются
 * явно. Обратная схема — «вешаем guard там, где вспомнили» — рано или поздно
 * оставляет открытым один эндпоинт, и это всегда неудачный эндпоинт.
 */
export const IS_PUBLIC = 'auth:public';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const REQUIRED_ROLES = 'auth:roles';
export const Roles = (...roles: Role[]) => SetMetadata(REQUIRED_ROLES, roles);

export const REQUIRED_PERMISSIONS = 'auth:permissions';
/** Права из таблицы PERMISSIONS в @yaspectr/core — точнее, чем список ролей. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

/** Текущий пользователь. Гарантированно есть везде, кроме @Public(). */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    return field ? user?.[field] : user;
  },
);

/**
 * Идентификатор компании текущего пользователя.
 *
 * Тенант берётся ТОЛЬКО отсюда — из проверенной сессии. Если бы companyId
 * можно было передать в теле запроса или в заголовке, вся мультитенантность
 * сводилась бы к честному слову клиента.
 */
export const CompanyId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const user = ctx.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
  if (!user) throw new Error('CompanyId запрошен на маршруте без аутентификации');
  return user.companyId;
});
