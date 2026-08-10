/**
 * Реестр иконок справочника.
 *
 * Иконка — поле позиции, которое выбирает человек, а не результат догадки
 * по названию. Эвристика «если в названии есть „камера“ — рисуем камеру»
 * ломается на первой же позиции вроде «Кронштейн для камеры» и оставляет
 * пользователя без объяснения, почему значок именно такой.
 *
 * Здесь только идентификаторы и подписи — они нужны и серверу (проверить,
 * что пришёл известный id), и клиенту. Сама отрисовка живёт в apps/web:
 * SVG на сервере не нужен.
 */

export const ICON_GROUPS = [
  'video',
  'access',
  'intercom',
  'alarm',
  'network',
  'power',
  'cable',
  'work',
  'other',
] as const;

export type IconGroup = (typeof ICON_GROUPS)[number];

export const ICON_GROUP_LABELS: Record<IconGroup, string> = {
  video: 'Видеонаблюдение',
  access: 'Контроль доступа',
  intercom: 'Домофония',
  alarm: 'Охранно-пожарная',
  network: 'Сеть',
  power: 'Питание',
  cable: 'Кабель и материалы',
  work: 'Работы',
  other: 'Прочее',
};

export interface IconMeta {
  id: string;
  label: string;
  group: IconGroup;
  /** Слова для поиска — то, как позицию называют в жизни. */
  keywords: string[];
}

