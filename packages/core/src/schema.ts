/**
 * Zod-схемы — единственный источник правды о форме данных.
 *
 * Их использует и API (валидация каждого входящего запроса), и фронт
 * (валидация форм до отправки). Схема одна, значит правила совпадают,
 * и фронт не может «разрешить» то, что бэк потом молча отвергнет.
 *
 * Всё, что приходит снаружи, проходит через эти схемы. Ничего не парсим
 * вручную и не доверяем клиенту: .strict() на объектах отсекает лишние
 * поля, чтобы нельзя было дописать, скажем, companyId в теле запроса.
 */

import { z } from 'zod';
import {
  ACT_STATUSES,
  ESTIMATE_MODES,
  ESTIMATE_STATUSES,
  ITEM_KINDS,
  QTY_MODES,
  ROLES,
  UNITS,
  VAT_MODES,
} from './domain.js';
import { isCatalogIcon } from './icons.js';
import { MAX_KOPECKS, MAX_QTY_MILLI } from './money.js';

// ─────────────────────────────────────────────────────────────
// Примитивы
// ─────────────────────────────────────────────────────────────

export const zId = z.string().uuid('некорректный идентификатор');

export const zKopecks = z
  .number()
  .int('сумма должна быть в целых копейках')
  .min(0, 'сумма не может быть отрицательной')
  .max(MAX_KOPECKS, 'слишком большая сумма');

export const zQtyMilli = z
  .number()
  .int('количество должно быть в целых тысячных')
  .min(0, 'количество не может быть отрицательным')
  .max(MAX_QTY_MILLI, 'слишком большое количество');

export const zPositiveQtyMilli = zQtyMilli.min(1, 'количество должно быть больше нуля');

export const zBasisPoints = z
  .number()
  .int()
  .min(0, 'процент не может быть отрицательным')
  .max(10_000, 'процент не может превышать 100 %');

/** Свободный текст от пользователя: обрезаем пробелы, ограничиваем длину. */
const zText = (max: number) => z.string().trim().max(max, `не длиннее ${max} символов`);

const zRequiredText = (max: number, label: string) =>
  zText(max).min(1, `${label}: обязательное поле`);

export const zUnit = z.enum(UNITS);
export const zItemKind = z.enum(ITEM_KINDS);
export const zQtyMode = z.enum(QTY_MODES);
export const zVatMode = z.enum(VAT_MODES);
export const zEstimateMode = z.enum(ESTIMATE_MODES);
export const zEstimateStatus = z.enum(ESTIMATE_STATUSES);
export const zActStatus = z.enum(ACT_STATUSES);
export const zRole = z.enum(ROLES);

/**
 * Российский телефон. Не нормализуем агрессивно — принимаем то, что человек
 * набрал, но отсекаем явный мусор. Хранить будем как есть: это персональные
 * данные, лишние преобразования только мешают.
 */
export const zPhone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s()-]{6,20}$/u, 'некорректный телефон')
  .nullable();

// ─────────────────────────────────────────────────────────────
// Аутентификация
// ─────────────────────────────────────────────────────────────

export const zEmail = z.string().trim().toLowerCase().email('некорректный email').max(254);

/**
 * Пароль. Минимум 12 символов — длина защищает лучше, чем требование
 * «одна заглавная и один спецсимвол», которое люди обходят через «Password1!».
 * Верхний предел стоит намеренно: argon2id от мегабайтного пароля считается
 * долго, и это превращается в способ положить сервер.
 */
export const zPassword = z
  .string()
  .min(12, 'пароль не короче 12 символов')
  .max(200, 'пароль не длиннее 200 символов');

export const loginSchema = z
  .object({
    email: zEmail,
    password: z.string().min(1, 'введите пароль').max(200),
  })
  .strict();

export const registerCompanySchema = z
  .object({
    companyName: zRequiredText(200, 'название компании'),
    email: zEmail,
    password: zPassword,
    fullName: zRequiredText(200, 'имя'),
  })
  .strict();

export const createUserSchema = z
  .object({
    email: zEmail,
    password: zPassword,
    fullName: zRequiredText(200, 'имя'),
    role: zRole,
    phone: zPhone.optional(),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: zPassword,
  })
  .strict();

// ─────────────────────────────────────────────────────────────
// Справочник
// ─────────────────────────────────────────────────────────────

