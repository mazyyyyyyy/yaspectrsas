/**
 * Наполнение базы стартовыми данными.
 *
 * Справочник и комплекты взяты из макета — это реальный набор монтажника:
 * камера, Wi-Fi точка, домофон, регистратор. Цены оттуда же, их всё равно
 * заказчик будет править под себя, но начинать с пустого справочника нельзя:
 * систему невозможно будет даже посмотреть.
 *
 * Запуск:  npm run db:seed --workspace @yaspectr/api
 * Идемпотентен: повторный запуск ничего не дублирует.
 */

import { ItemKind, PrismaClient, QtyMode, Role, Unit } from '@prisma/client';
import { hash, Algorithm } from '@node-rs/argon2';
import { isCatalogIcon } from '@yaspectr/core';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

const COMPANY_NAME = 'Яспектр';
const ADMIN_EMAIL = 'admin@yaspectr.local';

/** Копейки. 20 100 ₽ → 2 010 000. */
const rub = (rubles: number): number => Math.round(rubles * 100);
/** Тысячные. 30 м → 30 000. */
const qty = (units: number): number => Math.round(units * 1000);

interface ItemSeed {
  key: string;
  sku: string;
  name: string;
  kind: ItemKind;
  unit: Unit;
  /** Идентификатор из CATALOG_ICONS. Задан явно, а не выведен из названия. */
  icon: string;
  material?: number;
  labor?: number;
  cost?: number;
  category: string;
}

const CATEGORIES = [
  'Видеонаблюдение',
  'Контроль доступа',
  'Домофония',
  'Охранно-пожарная',
  'Сеть и Wi-Fi',
  'Питание',
  'Расходники',
  'Работы',
];

/**
 * Стартовый справочник слаботочки.
 *
 * Не «пример из макета», а рабочий набор: видеонаблюдение, СКУД, домофония,
 * ОПС, сеть, питание, расходники и работы. Цены — ориентир по рынку, их
 * заказчик правит под своих поставщиков; смысл в том, чтобы систему можно
 * было открыть и сразу считать, а не набивать сотню позиций руками.
 *
 * Иконка у каждой позиции задана явно — это то самое поле, которое теперь
 * выбирается в форме, а не угадывается по названию.
 */
