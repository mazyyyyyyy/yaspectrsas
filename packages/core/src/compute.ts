/**
 * Движок расчёта — единственное место в системе, где считаются деньги.
 *
 * Функции здесь чистые: никакого I/O, никакого доступа к БД, никакого
 * Date.now(). Тот же самый код импортируют и фронт (мгновенный пересчёт
 * при вводе), и API (проверка перед сохранением), и генератор PDF/DOCX.
 * Поэтому экспресс-расчёт, детальная смета и документ у клиента физически
 * не могут показать разные цифры.
 *
 * Порядок округления зафиксирован и важен:
 *   1. Округляем КАЖДУЮ строку (цена × количество).
 *   2. Суммы строк складываем точно, без повторного округления.
 *   3. Скидку считаем от подытога и округляем один раз.
 *   4. НДС считаем от суммы после скидки.
 * Сначала суммировать неокруглённое, а округлять в конце — нельзя: тогда
 * итог не сойдётся с построчными суммами, которые видит клиент в PDF.
 */

import type { ItemKind, VatMode } from './domain.js';
import { ITEM_KINDS } from './domain.js';
import type { BasisPoints, Kopecks, QtyMilli } from './money.js';
import { mulQty, percentOf, vatIncludedIn } from './money.js';

// ─────────────────────────────────────────────────────────────
// Вход (структурный — подходят и записи из БД, и черновик на клиенте)
// ─────────────────────────────────────────────────────────────

export interface ComputableLine {
  id: string;
  kind: ItemKind;
  qty: QtyMilli;
  unitMaterialPrice: Kopecks;
  unitLaborPrice: Kopecks;
  isEnabled: boolean;
}

export interface ComputablePosition {
  id: string;
  kind: ItemKind;
  qty: QtyMilli;
  unitMaterialPrice: Kopecks;
  unitLaborPrice: Kopecks;
  isEnabled: boolean;
  lines: readonly ComputableLine[];
}

export interface ComputableEstimate {
  discountBp: BasisPoints;
  vatMode: VatMode;
  vatRateBp: BasisPoints;
  positions: readonly ComputablePosition[];
}

// ─────────────────────────────────────────────────────────────
// Результат
// ─────────────────────────────────────────────────────────────

export interface LineTotals {
  lineId: string;
  material: Kopecks;
  labor: Kopecks;
  total: Kopecks;
}

export interface PositionTotals {
  positionId: string;
  /** Стоимость самой базовой позиции (например, шести камер). */
  ownMaterial: Kopecks;
  ownLabor: Kopecks;
  /** Стоимость развёрнутого комплекта. */
  linesMaterial: Kopecks;
  linesLabor: Kopecks;
  /** Итог позиции: своя стоимость + комплект. */
  material: Kopecks;
  labor: Kopecks;
  total: Kopecks;
  lines: LineTotals[];
}

export interface EstimateTotals {
  positions: PositionTotals[];
  /** Всё, что материал/оборудование, по всем позициям и строкам. */
  materials: Kopecks;
  /** Всё, что работа. */
  labor: Kopecks;
  /** materials + labor, до скидки. */
  subtotal: Kopecks;
  discount: Kopecks;
  afterDiscount: Kopecks;
  vat: Kopecks;
  /** Итог к оплате. */
  grandTotal: Kopecks;
  /** Разбивка по типу позиции — для сводных плиток и аналитики. */
  byKind: Record<ItemKind, Kopecks>;
}

function emptyByKind(): Record<ItemKind, Kopecks> {
  const out = {} as Record<ItemKind, Kopecks>;
  for (const kind of ITEM_KINDS) out[kind] = 0;
  return out;
}

// ─────────────────────────────────────────────────────────────
// Расчёт
// ─────────────────────────────────────────────────────────────

export function computeLine(line: ComputableLine): LineTotals {
  if (!line.isEnabled) {
    return { lineId: line.id, material: 0, labor: 0, total: 0 };
  }
  const material = mulQty(line.unitMaterialPrice, line.qty);
  const labor = mulQty(line.unitLaborPrice, line.qty);
  return { lineId: line.id, material, labor, total: material + labor };
}

