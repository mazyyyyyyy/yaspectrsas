import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, type ActStatus } from '@prisma/client';
import type {
  CreateActFromEstimateInput,
  PaginationInput,
  ToggleActItemInput,
  WorkActInput,
} from '@yaspectr/core';
import { DocumentNumberService } from '../common/document-number.service.js';
import { PrismaService } from '../common/prisma.service.js';

const WITH_ITEMS = {
  items: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.WorkActInclude;

@Injectable()
export class ActsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: DocumentNumberService,
  ) {}

  /**
   * Монтажник видит только свои объекты.
   *
   * Права act:read у него есть, но это не значит «все акты компании»:
   * в акте адрес объекта и имя клиента, и человеку, который туда не едет,
   * эти данные не нужны.
   */
  private scopeFor(userId: string, role: Role): Prisma.WorkActWhereInput {
    return role === Role.INSTALLER ? { installerUserId: userId } : {};
  }

  async list(companyId: string, userId: string, role: Role, query: PaginationInput) {
    const where: Prisma.WorkActWhereInput = {
      companyId,
      ...this.scopeFor(userId, role),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: 'insensitive' } },
              { siteAddress: { contains: query.search, mode: 'insensitive' } },
              { clientName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.runAsTenant(companyId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.workAct.findMany({
          where,
          orderBy: { workDate: 'desc' },
          skip: (query.page - 1) * query.perPage,
          take: query.perPage,
          include: { _count: { select: { items: true } } },
        }),
        tx.workAct.count({ where }),
      ]);

      return { items, total, page: query.page, perPage: query.perPage };
    });
  }

  async get(companyId: string, userId: string, role: Role, id: string) {
    const act = await this.prisma.runAsTenant(companyId, (tx) =>
      tx.workAct.findFirst({
        where: { id, companyId, ...this.scopeFor(userId, role) },
        include: WITH_ITEMS,
      }),
    );

    if (!act) throw new NotFoundException('Акт не найден');
    return act;
  }

  /**
   * Акт из сметы — основной путь.
   *
   * Чек-лист собирается из строк-работ: монтажнику на объекте нужен список
   * того, что он делает руками, а не перечень закупленного железа. Материалы
   * добавляются по флагу, если бригада принимает их по акту.
   *
   * Суммы в акт не переносятся сознательно: акт подтверждает выполнение работ,
   * а не цену. Цену видит менеджер в смете.
   */
  async createFromEstimate(companyId: string, input: CreateActFromEstimateInput) {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      const estimate = await tx.estimate.findFirst({
        where: { id: input.estimateId, companyId },
        include: { positions: { include: { lines: true }, orderBy: { sortOrder: 'asc' } } },
      });
      if (!estimate) throw new NotFoundException('Смета не найдена');

      const kinds = input.includeMaterials
        ? ['LABOR', 'CABLE', 'MATERIAL', 'EQUIPMENT']
        : ['LABOR', 'CABLE'];

      const items: Prisma.WorkActItemCreateWithoutActInput[] = [];
      let order = 0;

      for (const position of estimate.positions) {
        if (!position.isEnabled) continue;

        for (const line of position.lines) {
          if (!line.isEnabled || !kinds.includes(line.kind)) continue;
          // Кабель попадает в чек-лист только если за него платят как за работу:
          // «купить 180 м» — не пункт для монтажника, «проложить 180 м» — пункт.
          if (line.kind === 'CABLE' && line.unitLaborPrice === 0) continue;

          items.push({
            estimateLine: { connect: { id: line.id } },
            name: `${line.name} (${position.name})`,
            unit: line.unit,
            qtyPlanned: line.qty,
            sortOrder: order++,
          });
        }
      }

      const number = await this.numbers.next(tx, companyId, 'ACT');

      return tx.workAct.create({
        data: {
          companyId,
          estimateId: estimate.id,
          number,
          siteAddress: estimate.siteAddress ?? estimate.title,
          clientName: estimate.clientName,
          installerUserId: input.installerUserId ?? null,
          installerName: input.installerName,
          workDate: new Date(input.workDate),
          items: { create: items },
        },
        include: WITH_ITEMS,
      });
    });
  }

  /** Акт с нуля — когда выезд не связан со сметой (доработка, гарантия). */
  async create(companyId: string, input: WorkActInput) {
    return this.prisma.runAsTenant(companyId, async (tx) => {
      const number = await this.numbers.next(tx, companyId, 'ACT');

      return tx.workAct.create({
        data: {
          companyId,
          estimateId: input.estimateId ?? null,
          number,
          siteAddress: input.siteAddress,
          clientName: input.clientName ?? null,
          installerUserId: input.installerUserId ?? null,
          installerName: input.installerName,
          workDate: new Date(input.workDate),
          items: {
            create: input.items.map((item, index) => ({
              name: item.name,
              unit: item.unit,
              qtyPlanned: item.qtyPlanned,
              qtyDone: item.qtyDone,
              isDone: item.isDone,
              note: item.note ?? null,
              sortOrder: item.sortOrder || index,
            })),
          },
        },
        include: WITH_ITEMS,
      });
    });
  }

  /**
   * Отметка пункта чек-листа — то, что монтажник жмёт на объекте.
   *
   * Здесь же проходит граница ответственности из ТЗ: «выполнено» ставит
   * исполнитель, «проверено» — принимающий. Монтажник не может закрыть
   * собственную работу как проверенную, иначе вторая галочка ничего не значит.
   */
  async toggleItem(
    companyId: string,
    userId: string,
    role: Role,
    actId: string,
    itemId: string,
    patch: ToggleActItemInput,
  ) {
    if (patch.isChecked !== undefined && role === Role.INSTALLER) {
      throw new ForbiddenException('Отметку «проверено» ставит принимающий работу, не исполнитель');
    }

    return this.prisma.runAsTenant(companyId, async (tx) => {
      const act = await tx.workAct.findFirst({
        where: { id: actId, companyId, ...this.scopeFor(userId, role) },
        include: WITH_ITEMS,
      });
      if (!act) throw new NotFoundException('Акт не найден');
      if (!act.items.some((i) => i.id === itemId)) {
        throw new NotFoundException('Пункт акта не найден');
      }

      const item = act.items.find((i) => i.id === itemId)!;
      const now = new Date();

      await tx.workActItem.update({
        where: { id: itemId },
        data: {
          ...(patch.qtyDone !== undefined && { qtyDone: patch.qtyDone }),
          ...(patch.note !== undefined && { note: patch.note }),
          ...(patch.isDone !== undefined && {
            isDone: patch.isDone,
            doneAt: patch.isDone ? now : null,
            // Держим количество согласованным с галочкой прямо здесь, а не
            // надеемся, что клиент пришлёт qtyDone вместе с isDone. Иначе
            // в акте появляется «работа выполнена, сделано 0 шт.» — запись,
            // которая противоречит сама себе и попадёт в документ заказчику.
            ...(patch.qtyDone === undefined && {
              qtyDone: patch.isDone ? (item.qtyDone || item.qtyPlanned) : 0,
            }),
          }),
          ...(patch.isChecked !== undefined && {
            isChecked: patch.isChecked,
            checkedAt: patch.isChecked ? now : null,
            checkedByUserId: patch.isChecked ? userId : null,
          }),
        },
      });

      const updated = await tx.workAct.findUniqueOrThrow({
        where: { id: actId },
        include: WITH_ITEMS,
      });

      // Статус выводим из галочек, а не храним отдельно: иначе он рано или
      // поздно разойдётся с содержимым чек-листа.
      const status = deriveStatus(updated.items, updated.sentToChatAt);
      if (status !== updated.status) {
        return tx.workAct.update({ where: { id: actId }, data: { status }, include: WITH_ITEMS });
      }
      return updated;
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.prisma.runAsTenant(companyId, async (tx) => {
      const act = await tx.workAct.findFirst({ where: { id, companyId } });
      if (!act) throw new NotFoundException('Акт не найден');
      await tx.workAct.delete({ where: { id } });
    });
  }
}

function deriveStatus(
  items: { isDone: boolean }[],
  sentToChatAt: Date | null,
): ActStatus {
  if (sentToChatAt) return 'SENT';
  if (items.length === 0) return 'OPEN';
  if (items.every((i) => i.isDone)) return 'DONE';
  if (items.some((i) => i.isDone)) return 'IN_PROGRESS';
  return 'OPEN';
}
