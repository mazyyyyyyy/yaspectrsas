import { z } from 'zod';

/**
 * Валидация окружения при старте.
 *
 * Принцип — падать громко и сразу. Сервер, поднявшийся с пустым
 * SESSION_SECRET или с CORS_ORIGINS='*', выглядит рабочим ровно до первого
 * инцидента. Лучше не стартовать вовсе, чем стартовать дырявым.
 */

const csvList = z
  .string()
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean));

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().url('DATABASE_URL должен быть корректным URL'),

  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  /**
   * Явный список источников. Звёздочка запрещена схемой: с cookie-сессиями
   * `Access-Control-Allow-Origin: *` всё равно не работает, а если её
   * когда-нибудь «починят» вместе с credentials — получим CSRF со всего интернета.
   */
  CORS_ORIGINS: csvList.refine((list) => list.length > 0 && !list.includes('*'), {
    message: 'CORS_ORIGINS: перечислите домены явно, «*» недопустима',
  }),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET не короче 32 символов'),
  SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(43_200).default(720),

  COOKIE_SECURE: booleanish.default('false'),
  COOKIE_DOMAIN: z.string().optional(),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  CHROMIUM_PATH: z.string().optional(),
});

/**
 * Требования, которые в разработке мешают, а в проде обязательны.
 * Разделяем явно, чтобы «у меня локально работало» не доехало до сервера.
 */
const productionSchema = baseSchema
  .refine((env) => env.NODE_ENV !== 'production' || env.COOKIE_SECURE, {
    message: 'В production COOKIE_SECURE обязан быть true — иначе сессия уедет по HTTP',
    path: ['COOKIE_SECURE'],
  })
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      env.CORS_ORIGINS.every((origin) => origin.startsWith('https://')),
    {
      message: 'В production все CORS_ORIGINS должны быть https://',
      path: ['CORS_ORIGINS'],
    },
  )
  .refine((env) => env.NODE_ENV !== 'production' || env.SESSION_SECRET.length >= 43, {
    message:
      'В production SESSION_SECRET должен быть не короче 43 символов ' +
      '(32 случайных байта в base64url). Сгенерировать: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
    path: ['SESSION_SECRET'],
  })
  .refine(
    (env) => !env.TELEGRAM_BOT_TOKEN || Boolean(env.TELEGRAM_WEBHOOK_SECRET),
    {
      message:
        'Задан TELEGRAM_BOT_TOKEN, но нет TELEGRAM_WEBHOOK_SECRET — ' +
        'вебхук без секрета может дёрнуть кто угодно',
      path: ['TELEGRAM_WEBHOOK_SECRET'],
    },
  );

export type AppEnv = z.infer<typeof baseSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = productionSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(корень)'}: ${issue.message}`)
      .join('\n');

    // Ошибку печатаем сами: Nest ещё не поднялся, логгера нет.
    throw new Error(`Некорректная конфигурация окружения:\n${details}\n`);
  }

  return parsed.data;
}
