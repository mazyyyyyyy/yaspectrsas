import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type EstimateStatus } from '@prisma/client';
import {
  computeEstimate,
  createPosition as buildPosition,
  groupPositions,
  repricePosition,
  resyncPosition,
  type AddPositionInput,
  type EstimateInput,
  type EstimateLineInput,
  type EstimateTotals,
  type KitTemplate,
  type PaginationInput,
} from '@yaspectr/core';
import { randomUUID } from 'node:crypto';
import { DocumentNumberService } from '../common/document-number.service.js';
import { PrismaService } from '../common/prisma.service.js';

/** Полная выборка сметы — позиции и строки в порядке отображения. */
const FULL_INCLUDE = {
  positions: {
    orderBy: { sortOrder: 'asc' },
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
  },
} satisfies Prisma.EstimateInclude;

type EstimateRecord = Prisma.EstimateGetPayload<{ include: typeof FULL_INCLUDE }>;

/**
 * Статусы, в которых смету ещё можно править.
 *
 * После отправки клиенту смета — это обязательство. Молчаливое изменение
 * отправленного документа означает, что клиент видел одну цену, а в системе
 * лежит другая. Чтобы править, нужно вернуть в черновик явным действием.
 */
const EDITABLE_STATUSES: EstimateStatus[] = ['DRAFT', 'REJECTED'];

