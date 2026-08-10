/**
 * Домен: справочник, шаблоны комплектов, смета, акт.
 *
 * Это те самые «позиция → шаблон комплекта» из ТЗ. Ключевая идея —
 * у каждой строки справочника ДВЕ цены: за материал и за работу.
 * Кабель тогда перестаёт быть особым случаем: «цена за метр (материал)»
 * и «цена за метр (прокладка)» — это просто materialPrice и laborPrice
 * одной и той же позиции с единицей измерения «м».
 */

import type { BasisPoints, Kopecks, QtyMilli } from './money.js';

// ─────────────────────────────────────────────────────────────
// Справочники
// ─────────────────────────────────────────────────────────────

export const UNITS = ['PCS', 'M', 'SET', 'HOUR'] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABELS: Record<Unit, string> = {
  PCS: 'шт.',
  M: 'м',
  SET: 'компл.',
  HOUR: 'ч',
};

export const ITEM_KINDS = ['EQUIPMENT', 'MATERIAL', 'LABOR', 'CABLE'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  EQUIPMENT: 'Оборудование',
  MATERIAL: 'Материал',
  LABOR: 'Работа',
  CABLE: 'Кабель',
};

/**
 * Позиция справочника.
 *
 * materialPrice / laborPrice — цены за ОДНУ единицу measure. Обе могут быть
 * заданы одновременно: у кабеля это стоимость метра кабеля и стоимость
 * прокладки метра; у камеры — стоимость камеры и, если так удобнее,
 * стоимость её монтажа.
 */
export interface CatalogItem {
  id: string;
  companyId: string;
  sku: string | null;
  name: string;
  kind: ItemKind;
  unit: Unit;
  /** Идентификатор из CATALOG_ICONS. Выбирает пользователь. */
  icon: string | null;
  materialPrice: Kopecks;
  laborPrice: Kopecks;
  /** Закупочная цена. Видна только ADMIN/MANAGER, монтажнику — никогда. */
  costPrice: Kopecks | null;
  categoryId: string | null;
  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────
// Шаблоны комплектов
// ─────────────────────────────────────────────────────────────

export const QTY_MODES = ['PER_ROOT', 'FIXED'] as const;
export type QtyMode = (typeof QTY_MODES)[number];

/**
 * Строка шаблона комплекта.
 *
 * PER_ROOT — количество умножается на количество базовых позиций.
 *   «6 камер» → 6 юстировок (qtyPerRoot = 1 шт) и 180 м кабеля
 *   (qtyPerRoot = 30 м).
 * FIXED — количество не зависит от базовой позиции: один телеком-бокс
 *   на весь комплект, сколько бы камер ни было.
 */
export interface KitLine {
  id: string;
  itemId: string;
  qtyMode: QtyMode;
  qtyPerRoot: QtyMilli;
  /** Диапазон для подсказки в UI (кабель по умолчанию 30–50 м на точку). */
  minPerRoot: QtyMilli | null;
  maxPerRoot: QtyMilli | null;
  /** Необязательная строка: показываем, но по умолчанию можем не включать. */
  isOptional: boolean;
  isDefaultEnabled: boolean;
  sortOrder: number;
}

/** Шаблон: «если монтаж камеры, то сразу юстировка + распред. коробка». */
export interface KitTemplate {
  id: string;
  companyId: string;
  name: string;
  /** Базовая позиция справочника, к которой привязан комплект. */
  rootItemId: string;
  isActive: boolean;
  lines: KitLine[];
}

// ─────────────────────────────────────────────────────────────
// Смета
// ─────────────────────────────────────────────────────────────

export const ESTIMATE_MODES = ['EXPRESS', 'DETAILED'] as const;
/**
 * Режим — это ТОЛЬКО способ показа одних и тех же данных, как в ТЗ:
 * свёрнутый и развёрнутый вид. На расчёт он не влияет никак, поэтому
 * экспресс-сумма и детальная смета совпадают до копейки по построению.
 */
export type EstimateMode = (typeof ESTIMATE_MODES)[number];

export const ESTIMATE_STATUSES = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'ARCHIVED'] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const VAT_MODES = ['NONE', 'ADDED', 'INCLUDED'] as const;
/**
 * NONE     — без НДС (УСН), самый частый случай для монтажников.
 * ADDED    — НДС сверху: итог = сумма + НДС.
 * INCLUDED — НДС в том числе: итог = сумма, налог выделяется из неё.
 */
