import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

/**
 * Конфигурация — часть периметра безопасности. Эти тесты фиксируют, что
 * сервер откажется стартовать с опасными настройками, а не «заведётся и
 * как-нибудь поработает».
 */

const validDev = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  CORS_ORIGINS: 'http://localhost:5173',
  SESSION_SECRET: 'x'.repeat(43),
};

const validProd = {
  ...validDev,
  NODE_ENV: 'production',
  CORS_ORIGINS: 'https://app.yaspectr.ru',
  COOKIE_SECURE: 'true',
};

describe('loadEnv — базовая валидация', () => {
  it('принимает корректную конфигурацию разработки', () => {
    const env = loadEnv(validDev as NodeJS.ProcessEnv);

    expect(env.API_PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173']);
    expect(env.SESSION_TTL_MINUTES).toBe(720);
  });

  it('разбирает список источников через запятую', () => {
    const env = loadEnv({
      ...validDev,
      CORS_ORIGINS: 'http://localhost:5173, http://localhost:4173',
    } as NodeJS.ProcessEnv);

    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'http://localhost:4173']);
  });

  it('падает без SESSION_SECRET', () => {
    const { SESSION_SECRET, ...withoutSecret } = validDev;
    expect(() => loadEnv(withoutSecret as NodeJS.ProcessEnv)).toThrow(/SESSION_SECRET/);
  });

  it('падает на коротком SESSION_SECRET', () => {
    expect(() =>
      loadEnv({ ...validDev, SESSION_SECRET: 'слишком-коротко' } as NodeJS.ProcessEnv),
    ).toThrow(/SESSION_SECRET/);
  });

  it('падает на некорректном DATABASE_URL', () => {
    expect(() =>
      loadEnv({ ...validDev, DATABASE_URL: 'не-url' } as NodeJS.ProcessEnv),
    ).toThrow(/DATABASE_URL/);
  });

  it('запрещает «*» в CORS_ORIGINS', () => {
    // С cookie-сессиями звёздочка означала бы приём запросов откуда угодно.
    expect(() => loadEnv({ ...validDev, CORS_ORIGINS: '*' } as NodeJS.ProcessEnv)).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it('требует непустой список источников', () => {
    expect(() => loadEnv({ ...validDev, CORS_ORIGINS: '' } as NodeJS.ProcessEnv)).toThrow(
      /CORS_ORIGINS/,
    );
  });
});

describe('loadEnv — ужесточение для production', () => {
  it('принимает корректную боевую конфигурацию', () => {
    const env = loadEnv(validProd as NodeJS.ProcessEnv);

    expect(env.NODE_ENV).toBe('production');
    expect(env.COOKIE_SECURE).toBe(true);
  });

  it('не даёт выкатить прод без COOKIE_SECURE', () => {
    expect(() =>
      loadEnv({ ...validProd, COOKIE_SECURE: 'false' } as NodeJS.ProcessEnv),
    ).toThrow(/COOKIE_SECURE/);
  });

  it('не даёт выкатить прод с http-источником', () => {
    expect(() =>
      loadEnv({ ...validProd, CORS_ORIGINS: 'http://app.yaspectr.ru' } as NodeJS.ProcessEnv),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('требует в проде секрет полной длины', () => {
    expect(() =>
      loadEnv({ ...validProd, SESSION_SECRET: 'x'.repeat(32) } as NodeJS.ProcessEnv),
    ).toThrow(/SESSION_SECRET/);
  });

  it('в разработке 32 символов достаточно', () => {
    // Требования различаются намеренно: разработке не нужен боевой секрет.
    expect(() =>
      loadEnv({ ...validDev, SESSION_SECRET: 'x'.repeat(32) } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it('не даёт включить Telegram без секрета вебхука', () => {
    expect(() =>
      loadEnv({ ...validProd, TELEGRAM_BOT_TOKEN: '123:ABC' } as NodeJS.ProcessEnv),
    ).toThrow(/TELEGRAM_WEBHOOK_SECRET/);
  });

  it('пропускает Telegram, когда заданы обе переменные', () => {
    expect(() =>
      loadEnv({
        ...validProd,
        TELEGRAM_BOT_TOKEN: '123:ABC',
        TELEGRAM_WEBHOOK_SECRET: 'секрет-вебхука',
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });
});