export const CATALOG_ICONS: readonly IconMeta[] = [
  // ── Видеонаблюдение ──
  { id: 'camera-bullet', label: 'Камера цилиндрическая', group: 'video', keywords: ['камера', 'булет', 'уличная', 'ip'] },
  { id: 'camera-dome', label: 'Камера купольная', group: 'video', keywords: ['камера', 'купол', 'внутренняя'] },
  { id: 'camera-ptz', label: 'Камера поворотная (PTZ)', group: 'video', keywords: ['камера', 'ptz', 'поворотная', 'скоростная'] },
  { id: 'camera-fisheye', label: 'Камера панорамная', group: 'video', keywords: ['камера', 'fisheye', 'панорамная', 'рыбий глаз'] },
  { id: 'nvr', label: 'Видеорегистратор', group: 'video', keywords: ['регистратор', 'nvr', 'dvr', 'видеорегистратор'] },
  { id: 'monitor', label: 'Монитор', group: 'video', keywords: ['монитор', 'экран', 'дисплей'] },
  { id: 'hdd', label: 'Жёсткий диск', group: 'video', keywords: ['диск', 'hdd', 'накопитель', 'жёсткий'] },

  // ── Контроль доступа ──
  { id: 'reader', label: 'Считыватель', group: 'access', keywords: ['считыватель', 'карта', 'скуд', 'rfid'] },
  { id: 'lock-magnetic', label: 'Замок электромагнитный', group: 'access', keywords: ['замок', 'электромагнитный', 'магнит'] },
  { id: 'lock-mech', label: 'Замок электромеханический', group: 'access', keywords: ['замок', 'электромеханический', 'защёлка'] },
  { id: 'turnstile', label: 'Турникет', group: 'access', keywords: ['турникет', 'проходная'] },
  { id: 'barrier', label: 'Шлагбаум', group: 'access', keywords: ['шлагбаум', 'ворота', 'парковка'] },
  { id: 'exit-button', label: 'Кнопка выхода', group: 'access', keywords: ['кнопка', 'выход'] },
  { id: 'door-closer', label: 'Доводчик двери', group: 'access', keywords: ['доводчик', 'дверь'] },
  { id: 'acs-controller', label: 'Контроллер СКУД', group: 'access', keywords: ['контроллер', 'скуд', 'доступ'] },

  // ── Домофония ──
  { id: 'intercom-panel', label: 'Вызывная панель', group: 'intercom', keywords: ['панель', 'вызывная', 'домофон'] },
  { id: 'intercom-monitor', label: 'Монитор домофона', group: 'intercom', keywords: ['монитор', 'домофон', 'видеодомофон'] },
  { id: 'intercom-handset', label: 'Трубка домофона', group: 'intercom', keywords: ['трубка', 'домофон', 'аудио'] },

  // ── Охранно-пожарная ──
  { id: 'motion-sensor', label: 'Датчик движения', group: 'alarm', keywords: ['датчик', 'движение', 'ик', 'извещатель'] },
  { id: 'smoke-detector', label: 'Дымовой извещатель', group: 'alarm', keywords: ['дым', 'пожарный', 'извещатель', 'датчик'] },
  { id: 'heat-detector', label: 'Тепловой извещатель', group: 'alarm', keywords: ['тепло', 'пожарный', 'извещатель', 'температура'] },
  { id: 'magnetic-contact', label: 'Магнитоконтактный датчик', group: 'alarm', keywords: ['геркон', 'датчик', 'дверь', 'окно', 'спмк'] },
  { id: 'glass-break', label: 'Датчик разбития стекла', group: 'alarm', keywords: ['стекло', 'разбитие', 'акустический', 'датчик'] },
  { id: 'siren', label: 'Оповещатель, сирена', group: 'alarm', keywords: ['сирена', 'оповещатель', 'звук', 'сигнал'] },
  { id: 'alarm-panel', label: 'Прибор приёмно-контрольный', group: 'alarm', keywords: ['ппк', 'прибор', 'панель', 'охрана'] },
  { id: 'manual-call-point', label: 'Ручной извещатель', group: 'alarm', keywords: ['ипр', 'кнопка', 'пожарная', 'ручной'] },
  { id: 'leak-sensor', label: 'Датчик протечки', group: 'alarm', keywords: ['протечка', 'вода', 'датчик'] },

  // ── Сеть ──
  { id: 'wifi-ap', label: 'Точка доступа Wi-Fi', group: 'network', keywords: ['wi-fi', 'wifi', 'точка', 'доступа', 'ap'] },
  { id: 'switch', label: 'Коммутатор', group: 'network', keywords: ['коммутатор', 'свитч', 'switch', 'poe'] },
  { id: 'router', label: 'Маршрутизатор', group: 'network', keywords: ['роутер', 'маршрутизатор', 'router'] },
  { id: 'patch-panel', label: 'Патч-панель', group: 'network', keywords: ['патч-панель', 'кросс'] },
  { id: 'rack', label: 'Шкаф, бокс', group: 'network', keywords: ['шкаф', 'бокс', 'стойка', 'телеком'] },
  { id: 'poe-injector', label: 'PoE-инжектор', group: 'network', keywords: ['poe', 'инжектор', 'питание'] },

  // ── Питание ──
  { id: 'psu', label: 'Блок питания', group: 'power', keywords: ['блок', 'питание', 'бп'] },
  { id: 'ups', label: 'ИБП, аккумулятор', group: 'power', keywords: ['ибп', 'аккумулятор', 'батарея', 'ups'] },
  { id: 'breaker', label: 'Автомат, щиток', group: 'power', keywords: ['автомат', 'щиток', 'электрика'] },

  // ── Кабель и материалы ──
  { id: 'cable-coil', label: 'Кабель', group: 'cable', keywords: ['кабель', 'утп', 'utp', 'кспв', 'витая пара'] },
  { id: 'conduit', label: 'Гофра, труба', group: 'cable', keywords: ['гофра', 'труба', 'пнд'] },
  { id: 'cable-tray', label: 'Кабель-канал, лоток', group: 'cable', keywords: ['кабель-канал', 'лоток', 'короб'] },
  { id: 'junction-box', label: 'Распределительная коробка', group: 'cable', keywords: ['коробка', 'распред', 'распаечная'] },
  { id: 'bracket', label: 'Кронштейн', group: 'cable', keywords: ['кронштейн', 'крепление', 'держатель'] },
  { id: 'fastener', label: 'Крепёж', group: 'cable', keywords: ['крепёж', 'дюбель', 'саморез', 'хомут'] },
  { id: 'patch-cord', label: 'Патч-корд', group: 'cable', keywords: ['патч-корд', 'шнур'] },
  { id: 'rj45', label: 'Разъём RJ-45', group: 'cable', keywords: ['разъём', 'rj45', 'коннектор', 'джек'] },

  // ── Работы ──
  { id: 'mount', label: 'Монтаж', group: 'work', keywords: ['монтаж', 'установка', 'работа'] },
  { id: 'align', label: 'Юстировка', group: 'work', keywords: ['юстировка', 'настройка угла', 'наведение'] },
  { id: 'setup', label: 'Настройка', group: 'work', keywords: ['настройка', 'конфигурация', 'программирование'] },
  { id: 'commissioning', label: 'Пусконаладка', group: 'work', keywords: ['пусконаладка', 'пнр', 'запуск'] },
  { id: 'drilling', label: 'Штробление, бурение', group: 'work', keywords: ['штробление', 'бурение', 'отверстие', 'перфоратор'] },
  { id: 'cable-laying', label: 'Прокладка кабеля', group: 'work', keywords: ['прокладка', 'кабель', 'протяжка'] },
  { id: 'trip', label: 'Выезд', group: 'work', keywords: ['выезд', 'доставка', 'транспорт'] },
  { id: 'diagnostics', label: 'Диагностика', group: 'work', keywords: ['диагностика', 'обследование', 'проверка'] },

  // ── Прочее ──
  { id: 'box', label: 'Без иконки', group: 'other', keywords: ['прочее', 'разное'] },
] as const;

export const CATALOG_ICON_IDS: readonly string[] = CATALOG_ICONS.map((icon) => icon.id);

const BY_ID = new Map(CATALOG_ICONS.map((icon) => [icon.id, icon]));

export function isCatalogIcon(id: string): boolean {
  return BY_ID.has(id);
}

export function findIcon(id: string | null | undefined): IconMeta | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/**
 * Подсказка иконки по названию позиции.
 *
 * Используется ТОЛЬКО как предзаполнение поля в форме, когда пользователь
 * ещё ничего не выбрал: он видит подставленное значение и может его сменить.
 * Хранится всегда явный выбор, а не результат этой функции.
 */
export function suggestIcon(name: string, kind: string): string {
  const text = name.toLowerCase();

  for (const icon of CATALOG_ICONS) {
    if (icon.group === 'other') continue;
    if (icon.keywords.some((word) => text.includes(word))) return icon.id;
  }

  if (kind === 'CABLE') return 'cable-coil';
  if (kind === 'LABOR') return 'mount';
  return 'box';
}