export type VatMode = (typeof VAT_MODES)[number];

/**
 * Строка сметы — развёрнутый комплект.
 *
 * Цены здесь — СНИМОК справочника на момент добавления позиции. Если завтра
 * поставщик поднимет цену на кабель, уже отправленная клиенту смета не должна
 * измениться задним числом. Пересчёт по актуальным ценам — только явным
 * действием пользователя (resyncPosition).
 */
export interface EstimateLine {
  id: string;
  catalogItemId: string | null;
  kitLineId: string | null;
  name: string;
  kind: ItemKind;
  unit: Unit;
  /** Абсолютное количество, уже умноженное на количество базовых позиций. */
  qty: QtyMilli;
  unitMaterialPrice: Kopecks;
  unitLaborPrice: Kopecks;
  isEnabled: boolean;
  /** Правил руками — пересчёт по шаблону такую строку не тронет. */
  isManual: boolean;
  note: string | null;
  sortOrder: number;
}

export interface EstimatePosition {
  id: string;
  catalogItemId: string | null;
  kitTemplateId: string | null;
  name: string;
  /**
   * Тип позиции — снимок, как и цены. Позицию справочника могут переименовать,
   * перевести в другой тип или удалить; смета от этого меняться не должна,
   * а разбивка по типам в уже выставленном документе — тем более.
   */
  kind: ItemKind;
  /** Снимок иконки — по той же причине, что и kind. */
  icon: string | null;
  unit: Unit;
  /** Количество базовых позиций: 6 камер. */
  qty: QtyMilli;
  unitMaterialPrice: Kopecks;
  unitLaborPrice: Kopecks;
  isEnabled: boolean;
  sortOrder: number;
  lines: EstimateLine[];
}

export interface Estimate {
  id: string;
  companyId: string;
  number: string;
  status: EstimateStatus;
  mode: EstimateMode;
  title: string;
  clientName: string | null;
  clientPhone: string | null;
  siteAddress: string | null;
  discountBp: BasisPoints;
  vatMode: VatMode;
  vatRateBp: BasisPoints;
  note: string | null;
  positions: EstimatePosition[];
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// Акт выполненных работ
// ─────────────────────────────────────────────────────────────

export const ACT_STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'SENT'] as const;
export type ActStatus = (typeof ACT_STATUSES)[number];

/**
 * Пункт чек-листа монтажника. Две независимые галочки, как в ТЗ:
 * «выполнено» ставит монтажник, «проверено» — старший.
 */
export interface WorkActItem {
  id: string;
  estimateLineId: string | null;
  name: string;
  unit: Unit;
  qtyPlanned: QtyMilli;
  qtyDone: QtyMilli;
  isDone: boolean;
  doneAt: string | null;
  isChecked: boolean;
  checkedAt: string | null;
  checkedByUserId: string | null;
  note: string | null;
  sortOrder: number;
}

export interface WorkAct {
  id: string;
  companyId: string;
  estimateId: string | null;
  number: string;
  status: ActStatus;
  siteAddress: string;
  clientName: string | null;
  installerUserId: string | null;
  installerName: string;
  workDate: string;
  items: WorkActItem[];
  sentToChatAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// Пользователи и права
// ─────────────────────────────────────────────────────────────

export const ROLES = ['ADMIN', 'MANAGER', 'INSTALLER'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  INSTALLER: 'Монтажник',
};

/**
 * Что кому можно. Держим таблицей, а не россыпью if-ов по коду:
 * права легко проверить глазами и легко покрыть тестом.
 *
 * Главное здесь — costPrice:read. Монтажник видит смету объекта, но
 * закупочные цены ему не показываются никогда.
 */
export const PERMISSIONS = {
  ADMIN: [
    'catalog:read', 'catalog:write',
    'kit:read', 'kit:write',
    'estimate:read', 'estimate:write', 'estimate:delete',
    'act:read', 'act:write',
    'costPrice:read',
    'user:read', 'user:write',
    'company:write',
  ],
  MANAGER: [
    'catalog:read',
    'kit:read',
    'estimate:read', 'estimate:write',
    'act:read', 'act:write',
    'costPrice:read',
  ],
  INSTALLER: [
    'catalog:read',
    'kit:read',
    'estimate:read',
    'act:read', 'act:write',
  ],
} as const satisfies Record<Role, readonly string[]>;

export type Permission = (typeof PERMISSIONS)[Role][number];

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[role] as readonly string[]).includes(permission);
}
