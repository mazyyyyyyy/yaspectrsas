import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

/**
 * Валидация входа по Zod-схеме из @yaspectr/core.
 *
 * Ничего не берём из запроса напрямую: контроллер получает уже разобранное
 * значение нужного типа. Схемы объявлены .strict(), поэтому лишние поля не
 * игнорируются, а отвергаются — иначе в тело запроса можно было бы дописать
 * companyId, ownerId или status и попробовать протащить их в БД.
 *
 * Используется safeParse, а НЕ parse + `catch (e) { if (e instanceof ZodError) }`.
 * Причина не стилистическая: zod может оказаться в процессе в двух экземплярах
 * (ESM-копия, загруженная ядром, и CJS-копия, загруженная этим приложением).
 * Тогда instanceof возвращает false для настоящей ZodError, ошибка валидации
 * проваливается в общий обработчик и клиент получает 500 вместо 400 с разбором
 * по полям. safeParse не зависит от тождества классов между реалмами.
 */
@Injectable()
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);

    if (result.success) return result.data;

    throw new BadRequestException({
      message: 'Проверьте заполнение полей',
      // Плоский вид {поле: сообщение} — фронту так проще подсветить поля.
      // Для лишних ключей path пустой, поэтому кладём их под '_'.
      errors: Object.fromEntries(
        result.error.issues.map((issue) => [issue.path.join('.') || '_', issue.message]),
      ),
    });
  }
}

/** Короткая запись: @Body(zodBody(estimateInputSchema)) */
export const zodBody = <T extends ZodTypeAny>(schema: T) => new ZodValidationPipe(schema);
