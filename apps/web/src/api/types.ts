/**
 * Формы ответов API.
 *
 * Доменные типы (ItemKind, Unit, Role, EstimateTotals…) берём из @yaspectr/core —
 * из того же пакета, которым сервер их и считает. Дублировать их здесь значило бы
 * заводить вторую версию правды, которая начнёт расходиться на первой же правке.
 */

import type {
  ActStatus,
  EstimateMode,
  EstimateStatus,
  EstimateTotals,
  ItemKind,
  PositionGroup,
  Role,
  Unit,
  VatMode,
} from '@yaspectr/core';

export interface CurrentUser {
  id: string;
  companyId: string;
  email: string;
  fullName: string;
  role: Role;
}

export interface AuthResponse {
  user: CurrentUser;
  csrfToken: string | null;
}

export interface CatalogItem {
  id: string;
  sku: string | null;
  name: string;
  kind: ItemKind;
  unit: Unit;
  /** Идентификатор из CATALOG_ICONS. Выбирает пользователь. */
  icon: string | null;
  materialPrice: number;
  laborPrice: number;
  /** Отсутствует, если у роли нет права costPrice:read — сервер его вырезает. */
  costPrice?: number | null;
  categoryId: string | null;
  isActive: boolean;
}

export interface CatalogCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

export interface EstimateLine {
  id: string;
  catalogItemId: string | null;
  kitLineId: string | null;
  name: string;
  kind: ItemKind;
  unit: Unit;
  qty: number;
  unitMaterialPrice: number;
  unitLaborPrice: number;
  isEnabled: boolean;
  isManual: boolean;
  note: string | null;
  sortOrder: number;
}

export interface EstimatePosition {
  id: string;
  catalogItemId: string | null;
  kitTemplateId: string | null;
  name: string;
  kind: ItemKind;
  /** Снимок иконки на момент добавления позиции. */
  icon: string | null;
  unit: Unit;
  qty: number;
  unitMaterialPrice: number;
  unitLaborPrice: number;
  isEnabled: boolean;
  sortOrder: number;
  lines: EstimateLine[];
}

export interface Estimate {
  id: string;
  number: string;
  title: string;
  status: EstimateStatus;
  mode: EstimateMode;
  clientName: string | null;
  clientPhone: string | null;
  siteAddress: string | null;
  note: string | null;
  discountBp: number;
  vatMode: VatMode;
  vatRateBp: number;
  createdAt: string;
  updatedAt: string;
  positions: EstimatePosition[];
  totals: EstimateTotals;
  groups: PositionGroup[];
}

export interface EstimateListItem {
  id: string;
  number: string;
  title: string;
  status: EstimateStatus;
  mode: EstimateMode;
  clientName: string | null;
  siteAddress: string | null;
  grandTotal: number;
  updatedAt: string;
}

/** Отчёт о пересчёте позиции — что обновилось, что осталось ручным. */
export interface ResyncChange {
  type: 'qty-updated' | 'line-added' | 'line-orphaned' | 'line-kept-manual';
  lineId: string;
  name: string;
  fromQty?: number;
  toQty?: number;
}

export interface EstimateWithChanges extends Estimate {
  changes?: ResyncChange[];
}

export interface WorkActItem {
  id: string;
  estimateLineId: string | null;
  name: string;
  unit: Unit;
  qtyPlanned: number;
  qtyDone: number;
  isDone: boolean;
  doneAt: string | null;
  isChecked: boolean;
  checkedAt: string | null;
  note: string | null;
  sortOrder: number;
}

export interface WorkAct {
  id: string;
  number: string;
  status: ActStatus;
  siteAddress: string;
  clientName: string | null;
  installerUserId: string | null;
  installerName: string;
  workDate: string;
  estimateId: string | null;
  sentToChatAt: string | null;
  items: WorkActItem[];
}

export interface WorkActListItem extends Omit<WorkAct, 'items'> {
  _count: { items: number };
}

export interface KitLine {
  id: string;
  itemId: string;
  qtyMode: 'PER_ROOT' | 'FIXED';
  qtyPerRoot: number;
  minPerRoot: number | null;
  maxPerRoot: number | null;
  isOptional: boolean;
  isDefaultEnabled: boolean;
  sortOrder: number;
  item: CatalogItem;
}

export interface KitTemplate {
  id: string;
  name: string;
  rootItemId: string;
  isDefault: boolean;
  isActive: boolean;
  rootItem: CatalogItem;
  lines: KitLine[];
}

export interface CompanyUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
