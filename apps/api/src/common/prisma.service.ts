import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Клиент БД.
 *
 * Логи запросов включены только в разработке и никогда не печатают параметры:
 * в них лежат телефоны и адреса клиентов, а логи обычно уезжают туда, где
 * персональные данные быть не должны.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }]
          : [{ emit: 'event', level: 'error' }],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Подключение к БД установлено');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Транзакция с установленным тенантом.
   *
   * Внутри неё Postgres-политики RLS (prisma/rls.sql) видят app.company_id и
   * сами отсекают чужие строки. Это ВТОРОЙ слой защиты: первый — явный
   * companyId в каждом where. Один слой рано или поздно пробьёт запрос,
   * который кто-то написал в спешке.
   */
  async runAsTenant<T>(
    companyId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      // set_config с параметром, а не интерполяция строки: companyId приходит
      // из сессии, но правило «никакой конкатенации в SQL» исключений не имеет.
      await tx.$executeRaw`SELECT set_config('app.company_id', ${companyId}::text, true)`;
      return fn(tx);
    });
  }
}
