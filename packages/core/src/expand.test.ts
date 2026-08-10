import { beforeEach, describe, expect, it } from 'vitest';
import { computePosition } from './compute.js';
import type { CatalogItem, KitLine, KitTemplate } from './domain.js';
import type { ExpandContext } from './expand.js';
import {
  ExpandError,
  createPosition,
  expandKit,
  kitLineQty,
  repricePosition,
  resyncPosition,
  validatePosition,
} from './expand.js';

// ─────────────────────────────────────────────────────────────
// Справочник и шаблон «камера под ключ» из ТЗ
// ─────────────────────────────────────────────────────────────

function item(over: Partial<CatalogItem> & Pick<CatalogItem, 'id' | 'name'>): CatalogItem {
  return {
    companyId: 'co-1',
    sku: null,
    kind: 'MATERIAL',
    unit: 'PCS',
    icon: null,
    materialPrice: 0,
    laborPrice: 0,
    costPrice: null,
    categoryId: null,
    isActive: true,
    ...over,
  };
}

const CAMERA = item({
  id: 'cam',
  name: 'IP камера 4 Мр',
  kind: 'EQUIPMENT',
  materialPrice: 2_010_000,
});
const MOUNT = item({ id: 'mount', name: 'Монтаж камеры', kind: 'LABOR', laborPrice: 150_000 });
const ALIGN = item({ id: 'align', name: 'Юстировка', kind: 'LABOR', laborPrice: 40_000 });
const BOX = item({ id: 'box', name: 'Распред. коробка', kind: 'MATERIAL', materialPrice: 12_000 });
// Кабель — одна позиция с двумя ценами за метр, как требует ТЗ.
const CABLE = item({
  id: 'cable',
  name: 'Кабель UTP',
  kind: 'CABLE',
  unit: 'M',
  materialPrice: 4_500,
  laborPrice: 3_500,
});
const RACK = item({ id: 'rack', name: 'Телеком-бокс', kind: 'MATERIAL', materialPrice: 240_000 });

function kitLine(over: Partial<KitLine> & Pick<KitLine, 'id' | 'itemId'>): KitLine {
  return {
    qtyMode: 'PER_ROOT',
    qtyPerRoot: 1_000,
    minPerRoot: null,
    maxPerRoot: null,
    isOptional: false,
    isDefaultEnabled: true,
    sortOrder: 0,
    ...over,
  };
}

const CAMERA_KIT: KitTemplate = {
  id: 'kit-cam',
  companyId: 'co-1',
  name: 'Камера под ключ',
  rootItemId: CAMERA.id,
  isActive: true,
  lines: [
    kitLine({ id: 'kl-mount', itemId: MOUNT.id, sortOrder: 0 }),
    kitLine({ id: 'kl-align', itemId: ALIGN.id, sortOrder: 1 }),
    kitLine({ id: 'kl-box', itemId: BOX.id, sortOrder: 2 }),
    // Кабель: 30 м на камеру, типовой диапазон 30–50 м из ТЗ.
    kitLine({
      id: 'kl-cable',
      itemId: CABLE.id,
      qtyPerRoot: 30_000,
      minPerRoot: 30_000,
      maxPerRoot: 50_000,
      sortOrder: 3,
    }),
    // Один бокс на объект независимо от количества камер.
    kitLine({ id: 'kl-rack', itemId: RACK.id, qtyMode: 'FIXED', qtyPerRoot: 1_000, sortOrder: 4 }),
  ],
};

let counter = 0;
let ctx: ExpandContext;

beforeEach(() => {
  counter = 0;
  ctx = {
    items: new Map([CAMERA, MOUNT, ALIGN, BOX, CABLE, RACK].map((i) => [i.id, i])),
    newId: () => `new-${++counter}`,
  };
});

// ─────────────────────────────────────────────────────────────

describe('kitLineQty', () => {
  it('PER_ROOT умножает норму на количество позиций', () => {
    const cable = CAMERA_KIT.lines.find((l) => l.id === 'kl-cable')!;
    expect(kitLineQty(cable, 6_000)).toBe(180_000); // 30 м × 6 камер
  });

  it('FIXED не зависит от количества позиций', () => {
    const rack = CAMERA_KIT.lines.find((l) => l.id === 'kl-rack')!;
    expect(kitLineQty(rack, 6_000)).toBe(1_000);
    expect(kitLineQty(rack, 20_000)).toBe(1_000);
  });
});