const ITEMS: ItemSeed[] = [
  // ── Видеонаблюдение ──
  { key: 'cam', sku: 'CAM-4MP', name: 'IP камера 4 Мп, уличная', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'camera-bullet', material: rub(20_100), cost: rub(14_500), category: 'Видеонаблюдение' },
  { key: 'cam-dome', sku: 'CAM-DOME-4', name: 'IP камера купольная 4 Мп', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'camera-dome', material: rub(18_400), cost: rub(13_100), category: 'Видеонаблюдение' },
  { key: 'cam-ptz', sku: 'CAM-PTZ', name: 'IP камера поворотная PTZ, 25×', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'camera-ptz', material: rub(78_000), cost: rub(59_000), category: 'Видеонаблюдение' },
  { key: 'cam-fish', sku: 'CAM-FISH', name: 'IP камера панорамная 360°', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'camera-fisheye', material: rub(34_500), cost: rub(25_800), category: 'Видеонаблюдение' },
  { key: 'nvr', sku: 'NVR-8', name: 'Сетевой регистратор, 8 каналов', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'nvr', material: rub(28_900), cost: rub(21_000), category: 'Видеонаблюдение' },
  { key: 'nvr-16', sku: 'NVR-16', name: 'Сетевой регистратор, 16 каналов', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'nvr', material: rub(46_700), cost: rub(35_200), category: 'Видеонаблюдение' },
  { key: 'hdd', sku: 'HDD-4T', name: 'Жёсткий диск 4 ТБ (для видеонаблюдения)', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'hdd', material: rub(11_900), cost: rub(9_100), category: 'Видеонаблюдение' },
  { key: 'monitor', sku: 'MON-24', name: 'Монитор 24"', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'monitor', material: rub(14_500), cost: rub(11_200), category: 'Видеонаблюдение' },

  // ── Контроль доступа ──
  { key: 'reader', sku: 'ACS-RD', name: 'Считыватель бесконтактный Mifare', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'reader', material: rub(4_200), cost: rub(2_900), category: 'Контроль доступа' },
  { key: 'acs-ctrl', sku: 'ACS-CTRL', name: 'Контроллер СКУД, 2 двери', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'acs-controller', material: rub(12_800), cost: rub(9_400), category: 'Контроль доступа' },
  { key: 'lock-mag', sku: 'ACS-LM300', name: 'Замок электромагнитный 300 кг', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'lock-magnetic', material: rub(3_600), cost: rub(2_400), category: 'Контроль доступа' },
  { key: 'lock-mech', sku: 'ACS-LMECH', name: 'Замок электромеханический', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'lock-mech', material: rub(5_900), cost: rub(4_200), category: 'Контроль доступа' },
  { key: 'exit-btn', sku: 'ACS-BTN', name: 'Кнопка выхода', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'exit-button', material: rub(750), cost: rub(430), category: 'Контроль доступа' },
  { key: 'closer', sku: 'ACS-CLS', name: 'Доводчик дверной', kind: ItemKind.MATERIAL, unit: Unit.PCS, icon: 'door-closer', material: rub(2_800), cost: rub(1_900), category: 'Контроль доступа' },
  { key: 'turnstile', sku: 'ACS-TURN', name: 'Турникет-трипод', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'turnstile', material: rub(96_000), cost: rub(74_000), category: 'Контроль доступа' },
  { key: 'barrier', sku: 'ACS-BAR', name: 'Шлагбаум автоматический, 4 м', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'barrier', material: rub(112_000), cost: rub(88_000), category: 'Контроль доступа' },

  // ── Домофония ──
  { key: 'door', sku: 'DOOR-VZ', name: 'Домофон Vizit, комплект', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'intercom-panel', material: rub(18_500), cost: rub(13_200), category: 'Домофония' },
  { key: 'intercom-mon', sku: 'DOOR-MON7', name: 'Монитор видеодомофона 7"', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'intercom-monitor', material: rub(9_800), cost: rub(7_100), category: 'Домофония' },
  { key: 'intercom-tube', sku: 'DOOR-TUBE', name: 'Трубка аудиодомофона', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'intercom-handset', material: rub(1_450), cost: rub(890), category: 'Домофония' },

  // ── Охранно-пожарная ──
  { key: 'pir', sku: 'OPS-PIR', name: 'Извещатель движения ИК', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'motion-sensor', material: rub(950), cost: rub(560), category: 'Охранно-пожарная' },
  { key: 'smoke', sku: 'OPS-SMOKE', name: 'Извещатель дымовой ИП-212', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'smoke-detector', material: rub(680), cost: rub(390), category: 'Охранно-пожарная' },
  { key: 'heat', sku: 'OPS-HEAT', name: 'Извещатель тепловой ИП-101', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'heat-detector', material: rub(620), cost: rub(350), category: 'Охранно-пожарная' },
  { key: 'magnet', sku: 'OPS-SMK', name: 'Извещатель магнитоконтактный (геркон)', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'magnetic-contact', material: rub(240), cost: rub(130), category: 'Охранно-пожарная' },
  { key: 'glass', sku: 'OPS-GLASS', name: 'Извещатель разбития стекла', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'glass-break', material: rub(1_350), cost: rub(880), category: 'Охранно-пожарная' },
  { key: 'ipr', sku: 'OPS-IPR', name: 'Извещатель пожарный ручной ИПР', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'manual-call-point', material: rub(520), cost: rub(290), category: 'Охранно-пожарная' },
  { key: 'siren', sku: 'OPS-SIR', name: 'Оповещатель свето-звуковой', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'siren', material: rub(1_180), cost: rub(720), category: 'Охранно-пожарная' },
  { key: 'ppk', sku: 'OPS-PPK', name: 'Прибор приёмно-контрольный, 8 шлейфов', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'alarm-panel', material: rub(14_200), cost: rub(10_600), category: 'Охранно-пожарная' },
  { key: 'leak', sku: 'OPS-LEAK', name: 'Датчик протечки воды', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'leak-sensor', material: rub(890), cost: rub(520), category: 'Охранно-пожарная' },

  // ── Сеть и Wi-Fi ──
  { key: 'wifi', sku: 'AP-AX1800', name: 'Wi-Fi точка доступа AX1800', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'wifi-ap', material: rub(11_000), cost: rub(7_900), category: 'Сеть и Wi-Fi' },
  { key: 'switch8', sku: 'SW-8POE', name: 'Коммутатор 8 портов PoE', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'switch', material: rub(9_600), cost: rub(6_800), category: 'Сеть и Wi-Fi' },
  { key: 'switch16', sku: 'SW-16POE', name: 'Коммутатор 16 портов PoE', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'switch', material: rub(19_400), cost: rub(14_500), category: 'Сеть и Wi-Fi' },
  { key: 'router', sku: 'RT-GW', name: 'Маршрутизатор', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'router', material: rub(8_700), cost: rub(6_200), category: 'Сеть и Wi-Fi' },
  { key: 'poe-inj', sku: 'POE-INJ', name: 'PoE-инжектор 30 Вт', kind: ItemKind.MATERIAL, unit: Unit.PCS, icon: 'poe-injector', material: rub(1_600), cost: rub(1_050), category: 'Сеть и Wi-Fi' },
  { key: 'patch-panel', sku: 'PP-24', name: 'Патч-панель 24 порта', kind: ItemKind.MATERIAL, unit: Unit.PCS, icon: 'patch-panel', material: rub(3_400), cost: rub(2_300), category: 'Сеть и Wi-Fi' },
  { key: 'rack', sku: 'M-RACK', name: 'Телекоммуникационный бокс', kind: ItemKind.MATERIAL, unit: Unit.PCS, icon: 'rack', material: rub(2_400), cost: rub(1_700), category: 'Сеть и Wi-Fi' },

  // ── Питание ──
  { key: 'psu', sku: 'M-PSU', name: 'Блок питания 12 В, 5 А', kind: ItemKind.MATERIAL, unit: Unit.PCS, icon: 'psu', material: rub(1_450), cost: rub(980), category: 'Питание' },
  { key: 'ups', sku: 'PWR-UPS', name: 'ИБП 650 ВА', kind: ItemKind.EQUIPMENT, unit: Unit.PCS, icon: 'ups', material: rub(7_900), cost: rub(5_900), category: 'Питание' },
  { key: 'akb', sku: 'PWR-AKB', name: 'Аккумулятор 12 В, 7 А·ч', kind: ItemKind.MATERIAL, unit: Unit.PCS, icon: 'ups', material: rub(1_900), cost: rub(1_250), category: 'Питание' },
  { key: 'breaker', sku: 'PWR-BRK', name: 'Автоматический выключатель', kind: ItemKind.MATERIAL, unit: Unit.PCS, icon: 'breaker', material: rub(480), cost: rub(280), category: 'Питание' },

  // ── Расходники ──
  { key: 'box', sku: 'M-BOX', name: 'Распределительная коробка', kind: ItemKind.MATERIAL, unit: Unit.PCS, icon: 'junction-box', material: rub(120), cost: rub(70), category: 'Расходники' },
  { key: 'bracket', sku: 'M-BRK', name: 'Кронштейн настенный', kind: ItemKind.MATERIAL, unit: Unit.PCS, icon: 'bracket', material: rub(350), cost: rub(210), category: 'Расходники' },
  { key: 'patch', sku: 'M-PATCH', name: 'Патч-корд 1 м', kind: ItemKind.MATERIAL, unit: Unit.PCS, icon: 'patch-cord', material: rub(190), cost: rub(110), category: 'Расходники' },
  { key: 'rj45', sku: 'M-RJ45', name: 'Разъём RJ-45', kind: ItemKind.MATERIAL, unit: Unit.PCS, icon: 'rj45', material: rub(25), cost: rub(12), category: 'Расходники' },
  { key: 'gofra', sku: 'M-GOFRA', name: 'Гофра ПВХ 20 мм', kind: ItemKind.MATERIAL, unit: Unit.M, icon: 'conduit', material: rub(32), cost: rub(19), category: 'Расходники' },
  { key: 'kanal', sku: 'M-KANAL', name: 'Кабель-канал 25×16', kind: ItemKind.MATERIAL, unit: Unit.M, icon: 'cable-tray', material: rub(78), cost: rub(48), category: 'Расходники' },
  { key: 'fast', sku: 'M-FAST', name: 'Крепёж (дюбель, саморез, хомут)', kind: ItemKind.MATERIAL, unit: Unit.PCS, icon: 'fastener', material: rub(12), cost: rub(6), category: 'Расходники' },

  // ── Кабель: одна позиция, две цены за метр (материал + прокладка) ──
  { key: 'utp', sku: 'C-UTP', name: 'Кабель UTP cat.5e', kind: ItemKind.CABLE, unit: Unit.M, icon: 'cable-coil', material: rub(45), labor: rub(35), cost: rub(28), category: 'Расходники' },
  { key: 'utp6', sku: 'C-UTP6', name: 'Кабель UTP cat.6', kind: ItemKind.CABLE, unit: Unit.M, icon: 'cable-coil', material: rub(72), labor: rub(35), cost: rub(49), category: 'Расходники' },
  { key: 'kspv', sku: 'C-KSPV', name: 'Кабель КСПВ 4×0,5', kind: ItemKind.CABLE, unit: Unit.M, icon: 'cable-coil', material: rub(28), labor: rub(35), cost: rub(17), category: 'Расходники' },
  { key: 'kspveg', sku: 'C-KSPVEG', name: 'Кабель КСПВЭГ 2×0,5 (экран)', kind: ItemKind.CABLE, unit: Unit.M, icon: 'cable-coil', material: rub(41), labor: rub(35), cost: rub(26), category: 'Расходники' },
  { key: 'vvg', sku: 'C-VVG', name: 'Кабель ВВГнг 3×1,5', kind: ItemKind.CABLE, unit: Unit.M, icon: 'cable-coil', material: rub(64), labor: rub(45), cost: rub(43), category: 'Расходники' },

  // ── Работы ──
  { key: 'mount-cam', sku: 'W-CAM-M', name: 'Монтаж камеры', kind: ItemKind.LABOR, unit: Unit.PCS, icon: 'mount', labor: rub(1_500), category: 'Работы' },
  { key: 'align-cam', sku: 'W-CAM-A', name: 'Юстировка камеры', kind: ItemKind.LABOR, unit: Unit.PCS, icon: 'align', labor: rub(400), category: 'Работы' },
  { key: 'mount-nvr', sku: 'W-NVR-M', name: 'Монтаж и настройка регистратора', kind: ItemKind.LABOR, unit: Unit.PCS, icon: 'setup', labor: rub(3_500), category: 'Работы' },
  { key: 'commission', sku: 'W-COMM', name: 'Пусконаладка системы', kind: ItemKind.LABOR, unit: Unit.PCS, icon: 'commissioning', labor: rub(2_000), category: 'Работы' },
  { key: 'mount-wifi', sku: 'W-AP-M', name: 'Монтаж точки доступа', kind: ItemKind.LABOR, unit: Unit.PCS, icon: 'mount', labor: rub(1_200), category: 'Работы' },
  { key: 'setup-wifi', sku: 'W-AP-S', name: 'Настройка и подключение точки', kind: ItemKind.LABOR, unit: Unit.PCS, icon: 'setup', labor: rub(800), category: 'Работы' },
  { key: 'mount-panel', sku: 'W-DR-P', name: 'Монтаж вызывной панели', kind: ItemKind.LABOR, unit: Unit.PCS, icon: 'mount', labor: rub(2_500), category: 'Работы' },
  { key: 'mount-ctrl', sku: 'W-DR-C', name: 'Монтаж блока управления', kind: ItemKind.LABOR, unit: Unit.PCS, icon: 'mount', labor: rub(1_800), category: 'Работы' },
  { key: 'mount-sensor', sku: 'W-OPS-M', name: 'Монтаж извещателя', kind: ItemKind.LABOR, unit: Unit.PCS, icon: 'mount', labor: rub(650), category: 'Работы' },
  { key: 'mount-lock', sku: 'W-ACS-L', name: 'Монтаж замка с подключением', kind: ItemKind.LABOR, unit: Unit.PCS, icon: 'mount', labor: rub(2_800), category: 'Работы' },
  { key: 'drill', sku: 'W-DRILL', name: 'Сверление отверстия в бетоне', kind: ItemKind.LABOR, unit: Unit.PCS, icon: 'drilling', labor: rub(450), category: 'Работы' },
  { key: 'shtrob', sku: 'W-SHTR', name: 'Штробление стены', kind: ItemKind.LABOR, unit: Unit.M, icon: 'drilling', labor: rub(390), category: 'Работы' },
  { key: 'trip', sku: 'W-TRIP', name: 'Выезд на объект', kind: ItemKind.LABOR, unit: Unit.PCS, icon: 'trip', labor: rub(1_500), category: 'Работы' },
  { key: 'diag', sku: 'W-DIAG', name: 'Диагностика системы', kind: ItemKind.LABOR, unit: Unit.HOUR, icon: 'diagnostics', labor: rub(1_800), category: 'Работы' },
];

