import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import {
  CSRF_HEADER,
  SESSION_COOKIE,
  SessionService,
  type AuthenticatedUser,
} from '../../auth/session.service.js';
import { IS_PUBLIC } from '../decorators.js';

/** Методы, не меняющие состояние, — их CSRF не касается. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = request.cookies?.[SESSION_COOKIE];

    if (!token) {
      throw new UnauthorizedException('Требуется вход в систему');
    }

    const user = await this.sessions.validate(token);
    if (!user) {
      throw new UnauthorizedException('Сессия истекла, войдите заново');
    }

    // CSRF проверяем ПОСЛЕ аутентификации: без действующей сессии подделывать
    // нечего, а до неё мы не знаем, с чем сверять токен.
    if (!SAFE_METHODS.has(request.method)) {
      const presented = request.headers[CSRF_HEADER];
      const value = Array.isArray(presented) ? presented[0] : presented;

      if (!this.sessions.verifyCsrf(token, value)) {
        throw new ForbiddenException('Некорректный CSRF-токен, обновите страницу');
      }
    }

    (request as FastifyRequest & { user: AuthenticatedUser }).user = user;
    return true;
  }
}
