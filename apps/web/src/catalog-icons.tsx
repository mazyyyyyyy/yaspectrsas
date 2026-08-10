/**
 * Отрисовка иконок справочника.
 *
 * Один стиль на весь набор: сетка 24×24, обводка 1.6, скруглённые концы,
 * без заливок — иначе значки не встанут в один ряд и интерфейс развалится
 * на «разные картинки». Идентификаторы и подписи живут в @yaspectr/core,
 * здесь только формы.
 */

import type { ReactElement } from 'react';
import { CATALOG_ICONS } from '@yaspectr/core';

const S = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const ICON_PATHS: Record<string, ReactElement> = {
  // ── Видеонаблюдение ──
  'camera-bullet': (
    <>
      <path d="M3 8.6l13-3.6 1.8 5-13 3.6z" />
      <circle cx="9" cy="9.4" r="1.6" />
      <path d="M7.5 14.2V19h8" />
    </>
  ),
  'camera-dome': (
    <>
      <path d="M4 13a8 8 0 0 1 16 0z" />
      <path d="M3 13h18" />
      <circle cx="12" cy="10" r="2.2" />
      <path d="M12 15v4" />
    </>
  ),
  'camera-ptz': (
    <>
      <path d="M6 9.5h8l3 2.5-3 2.5H6z" />
      <circle cx="9.5" cy="12" r="1.6" />
      <path d="M12 17v3M8 20h8" />
      <path d="M5 5.5a9 9 0 0 1 14 0" />
    </>
  ),
  'camera-fisheye': (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 4v3.2M12 16.8V20M4 12h3.2M16.8 12H20" />
    </>
  ),
  nvr: (
    <>
      <rect x="2.5" y="8" width="19" height="8" rx="2" />
      <path d="M6 12h1.5M10 12h1.5" />
      <circle cx="18" cy="12" r="1" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16.5V20" />
    </>
  ),
  hdd: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="12" cy="12" r="0.8" />
    </>
  ),

  // ── Контроль доступа ──
  reader: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M9.5 8.5a4 4 0 0 1 0 5" />
      <path d="M12.5 6.5a7 7 0 0 1 0 9" />
    </>
  ),
  'lock-magnetic': (
    <>
      <rect x="4" y="4.5" width="16" height="5" rx="1" />
      <rect x="6" y="13" width="12" height="6.5" rx="1" />
      <path d="M12 9.5V13" />
    </>
  ),
  'lock-mech': (
    <>
      <rect x="4.5" y="9" width="15" height="10.5" rx="2" />
      <path d="M8 9V6.5a4 4 0 0 1 8 0V9" />
      <circle cx="12" cy="14" r="1.4" />
    </>
  ),
  turnstile: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9V4M15 12h5M12 15v5M9 12H4" />
      <path d="M4 20h16" />
    </>
  ),
  barrier: (
    <>
      <rect x="2.5" y="13" width="5" height="7" rx="1" />
      <path d="M7.5 10h14" />
      <path d="M11 10v3M15 10v3M19 10v3" />
      <path d="M5 13V9.5" />
    </>
  ),
  'exit-button': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 9.8v2.4" />
    </>
  ),
  'door-closer': (
    <>
      <rect x="3.5" y="3.5" width="8" height="17" rx="1" />
      <path d="M11.5 7h6a2 2 0 0 1 2 2v3" />
      <path d="M17 9.5l2.5 2.5L17 14.5" />
      <circle cx="9" cy="12" r="0.9" />
    </>
  ),
  'acs-controller': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9h4M7 12h6M7 15h3" />
      <circle cx="17" cy="9.5" r="1.2" />
    </>
  ),

  // ── Домофония ──
  'intercom-panel': (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2" />
      <circle cx="12" cy="7.5" r="1.7" />
      <path d="M9.5 12h5M9.5 15h5M9.5 18h2.5" />
    </>
  ),
  'intercom-monitor': (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <circle cx="12" cy="10.5" r="2.6" />
      <path d="M7 20h10" />
    </>
  ),
  'intercom-handset': (
    <>
      <path d="M5 4.5h4l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v4a1.5 1.5 0 0 1-1.6 1.5C10.4 20 4 13.6 3.5 6.1A1.5 1.5 0 0 1 5 4.5z" />
    </>
  ),

  // ── Охранно-пожарная ──
  'motion-sensor': (
    <>
      <path d="M5 4.5h14a1 1 0 0 1 1 1v5a8 8 0 0 1-16 0v-5a1 1 0 0 1 1-1z" />
      <path d="M9.5 15.5a5 5 0 0 0 5 0" />
      <path d="M12 18.5V21" />
    </>
  ),
  'smoke-detector': (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v1.6M12 18.4V20M4 12h1.6M18.4 12H20" />
    </>
  ),
  'heat-detector': (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8.5c1.8 1.6 2.6 3 2.6 4.2a2.6 2.6 0 0 1-5.2 0c0-1.2.8-2.6 2.6-4.2z" />
    </>
  ),
  'magnetic-contact': (
    <>
      <rect x="3.5" y="7" width="6.5" height="10" rx="1" />
      <rect x="14" y="7" width="6.5" height="10" rx="1" />
      <path d="M10 12h4" strokeDasharray="1.6 1.6" />
    </>
  ),
  'glass-break': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 4l7 7-3 4 4 2-2 3" />
      <path d="M11 11l9-5M11 11l6 9" />
    </>
  ),
  siren: (
    <>
      <path d="M7 17v-4a5 5 0 0 1 10 0v4z" />
      <path d="M5 17h14M10 20h4" />
      <path d="M12 4V2M6.5 6L5 4.5M17.5 6L19 4.5" />
    </>
  ),
  'alarm-panel': (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <rect x="6.5" y="7" width="11" height="4" rx="1" />
      <path d="M7 14.5h2M11 14.5h2M15 14.5h2M7 17.5h2M11 17.5h2M15 17.5h2" />
    </>
  ),
  'manual-call-point': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 10v2.5" />
      <path d="M8.5 15.5l-2 2M15.5 15.5l2 2" />
    </>
  ),
  'leak-sensor': (
    <>
      <path d="M12 3.5c3.2 3.8 5 6.4 5 8.6a5 5 0 0 1-10 0c0-2.2 1.8-4.8 5-8.6z" />
      <path d="M9.5 12.5a2.5 2.5 0 0 0 2.5 2.5" />
    </>
  ),

  // ── Сеть ──
  'wifi-ap': (
    <>
      <path d="M4 9.5a12 12 0 0 1 16 0" />
      <path d="M7 13a8 8 0 0 1 10 0" />
      <circle cx="12" cy="17.5" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  switch: (
    <>
      <rect x="2.5" y="8.5" width="19" height="7" rx="1.5" />
      <path d="M5.5 11.5v1M8 11.5v1M10.5 11.5v1M13 11.5v1M15.5 11.5v1M18 11.5v1" />
    </>
  ),
  router: (
    <>
      <rect x="3" y="12" width="18" height="7" rx="2" />
      <path d="M6.5 15.5h1M9.5 15.5h1" />
      <path d="M12 12V8M12 8l-2.5-2.5M12 8l2.5-2.5" />
    </>
  ),
  'patch-panel': (
    <>
      <rect x="2.5" y="7" width="19" height="10" rx="1.5" />
      <rect x="5" y="10" width="3" height="4" rx="0.5" />
      <rect x="10.5" y="10" width="3" height="4" rx="0.5" />
      <rect x="16" y="10" width="3" height="4" rx="0.5" />
    </>
  ),
  rack: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <rect x="7" y="6" width="10" height="3.5" rx="0.5" />
      <rect x="7" y="12" width="10" height="3.5" rx="0.5" />
      <path d="M7 19h4" />
    </>
  ),
  'poe-injector': (
    <>
      <rect x="3" y="8" width="18" height="8" rx="2" />
      <path d="M13 10l-2.5 3.5h3L11 17" />
      <path d="M6 12h2" />
    </>
  ),

  // ── Питание ──
  psu: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <path d="M13.5 9.5L10 13h3l-1 2.5" />
      <path d="M6 12h2" />
    </>
  ),
  ups: (
    <>
      <rect x="3" y="7.5" width="16" height="9" rx="1.5" />
      <path d="M19 10.5h2v3h-2" />
      <path d="M7 12h3M8.5 10.5v3M13 12h3" />
    </>
  ),
  breaker: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 7.5h6M9 12h6M9 16.5h6" />
      <path d="M12 5.5v4" />
    </>
  ),

  // ── Кабель и материалы ──
  'cable-coil': (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M19.5 12H22" />
    </>
  ),
  conduit: (
    <>
      <path d="M3 8.5h18v7H3z" />
      <path d="M7 8.5v7M11 8.5v7M15 8.5v7M19 8.5v7" />
    </>
  ),
  'cable-tray': (
    <>
      <path d="M3 6v12h18V6" />
      <path d="M3 18h18" />
      <path d="M8 6v12M13 6v12M18 6v12" strokeDasharray="2 2" />
    </>
  ),
  'junction-box': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3" />
    </>
  ),
  bracket: (
    <>
      <path d="M5 4v13a3 3 0 0 0 3 3h11" />
      <path d="M5 4h4M15 20v-4" />
      <circle cx="19" cy="20" r="0.9" />
    </>
  ),
  fastener: (
    <>
      <path d="M12 3.5v13" />
      <path d="M9 3.5h6" />
      <path d="M9.5 7h5M9.5 10h5M9.5 13h5" />
      <path d="M12 20.5l-2-4h4z" />
    </>
  ),
  'patch-cord': (
    <>
      <rect x="3" y="4" width="6" height="5" rx="1" />
      <rect x="15" y="15" width="6" height="5" rx="1" />
      <path d="M6 9c0 6 12 1 12 6" />
    </>
  ),
  rj45: (
    <>
      <path d="M6 4h12v9l-3 3v4H9v-4l-3-3z" />
      <path d="M9 6.5v3M12 6.5v3M15 6.5v3" />
    </>
  ),

  // ── Работы ──
  mount: (
    <>
      <path d="M14.5 3.5a4.5 4.5 0 0 0-5.6 5.9L3.5 14.8a2 2 0 0 0 2.8 2.8l5.4-5.4a4.5 4.5 0 0 0 5.9-5.6l-2.6 2.6-2.2-2.2z" />
      <path d="M14 14l5.5 5.5" />
    </>
  ),
  align: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  setup: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6" />
    </>
  ),
  commissioning: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12.3l2.7 2.7L16 9.5" />
    </>
  ),
  drilling: (
    <>
      <path d="M4 6.5h8v6H4z" />
      <path d="M12 8h4l4-2v6l-4-2h-4" />
      <path d="M6 12.5V19M4.5 19h3" />
    </>
  ),
  'cable-laying': (
    <>
      <path d="M3 17c3 0 3-10 6-10s3 10 6 10 3-6 6-6" />
      <circle cx="3" cy="17" r="1" fill="currentColor" stroke="none" />
      <circle cx="21" cy="11" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  trip: (
    <>
      <path d="M3 15.5V11l2-4h9l3 4h4v4.5" />
      <circle cx="7.5" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
      <path d="M9.5 17h5.5" />
    </>
  ),
  diagnostics: (
    <>
      <path d="M3 12h4l2-5 3 10 2.5-6 1.5 3h5" />
    </>
  ),

  // ── Прочее ──
  box: (
    <>
      <rect x="3.5" y="6" width="17" height="13" rx="2" />
      <path d="M3.5 10h17" />
    </>
  ),
};

/** Иконка по идентификатору. Неизвестный id — нейтральный значок, не пустота. */
export function CatalogIcon({ id, size = 16 }: { id: string | null | undefined; size?: number }) {
  const shape = (id && ICON_PATHS[id]) || ICON_PATHS['box'];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden="true">
      {shape}
    </svg>
  );
}

/**
 * Проверка целостности набора при загрузке модуля в разработке.
 *
 * Реестр в core и формы здесь — два файла, которые обязаны совпадать.
 * Молча отрисовать «коробку» вместо забытой иконки — значит узнать о
 * расхождении от пользователя, а не от сборки.
 */
if (import.meta.env.DEV) {
  const missing = CATALOG_ICONS.filter((icon) => !ICON_PATHS[icon.id]).map((icon) => icon.id);
  if (missing.length > 0) {
    console.error('[catalog-icons] нет форм для иконок:', missing.join(', '));
  }

  const ids = new Set(CATALOG_ICONS.map((icon) => icon.id));
  const extra = Object.keys(ICON_PATHS).filter((id) => !ids.has(id));
  if (extra.length > 0) {
    console.error('[catalog-icons] формы без записи в реестре:', extra.join(', '));
  }
}
