import { describe, expect, it } from 'vitest';
import {
  CATALOG_ICONS,
  CATALOG_ICON_IDS,
  ICON_GROUPS,
  ICON_GROUP_LABELS,
  findIcon,
  isCatalogIcon,
  suggestIcon,
} from './icons.js';

describe('реестр иконок', () => {
  it('идентификаторы уникальны', () => {
    // Дубль id означал бы, что одна из двух иконок недостижима, и заметили
    // бы это только по «почему-то не та картинка» через полгода.
    expect(new Set(CATALOG_ICON_IDS).size).toBe(CATALOG_ICON_IDS.length);
  });

  it('идентификаторы безопасны для разметки и URL', () => {
    // Значение попадает в атрибуты и ключи React — никаких пробелов и кавычек.
    for (const id of CATALOG_ICON_IDS) {
      expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('у каждой иконки известная группа и непустая подпись', () => {
    for (const icon of CATALOG_ICONS) {
      expect(ICON_GROUPS).toContain(icon.group);
      expect(icon.label.trim().length).toBeGreaterThan(0);
      expect(icon.keywords.length).toBeGreaterThan(0);
    }
  });

  it('у каждой группы есть подпись', () => {
    for (const group of ICON_GROUPS) {
      expect(ICON_GROUP_LABELS[group]).toBeTruthy();
    }
  });

  it('покрывает основные разделы слаботочки', () => {
    const groups = new Set(CATALOG_ICONS.map((i) => i.group));
    for (const required of ['video', 'access', 'intercom', 'alarm', 'network', 'cable', 'work']) {
      expect(groups).toContain(required);
    }
  });
});

describe('isCatalogIcon', () => {
  it('признаёт известные значения', () => {
    expect(isCatalogIcon('camera-dome')).toBe(true);
    expect(isCatalogIcon('siren')).toBe(true);
  });

  it('отвергает посторонние', () => {
    expect(isCatalogIcon('нет-такой')).toBe(false);
    expect(isCatalogIcon('')).toBe(false);
    expect(isCatalogIcon('<script>')).toBe(false);
  });
});

describe('findIcon', () => {
  it('находит по id', () => {
    expect(findIcon('nvr')?.label).toBe('Видеорегистратор');
  });

  it('возвращает null на пустое и неизвестное', () => {
    expect(findIcon(null)).toBeNull();
    expect(findIcon(undefined)).toBeNull();
    expect(findIcon('нет-такой')).toBeNull();
  });
});

describe('suggestIcon', () => {
  it.each([
    ['IP камера 4 Мп', 'EQUIPMENT'],
    ['Сетевой регистратор, 8 каналов', 'EQUIPMENT'],
    ['Датчик движения', 'EQUIPMENT'],
    ['Кабель UTP cat.5e', 'CABLE'],
    ['Монтаж камеры', 'LABOR'],
  ])('для «%s» подбирает существующую иконку', (name, kind) => {
    const suggested = suggestIcon(name, kind);
    expect(isCatalogIcon(suggested)).toBe(true);
  });

  it('на незнакомое название даёт нейтральный значок, а не пустоту', () => {
    expect(suggestIcon('Нечто невиданное', 'MATERIAL')).toBe('box');
  });

  it('кабель без совпадений по словам всё равно получает кабельный значок', () => {
    expect(suggestIcon('Провод особый', 'CABLE')).toBe('cable-coil');
  });

  it('срабатывает по первому совпадению в порядке реестра', () => {
    // Приоритет задаётся порядком CATALOG_ICONS, а не «умностью» разбора:
    // в названии с несколькими знакомыми словами выигрывает то, что выше
    // в списке. Это и есть причина, по которой подсказка не может быть
    // источником истины — окончательный выбор делает человек в форме.
    expect(suggestIcon('Кронштейн настенный', 'MATERIAL')).toBe('bracket');
    expect(suggestIcon('Камера на кронштейне', 'EQUIPMENT')).toBe('camera-bullet');
  });
});
