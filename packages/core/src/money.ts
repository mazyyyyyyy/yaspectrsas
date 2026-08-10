/**
 * Деньги и количества.
 *
 * Два правила, которые нельзя нарушать:
 *   1. Деньги — целые копейки. Никаких float: 0.1 + 0.2 !== 0.3, и смета
 *      на 190 000 ₽ разъедется с суммой своих строк на копейки, а клиент
 *      это заметит.
 *   2. Количества — целые тысячные (QtyMilli). 1,5 м = 1500. Кабель меряют
 *      дробными метрами, часы работ — дробными часами, поэтому целых единиц
 *      не хватает, а float здесь так же опасен, как в деньгах.
 */

/** Целые копейки. 20 100,50 ₽ = 2010050. */
export type Kopecks = number;

/** Количество в тысячных долях единицы. 1,5 м = 1500, 6 шт = 6000. */
export type QtyMilli = number;

/** Доля в базисных пунктах: 1 bp = 0,01 %. 10 % = 1000, 12,5 % = 1250. */
export type BasisPoints = number;

/**
 * Границы, за которыми умножение перестаёт быть точным в double.
 * Произведение цены на целую часть количества не должно вылезать за
 * Number.MAX_SAFE_INTEGER (9,007e15) — отсюда и потолки.
 */
export const MAX_KOPECKS: Kopecks = 1_000_000_000; // 10 млн ₽ за единицу
export const MAX_QTY_MILLI: QtyMilli = 100_000_000; // 100 000 единиц
export const MAX_BP: BasisPoints = 1_000_000; // 10 000 %

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

