/**
 * @yaspectr/core — ядро предметной области.
 *
 * Один пакет, который импортируют и apps/api, и apps/web. Здесь нет ни
 * обращений к БД, ни HTTP, ни браузерных API — только типы, схемы и чистые
 * функции расчёта. Благодаря этому «экспресс-расчёт», «детальная смета»
 * и выгруженный клиенту PDF считаются одним и тем же кодом.
 */

export * from './money.js';
export * from './domain.js';
export * from './icons.js';
export * from './compute.js';
export * from './expand.js';
export * from './schema.js';
