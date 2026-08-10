/**
 * Разворот шаблона комплекта в строки сметы.
 *
 * Это механика «если монтаж камеры, то сразу юстировка + распред. коробка»
 * из ТЗ. Шаблон задаёт количество НА ОДНУ базовую позицию, разворот
 * умножает его на количество позиций и получает абсолютные числа.
 *
 * После разворота смета самодостаточна: в ней лежат имена, количества и
 * СНИМОК цен. Дальше её правят руками, и шаблон об этом ничего не знает.
 * Именно поэтому «до винтика» и экспресс — один документ в двух видах,
 * а не две программы.
 */

import type {
  CatalogItem,
  EstimateLine,
  EstimatePosition,
  KitLine,
  KitTemplate,
} from './domain.js';
import type { QtyMilli } from './money.js';
import { mulQtyByQty } from './money.js';

/**
 * Внешние зависимости разворота, переданные явно — чтобы функции
 * оставались чистыми и тестируемыми (никаких crypto.randomUUID внутри).
 */
export interface ExpandContext {
  /** Справочник по id. Строки шаблона ссылаются на него. */
  items: ReadonlyMap<string, CatalogItem>;
  /** Генератор идентификаторов новых строк. */
  newId: () => string;
}

export class ExpandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpandError';
  }
}

function requireItem(ctx: ExpandContext, itemId: string): CatalogItem {
  const item = ctx.items.get(itemId);
  if (!item) {
    throw new ExpandError(`позиция справочника ${itemId} не найдена`);
  }
  return item;
}

/** Количество строки комплекта при заданном количестве базовых позиций. */
export function kitLineQty(line: KitLine, rootQty: QtyMilli): QtyMilli {
  return line.qtyMode === 'FIXED' ? line.qtyPerRoot : mulQtyByQty(line.qtyPerRoot, rootQty);
}

function buildLine(
  kitLine: KitLine,
  rootQty: QtyMilli,
  ctx: ExpandContext,
  sortOrder: number,
): EstimateLine {
  const item = requireItem(ctx, kitLine.itemId);
  return {
    id: ctx.newId(),
    catalogItemId: item.id,
    kitLineId: kitLine.id,
    name: item.name,
    kind: item.kind,
    unit: item.unit,
    qty: kitLineQty(kitLine, rootQty),
    unitMaterialPrice: item.materialPrice,
    unitLaborPrice: item.laborPrice,
    isEnabled: kitLine.isOptional ? kitLine.isDefaultEnabled : true,
    isManual: false,
    note: null,
    sortOrder,
  };
}

/** Разворот шаблона в набор строк для заданного количества базовых позиций. */
export function expandKit(
  kit: KitTemplate,
  rootQty: QtyMilli,
  ctx: ExpandContext,
): EstimateLine[] {
  return [...kit.lines]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((kitLine, index) => buildLine(kitLine, rootQty, ctx, index));
}

/**
 * Новая позиция сметы: базовая позиция справочника + развёрнутый комплект.
 * Если шаблона нет — получится просто позиция без строк, это нормально.
 */
export function createPosition(
  item: CatalogItem,
  kit: KitTemplate | null,
  qty: QtyMilli,
  ctx: ExpandContext,
  sortOrder = 0,
): EstimatePosition {
  return {
    id: ctx.newId(),
    catalogItemId: item.id,
    kitTemplateId: kit?.id ?? null,
    name: item.name,
    kind: item.kind,
    icon: item.icon,
    unit: item.unit,
    qty,
    unitMaterialPrice: item.materialPrice,
    unitLaborPrice: item.laborPrice,
    isEnabled: true,
    sortOrder,
    lines: kit ? expandKit(kit, qty, ctx) : [],
  };
}

export interface ResyncResult {
  position: EstimatePosition;
  /** Что именно изменилось — показываем пользователю перед применением. */
  changes: ResyncChange[];
}

export interface ResyncChange {
  type: 'qty-updated' | 'line-added' | 'line-orphaned' | 'line-kept-manual';
  lineId: string;
  name: string;
  fromQty?: QtyMilli;
  toQty?: QtyMilli;
}

/**
 * Пересчёт позиции под новое количество базовых позиций.
 *
 * Правки руками не затираются — строка с isManual остаётся как есть.
 * Это ровно тот случай, когда монтажник поставил кабелю не расчётные 180 м,
 * а замеренные 205: пересчёт «6 камер → 8 камер» не должен об этом забыть.
 *
 * Строки, которых больше нет в шаблоне, тоже не удаляются: их помечаем
 * orphaned и оставляем решение пользователю. Молча выкидывать из сметы
 * то, что там уже было, — самый быстрый способ выставить клиенту не тот счёт.
 */
