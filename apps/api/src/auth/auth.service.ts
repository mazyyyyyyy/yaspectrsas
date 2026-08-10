import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { LoginInput, RegisterCompanyInput } from '@yaspectr/core';
import { PrismaService } from '../common/prisma.service.js';
import { PasswordService } from './password.service.js';
import { SessionService, type AuthenticatedUser, type CreatedSession } from './session.service.js';

/** После стольких неудач подряд аккаунт временно блокируется. */
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * Вход.
   *
   * Ответ на «нет такого пользователя», «неверный пароль» и «аккаунт
   * заблокирован» — один и тот же. Разные сообщения превратили бы форму входа
   * в справочник: подставляя email, можно было бы выяснить, кто зарегистрирован.
   * Время ответа тоже выравниваем — см. fakeVerify.
   */
  async login(
    input: LoginInput,
    ip?: string,
    userAgent?: string,
  ): Promise<{ user: AuthenticatedUser; session: CreatedSession }> {
    const invalid = () => new UnauthorizedException('Неверный email или пароль');

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { company: { select: { isActive: true } } },
    });

    if (!user) {
      await this.passwords.fakeVerify(input.password);
      throw invalid();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.passwords.fakeVerify(input.password);
      throw invalid();
    }

    const matches = await this.passwords.verify(user.passwordHash, input.password);

    if (!matches || !user.isActive || !user.company.isActive) {
      // Счётчик растим только на реально неверном пароле: иначе отключённого
      // сотрудника можно «заблокировать» ещё и по счётчику без причины.
      if (!matches) await this.registerFailedAttempt(user.id, user.failedLoginCount);
      throw invalid();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const session = await this.sessions.create(user.id, ip, userAgent);

    return {
      user: {
        id: user.id,
        companyId: user.companyId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      session,
    };
  }

  private async registerFailedAttempt(userId: string, currentCount: number): Promise<void> {
    const next = currentCount + 1;
    const shouldLock = next >= MAX_FAILED_LOGINS;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: shouldLock ? 0 : next,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      },
    });

    if (shouldLock) {
      this.logger.warn(`Аккаунт ${userId} заблокирован на ${LOCKOUT_MINUTES} мин после перебора`);
    }
  }

  /**
   * Регистрация компании — создаёт тенант и первого администратора.
   * Оба объекта в одной транзакции: компания без администратора никому
   * не нужна и войти в неё нельзя.
   */
  async registerCompany(input: RegisterCompanyInput): Promise<{ companyId: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Регистрация с этим email невозможна');
    }

    const passwordHash = await this.passwords.hash(input.password);

    const company = await this.prisma.$transaction(async (tx) => {
      const created = await tx.company.create({ data: { name: input.companyName } });
      await tx.user.create({
        data: {
          companyId: created.id,
          email: input.email,
          passwordHash,
          fullName: input.fullName,
          role: Role.ADMIN,
        },
      });
      return created;
    });

    return { companyId: company.id };
  }

  async changePassword(userId: string, current: string, next: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!(await this.passwords.verify(user.passwordHash, current))) {
      throw new UnauthorizedException('Текущий пароль указан неверно');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(next) },
    });

    // Все прочие сессии закрываем: смена пароля — это в том числе реакция
    // на «кажется, кто-то знает мой старый».
    await this.sessions.revokeAllForUser(userId);
  }
}