function assertSafeInt(value: number, max: number, what: string): void {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${what}: ожидалось целое число, получено ${value}`);
  }
  if (Math.abs(value) > max) {
    throw new MoneyError(`${what}: значение ${value} выходит за предел ±${max}`);
  }
}

export function assertKopecks(value: number, what = 'сумма'): asserts value is Kopecks {
  assertSafeInt(value, MAX_KOPECKS, what);
}

export function assertQtyMilli(value: number, what = 'количество'): asserts value is QtyMilli {
  assertSafeInt(value, MAX_QTY_MILLI, what);
}

/**
 * Округление «половина от нуля» — то, как округляет бухгалтерия:
 * 2,5 → 3 и −2,5 → −3. Math.round этого не делает (−2,5 → −2).
 */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Цена за единицу × количество → сумма строки.
 *
 * Считаем целую и дробную часть количества раздельно: произведение
 * price × qtyMilli напрямую (до 1e9 × 1e8 = 1e17) уже выходит за пределы
 * точности double, а price × целые_единицы и price × остаток — нет.
 */
export function mulQty(price: Kopecks, qty: QtyMilli): Kopecks {
  assertKopecks(price, 'цена за единицу');
  assertQtyMilli(qty, 'количество');

  const whole = Math.trunc(qty / 1000);
  const frac = qty - whole * 1000;

  const wholePart = price * whole;
  if (!Number.isSafeInteger(wholePart)) {
    throw new MoneyError(`переполнение при умножении ${price} на ${qty / 1000}`);
  }
  const fracPart = roundHalfAwayFromZero((price * frac) / 1000);

  return wholePart + fracPart;
}

/** Перемножение двух количеств: 30 м/камеру × 6 камер = 180 м. */
export function mulQtyByQty(a: QtyMilli, b: QtyMilli): QtyMilli {
  assertQtyMilli(a, 'количество A');
  assertQtyMilli(b, 'количество B');

  const whole = Math.trunc(b / 1000);
  const frac = b - whole * 1000;

  const result = a * whole + roundHalfAwayFromZero((a * frac) / 1000);
  assertQtyMilli(result, 'результат умножения количеств');
  return result;
}

/** Доля от суммы: percentOf(190_000_00, 1000) = 10 % = 19_000_00. */
export function percentOf(amount: Kopecks, bp: BasisPoints): Kopecks {
  assertKopecks(amount, 'база для процента');
  assertSafeInt(bp, MAX_BP, 'процент');
  return roundHalfAwayFromZero((amount * bp) / 10_000);
}

/**
 * НДС «в том числе» — выделение налога из суммы, которая его уже содержит.
 * При 20 %: vat = amount × 20 / 120.
 */
export function vatIncludedIn(amount: Kopecks, rateBp: BasisPoints): Kopecks {
  assertKopecks(amount, 'сумма с НДС');
  assertSafeInt(rateBp, MAX_BP, 'ставка НДС');
  if (rateBp === 0) return 0;
  return roundHalfAwayFromZero((amount * rateBp) / (10_000 + rateBp));
}

export function percentToBp(percent: number): BasisPoints {
  return roundHalfAwayFromZero(percent * 100);
}

export function bpToPercent(bp: BasisPoints): number {
  return bp / 100;
}

export function qtyFromNumber(qty: number): QtyMilli {
  return roundHalfAwayFromZero(qty * 1000);
}

export function qtyToNumber(qty: QtyMilli): number {
  return qty / 1000;
}

export function rublesToKopecks(rubles: number): Kopecks {
  return roundHalfAwayFromZero(rubles * 100);
}

/**
 * Разбор денег из пользовательского ввода: «20 100,50», «20100.5»,
 * «20 100 ₽», «1 234,5 руб» → копейки. Возвращает null, если ввод
 * не похож на число — вызывающий решает, что показать пользователю.
 */
export function parseMoney(input: string | number): Kopecks | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? rublesToKopecks(input) : null;
  }

  // Выкидываем пробелы (в т.ч. неразрывные и узкие), символы валюты и «руб».
  const cleaned = input
    .replace(/[\s   ]/g, '')
    .replace(/[₽]|руб\.?|р\.?$/giu, '')
    .replace(',', '.')
    .trim();

  if (cleaned === '' || !/^-?\d*\.?\d*$/.test(cleaned) || !/\d/.test(cleaned)) {
    return null;
  }

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;

  const kopecks = rublesToKopecks(value);
  return Math.abs(kopecks) > MAX_KOPECKS ? null : kopecks;
}

/** Разбор количества: «1,5», «30 м», «6 шт» → QtyMilli. */
export function parseQty(input: string | number): QtyMilli | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? qtyFromNumber(input) : null;
  }

  const cleaned = input
    .replace(/[\s   ]/g, '')
    .replace(/(м|шт\.?|компл\.?|ч|км)$/giu, '')
    .replace(',', '.')
    .trim();

  if (cleaned === '' || !/^-?\d*\.?\d*$/.test(cleaned) || !/\d/.test(cleaned)) {
    return null;
  }

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;

  const qty = qtyFromNumber(value);
  return Math.abs(qty) > MAX_QTY_MILLI ? null : qty;
}

const RU_GROUP_SEPARATOR = ' '; // неразрывный пробел: «120 600 ₽» не рвётся на переносе

/**
 * Форматирование денег для показа.
 * По умолчанию копейки скрываются, если их нет: «120 600 ₽», но «120 600,50 ₽».
 */
export function formatMoney(
  kopecks: Kopecks,
  options: { currency?: boolean; forceKopecks?: boolean } = {},
): string {
  const { currency = true, forceKopecks = false } = options;

  const negative = kopecks < 0;
  const abs = Math.abs(kopecks);
  const rubles = Math.trunc(abs / 100);
  const cents = abs % 100;

  const grouped = String(rubles).replace(/\B(?=(\d{3})+(?!\d))/g, RU_GROUP_SEPARATOR);
  const showCents = forceKopecks || cents !== 0;

  let out = grouped;
  if (showCents) out += ',' + String(cents).padStart(2, '0');
  if (negative) out = '−' + out; // минус, а не дефис
  if (currency) out += RU_GROUP_SEPARATOR + '₽';

  return out;
}

/** Форматирование количества: 6000 → «6», 1500 → «1,5», 180 500 → «180,5». */
export function formatQty(qty: QtyMilli, unitLabel?: string): string {
  const negative = qty < 0;
  const abs = Math.abs(qty);
  const whole = Math.trunc(abs / 1000);
  const frac = abs % 1000;

  let out = String(whole);
  if (frac !== 0) {
    out += ',' + String(frac).padStart(3, '0').replace(/0+$/, '');
  }
  if (negative) out = '−' + out;
  if (unitLabel) out += RU_GROUP_SEPARATOR + unitLabel;

  return out;
}