interface KitSeed {
  name: string;
  rootKey: string;
  lines: {
    itemKey: string;
    perRoot: number;
    mode?: QtyMode;
    min?: number;
    max?: number;
    optional?: boolean;
  }[];
}

/**
 * Комплекты — ядро ТЗ: «если монтаж камеры, то сразу юстировка
 * + распред. коробка». Кабель идёт с диапазоном 30–50 м на точку.
 */
const KITS: KitSeed[] = [
  {
    name: 'Камера под ключ',
    rootKey: 'cam',
    lines: [
      { itemKey: 'mount-cam', perRoot: qty(1) },
      { itemKey: 'align-cam', perRoot: qty(1) },
      { itemKey: 'box', perRoot: qty(1) },
      { itemKey: 'utp', perRoot: qty(30), min: qty(30), max: qty(50) },
    ],
  },
  {
    name: 'Регистратор под ключ',
    rootKey: 'nvr',
    lines: [
      { itemKey: 'mount-nvr', perRoot: qty(1) },
      { itemKey: 'commission', perRoot: qty(1) },
      { itemKey: 'rack', perRoot: qty(1), mode: QtyMode.FIXED },
      { itemKey: 'patch', perRoot: qty(4) },
    ],
  },
  {
    name: 'Wi-Fi точка под ключ',
    rootKey: 'wifi',
    lines: [
      { itemKey: 'mount-wifi', perRoot: qty(1) },
      { itemKey: 'setup-wifi', perRoot: qty(1) },
      { itemKey: 'bracket', perRoot: qty(1) },
      { itemKey: 'utp', perRoot: qty(30), min: qty(30), max: qty(50) },
    ],
  },
  {
    name: 'Домофон под ключ',
    rootKey: 'door',
    lines: [
      { itemKey: 'mount-panel', perRoot: qty(1) },
      { itemKey: 'mount-ctrl', perRoot: qty(1) },
      { itemKey: 'psu', perRoot: qty(1) },
      { itemKey: 'kspv', perRoot: qty(40), min: qty(30), max: qty(50) },
    ],
  },
  {
    name: 'Дверь СКУД под ключ',
    rootKey: 'lock-mag',
    lines: [
      { itemKey: 'mount-lock', perRoot: qty(1) },
      { itemKey: 'reader', perRoot: qty(1) },
      { itemKey: 'exit-btn', perRoot: qty(1) },
      { itemKey: 'closer', perRoot: qty(1), optional: true },
      { itemKey: 'psu', perRoot: qty(1) },
      { itemKey: 'kspveg', perRoot: qty(25), min: qty(15), max: qty(40) },
    ],
  },
  {
    name: 'Извещатель под ключ',
    rootKey: 'pir',
    lines: [
      { itemKey: 'mount-sensor', perRoot: qty(1) },
      { itemKey: 'kspveg', perRoot: qty(20), min: qty(15), max: qty(35) },
      { itemKey: 'fast', perRoot: qty(4) },
    ],
  },
  {
    name: 'Камера купольная под ключ',
    rootKey: 'cam-dome',
    lines: [
      { itemKey: 'mount-cam', perRoot: qty(1) },
      { itemKey: 'align-cam', perRoot: qty(1) },
      { itemKey: 'box', perRoot: qty(1) },
      { itemKey: 'utp', perRoot: qty(25), min: qty(20), max: qty(45) },
    ],
  },
];