export function resyncPosition(
  position: EstimatePosition,
  kit: KitTemplate | null,
  newQty: QtyMilli,
  ctx: ExpandContext,
): ResyncResult {
  const changes: ResyncChange[] = [];
  const kitLines = new Map<string, KitLine>();
  if (kit) for (const line of kit.lines) kitLines.set(line.id, line);

  const seenKitLineIds = new Set<string>();
  const lines: EstimateLine[] = [];

  for (const line of position.lines) {
    if (line.isManual) {
      // Строку не трогаем, но обязательно отмечаем её строку шаблона как
      // присутствующую. Иначе цикл ниже сочтёт, что кабеля в позиции нет,
      // и добавит второй — клиент получит счёт и на замеренные 205 м,
      // и на расчётные 240.
      if (line.kitLineId) seenKitLineIds.add(line.kitLineId);
      changes.push({ type: 'line-kept-manual', lineId: line.id, name: line.name });
      lines.push(line);
      continue;
    }

    if (!line.kitLineId) {
      lines.push(line);
      continue;
    }

    const kitLine = kitLines.get(line.kitLineId);
    if (!kitLine) {
      changes.push({ type: 'line-orphaned', lineId: line.id, name: line.name });
      lines.push(line);
      continue;
    }

    seenKitLineIds.add(kitLine.id);
    const qty = kitLineQty(kitLine, newQty);
    if (qty !== line.qty) {
      changes.push({
        type: 'qty-updated',
        lineId: line.id,
        name: line.name,
        fromQty: line.qty,
        toQty: qty,
      });
    }
    lines.push({ ...line, qty });
  }

  if (kit) {
    let sortOrder = lines.length;
    for (const kitLine of [...kit.lines].sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (seenKitLineIds.has(kitLine.id)) continue;
      const added = buildLine(kitLine, newQty, ctx, sortOrder++);
      changes.push({ type: 'line-added', lineId: added.id, name: added.name, toQty: added.qty });
      lines.push(added);
    }
  }

  return {
    position: { ...position, qty: newQty, lines },
    changes,
  };
}

export interface RepriceChange {
  lineId: string;
  name: string;
  fromMaterial: number;
  toMaterial: number;
  fromLabor: number;
  toLabor: number;
}

/**
 * Обновление снимка цен по текущему справочнику.
 *
 * Только явным действием пользователя. Смета в статусе SENT/APPROVED
 * переоценке не подлежит — это уже обязательство перед клиентом, и
 * решение об этом принимает вызывающий, а не движок.
 */
export function repricePosition(
  position: EstimatePosition,
  ctx: ExpandContext,
): { position: EstimatePosition; changes: RepriceChange[] } {
  const changes: RepriceChange[] = [];

  const repriceOne = <T extends EstimateLine | EstimatePosition>(entity: T): T => {
    if (!entity.catalogItemId) return entity;
    const item = ctx.items.get(entity.catalogItemId);
    if (!item) return entity;
    if (
      item.materialPrice === entity.unitMaterialPrice &&
      item.laborPrice === entity.unitLaborPrice
    ) {
      return entity;
    }
    changes.push({
      lineId: entity.id,
      name: entity.name,
      fromMaterial: entity.unitMaterialPrice,
      toMaterial: item.materialPrice,
      fromLabor: entity.unitLaborPrice,
      toLabor: item.laborPrice,
    });
    return { ...entity, unitMaterialPrice: item.materialPrice, unitLaborPrice: item.laborPrice };
  };

  const next = repriceOne(position);
  return {
    position: { ...next, lines: position.lines.map(repriceOne) },
    changes,
  };
}

// ─────────────────────────────────────────────────────────────
// Проверки, которые нужны и на фронте, и на бэке
// ─────────────────────────────────────────────────────────────

export interface ValidationIssue {
  level: 'error' | 'warning';
  path: string;
  message: string;
}

/**
 * Мягкие проверки позиции: диапазоны из шаблона (кабель 30–50 м на точку)
 * не запрещают ввести 200 м, но предупреждают. Жёсткие ограничения — в Zod.
 */
export function validatePosition(
  position: EstimatePosition,
  kit: KitTemplate | null,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (position.qty <= 0) {
    issues.push({
      level: 'error',
      path: `position.${position.id}.qty`,
      message: 'Количество должно быть больше нуля',
    });
  }

  if (!kit) return issues;

  const kitLines = new Map(kit.lines.map((l) => [l.id, l]));

  for (const line of position.lines) {
    if (!line.isEnabled || !line.kitLineId) continue;
    const kitLine = kitLines.get(line.kitLineId);
    if (!kitLine || position.qty <= 0) continue;

    // Приводим к «на одну базовую позицию», чтобы сравнить с диапазоном шаблона.
    const perRoot =
      kitLine.qtyMode === 'FIXED'
        ? line.qty
        : Math.round((line.qty * 1000) / position.qty);

    if (kitLine.minPerRoot !== null && perRoot < kitLine.minPerRoot) {
      issues.push({
        level: 'warning',
        path: `position.${position.id}.line.${line.id}.qty`,
        message: `«${line.name}»: ${perRoot / 1000} на позицию — меньше типового минимума ${kitLine.minPerRoot / 1000}`,
      });
    }
    if (kitLine.maxPerRoot !== null && perRoot > kitLine.maxPerRoot) {
      issues.push({
        level: 'warning',
        path: `position.${position.id}.line.${line.id}.qty`,
        message: `«${line.name}»: ${perRoot / 1000} на позицию — больше типового максимума ${kitLine.maxPerRoot / 1000}`,
      });
    }
  }

  return issues;
}
