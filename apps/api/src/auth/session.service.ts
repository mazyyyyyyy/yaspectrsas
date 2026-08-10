import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AppEnv } from '../config/env.js';
import { ENV } from '../config/env.token.js';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';

/** Пользователь, приклеенный к запросу после успешной аутентификации. */
export interface AuthenticatedUser {
  id: string;
  companyId: string;
  email: string;
  fullName: string;
  role: Role;
}

export interface CreatedSession {
  token: string;
  csrfToken: string;
  expiresAt: Date;
}

export const SESSION_COOKIE = 'ya_session';
export const CSRF_COOKIE = 'ya_csrf';
export const CSRF_HEADER = 'x-csrf-token';

/** Раз в столько минут продлеваем сессию — чтобы не писать в БД на каждый запрос. */
const SLIDING_REFRESH_MINUTES = 15;

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: AppEnv,
  ) {}

  /**
   * Токен сессии — 32 случайных байта, а не JWT.
   *
   * JWT здесь был бы хуже: его нельзя отозвать до истечения срока, а
   * «уволенный сотрудник ходит в систему ещё сутки» — это не теория.
   * Непрозрачный токен отзывается одной строкой в БД.
   */
  async create(userId: string, ip?: string, userAgent?: string): Promise<CreatedSession> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + this.env.SESSION_TTL_MINUTES * 60_000);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ip: ip?.slice(0, 45),
        userAgent: userAgent?.slice(0, 500),
      },
    });

    return { token, csrfToken: this.deriveCsrfToken(tokenHash), expiresAt };
  }

  /**
   * Проверка сессии. Возвращает null на любой сбой — вызывающему не нужно
   * знать, протух токен, отозван он или пользователь заблокирован.
   */
  async validate(token: string): Promise<AuthenticatedUser | null> {
    if (!token || token.length > 200) return null;

    const tokenHash = hashToken(token);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            companyId: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true,
            company: { select: { isActive: true } },
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
    // Заблокированный пользователь или отключённая компания теряют доступ
    // немедленно, не дожидаясь истечения сессии.
    if (!session.user.isActive || !session.user.company.isActive) return null;

    await this.touch(session.id, session.lastSeenAt);

    return {
      id: session.user.id,
      companyId: session.user.companyId,
      email: session.user.email,
      fullName: session.user.fullName,
      role: session.user.role,
    };
  }

  /** Скользящее продление: активная работа не должна прерываться разлогином. */
  private async touch(sessionId: string, lastSeenAt: Date): Promise<void> {
    const staleFor = Date.now() - lastSeenAt.getTime();
    if (staleFor < SLIDING_REFRESH_MINUTES * 60_000) return;

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + this.env.SESSION_TTL_MINUTES * 60_000),
      },
    });
  }

  async revoke(token: string): Promise<void> {
    if (!token) return;
    await this.prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Отзыв всех сессий — при смене пароля и при блокировке сотрудника. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Уборка протухших записей: вызывается по расписанию. */
  async purgeExpired(): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }

  // ─────────────────────────────────────────────────────────────
  // CSRF
  // ─────────────────────────────────────────────────────────────

  /**
   * CSRF-токен выводится из сессии через HMAC, а не хранится отдельно.
   *
   * Схема — double submit: значение кладётся в обычную (читаемую скриптом)
   * cookie, клиент дублирует его в заголовке X-CSRF-Token, сервер сверяет.
   * Чужой сайт не может прочитать cookie и потому не может подставить
   * заголовок. Привязка к сессии через HMAC добивает вариант, где злоумышленник
   * дотянулся до установки cookie на поддомене: подделать значение без
   * SESSION_SECRET всё равно нельзя.
   */
  deriveCsrfToken(tokenHash: string): string {
    return createHmac('sha256', this.env.SESSION_SECRET).update(tokenHash).digest('base64url');
  }

  csrfTokenForSession(sessionToken: string): string {
    return this.deriveCsrfToken(hashToken(sessionToken));
  }

  verifyCsrf(sessionToken: string, presented: string | undefined): boolean {
    if (!presented) return false;

    const expected = Buffer.from(this.csrfTokenForSession(sessionToken));
    const actual = Buffer.from(presented);

    // Сравнение постоянного времени: побайтовое сравнение с ранним выходом
    // позволяет подобрать токен по времени ответа.
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