describe('expandKit', () => {
  it('разворачивает комплект в абсолютные количества', () => {
    const lines = expandKit(CAMERA_KIT, 6_000, ctx);

    expect(lines.map((l) => [l.name, l.qty])).toEqual([
      ['Монтаж камеры', 6_000],
      ['Юстировка', 6_000],
      ['Распред. коробка', 6_000],
      ['Кабель UTP', 180_000],
      ['Телеком-бокс', 1_000],
    ]);
  });

  it('снимает цены из справочника, а не ссылается на него', () => {
    const lines = expandKit(CAMERA_KIT, 1_000, ctx);
    const cable = lines.find((l) => l.catalogItemId === 'cable')!;

    expect(cable.unitMaterialPrice).toBe(4_500);
    expect(cable.unitLaborPrice).toBe(3_500);
    expect(cable.kitLineId).toBe('kl-cable');
    expect(cable.isManual).toBe(false);
  });

  it('уважает порядок сортировки, а не порядок в массиве', () => {
    const shuffled: KitTemplate = {
      ...CAMERA_KIT,
      lines: [...CAMERA_KIT.lines].reverse(),
    };
    const lines = expandKit(shuffled, 1_000, ctx);

    expect(lines[0]!.name).toBe('Монтаж камеры');
  });

  it('необязательная выключенная строка приходит выключенной', () => {
    const kit: KitTemplate = {
      ...CAMERA_KIT,
      lines: [kitLine({ id: 'kl-x', itemId: RACK.id, isOptional: true, isDefaultEnabled: false })],
    };
    expect(expandKit(kit, 1_000, ctx)[0]!.isEnabled).toBe(false);
  });

  it('падает понятной ошибкой, если позиции справочника нет', () => {
    const kit: KitTemplate = {
      ...CAMERA_KIT,
      lines: [kitLine({ id: 'kl-ghost', itemId: 'ghost' })],
    };
    expect(() => expandKit(kit, 1_000, ctx)).toThrow(ExpandError);
  });
});

describe('createPosition', () => {
  it('собирает позицию, которая считается до нужной суммы', () => {
    const position = createPosition(CAMERA, CAMERA_KIT, 6_000, ctx);
    const totals = computePosition(position);

    // 120 600 (камеры) + 9 000 + 2 400 + 720 + 8 100 + 6 300 + 2 400 (бокс)
    expect(totals.total).toBe(14_952_000);
    expect(totals.material + totals.labor).toBe(totals.total);
  });

  it('без шаблона даёт позицию без строк', () => {
    const position = createPosition(CAMERA, null, 1_000, ctx);

    expect(position.lines).toHaveLength(0);
    expect(position.kitTemplateId).toBeNull();
    expect(computePosition(position).total).toBe(2_010_000);
  });
});

describe('resyncPosition', () => {
  it('пересчитывает количества под новое число позиций', () => {
    const position = createPosition(CAMERA, CAMERA_KIT, 6_000, ctx);
    const { position: next, changes } = resyncPosition(position, CAMERA_KIT, 8_000, ctx);

    expect(next.qty).toBe(8_000);
    expect(next.lines.find((l) => l.catalogItemId === 'cable')!.qty).toBe(240_000); // 30 × 8
    expect(next.lines.find((l) => l.catalogItemId === 'mount')!.qty).toBe(8_000);
    // FIXED не тронут
    expect(next.lines.find((l) => l.catalogItemId === 'rack')!.qty).toBe(1_000);

    expect(changes.filter((c) => c.type === 'qty-updated')).toHaveLength(4);
  });

  it('НЕ затирает строку, поправленную руками', () => {
    // Монтажник замерил кабель: не расчётные 180 м, а 205.
    const position = createPosition(CAMERA, CAMERA_KIT, 6_000, ctx);
    const edited = {
      ...position,
      lines: position.lines.map((l) =>
        l.catalogItemId === 'cable' ? { ...l, qty: 205_000, isManual: true } : l,
      ),
    };

    const { position: next, changes } = resyncPosition(edited, CAMERA_KIT, 8_000, ctx);

    expect(next.lines.find((l) => l.catalogItemId === 'cable')!.qty).toBe(205_000);
    expect(changes.some((c) => c.type === 'line-kept-manual')).toBe(true);
  });

  it('не дублирует ручную строку второй, расчётной', () => {
    // Регрессия: ручная строка сохранялась, но её строка шаблона считалась
    // отсутствующей, и рядом появлялся ещё один кабель на расчётные 240 м.
    // В смете это двойной счёт клиенту за один и тот же кабель.
    const position = createPosition(CAMERA, CAMERA_KIT, 6_000, ctx);
    const edited = {
      ...position,
      lines: position.lines.map((l) =>
        l.catalogItemId === 'cable' ? { ...l, qty: 205_000, isManual: true } : l,
      ),
    };

    const { position: next, changes } = resyncPosition(edited, CAMERA_KIT, 8_000, ctx);

    const cables = next.lines.filter((l) => l.catalogItemId === 'cable');
    expect(cables).toHaveLength(1);
    expect(cables[0]!.qty).toBe(205_000);

    expect(next.lines).toHaveLength(position.lines.length);
    expect(changes.filter((c) => c.type === 'line-added')).toHaveLength(0);
  });

  it('добавляет строки, появившиеся в шаблоне позже', () => {
    const position = createPosition(CAMERA, CAMERA_KIT, 6_000, ctx);
    const extended: KitTemplate = {
      ...CAMERA_KIT,
      lines: [...CAMERA_KIT.lines, kitLine({ id: 'kl-new', itemId: BOX.id, sortOrder: 9 })],
    };

    const { position: next, changes } = resyncPosition(position, extended, 6_000, ctx);

    expect(next.lines).toHaveLength(6);
    expect(changes.filter((c) => c.type === 'line-added')).toHaveLength(1);
  });

  it('не выбрасывает строки, исчезнувшие из шаблона, — только помечает', () => {
    const position = createPosition(CAMERA, CAMERA_KIT, 6_000, ctx);
    const trimmed: KitTemplate = {
      ...CAMERA_KIT,
      lines: CAMERA_KIT.lines.filter((l) => l.id !== 'kl-box'),
    };

    const { position: next, changes } = resyncPosition(position, trimmed, 6_000, ctx);

    // Молча удалить строку из уже собранной сметы — это выставить клиенту не тот счёт.
    expect(next.lines).toHaveLength(5);
    expect(changes.some((c) => c.type === 'line-orphaned' && c.name === 'Распред. коробка')).toBe(
      true,
    );
  });

  it('не мутирует исходную позицию', () => {
    const position = createPosition(CAMERA, CAMERA_KIT, 6_000, ctx);
    const before = JSON.stringify(position);

    resyncPosition(position, CAMERA_KIT, 8_000, ctx);

    expect(JSON.stringify(position)).toBe(before);
  });
});

