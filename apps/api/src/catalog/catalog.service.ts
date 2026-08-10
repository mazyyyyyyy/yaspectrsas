import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type CatalogItem, type Role } from '@prisma/client';
import { can, type CatalogItemInput, type PaginationInput } from '@yaspectr/core';
import { PrismaService } from '../common/prisma.service.js';

/** Позиция справочника в том виде, в каком её можно отдать наружу. */
export type CatalogItemView = Omit<CatalogItem, 'costPrice'> & { costPrice?: number | null };

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Закупочная цена вырезается на сервере, а не прячется в интерфейсе.
   * Спрятанная кнопка — не защита: ответ API открывается в консоли браузера
   * за две секунды, а монтажник не должен знать вашу маржу.
   */
  private visible(item: CatalogItem, role: Role): CatalogItemView {
    if (can(role, 'costPrice:read')) return item;
    const { costPrice: _hidden, ...rest } = item;
    return rest;
  }

  async list(
    companyId: string,
    role: Role,
    query: PaginationInput,
  ): Promise<{ items: CatalogItemView[]; total: number; page: number; perPage: number }> {
    const where: Prisma.CatalogItemWhereInput = {
      companyId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.runAsTenant(companyId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.catalogItem.findMany({
          where,
          orderBy: [{ kind: 'asc' }, { name: 'asc' }],
          skip: (query.page - 1) * query.perPage,
          take: query.perPage,
        }),
        tx.catalogItem.count({ where }),
      ]);

      return {
        items: items.map((item) => this.visible(item, role)),
        total,
        page: query.page,
        perPage: query.perPage,
      };
    });
  }

  async get(companyId: string, role: Role, id: string): Promise<CatalogItemView> {
    const item = await this.prisma.runAsTenant(companyId, (tx) =>
      // companyId в where стоит явно, хотя RLS и так отсечёт чужое:
      // два рубежа, и ни один не единственный.
      tx.catalogItem.findFirst({ where: { id, companyId } }),
    );

    if (!item) throw new NotFoundException('Позиция справочника не найдена');
    return this.visible(item, role);
  }

  async create(companyId: string, input: CatalogItemInput): Promise<CatalogItem> {
    return this.prisma.runAsTenant(companyId, (tx) =>
      tx.catalogItem.create({
        data: {
          companyId,
          sku: input.sku ?? null,
          name: input.name,
          kind: input.kind,
          unit: input.unit,
          icon: input.icon ?? null,
          materialPrice: input.materialPrice,
          laborPrice: input.laborPrice,
          costPrice: input.costPrice ?? null,
          categoryId: input.categoryId ?? null,
          isActive: input.isActive,
        },
      }),
    );
  }

  async update(
    companyId: string,
    id: string,
    patch: Partial<CatalogItemInput>,
  ): Promise<CatalogItem> {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      const existing = await tx.catalogItem.findFirst({ where: { id, companyId } });
      if (!existing) throw new NotFoundException('Позиция справочника не найдена');

      return tx.catalogItem.update({ where: { id }, data: patch });
    });
  }

  /**
   * Позиции не удаляются, а переводятся в неактивные.
   *
   * На неё ссылаются строки уже выставленных смет и шаблоны комплектов.
   * Физическое удаление либо оборвало бы эти связи, либо потребовало каскада,
   * который вычистит часть истории — а смета обязана оставаться читаемой
   * ровно в том виде, в каком её видел клиент.
   */
  async archive(companyId: string, id: string): Promise<CatalogItem> {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      const existing = await tx.catalogItem.findFirst({ where: { id, companyId } });
      if (!existing) throw new NotFoundException('Позиция справочника не найдена');

      return tx.catalogItem.update({ where: { id }, data: { isActive: false } });
    });
  }

  async listCategories(companyId: string) {
    return this.prisma.runAsTenant(companyId, (tx) =>
      tx.catalogCategory.findMany({
        where: { companyId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    );
  }

  async createCategory(companyId: string, input: { name: string; sortOrder: number }) {
    return this.prisma.runAsTenant(companyId, (tx) =>
      tx.catalogCategory.create({ data: { companyId, ...input } }),
    );
  }
}