/**
 * Иконки сверяем с реестром до записи.
 *
 * Идентификатор здесь — обычная строка, опечатку компилятор не поймает.
 * Позиция с несуществующей иконкой отрисуется нейтральной «коробкой», и
 * разбираться в этом придётся уже на живых данных.
 */
function assertIconsAreKnown(): void {
  const unknown = ITEMS.filter((item) => !isCatalogIcon(item.icon));
  if (unknown.length > 0) {
    throw new Error(
      `Неизвестные иконки в справочнике: ${unknown.map((i) => `${i.key}→${i.icon}`).join(', ')}`,
    );
  }
}

async function main(): Promise<void> {
  assertIconsAreKnown();

  const existing = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (existing) {
    console.log(`Компания «${COMPANY_NAME}» уже есть — seed пропущен.`);
    return;
  }

  // Пароль генерируем, а не зашиваем: seed-скрипт с паролем «admin123»
  // рано или поздно уезжает на боевой сервер.
  const adminPassword = randomBytes(12).toString('base64url');
  const passwordHash = await hash(adminPassword, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const company = await prisma.company.create({
    data: { name: COMPANY_NAME, phone: '+7 900 000-00-00' },
  });

  await prisma.$transaction(async (tx) => {
    // Включаем тенанта: таблицы ниже под RLS, без этого INSERT не пройдёт.
    // Ровно тот же приём, что PrismaService.runAsTenant использует в рантайме.
    await tx.$executeRaw`SELECT set_config('app.company_id', ${company.id}::text, true)`;

    await tx.user.create({
      data: {
        companyId: company.id,
        email: ADMIN_EMAIL,
        passwordHash,
        fullName: 'Администратор',
        role: Role.ADMIN,
      },
    });

    const categoryIds = new Map<string, string>();
    for (const [index, name] of CATEGORIES.entries()) {
      const category = await tx.catalogCategory.create({
        data: { companyId: company.id, name, sortOrder: index },
      });
      categoryIds.set(name, category.id);
    }

    const itemIds = new Map<string, string>();
    for (const seed of ITEMS) {
      const item = await tx.catalogItem.create({
        data: {
          companyId: company.id,
          categoryId: categoryIds.get(seed.category) ?? null,
          sku: seed.sku,
          name: seed.name,
          kind: seed.kind,
          unit: seed.unit,
          icon: seed.icon,
          materialPrice: seed.material ?? 0,
          laborPrice: seed.labor ?? 0,
          costPrice: seed.cost ?? null,
        },
      });
      itemIds.set(seed.key, item.id);
    }

    for (const kit of KITS) {
      const rootItemId = itemIds.get(kit.rootKey);
      if (!rootItemId) throw new Error(`Комплект «${kit.name}»: нет базовой позиции ${kit.rootKey}`);

      await tx.kitTemplate.create({
        data: {
          companyId: company.id,
          name: kit.name,
          rootItemId,
          isDefault: true,
          lines: {
            create: kit.lines.map((line, index) => {
              const itemId = itemIds.get(line.itemKey);
              if (!itemId) throw new Error(`Комплект «${kit.name}»: нет позиции ${line.itemKey}`);
              return {
                itemId,
                qtyMode: line.mode ?? QtyMode.PER_ROOT,
                qtyPerRoot: line.perRoot,
                minPerRoot: line.min ?? null,
                maxPerRoot: line.max ?? null,
                isOptional: line.optional ?? false,
                sortOrder: index,
              };
            }),
          },
        },
      });
    }
  });

  console.log('');
  console.log('  Стартовые данные загружены.');
  console.log(`  Категорий: ${CATEGORIES.length}, позиций: ${ITEMS.length}, комплектов: ${KITS.length}`);
  console.log('');
  console.log('  Вход в систему:');
  console.log(`    email:  ${ADMIN_EMAIL}`);
  console.log(`    пароль: ${adminPassword}`);
  console.log('');
  console.log('  Пароль показан один раз — сохраните его сейчас.');
  console.log('');
}

main()
  .catch((error) => {
    console.error('Seed не выполнен:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
