import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Role } from '@prisma/client';
import type { CreateUserInput } from '@yaspectr/core';
import { PasswordService } from '../auth/password.service.js';
import { SessionService } from '../auth/session.service.js';
import { PrismaService } from '../common/prisma.service.js';

/** Поля, которые безопасно отдавать наружу: без хеша пароля и счётчиков блокировки. */
const PUBLIC_FIELDS = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * Таблица users намеренно выведена из-под RLS (см. prisma/rls.sql:
   * вход невозможен, если пользователя нельзя найти до определения тенанта).
   * Значит, фильтр по companyId здесь — единственная защита, и он обязателен
   * в КАЖДОМ запросе этого сервиса.
   */
  async list(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
      select: PUBLIC_FIELDS,
    });
  }

  async create(companyId: string, input: CreateUserInput) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    // Сообщение не говорит «email занят в другой компании» — это раскрыло бы
    // чужой состав сотрудников.
    if (existing) throw new ConflictException('Пользователь с таким email уже существует');

    return this.prisma.user.create({
      data: {
        companyId,
        email: input.email,
        passwordHash: await this.passwords.hash(input.password),
        fullName: input.fullName,
        phone: input.phone ?? null,
        role: input.role,
      },
      select: PUBLIC_FIELDS,
    });
  }

  async update(
    companyId: string,
    actorId: string,
    id: string,
    patch: { fullName?: string; email?: string; phone?: string | null; role?: Role; isActive?: boolean },
  ) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    // Администратор не может разжаловать или отключить сам себя: иначе
    // компания рискует остаться вообще без администратора.
    if (id === actorId && (patch.role !== undefined || patch.isActive === false)) {
      throw new ForbiddenException('Нельзя изменить собственную роль или отключить свою учётную запись');
    }

    if (user.role === 'ADMIN' && (patch.role !== undefined || patch.isActive === false)) {
      await this.assertNotLastAdmin(companyId, id);
    }

    // Смена email — это смена логина. Проверяем, что он свободен (email
    // уникален глобально), и не раскрываем, в какой компании он занят.
    const emailChanged = patch.email !== undefined && patch.email !== user.email;
    if (emailChanged) {
      const taken = await this.prisma.user.findUnique({
        where: { email: patch.email! },
        select: { id: true },
      });
      if (taken) throw new ConflictException('Пользователь с таким email уже существует');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: patch,
      select: PUBLIC_FIELDS,
    });

    // Отключённый, пониженный в правах или сменивший логин сотрудник теряет
    // доступ немедленно, а не когда истечёт его сессия.
    if (patch.isActive === false || patch.role !== undefined || emailChanged) {
      await this.sessions.revokeAllForUser(id);
    }

    return updated;
  }

  /** Сброс пароля администратором — возвращает временный пароль один раз. */
  async resetPassword(companyId: string, id: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await this.passwords.hash(newPassword),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    await this.sessions.revokeAllForUser(id);
  }

  private async assertNotLastAdmin(companyId: string, excludeId: string): Promise<void> {
    const others = await this.prisma.user.count({
      where: { companyId, role: 'ADMIN', isActive: true, id: { not: excludeId } },
    });
    if (others === 0) {
      throw new ConflictException('Это последний администратор компании — сначала назначьте другого');
    }
  }
}
