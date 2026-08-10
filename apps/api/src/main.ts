import 'reflect-metadata';

import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

async function bootstrap(): Promise<void> {
  // Конфигурацию читаем до создания приложения: если она плохая, лучше
  // не поднимать сервер вообще.
  const env = loadEnv();
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Доверяем заголовкам прокси только за обратным прокси — иначе клиент
      // сам себе нарисует X-Forwarded-For и обойдёт лимит запросов.
      trustProxy: env.NODE_ENV === 'production',
      bodyLimit: 1_048_576, // 1 МиБ: смета — это текст, а не файлы
    }),
    { bufferLogs: true },
  );

  await app.register(fastifyCookie, { secret: env.SESSION_SECRET });

  await app.register(fastifyHelmet, {
    // API не отдаёт HTML, поэтому политика максимально глухая:
    // любая попытка что-то отрендерить из ответа API — уже аномалия.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: env.COOKIE_SECURE
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
      : false,
  });

  await app.register(fastifyRateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // Ключ — сессия, если она есть, иначе IP. Иначе весь офис за одним NAT
    // делит лимит на всех.
    keyGenerator: (request) => request.cookies?.ya_session ?? request.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      message: 'Слишком много запросов, подождите немного',
    }),
  });

  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true, // без этого cookie-сессия не доедет
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    maxAge: 86_400,
  });

  app.setGlobalPrefix('api');
  // Останавливаемся по SIGTERM аккуратно: docker stop не должен рвать
  // запись сметы посередине.
  app.enableShutdownHooks();

  await app.listen(env.API_PORT, '0.0.0.0');
  logger.log(`API слушает :${env.API_PORT} (${env.NODE_ENV})`);
}

bootstrap().catch((error) => {
  // Логгер Nest здесь может быть ещё не готов — пишем напрямую.
  console.error('Не удалось запустить API:', error instanceof Error ? error.message : error);
  process.exit(1);
});
