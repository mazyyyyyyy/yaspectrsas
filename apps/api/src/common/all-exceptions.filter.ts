import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Ошибки ядра распознаём по имени, а не через instanceof.
 *
 * @yaspectr/core — ESM-пакет, а это приложение собрано в CommonJS. Один и тот
 * же класс может оказаться в процессе в двух экземплярах, и тогда instanceof
 * даёт false для настоящей ошибки: некорректный ввод превращается в 500.
 * Проверка по name от способа загрузки модуля не зависит.
 */
function isCoreError(error: unknown, name: string): error is Error {
  return error instanceof Error && error.name === name;
}

/**
 * Единая обработка ошибок.
 *
 * Наружу уходит только то, что клиенту полезно знать. Стек, SQL и текст
 * ошибок Prisma остаются в логах: сообщение вида «Unique constraint failed on
 * the fields: (`email`)» подсказывает злоумышленнику структуру БД, а сообщение
 * «пользователь с таким email уже есть» ещё и подтверждает регистрацию.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { status, body } = this.describe(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    reply.status(status).send(body);
  }

  private describe(exception: unknown): { status: number; body: Record<string, unknown> } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      return {
        status: exception.getStatus(),
        body:
          typeof response === 'string'
            ? { message: response }
            : (response as Record<string, unknown>),
      };
    }

    // Ошибки расчёта и разворота комплекта — это некорректный ввод,
    // а не сбой сервера.
    if (isCoreError(exception, 'MoneyError') || isCoreError(exception, 'ExpandError')) {
      return { status: HttpStatus.BAD_REQUEST, body: { message: exception.message } };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.describePrisma(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { message: 'Внутренняя ошибка сервера' },
    };
  }

  private describePrisma(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    body: Record<string, unknown>;
  } {
    switch (error.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          body: { message: 'Такая запись уже существует' },
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          body: { message: 'Ссылка на несуществующую запись' },
        };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, body: { message: 'Запись не найдена' } };
      default:
        this.logger.error(`Prisma ${error.code}: ${error.message}`);
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          body: { message: 'Внутренняя ошибка сервера' },
        };
    }
  }
}