@Injectable()
export class EstimatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: DocumentNumberService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Чтение
  // ─────────────────────────────────────────────────────────────

  async list(companyId: string, query: PaginationInput) {
    const where: Prisma.EstimateWhereInput = {
      companyId,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { number: { contains: query.search, mode: 'insensitive' } },
              { clientName: { contains: query.search, mode: 'insensitive' } },
              { siteAddress: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.runAsTenant(companyId, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.estimate.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: (query.page - 1) * query.perPage,
          take: query.perPage,
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
            mode: true,
            clientName: true,
            siteAddress: true,
            grandTotal: true,
            updatedAt: true,
          },
        }),
        tx.estimate.count({ where }),
      ]);

      return {
        // Итоги в БД — BigInt: JSON.stringify его не умеет, а смета
        // на 100 млн ₽ в Int32 не влезает. Разворачиваем на границе API.
        items: rows.map((row) => ({ ...row, grandTotal: Number(row.grandTotal) })),
        total,
        page: query.page,
        perPage: query.perPage,
      };
    });
  }

  async get(companyId: string, id: string) {
    const estimate = await this.prisma.runAsTenant(companyId, (tx) =>
      tx.estimate.findFirst({ where: { id, companyId }, include: FULL_INCLUDE }),
    );

    if (!estimate) throw new NotFoundException('Смета не найдена');
    return this.toView(estimate);
  }

  // ─────────────────────────────────────────────────────────────
  // Создание и правка
  // ─────────────────────────────────────────────────────────────

  async create(companyId: string, ownerId: string, input: EstimateInput) {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      const number = await this.numbers.next(tx, companyId, 'EST');

      const created = await tx.estimate.create({
        data: {
          companyId,
          ownerId,
          number,
          title: input.title,
          mode: input.mode,
          clientName: input.clientName ?? null,
          clientPhone: input.clientPhone ?? null,
          siteAddress: input.siteAddress ?? null,
          note: input.note ?? null,
          discountBp: input.discountBp,
          vatMode: input.vatMode,
          vatRateBp: input.vatRateBp,
          positions: {
            create: input.positions.map((position, index) => ({
              catalogItemId: position.catalogItemId ?? null,
              kitTemplateId: position.kitTemplateId ?? null,
              name: position.name,
              kind: position.kind,
              icon: position.icon ?? null,
              unit: position.unit,
              qty: position.qty,
              unitMaterialPrice: position.unitMaterialPrice,
              unitLaborPrice: position.unitLaborPrice,
              isEnabled: position.isEnabled,
              sortOrder: position.sortOrder || index,
              lines: { create: position.lines.map(toLineData) },
            })),
          },
        },
        include: FULL_INCLUDE,
      });

      return this.toView(await this.persistTotals(tx, created));
    });
  }

  async updateHeader(companyId: string, id: string, patch: Partial<EstimateInput>) {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      const estimate = await this.loadEditable(tx, companyId, id);

      // positions правятся отдельными операциями (addPosition/updatePosition):
      // их нельзя переписать целиком из тела запроса, иначе клиент сможет
      // подменить снимок цен на любой удобный ему.
      const { positions: _ignored, ...header } = patch;

      await tx.estimate.update({
        where: { id: estimate.id },
        data: {
          ...(header.title !== undefined && { title: header.title }),
          ...(header.mode !== undefined && { mode: header.mode }),
          ...(header.clientName !== undefined && { clientName: header.clientName }),
          ...(header.clientPhone !== undefined && { clientPhone: header.clientPhone }),
          ...(header.siteAddress !== undefined && { siteAddress: header.siteAddress }),
          ...(header.note !== undefined && { note: header.note }),
          ...(header.discountBp !== undefined && { discountBp: header.discountBp }),
          ...(header.vatMode !== undefined && { vatMode: header.vatMode }),
          ...(header.vatRateBp !== undefined && { vatRateBp: header.vatRateBp }),
        },
      });

      return this.toView(await this.reload(tx, id));
    });
  }

  /**
   * Добавление позиции из справочника — основной путь экспресс-режима.
   * Комплект разворачивается сразу: «10 камер» превращается в монтаж,
   * юстировку, коробки и кабель без единого лишнего действия.
   */
  async addPosition(companyId: string, id: string, input: AddPositionInput) {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      const estimate = await this.loadEditable(tx, companyId, id);

      const item = await tx.catalogItem.findFirst({
        where: { id: input.catalogItemId, companyId, isActive: true },
      });
      if (!item) throw new NotFoundException('Позиция справочника не найдена');

      const kitRecord = await tx.kitTemplate.findFirst({
        where: input.kitTemplateId
          ? { id: input.kitTemplateId, companyId, isActive: true }
          : { companyId, rootItemId: item.id, isDefault: true, isActive: true },
        include: { lines: { orderBy: { sortOrder: 'asc' }, include: { item: true } } },
      });

      const kit = kitRecord ? toCoreKit(kitRecord) : null;
      const items = new Map(
        (kitRecord?.lines.map((line) => line.item) ?? []).concat(item).map((i) => [i.id, i]),
      );

      const position = buildPosition(
        item,
        kit,
        input.qty,
        { items, newId: randomUUID },
        estimate.positions.length,
      );

      await tx.estimatePosition.create({
        data: {
          estimateId: estimate.id,
          catalogItemId: position.catalogItemId,
          kitTemplateId: position.kitTemplateId,
          name: position.name,
          kind: position.kind,
          icon: position.icon ?? null,
          unit: position.unit,
          qty: position.qty,
          unitMaterialPrice: position.unitMaterialPrice,
          unitLaborPrice: position.unitLaborPrice,
          sortOrder: position.sortOrder,
          lines: { create: position.lines.map(toLineData) },
        },
      });

      return this.toView(await this.persistTotals(tx, await this.reload(tx, id)));
    });
  }

  /**
   * Смена количества базовых позиций с пересчётом комплекта.
   * Строки, поправленные руками, сохраняются — см. resyncPosition в ядре.
   */
  async updatePositionQty(companyId: string, id: string, positionId: string, qty: number) {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      const estimate = await this.loadEditable(tx, companyId, id);

      const record = estimate.positions.find((p) => p.id === positionId);
      if (!record) throw new NotFoundException('Позиция сметы не найдена');

      const kitRecord = record.kitTemplateId
        ? await tx.kitTemplate.findFirst({
            where: { id: record.kitTemplateId, companyId },
            include: { lines: { orderBy: { sortOrder: 'asc' }, include: { item: true } } },
          })
        : null;

      const kit = kitRecord ? toCoreKit(kitRecord) : null;
      const items = new Map((kitRecord?.lines ?? []).map((line) => [line.item.id, line.item]));

      const { position: next, changes } = resyncPosition(
        { ...record, lines: record.lines },
        kit,
        qty,
        { items, newId: randomUUID },
      );

      await tx.estimatePosition.update({
        where: { id: positionId },
        data: { qty: next.qty },
      });

      const knownIds = new Set(record.lines.map((line) => line.id));
      for (const line of next.lines) {
        if (knownIds.has(line.id)) {
          await tx.estimateLine.update({ where: { id: line.id }, data: { qty: line.qty } });
        } else {
          await tx.estimateLine.create({ data: { positionId, ...toLineData(line) } });
        }
      }

      return {
        ...this.toView(await this.persistTotals(tx, await this.reload(tx, id))),
        // Отдаём список изменений, чтобы интерфейс мог показать, что именно
        // пересчиталось, а что осталось ручным.
        changes,
      };
    });
  }

  /** Ручная правка строки — то самое «до винтика» из ТЗ. */
  async updateLine(
    companyId: string,
    id: string,
    lineId: string,
    patch: Partial<EstimateLineInput>,
  ) {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      const estimate = await this.loadEditable(tx, companyId, id);

      const owns = estimate.positions.some((p) => p.lines.some((l) => l.id === lineId));
      if (!owns) throw new NotFoundException('Строка сметы не найдена');

      await tx.estimateLine.update({
        where: { id: lineId },
        data: {
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.qty !== undefined && { qty: patch.qty }),
          ...(patch.unitMaterialPrice !== undefined && {
            unitMaterialPrice: patch.unitMaterialPrice,
          }),
          ...(patch.unitLaborPrice !== undefined && { unitLaborPrice: patch.unitLaborPrice }),
          ...(patch.isEnabled !== undefined && { isEnabled: patch.isEnabled }),
          ...(patch.note !== undefined && { note: patch.note }),
          // Любая правка руками помечает строку: пересчёт по шаблону
          // больше её не тронет.
          isManual: true,
        },
      });

      return this.toView(await this.persistTotals(tx, await this.reload(tx, id)));
    });
  }

  async removePosition(companyId: string, id: string, positionId: string) {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      const estimate = await this.loadEditable(tx, companyId, id);
      if (!estimate.positions.some((p) => p.id === positionId)) {
        throw new NotFoundException('Позиция сметы не найдена');
      }

      await tx.estimatePosition.delete({ where: { id: positionId } });
      return this.toView(await this.persistTotals(tx, await this.reload(tx, id)));
    });
  }

  /** Обновление снимка цен по актуальному справочнику. Только для черновика. */
  async reprice(companyId: string, id: string) {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      const estimate = await this.loadEditable(tx, companyId, id);

      const referenced = [
        ...new Set(
          estimate.positions.flatMap((p) => [
            p.catalogItemId,
            ...p.lines.map((l) => l.catalogItemId),
          ]),
        ),
      ].filter((v): v is string => Boolean(v));

      const catalogItems = await tx.catalogItem.findMany({
        where: { id: { in: referenced }, companyId },
      });
      const items = new Map(catalogItems.map((item) => [item.id, item]));

      const allChanges = [];
      for (const record of estimate.positions) {
        const { position, changes } = repricePosition(
          { ...record, lines: record.lines },
          { items, newId: randomUUID },
        );
        if (changes.length === 0) continue;

        await tx.estimatePosition.update({
          where: { id: position.id },
          data: {
            unitMaterialPrice: position.unitMaterialPrice,
            unitLaborPrice: position.unitLaborPrice,
          },
        });
        for (const line of position.lines) {
          await tx.estimateLine.update({
            where: { id: line.id },
            data: {
              unitMaterialPrice: line.unitMaterialPrice,
              unitLaborPrice: line.unitLaborPrice,
            },
          });
        }
        allChanges.push(...changes);
      }

      return {
        ...this.toView(await this.persistTotals(tx, await this.reload(tx, id))),
        changes: allChanges,
      };
    });
  }

  async setStatus(companyId: string, id: string, status: EstimateStatus) {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      const estimate = await tx.estimate.findFirst({ where: { id, companyId } });
      if (!estimate) throw new NotFoundException('Смета не найдена');

      return this.toView(
        await tx.estimate.update({
          where: { id },
          data: {
            status,
            ...(status === 'SENT' && !estimate.sentAt ? { sentAt: new Date() } : {}),
          },
          include: FULL_INCLUDE,
        }),
      );
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.prisma.runAsTenant(companyId, async (tx) => {
      const estimate = await tx.estimate.findFirst({ where: { id, companyId } });
      if (!estimate) throw new NotFoundException('Смета не найдена');
      if (estimate.status === 'APPROVED') {
        throw new ConflictException('Согласованную смету нельзя удалить — переведите в архив');
      }
      await tx.estimate.delete({ where: { id } });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Служебное
  // ─────────────────────────────────────────────────────────────

  private async loadEditable(
    tx: Prisma.TransactionClient,
    companyId: string,
    id: string,
  ): Promise<EstimateRecord> {
    const estimate = await tx.estimate.findFirst({
      where: { id, companyId },
      include: FULL_INCLUDE,
    });
    if (!estimate) throw new NotFoundException('Смета не найдена');

    if (!EDITABLE_STATUSES.includes(estimate.status)) {
      throw new ConflictException(
        'Смета уже отправлена клиенту. Чтобы изменить, верните её в черновик.',
      );
    }
    return estimate;
  }

  private async reload(tx: Prisma.TransactionClient, id: string): Promise<EstimateRecord> {
    return tx.estimate.findUniqueOrThrow({ where: { id }, include: FULL_INCLUDE });
  }

  /**
   * Денормализованные итоги пересчитываются движком из ядра — тем же самым,
   * что считает экспресс-режим на телефоне и что попадёт в PDF. Руками их
   * записать нельзя ни из какого запроса.
   */
  private async persistTotals(
    tx: Prisma.TransactionClient,
    estimate: EstimateRecord,
  ): Promise<EstimateRecord> {
    const totals = computeEstimate(toComputable(estimate));

    await tx.estimate.update({
      where: { id: estimate.id },
      data: {
        totalMaterials: BigInt(totals.materials),
        totalLabor: BigInt(totals.labor),
        totalDiscount: BigInt(totals.discount),
        totalVat: BigInt(totals.vat),
        grandTotal: BigInt(totals.grandTotal),
      },
    });

    return this.reload(tx, estimate.id);
  }

  private toView(estimate: EstimateRecord) {
    const totals = computeEstimate(toComputable(estimate));
    const groups = groupPositions(
      estimate.positions.map((p) => ({
        id: p.id,
        catalogItemId: p.catalogItemId,
        name: p.name,
        kind: p.kind,
        icon: p.icon,
        qty: p.qty,
        unitMaterialPrice: p.unitMaterialPrice,
        unitLaborPrice: p.unitLaborPrice,
        isEnabled: p.isEnabled,
        lines: p.lines,
      })),
      totals,
    );

    const { totalMaterials, totalLabor, totalDiscount, totalVat, grandTotal, ...rest } = estimate;

    return {
      ...rest,
      totals: totals satisfies EstimateTotals,
      // Плитки экспресс-режима: «Камеры — 6 шт — 120 600 ₽».
      groups,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Преобразования между записями БД и типами ядра
// ─────────────────────────────────────────────────────────────

function toComputable(estimate: EstimateRecord) {
  return {
    discountBp: estimate.discountBp,
    vatMode: estimate.vatMode,
    vatRateBp: estimate.vatRateBp,
    positions: estimate.positions.map((position) => ({
      id: position.id,
      kind: position.kind,
      qty: position.qty,
      unitMaterialPrice: position.unitMaterialPrice,
      unitLaborPrice: position.unitLaborPrice,
      isEnabled: position.isEnabled,
      lines: position.lines,
    })),
  };
}

type KitRecord = Prisma.KitTemplateGetPayload<{ include: { lines: { include: { item: true } } } }>;

function toCoreKit(record: KitRecord): KitTemplate {
  return {
    id: record.id,
    companyId: record.companyId,
    name: record.name,
    rootItemId: record.rootItemId,
    isActive: record.isActive,
    lines: record.lines.map((line) => ({
      id: line.id,
      itemId: line.itemId,
      qtyMode: line.qtyMode,
      qtyPerRoot: line.qtyPerRoot,
      minPerRoot: line.minPerRoot,
      maxPerRoot: line.maxPerRoot,
      isOptional: line.isOptional,
      isDefaultEnabled: line.isDefaultEnabled,
      sortOrder: line.sortOrder,
    })),
  };
}

/**
 * Строка из ядра или из тела запроса → данные для Prisma.
 *
 * Необязательные поля приходят как `undefined` из Zod и как `null` из ядра.
 * Приводим к `null` здесь, в одном месте: в БД «не задано» — это NULL, а
 * `undefined` в Prisma означает «не трогать поле», что для create — не то же самое.
 */
function toLineData(line: {
  catalogItemId?: string | null;
  kitLineId?: string | null;
  name: string;
  kind: EstimateLineInput['kind'];
  unit: EstimateLineInput['unit'];
  qty: number;
  unitMaterialPrice: number;
  unitLaborPrice: number;
  isEnabled: boolean;
  isManual: boolean;
  note?: string | null;
  sortOrder: number;
}) {
  return {
    catalogItemId: line.catalogItemId ?? null,
    kitLineId: line.kitLineId ?? null,
    name: line.name,
    kind: line.kind,
    unit: line.unit,
    qty: line.qty,
    unitMaterialPrice: line.unitMaterialPrice,
    unitLaborPrice: line.unitLaborPrice,
    isEnabled: line.isEnabled,
    isManual: line.isManual,
    note: line.note ?? null,
    sortOrder: line.sortOrder,
  };
}
