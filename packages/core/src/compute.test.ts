import { describe, expect, it } from 'vitest';
import type { ComputableEstimate, ComputableLine, ComputablePosition } from './compute.js';
import { computeEstimate, computePosition, groupPositions } from './compute.js';
import type { ItemKind } from './domain.js';

// ─────────────────────────────────────────────────────────────
// Хелперы фикстур
// ─────────────────────────────────────────────────────────────

let counter = 0;
const nextId = () => `id-${++counter}`;

function line(
  kind: ItemKind,
  qty: number,
  material: number,
  labor = 0,
  isEnabled = true,
): ComputableLine {
  return { id: nextId(), kind, qty, unitMaterialPrice: material, unitLaborPrice: labor, isEnabled };
}

function position(
  kind: ItemKind,
  qty: number,
  material: number,
  lines: ComputableLine[] = [],
  labor = 0,
  isEnabled = true,
): ComputablePosition {
  return {
    id: nextId(),
    kind,
    qty,
    unitMaterialPrice: material,
    unitLaborPrice: labor,
    isEnabled,
    lines,
  };
}

/**
 * Тот же набор, что нарисован в макете: 6 камер с комплектом
 * (монтаж + юстировка + распред. коробка + кабель 30 м на камеру).
 *
 * В макете итог был константой TOTAL = 190000 и не сходился ни с чем.
 * Здесь он обязан сойтись со суммой строк — это и проверяем.
 */
function cameraPosition(): ComputablePosition {
  return position('EQUIPMENT', 6_000, 2_010_000, [
    line('LABOR', 6_000, 0, 150_000), // монтаж 1 500 ₽ × 6
    line('LABOR', 6_000, 0, 40_000), // юстировка 400 ₽ × 6
    line('MATERIAL', 6_000, 12_000), // распред. коробка 120 ₽ × 6
    // Кабель — ОДНА строка с двумя ценами за метр: 45 ₽ материал + 35 ₽ прокладка.
    // 30 м на камеру × 6 = 180 м.
    line('CABLE', 180_000, 4_500, 3_500),
  ]);
}

const noVat = { discountBp: 0, vatMode: 'NONE' as const, vatRateBp: 0 };

// ─────────────────────────────────────────────────────────────

describe('computePosition', () => {
  it('складывает свою стоимость и стоимость комплекта', () => {
    const totals = computePosition(cameraPosition());

    expect(totals.ownMaterial).toBe(12_060_000); // 120 600 ₽ — 6 камер
    expect(totals.ownLabor).toBe(0);

    // Комплект: коробки 720 ₽ + кабель 8 100 ₽ материал
    expect(totals.linesMaterial).toBe(72_000 + 810_000);
    // Работы: монтаж 9 000 + юстировка 2 400 + прокладка 6 300
    expect(totals.linesLabor).toBe(900_000 + 240_000 + 630_000);

    expect(totals.total).toBe(14_712_000); // 147 120 ₽
    expect(totals.material + totals.labor).toBe(totals.total);
  });

  it('одна строка кабеля даёт и материал, и работу', () => {
    const cable = line('CABLE', 180_000, 4_500, 3_500);
    const totals = computePosition(position('EQUIPMENT', 1_000, 0, [cable]));

    expect(totals.lines[0]!.material).toBe(810_000); // 8 100 ₽
    expect(totals.lines[0]!.labor).toBe(630_000); // 6 300 ₽
    expect(totals.lines[0]!.total).toBe(1_440_000); // 14 400 ₽
  });

  it('выключенная строка не попадает в сумму', () => {
    const p = position('EQUIPMENT', 1_000, 100_000, [
      line('MATERIAL', 1_000, 50_000, 0, false),
    ]);
    const totals = computePosition(p);

    expect(totals.linesMaterial).toBe(0);
    expect(totals.total).toBe(100_000);
  });

  it('выключенная позиция обнуляется целиком, включая комплект', () => {
    const p = position('EQUIPMENT', 6_000, 2_010_000, [line('LABOR', 6_000, 0, 150_000)], 0, false);
    const totals = computePosition(p);

    expect(totals.total).toBe(0);
    expect(totals.lines.every((l) => l.total === 0)).toBe(true);
  });
});