export function computePosition(position: ComputablePosition): PositionTotals {
  const lines = position.lines.map(computeLine);

  if (!position.isEnabled) {
    return {
      positionId: position.id,
      ownMaterial: 0,
      ownLabor: 0,
      linesMaterial: 0,
      linesLabor: 0,
      material: 0,
      labor: 0,
      total: 0,
      // Строки считаем и показываем, но в сумму отключённой позиции не берём.
      lines: lines.map((l) => ({ ...l, material: 0, labor: 0, total: 0 })),
    };
  }

  const ownMaterial = mulQty(position.unitMaterialPrice, position.qty);
  const ownLabor = mulQty(position.unitLaborPrice, position.qty);

  let linesMaterial = 0;
  let linesLabor = 0;
  for (const line of lines) {
    linesMaterial += line.material;
    linesLabor += line.labor;
  }

  const material = ownMaterial + linesMaterial;
  const labor = ownLabor + linesLabor;

  return {
    positionId: position.id,
    ownMaterial,
    ownLabor,
    linesMaterial,
    linesLabor,
    material,
    labor,
    total: material + labor,
    lines,
  };
}

export function computeEstimate(estimate: ComputableEstimate): EstimateTotals {
  const positions = estimate.positions.map(computePosition);
  const byKind = emptyByKind();

  let materials = 0;
  let labor = 0;

  for (let i = 0; i < positions.length; i++) {
    const totals = positions[i]!;
    const source = estimate.positions[i]!;

    materials += totals.material;
    labor += totals.labor;

    // Своя стоимость позиции относится к её собственному типу…
    byKind[source.kind] += totals.ownMaterial + totals.ownLabor;
    // …а каждая строка комплекта — к своему.
    for (let j = 0; j < totals.lines.length; j++) {
      byKind[source.lines[j]!.kind] += totals.lines[j]!.total;
    }
  }

  const subtotal = materials + labor;
  const discount = percentOf(subtotal, estimate.discountBp);
  const afterDiscount = subtotal - discount;

  let vat = 0;
  let grandTotal = afterDiscount;

  switch (estimate.vatMode) {
    case 'NONE':
      break;
    case 'ADDED':
      vat = percentOf(afterDiscount, estimate.vatRateBp);
      grandTotal = afterDiscount + vat;
      break;
    case 'INCLUDED':
      vat = vatIncludedIn(afterDiscount, estimate.vatRateBp);
      break;
  }

  return {
    positions,
    materials,
    labor,
    subtotal,
    discount,
    afterDiscount,
    vat,
    grandTotal,
    byKind,
  };
}

// ─────────────────────────────────────────────────────────────
// Сводка для экспресс-режима
// ─────────────────────────────────────────────────────────────

export interface PositionGroup {
  /** id позиции справочника, по которой сгруппировали. */
  catalogItemId: string | null;
  name: string;
  kind: ItemKind;
  /** Иконка первой позиции группы — они все от одной позиции справочника. */
  icon: string | null;
  qty: QtyMilli;
  total: Kopecks;
}

export interface GroupablePosition extends ComputablePosition {
  catalogItemId: string | null;
  name: string;
  icon: string | null;
}

/**
 * Плитки экспресс-режима: «Камеры — 6 шт — 120 600 ₽».
 * Одинаковые позиции справочника складываются в одну плитку, включая
 * стоимость их комплектов — клиент на месте видит честную цену «под ключ»,
 * а не голую цену железки.
 */
export function groupPositions(
  positions: readonly GroupablePosition[],
  totals: EstimateTotals,
): PositionGroup[] {
  const byKey = new Map<string, PositionGroup>();

  positions.forEach((position, index) => {
    if (!position.isEnabled) return;

    const key = position.catalogItemId ?? `custom:${position.name}`;
    const positionTotal = totals.positions[index]?.total ?? 0;

    const existing = byKey.get(key);
    if (existing) {
      existing.qty += position.qty;
      existing.total += positionTotal;
      return;
    }

    byKey.set(key, {
      catalogItemId: position.catalogItemId,
      name: position.name,
      kind: position.kind,
      icon: position.icon,
      qty: position.qty,
      total: positionTotal,
    });
  });

  return [...byKey.values()];
}
