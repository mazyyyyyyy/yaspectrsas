import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { KitTemplateInput, KitTemplatePatch } from '@yaspectr/core';
import { PrismaService } from '../common/prisma.service.js';

const WITH_LINES = {
  lines: { orderBy: { sortOrder: 'asc' }, include: { item: true } },
  rootItem: true,
} satisfies Prisma.KitTemplateInclude;

@Injectable()
export class KitsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    return this.prisma.runAsTenant(companyId, (tx) =>
      tx.kitTemplate.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
        include: WITH_LINES,
      }),
    );
  }

  async get(companyId: string, id: string) {
    const kit = await this.prisma.runAsTenant(companyId, (tx) =>
      tx.kitTemplate.findFirst({ where: { id, companyId }, include: WITH_LINES }),
    );
    if (!kit) throw new NotFoundException('Комплект не найден');
    return kit;
  }

  /** Комплект по умолчанию для базовой позиции — то, что подставится само. */
  async findDefaultFor(companyId: string, rootItemId: string) {
    return this.prisma.runAsTenant(companyId, (tx) =>
      tx.kitTemplate.findFirst({
        where: { companyId, rootItemId, isDefault: true, isActive: true },
        include: WITH_LINES,
      }),
    );
  }

  async create(companyId: string, input: KitTemplateInput) {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      await this.assertItemsBelongToCompany(tx, companyId, [
        input.rootItemId,
        ...input.lines.map((l) => l.itemId),
      ]);

      if (input.isDefault) await this.clearDefault(tx, companyId, input.rootItemId, null);

      return tx.kitTemplate.create({
        data: {
          companyId,
          name: input.name,
          rootItemId: input.rootItemId,
          isDefault: input.isDefault,
          isActive: input.isActive,
          lines: { create: input.lines.map(toLineData) },
        },
        include: WITH_LINES,
      });
    });
  }

  /**
   * Правка комплекта заменяет строки целиком.
   *
   * Комплект маленький (единицы строк), а частичное слияние потребовало бы
   * от клиента присылать идентификаторы строк и породило бы вопрос «что делать
   * с теми, которых нет в запросе». Полная замена однозначна.
   *
   * На уже собранные сметы это не влияет: там лежит СНИМОК, а не ссылка.
   * Подтянуть изменения в конкретную смету можно только явным пересчётом.
   */
  async update(companyId: string, id: string, patch: KitTemplatePatch) {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      const existing = await tx.kitTemplate.findFirst({ where: { id, companyId } });
      if (!existing) throw new NotFoundException('Комплект не найден');

      const rootItemId = patch.rootItemId ?? existing.rootItemId;

      if (patch.rootItemId || patch.lines) {
        await this.assertItemsBelongToCompany(tx, companyId, [
          rootItemId,
          ...(patch.lines ?? []).map((l) => l.itemId),
        ]);
      }

      if (patch.isDefault) await this.clearDefault(tx, companyId, rootItemId, id);

      if (patch.lines) {
        await tx.kitLine.deleteMany({ where: { kitTemplateId: id } });
      }

      return tx.kitTemplate.update({
        where: { id },
        data: {
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.rootItemId !== undefined && { rootItemId: patch.rootItemId }),
          ...(patch.isDefault !== undefined && { isDefault: patch.isDefault }),
          ...(patch.isActive !== undefined && { isActive: patch.isActive }),
          ...(patch.lines && { lines: { create: patch.lines.map(toLineData) } }),
        },
        include: WITH_LINES,
      });
    });
  }

  async archive(companyId: string, id: string) {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      const existing = await tx.kitTemplate.findFirst({ where: { id, companyId } });
      if (!existing) throw new NotFoundException('Комплект не найден');

      return tx.kitTemplate.update({
        where: { id },
        data: { isActive: false, isDefault: false },
        include: WITH_LINES,
      });
    });
  }

  /**
   * Позиции справочника обязаны принадлежать той же компании.
   *
   * RLS и так не даст прочитать чужую позицию, но явная проверка превращает
   * «загадочно пустой комплект» в понятную ошибку 400.
   */
  private async assertItemsBelongToCompany(
    tx: Prisma.TransactionClient,
    companyId: string,
    itemIds: string[],
  ): Promise<void> {
    const unique = [...new Set(itemIds)];
    const found = await tx.catalogItem.count({ where: { id: { in: unique }, companyId } });

    if (found !== unique.length) {
      throw new BadRequestException('В комплекте есть позиции, которых нет в справочнике');
    }
  }

  /** На одну базовую позицию — один комплект по умолчанию. */
  private async clearDefault(
    tx: Prisma.TransactionClient,
    companyId: string,
    rootItemId: string,
    exceptId: string | null,
  ): Promise<void> {
    await tx.kitTemplate.updateMany({
      where: {
        companyId,
        rootItemId,
        isDefault: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isDefault: false },
    });
  }
}

function toLineData(line: KitTemplateInput['lines'][number], index: number) {
  return {
    itemId: line.itemId,
    qtyMode: line.qtyMode,
    qtyPerRoot: line.qtyPerRoot,
    minPerRoot: line.minPerRoot ?? null,
    maxPerRoot: line.maxPerRoot ?? null,
    isOptional: line.isOptional,
    isDefaultEnabled: line.isDefaultEnabled,
    sortOrder: line.sortOrder || index,
  };
}
