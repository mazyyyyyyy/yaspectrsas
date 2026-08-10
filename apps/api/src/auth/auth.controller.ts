import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import {
  changePasswordSchema,
  loginSchema,
  registerCompanySchema,
  type LoginInput,
  type RegisterCompanyInput,
} from '@yaspectr/core';
import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser, Public } from '../common/decorators.js';
import { zodBody } from '../common/zod-validation.pipe.js';
import type { AppEnv } from '../config/env.js';
import { ENV } from '../config/env.token.js';
import { AuthService } from './auth.service.js';
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  SessionService,
  type AuthenticatedUser,
} from './session.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(ENV) private readonly env: AppEnv,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(zodBody(loginSchema)) input: LoginInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { user, session } = await this.auth.login(
      input,
      request.ip,
      request.headers['user-agent'],
    );

    // Сессия — только для сервера, скрипт её не прочитает даже при XSS.
    reply.setCookie(SESSION_COOKIE, session.token, this.cookieOptions(true, session.expiresAt));
    // CSRF-токен, наоборот, обязан быть читаемым: фронт кладёт его в заголовок.
    reply.setCookie(CSRF_COOKIE, session.csrfToken, this.cookieOptions(false, session.expiresAt));

    return { user, csrfToken: session.csrfToken };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = request.cookies?.[SESSION_COOKIE];
    if (token) await this.sessions.revoke(token);

    reply.clearCookie(SESSION_COOKIE, this.cookieOptions(true));
    reply.clearCookie(CSRF_COOKIE, this.cookieOptions(false));
  }

  /** Кто я. Фронт зовёт при загрузке, чтобы восстановить сеанс и получить CSRF. */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser, @Req() request: FastifyRequest) {
    const token = request.cookies?.[SESSION_COOKIE];
    return {
      user,
      csrfToken: token ? this.sessions.csrfTokenForSession(token) : null,
    };
  }

  /**
   * Регистрация новой компании.
   *
   * Открытый маршрут, потому что мультитенант. Если система разворачивается
   * под одного заказчика — этот метод стоит выключить сразу после создания
   * первой компании, чтобы никто не заводил тенантов на вашем сервере.
   */
  @Public()
  @Post('register')
  async register(@Body(zodBody(registerCompanySchema)) input: RegisterCompanyInput) {
    return this.auth.registerCompany(input);
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body(zodBody(changePasswordSchema)) input: { currentPassword: string; newPassword: string },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.changePassword(userId, input.currentPassword, input.newPassword);
    // Текущая сессия тоже отозвана — просим войти заново.
    reply.clearCookie(SESSION_COOKIE, this.cookieOptions(true));
    reply.clearCookie(CSRF_COOKIE, this.cookieOptions(false));
  }

  private cookieOptions(httpOnly: boolean, expires?: Date): CookieSerializeOptions {
    return {
      httpOnly,
      secure: this.env.COOKIE_SECURE,
      // Lax, а не None: запросы с чужих сайтов cookie не получат вовсе.
      // Strict сломал бы переход по ссылке из письма или чат-бота.
      sameSite: 'lax',
      path: '/',
      domain: this.env.COOKIE_DOMAIN || undefined,
      expires,
    };
  }
}