describe('computeEstimate', () => {
  it('итог равен сумме позиций — никаких «примерно»', () => {
    const estimate: ComputableEstimate = {
      ...noVat,
      positions: [
        cameraPosition(),
        position('EQUIPMENT', 2_000, 1_100_000), // Wi-Fi 11 000 × 2
        position('EQUIPMENT', 1_000, 1_850_000), // домофон
        position('EQUIPMENT', 1_000, 2_890_000), // регистратор
      ],
    };

    const totals = computeEstimate(estimate);
    const sumOfPositions = totals.positions.reduce((acc, p) => acc + p.total, 0);

    expect(totals.subtotal).toBe(sumOfPositions);
    expect(totals.grandTotal).toBe(sumOfPositions);
  });

  it('разделяет материалы и работы точно, а не на глазок', () => {
    const totals = computeEstimate({ ...noVat, positions: [cameraPosition()] });

    expect(totals.materials).toBe(12_060_000 + 72_000 + 810_000); // 129 420 ₽
    expect(totals.labor).toBe(900_000 + 240_000 + 630_000); // 17 700 ₽
    expect(totals.materials + totals.labor).toBe(totals.subtotal);
  });

  it('разносит суммы по типам позиций', () => {
    const totals = computeEstimate({ ...noVat, positions: [cameraPosition()] });

    expect(totals.byKind.EQUIPMENT).toBe(12_060_000);
    expect(totals.byKind.LABOR).toBe(900_000 + 240_000);
    expect(totals.byKind.MATERIAL).toBe(72_000);
    expect(totals.byKind.CABLE).toBe(810_000 + 630_000);

    const sumByKind = Object.values(totals.byKind).reduce((a, b) => a + b, 0);
    expect(sumByKind).toBe(totals.subtotal);
  });

  it('применяет скидку к подытогу', () => {
    const totals = computeEstimate({
      ...noVat,
      discountBp: 1_000, // 10 %
      positions: [position('EQUIPMENT', 1_000, 19_000_000)],
    });

    expect(totals.subtotal).toBe(19_000_000);
    expect(totals.discount).toBe(1_900_000);
    expect(totals.afterDiscount).toBe(17_100_000);
    expect(totals.grandTotal).toBe(17_100_000);
  });

  it('НДС сверху увеличивает итог', () => {
    const totals = computeEstimate({
      discountBp: 0,
      vatMode: 'ADDED',
      vatRateBp: 2_000,
      positions: [position('EQUIPMENT', 1_000, 10_000_000)],
    });

    expect(totals.vat).toBe(2_000_000);
    expect(totals.grandTotal).toBe(12_000_000);
  });

  it('НДС «в том числе» выделяется из итога, не меняя его', () => {
    const totals = computeEstimate({
      discountBp: 0,
      vatMode: 'INCLUDED',
      vatRateBp: 2_000,
      positions: [position('EQUIPMENT', 1_000, 12_000_000)],
    });

    expect(totals.vat).toBe(2_000_000);
    expect(totals.grandTotal).toBe(12_000_000);
  });

  it('скидка считается до НДС', () => {
    const totals = computeEstimate({
      discountBp: 1_000,
      vatMode: 'ADDED',
      vatRateBp: 2_000,
      positions: [position('EQUIPMENT', 1_000, 10_000_000)],
    });

    expect(totals.discount).toBe(1_000_000);
    expect(totals.afterDiscount).toBe(9_000_000);
    expect(totals.vat).toBe(1_800_000);
    expect(totals.grandTotal).toBe(10_800_000);
  });

  it('пустая смета не ломается', () => {
    const totals = computeEstimate({ ...noVat, positions: [] });

    expect(totals.subtotal).toBe(0);
    expect(totals.grandTotal).toBe(0);
  });

  it('свёрнутый и развёрнутый вид дают одинаковый итог', () => {
    // Режим показа (EXPRESS/DETAILED) в расчёт вообще не входит — на входе
    // движка его нет. Этот тест фиксирует свойство: одни данные → один итог,
    // сколько бы строк мы ни решили показать на экране.
    const positions = [cameraPosition(), position('EQUIPMENT', 1_000, 2_890_000)];

    const detailed = computeEstimate({ ...noVat, positions });
    const sameData = computeEstimate({ ...noVat, positions });

    expect(detailed.grandTotal).toBe(sameData.grandTotal);
    expect(detailed.grandTotal).toBe(14_712_000 + 2_890_000);
  });
});

describe('groupPositions', () => {
  it('складывает одинаковые позиции в одну плитку вместе с комплектами', () => {
    const first = { ...cameraPosition(), catalogItemId: 'cam', name: 'IP камера 4 Мр', icon: 'camera-bullet' };
    const second = { ...cameraPosition(), catalogItemId: 'cam', name: 'IP камера 4 Мр', icon: 'camera-bullet' };
    const nvr = {
      ...position('EQUIPMENT', 1_000, 2_890_000),
      catalogItemId: 'nvr',
      name: 'Регистратор',
      icon: 'nvr',
    };

    const positions = [first, second, nvr];
    const totals = computeEstimate({ ...noVat, positions });
    const groups = groupPositions(positions, totals);

    expect(groups).toHaveLength(2);

    const cameras = groups.find((g) => g.catalogItemId === 'cam')!;
    expect(cameras.qty).toBe(12_000); // 6 + 6 камер
    expect(cameras.total).toBe(14_712_000 * 2); // цена «под ключ», а не голое железо

    expect(groups.reduce((a, g) => a + g.total, 0)).toBe(totals.subtotal);
  });

  it('пропускает выключенные позиции', () => {
    const off = {
      ...position('EQUIPMENT', 1_000, 100_000, [], 0, false),
      catalogItemId: 'x',
      name: 'Выключено',
      icon: null,
    };
    const on = { ...position('EQUIPMENT', 1_000, 100_000), catalogItemId: 'y', name: 'Включено', icon: null };

    const positions = [off, on];
    const groups = groupPositions(positions, computeEstimate({ ...noVat, positions }));

    expect(groups).toHaveLength(1);
    expect(groups[0]!.catalogItemId).toBe('y');
  });
});