describe('repricePosition', () => {
  it('обновляет снимок цен и отчитывается, что изменилось', () => {
    const position = createPosition(CAMERA, CAMERA_KIT, 6_000, ctx);

    // Поставщик поднял цену на кабель.
    ctx.items = new Map(ctx.items);
    (ctx.items as Map<string, CatalogItem>).set('cable', { ...CABLE, materialPrice: 5_200 });

    const { position: next, changes } = repricePosition(position, ctx);

    expect(next.lines.find((l) => l.catalogItemId === 'cable')!.unitMaterialPrice).toBe(5_200);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.fromMaterial).toBe(4_500);
    expect(changes[0]!.toMaterial).toBe(5_200);
  });

  it('без изменений в справочнике ничего не трогает', () => {
    const position = createPosition(CAMERA, CAMERA_KIT, 6_000, ctx);
    const { changes } = repricePosition(position, ctx);

    expect(changes).toHaveLength(0);
  });

  it('старая смета не переоценивается сама по себе', () => {
    // Снимок цен — вся суть: цену меняем в справочнике, смета стоит на месте,
    // пока пользователь явно не нажмёт «пересчитать».
    const position = createPosition(CAMERA, CAMERA_KIT, 6_000, ctx);
    const totalBefore = computePosition(position).total;

    (ctx.items as Map<string, CatalogItem>).set('cable', { ...CABLE, materialPrice: 9_900 });

    expect(computePosition(position).total).toBe(totalBefore);
  });
});

describe('validatePosition', () => {
  it('предупреждает о выходе за типовой диапазон, но не запрещает', () => {
    const position = createPosition(CAMERA, CAMERA_KIT, 6_000, ctx);
    const stretched = {
      ...position,
      lines: position.lines.map((l) =>
        l.catalogItemId === 'cable' ? { ...l, qty: 600_000 } : l, // 100 м на камеру
      ),
    };

    const issues = validatePosition(stretched, CAMERA_KIT);

    expect(issues).toHaveLength(1);
    expect(issues[0]!.level).toBe('warning');
    expect(issues[0]!.message).toContain('больше типового максимума');
  });

  it('расчётные значения не вызывают предупреждений', () => {
    const position = createPosition(CAMERA, CAMERA_KIT, 6_000, ctx);
    expect(validatePosition(position, CAMERA_KIT)).toHaveLength(0);
  });

  it('нулевое количество — ошибка, а не предупреждение', () => {
    const position = { ...createPosition(CAMERA, CAMERA_KIT, 6_000, ctx), qty: 0 };
    const issues = validatePosition(position, CAMERA_KIT);

    expect(issues[0]!.level).toBe('error');
  });
});