/**
 * Идентификатор иконки проверяем по реестру, а не как произвольную строку:
 * значение приходит из выпадающего списка, и всё, чего в списке нет, —
 * это либо ошибка клиента, либо попытка подсунуть постороннее значение
 * в поле, которое потом окажется в атрибуте разметки.
 */
export const zCatalogIcon = z
  .string()
  .refine(isCatalogIcon, { message: 'неизвестная иконка' });

export const catalogItemInputSchema = z
  .object({
    sku: zText(64).nullable().optional(),
    name: zRequiredText(300, 'наименование'),
    kind: zItemKind,
    unit: zUnit,
    icon: zCatalogIcon.nullable().optional(),
    materialPrice: zKopecks.default(0),
    laborPrice: zKopecks.default(0),
    costPrice: zKopecks.nullable().optional(),
    categoryId: zId.nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine((v) => v.materialPrice > 0 || v.laborPrice > 0, {
    message: 'хотя бы одна из цен (материал или работа) должна быть больше нуля',
    path: ['materialPrice'],
  });

export const catalogItemPatchSchema = catalogItemInputSchema.innerType().partial().strict();

export const catalogCategorySchema = z
  .object({
    name: zRequiredText(200, 'название категории'),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict();

// ─────────────────────────────────────────────────────────────
// Шаблоны комплектов
// ─────────────────────────────────────────────────────────────

export const kitLineInputSchema = z
  .object({
    itemId: zId,
    qtyMode: zQtyMode.default('PER_ROOT'),
    qtyPerRoot: zPositiveQtyMilli,
    minPerRoot: zQtyMilli.nullable().optional(),
    maxPerRoot: zQtyMilli.nullable().optional(),
    isOptional: z.boolean().default(false),
    isDefaultEnabled: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict()
  .refine(
    (v) => v.minPerRoot == null || v.maxPerRoot == null || v.minPerRoot <= v.maxPerRoot,
    { message: 'минимум не может быть больше максимума', path: ['minPerRoot'] },
  );

export const kitTemplateInputSchema = z
  .object({
    name: zRequiredText(200, 'название комплекта'),
    rootItemId: zId,
    /**
     * Комплект, который подставляется сам при добавлении базовой позиции.
     * На одну позицию справочника такой может быть только один — это
     * обеспечивает сервис, а не схема.
     */
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
    lines: z.array(kitLineInputSchema).max(200, 'слишком много строк в комплекте'),
  })
  .strict();

export const kitTemplatePatchSchema = kitTemplateInputSchema.partial().strict();

// ─────────────────────────────────────────────────────────────
// Смета
// ─────────────────────────────────────────────────────────────

export const estimateLineInputSchema = z
  .object({
    id: zId.optional(),
    catalogItemId: zId.nullable().optional(),
    kitLineId: zId.nullable().optional(),
    name: zRequiredText(300, 'наименование строки'),
    kind: zItemKind,
    unit: zUnit,
    qty: zQtyMilli,
    unitMaterialPrice: zKopecks,
    unitLaborPrice: zKopecks,
    isEnabled: z.boolean().default(true),
    isManual: z.boolean().default(false),
    note: zText(1000).nullable().optional(),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict();

export const estimatePositionInputSchema = z
  .object({
    id: zId.optional(),
    catalogItemId: zId.nullable().optional(),
    kitTemplateId: zId.nullable().optional(),
    name: zRequiredText(300, 'наименование позиции'),
    kind: zItemKind,
    icon: zCatalogIcon.nullable().optional(),
    unit: zUnit,
    qty: zPositiveQtyMilli,
    unitMaterialPrice: zKopecks,
    unitLaborPrice: zKopecks,
    isEnabled: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(9999).default(0),
    lines: z.array(estimateLineInputSchema).max(500, 'слишком много строк в позиции'),
  })
  .strict();

export const estimateInputSchema = z
  .object({
    title: zRequiredText(300, 'название сметы'),
    mode: zEstimateMode.default('EXPRESS'),
    clientName: zText(300).nullable().optional(),
    clientPhone: zPhone.optional(),
    siteAddress: zText(500).nullable().optional(),
    discountBp: zBasisPoints.default(0),
    vatMode: zVatMode.default('NONE'),
    vatRateBp: zBasisPoints.default(2000),
    note: zText(5000).nullable().optional(),
    positions: z.array(estimatePositionInputSchema).max(300, 'слишком много позиций'),
  })
  .strict();

export const estimatePatchSchema = estimateInputSchema.partial().strict();

export const estimateStatusPatchSchema = z.object({ status: zEstimateStatus }).strict();

/** Быстрое добавление позиции из справочника — основной путь экспресс-режима. */
export const addPositionSchema = z
  .object({
    catalogItemId: zId,
    qty: zPositiveQtyMilli,
    /** Явный шаблон; если не передан, берётся комплект по умолчанию для позиции. */
    kitTemplateId: zId.nullable().optional(),
  })
  .strict();

export const resyncPositionSchema = z.object({ qty: zPositiveQtyMilli }).strict();

// ─────────────────────────────────────────────────────────────
// Акт выполненных работ
// ─────────────────────────────────────────────────────────────

export const workActItemInputSchema = z
  .object({
    id: zId.optional(),
    estimateLineId: zId.nullable().optional(),
    name: zRequiredText(300, 'наименование работы'),
    unit: zUnit,
    qtyPlanned: zQtyMilli,
    qtyDone: zQtyMilli.default(0),
    isDone: z.boolean().default(false),
    isChecked: z.boolean().default(false),
    note: zText(1000).nullable().optional(),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict();

export const workActInputSchema = z
  .object({
    estimateId: zId.nullable().optional(),
    siteAddress: zRequiredText(500, 'адрес объекта'),
    clientName: zText(300).nullable().optional(),
    installerUserId: zId.nullable().optional(),
    installerName: zRequiredText(200, 'имя монтажника'),
    workDate: z.string().date('некорректная дата'),
    items: z.array(workActItemInputSchema).max(500, 'слишком много пунктов'),
  })
  .strict();

export const workActPatchSchema = workActInputSchema.partial().strict();

/**
 * Создание акта из готовой сметы — основной путь: чек-лист собирается
 * из строк-работ, а не набивается руками заново.
 */
export const createActFromEstimateSchema = z
  .object({
    estimateId: zId,
    installerUserId: zId.nullable().optional(),
    installerName: zRequiredText(200, 'имя монтажника'),
    workDate: z.string().date('некорректная дата'),
    /** Включать ли в чек-лист материалы, а не только работы. */
    includeMaterials: z.boolean().default(false),
  })
  .strict();

/** Отметка пункта чек-листа — то, что монтажник жмёт на объекте. */
export const toggleActItemSchema = z
  .object({
    isDone: z.boolean().optional(),
    isChecked: z.boolean().optional(),
    qtyDone: zQtyMilli.optional(),
    note: zText(1000).nullable().optional(),
  })
  .strict();

export const sendActSchema = z
  .object({
    /** Куда отправлять. Разрешаем только заранее настроенные чаты компании. */
    chatBindingId: zId,
    comment: zText(1000).optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────
// Экспорт документов
// ─────────────────────────────────────────────────────────────

export const exportFormatSchema = z.enum(['pdf', 'docx']);

export const exportEstimateSchema = z
  .object({
    format: exportFormatSchema,
    /** Свёрнутый вид для клиента или полный «до винтика». */
    detail: z.enum(['summary', 'full']).default('full'),
    /** Прятать разбивку материал/работа — иногда просят «одной строкой». */
    hideBreakdown: z.boolean().default(false),
  })
  .strict();

// ─────────────────────────────────────────────────────────────
// Пагинация и поиск
// ─────────────────────────────────────────────────────────────

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(50),
    search: zText(200).optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────
// Выведенные типы
// ─────────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CatalogItemInput = z.infer<typeof catalogItemInputSchema>;
export type KitTemplateInput = z.infer<typeof kitTemplateInputSchema>;
export type KitLineInput = z.infer<typeof kitLineInputSchema>;
export type EstimateInput = z.infer<typeof estimateInputSchema>;
export type EstimatePositionInput = z.infer<typeof estimatePositionInputSchema>;
export type EstimateLineInput = z.infer<typeof estimateLineInputSchema>;
export type AddPositionInput = z.infer<typeof addPositionSchema>;
export type KitTemplatePatch = z.infer<typeof kitTemplatePatchSchema>;
export type CreateActFromEstimateInput = z.infer<typeof createActFromEstimateSchema>;
export type WorkActInput = z.infer<typeof workActInputSchema>;
export type WorkActItemInput = z.infer<typeof workActItemInputSchema>;
export type ToggleActItemInput = z.infer<typeof toggleActItemSchema>;
export type ExportEstimateInput = z.infer<typeof exportEstimateSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
