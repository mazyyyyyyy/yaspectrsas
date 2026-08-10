import { describe, expect, it } from 'vitest';
import {
  MoneyError,
  formatMoney,
  formatQty,
  mulQty,
  mulQtyByQty,
  parseMoney,
  parseQty,
  percentOf,
  roundHalfAwayFromZero,
  vatIncludedIn,
} from './money.js';

/**
 * Неразрывный пробел U+00A0 — именно его ставит форматтер как разделитель
 * разрядов и перед «₽». Пишем константой, а не символом в литерале: обычный
 * и неразрывный пробел в исходнике неотличимы глазом, и тест, падающий на
 * «120 600 ₽» против «120 600 ₽», отнимает полчаса на ровном месте.
 */
const NBSP = ' ';

describe('roundHalfAwayFromZero', () => {
  it('округляет половину от нуля в обе стороны', () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(roundHalfAwayFromZero(2.4)).toBe(2);
    expect(roundHalfAwayFromZero(-2.4)).toBe(-2);
  });

  it('отличается от Math.round на отрицательной половине', () => {
    expect(Math.round(-2.5)).toBe(-2);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
  });
});

describe('mulQty', () => {
  it('считает целые количества точно', () => {
    // 20 100 ₽ × 6 шт
    expect(mulQty(2_010_000, 6_000)).toBe(12_060_000);
  });

  it('считает дробные метры кабеля', () => {
    // 45 ₽/м × 180,5 м = 8 122,50 ₽
    expect(mulQty(4_500, 180_500)).toBe(812_250);
  });

  it('не теряет точность там, где её теряет float', () => {
    // 0,1 ₽ × 3 = 0,30 ₽ ровно; наивное 0.1*3 дало бы 0.30000000000000004
    expect(mulQty(10, 3_000)).toBe(30);
  });

  it('выдерживает большие, но реальные величины', () => {
    // 5 000 ₽/м × 20 000 м
    expect(mulQty(500_000, 20_000_000)).toBe(10_000_000_000);
  });

  it('отвергает дробные копейки', () => {
    expect(() => mulQty(100.5, 1_000)).toThrow(MoneyError);
  });

  it('отвергает выход за предел', () => {
    expect(() => mulQty(2_000_000_000, 1_000)).toThrow(MoneyError);
  });
});

describe('mulQtyByQty', () => {
  it('умножает норму на количество позиций: 30 м × 6 камер = 180 м', () => {
    expect(mulQtyByQty(30_000, 6_000)).toBe(180_000);
  });

  it('работает с дробной нормой: 2,5 ч × 3 = 7,5 ч', () => {
    expect(mulQtyByQty(2_500, 3_000)).toBe(7_500);
  });
});

describe('percentOf', () => {
  it('считает скидку 10 % от 190 000 ₽', () => {
    expect(percentOf(19_000_000, 1_000)).toBe(1_900_000);
  });

  it('поддерживает дробный процент 12,5 %', () => {
    expect(percentOf(19_000_000, 1_250)).toBe(2_375_000);
  });

  it('нулевой процент даёт ноль', () => {
    expect(percentOf(19_000_000, 0)).toBe(0);
  });
});

describe('vatIncludedIn', () => {
  it('выделяет НДС 20 % из суммы 120 ₽ → 20 ₽', () => {
    expect(vatIncludedIn(12_000, 2_000)).toBe(2_000);
  });

  it('нулевая ставка даёт ноль', () => {
    expect(vatIncludedIn(12_000, 0)).toBe(0);
  });
});

describe('parseMoney', () => {
  it.each([
    ['20100', 2_010_000],
    ['20 100', 2_010_000],
    ['20 100,50', 2_010_050],
    ['20100.5', 2_010_050],
    ['20 100 ₽', 2_010_000],
    ['1 234,5 руб', 123_450],
    ['0', 0],
  ])('разбирает %s', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it('разбирает собственный форматированный вывод', () => {
    // Пользователь копирует «120 600 ₽» из сметы и вставляет в поле цены —
    // это должно работать, включая неразрывные пробелы.
    expect(parseMoney(formatMoney(2_010_000))).toBe(2_010_000);
    expect(parseMoney(formatMoney(812_250))).toBe(812_250);
  });

  it.each(['', 'abc', '—', '1.2.3', '₽'])('отвергает %s', (input) => {
    expect(parseMoney(input)).toBeNull();
  });

  it('отвергает нереально большую сумму', () => {
    expect(parseMoney('99999999999')).toBeNull();
  });
});

describe('parseQty', () => {
  it.each([
    ['6', 6_000],
    ['1,5', 1_500],
    ['30 м', 30_000],
    ['6 шт', 6_000],
    ['180.5', 180_500],
  ])('разбирает %s', (input, expected) => {
    expect(parseQty(input)).toBe(expected);
  });

  it('разбирает собственный форматированный вывод', () => {
    expect(parseQty(formatQty(180_500, 'м'))).toBe(180_500);
  });

  it.each(['', 'много', '--'])('отвергает %s', (input) => {
    expect(parseQty(input)).toBeNull();
  });
});

describe('formatMoney', () => {
  it('прячет нулевые копейки', () => {
    expect(formatMoney(12_060_000)).toBe(`120${NBSP}600${NBSP}₽`);
  });

  it('показывает ненулевые копейки', () => {
    expect(formatMoney(812_250)).toBe(`8${NBSP}122,50${NBSP}₽`);
  });

  it('может показать копейки принудительно', () => {
    expect(formatMoney(12_060_000, { forceKopecks: true })).toBe(`120${NBSP}600,00${NBSP}₽`);
  });

  it('умеет без символа валюты', () => {
    expect(formatMoney(12_060_000, { currency: false })).toBe(`120${NBSP}600`);
  });

  it('ставит настоящий минус, а не дефис', () => {
    expect(formatMoney(-1_900_000)).toBe(`−19${NBSP}000${NBSP}₽`);
  });

  it('группирует разряды неразрывным пробелом', () => {
    // Иначе «120 600 ₽» разорвётся на переносе строки в PDF.
    expect(formatMoney(12_060_000)).toContain(NBSP);
    expect(formatMoney(12_060_000)).not.toContain(' ');
  });
});

describe('formatQty', () => {
  it.each([
    [6_000, undefined, '6'],
    [1_500, undefined, '1,5'],
    [180_500, 'м', `180,5${NBSP}м`],
    [6_000, 'шт.', `6${NBSP}шт.`],
    [1_250, undefined, '1,25'],
  ])('форматирует %i', (qty, unit, expected) => {
    expect(formatQty(qty, unit)).toBe(expected);
  });
});
