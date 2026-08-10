import { describe, expect, it } from 'vitest';
import { can } from '@yaspectr/core';
import type { AppEnv } from '../config/env.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';

/**
 * Проверки защитных механизмов, которым не нужна БД.
 *
 * Всё, что здесь тестируется, ломается тихо: неверный CSRF-токен примут,
 * права разойдутся с интерфейсом, пароль сравнится не тем способом. Такие
 * дефекты не проявляются в ручном тестировании — только тестами.
 */

const env = { SESSION_SECRET: 'x'.repeat(48), SESSION_TTL_MINUTES: 720 } as AppEnv;

/** SessionService для CSRF не трогает БД — Prisma можно не поднимать. */
const sessions = new SessionService(null as never, env);

describe('CSRF', () => {
  it('принимает токен, выведенный из той же сессии', () => {
    const sessionToken = 'session-token-abc';
    const csrf = sessions.csrfTokenForSession(sessionToken);

    expect(sessions.verifyCsrf(sessionToken, csrf)).toBe(true);
  });

  it('отвергает токен от другой сессии', () => {
    const csrf = sessions.csrfTokenForSession('session-A');

    expect(sessions.verifyCsrf('session-B', csrf)).toBe(false);
  });

  it('отвергает отсутствующий токен', () => {
    expect(sessions.verifyCsrf('session-token-abc', undefined)).toBe(false);
    expect(sessions.verifyCsrf('session-token-abc', '')).toBe(false);
  });

  it('отвергает подделку', () => {
    expect(sessions.verifyCsrf('session-token-abc', 'подобранный-токен')).toBe(false);
  });

  it('отвергает токен, укороченный на один символ', () => {
    // Проверка сравнения постоянного времени: разная длина должна отсекаться
    // до timingSafeEqual, который на разной длине бросает исключение.
    const sessionToken = 'session-token-abc';
    const csrf = sessions.csrfTokenForSession(sessionToken);

    expect(sessions.verifyCsrf(sessionToken, csrf.slice(0, -1))).toBe(false);
    expect(sessions.verifyCsrf(sessionToken, csrf + 'x')).toBe(false);
  });

  it('токен не совпадает с самим токеном сессии', () => {
    // Иначе CSRF-cookie (читаемая скриптом) выдавала бы сессию при XSS.
    const sessionToken = 'session-token-abc';

    expect(sessions.csrfTokenForSession(sessionToken)).not.toBe(sessionToken);
  });

  it('без SESSION_SECRET токен предсказать нельзя', () => {
    const other = new SessionService(null as never, {
      ...env,
      SESSION_SECRET: 'y'.repeat(48),
    } as AppEnv);

    expect(other.csrfTokenForSession('session-token-abc')).not.toBe(
      sessions.csrfTokenForSession('session-token-abc'),
    );
  });
});

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('проверяет верный пароль', async () => {
    const hash = await passwords.hash('правильный-пароль-12');

    expect(await passwords.verify(hash, 'правильный-пароль-12')).toBe(true);
  });

  it('отвергает неверный пароль', async () => {
    const hash = await passwords.hash('правильный-пароль-12');

    expect(await passwords.verify(hash, 'неправильный-пароль')).toBe(false);
  });

  it('использует argon2id, а не что-то быстрое', async () => {
    const hash = await passwords.hash('правильный-пароль-12');

    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('даёт разный хеш одному паролю — соль случайна', async () => {
    const a = await passwords.hash('одинаковый-пароль-12');
    const b = await passwords.hash('одинаковый-пароль-12');

    expect(a).not.toBe(b);
  });

  it('не падает на битом хеше, а возвращает false', async () => {
    expect(await passwords.verify('не-хеш-вообще', 'пароль')).toBe(false);
  });

  it('fakeVerify отрабатывает без исключений', async () => {
    // Нужен для выравнивания времени ответа на несуществующий email.
    await expect(passwords.fakeVerify('любой-пароль')).resolves.toBeUndefined();
  });
});

describe('Права ролей', () => {
  it('монтажник не видит закупочные цены', () => {
    // Ключевое требование: смету объекта монтажник видит, закупку — нет.
    expect(can('INSTALLER', 'costPrice:read')).toBe(false);
    expect(can('MANAGER', 'costPrice:read')).toBe(true);
    expect(can('ADMIN', 'costPrice:read')).toBe(true);
  });

  it('монтажник не правит смету, но заполняет акт', () => {
    expect(can('INSTALLER', 'estimate:write')).toBe(false);
    expect(can('INSTALLER', 'estimate:read')).toBe(true);
    expect(can('INSTALLER', 'act:write')).toBe(true);
  });

  it('менеджер не правит справочник и не заводит пользователей', () => {
    expect(can('MANAGER', 'catalog:write')).toBe(false);
    expect(can('MANAGER', 'user:write')).toBe(false);
    expect(can('MANAGER', 'estimate:write')).toBe(true);
  });

  it('только администратор удаляет сметы', () => {
    expect(can('ADMIN', 'estimate:delete')).toBe(true);
    expect(can('MANAGER', 'estimate:delete' as never)).toBe(false);
    expect(can('INSTALLER', 'estimate:delete' as never)).toBe(false);
  });
});
