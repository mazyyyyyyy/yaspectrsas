/**
 * Разметка сметы для печати.
 *
 * Один шаблон на две задачи: сервер печатает из него PDF через Chrome, и он же
 * годится для предпросмотра в браузере. Считает суммы всё тот же движок из
 * @yaspectr/core, поэтому документ у клиента не может разойтись с экраном.
 */

import {
  ITEM_KIND_LABELS,
  UNIT_LABELS,
  computeEstimate,
  formatMoney,
  formatQty,
  type EstimateTotals,
  type ItemKind,
  type Unit,
  type VatMode,
} from '@yaspectr/core';

export interface DocumentCompany {
  name: string;
  inn: string | null;
  phone: string | null;
  address: string | null;
}

export interface DocumentLine {
  /** Нужен движку расчёта: по нему он помечает суммы строк. */
  id: string;
  name: string;
  kind: ItemKind;
  unit: Unit;
  qty: number;
  unitMaterialPrice: number;
  unitLaborPrice: number;
  isEnabled: boolean;
}

export interface DocumentPosition {
  id: string;
  name: string;
  kind: ItemKind;
  unit: Unit;
  qty: number;
  unitMaterialPrice: number;
  unitLaborPrice: number;
  isEnabled: boolean;
  lines: DocumentLine[];
}

export interface DocumentEstimate {
  number: string;
  title: string;
  clientName: string | null;
  clientPhone: string | null;
  siteAddress: string | null;
  note: string | null;
  discountBp: number;
  vatMode: VatMode;
  vatRateBp: number;
  createdAt: Date;
  positions: DocumentPosition[];
}

export interface RenderOptions {
  /** summary — свёрнуто для клиента, full — «до винтика». */
  detail: 'summary' | 'full';
  /** Спрятать разбивку материал/работа и показать одну сумму. */
  hideBreakdown: boolean;
}

/**
 * Экранирование ВСЕГО, что подставляется в разметку.
 *
 * Названия позиций и имя клиента вводит пользователь. Без экранирования
 * строка вида `<script>` или `"><img onerror=...>` превращает смету в
 * исполняемый код — а этот HTML открывает и Chrome на сервере, и браузер
 * менеджера. Экранируем и кавычки: подстановки встречаются внутри атрибутов.
 */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DATE_FORMAT = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

function vatLabel(mode: VatMode, rateBp: number): string | null {
  const rate = rateBp / 100;
  switch (mode) {
    case 'NONE':
      return null;
    case 'ADDED':
      return `НДС ${rate} % сверху`;
    case 'INCLUDED':
      return `в том числе НДС ${rate} %`;
  }
}

export function renderEstimateHtml(
  estimate: DocumentEstimate,
  company: DocumentCompany,
  options: RenderOptions,
): string {
  const totals = computeEstimate(estimate);
  const money = (value: number) => esc(formatMoney(value, { currency: false }));

  const rows = estimate.positions
    .map((position, index) => renderPosition(position, index, totals, options))
    .join('');

  const vat = vatLabel(estimate.vatMode, estimate.vatRateBp);
  const columns = options.hideBreakdown ? 5 : 7;

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Смета ${esc(estimate.number)}</title>
<style>
  /* Только системные шрифты: Chrome на сервере не ходит в интернет за
     Google Fonts, а без кириллицы документ бесполезен. */
  * { box-sizing: border-box; }
  /* Документ всегда светлый и печатается на белом.
     Без этих двух строк Chrome на системе с тёмной темой подставляет свой
     тёмный фон, и клиенту уходит смета светлым текстом по тёмному — либо,
     после печати на белом, почти невидимая. Печатный документ не должен
     зависеть от оформления машины, на которой его сгенерировали. */
  html { color-scheme: light; }
  html, body { background: #FFFFFF; }
  body {
    margin: 0; padding: 0;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 10pt; color: #2B2E2A; line-height: 1.45;
  }
  .sheet { padding: 14mm 12mm; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2px solid #8AB50F; padding-bottom: 8mm; margin-bottom: 7mm; }
  .company { font-size: 13pt; font-weight: 700; letter-spacing: -0.01em; }
  .company-meta { font-size: 8.5pt; color: #71766E; margin-top: 1.5mm; }
  .doc-title { font-size: 16pt; font-weight: 700; text-align: right; letter-spacing: -0.02em; }
  .doc-meta { font-size: 8.5pt; color: #71766E; text-align: right; margin-top: 1.5mm; }
  .facts { margin-bottom: 6mm; font-size: 9.5pt; }
  .facts div { margin-bottom: 1.2mm; }
  .facts b { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { font-size: 8pt; font-weight: 600; color: #4A4E48; text-transform: uppercase;
       letter-spacing: 0.03em; text-align: left; padding: 2.5mm 2mm;
       background: #F1F6E1; border-bottom: 1px solid #C7D2AF; }
  td { padding: 2.2mm 2mm; border-bottom: 1px solid #EDEFE8; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .pos-row td { background: #FAFBF6; font-weight: 600; border-top: 1px solid #E5E8E0; }
  .sub-row td { color: #4A4E48; font-size: 9pt; }
  .sub-row .name { padding-left: 6mm; }
  /* Строку не разрываем между страницами: половина позиции на одном листе,
     половина на другом — верный способ получить спор о содержании сметы. */
  tr { break-inside: avoid; }
  .totals { margin-top: 7mm; margin-left: auto; width: 78mm; break-inside: avoid; }
  .totals div { display: flex; justify-content: space-between; padding: 1.6mm 0; font-size: 9.5pt; }
  .totals .grand { border-top: 2px solid #8AB50F; margin-top: 2mm; padding-top: 3mm;
                   font-size: 13pt; font-weight: 700; color: #4E6B12; }
  .note { margin-top: 7mm; font-size: 9pt; color: #5A5F58; white-space: pre-wrap; }
  .disclaimer { margin-top: 4mm; font-size: 8.5pt; color: #9AA096; font-style: italic; }
  .signatures { margin-top: 14mm; display: flex; justify-content: space-between;
                font-size: 9pt; break-inside: avoid; }
  .sign { width: 70mm; }
  .sign-line { border-bottom: 1px solid #A6ABA2; height: 8mm; margin-bottom: 1.5mm; }
  .sign-label { color: #71766E; font-size: 8pt; }
  @page { size: A4; margin: 0; }
</style>
</head>
<body>
<div class="sheet">
  <div class="head">
    <div>
      <div class="company">${esc(company.name)}</div>
      <div class="company-meta">
        ${company.inn ? `ИНН ${esc(company.inn)}<br>` : ''}
        ${company.phone ? `${esc(company.phone)}<br>` : ''}
        ${company.address ? esc(company.address) : ''}
      </div>
    </div>
    <div>
      <div class="doc-title">Смета ${esc(estimate.number)}</div>
      <div class="doc-meta">от ${esc(DATE_FORMAT.format(estimate.createdAt))}</div>
    </div>
  </div>

  <div class="facts">
    <div><b>Объект:</b> ${esc(estimate.siteAddress || estimate.title)}</div>
    ${estimate.clientName ? `<div><b>Заказчик:</b> ${esc(estimate.clientName)}</div>` : ''}
    ${estimate.clientPhone ? `<div><b>Телефон:</b> ${esc(estimate.clientPhone)}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 8mm">№</th>
        <th>Наименование</th>
        <th style="width: 18mm">Тип</th>
        <th class="num" style="width: 18mm">Кол-во</th>
        ${
          options.hideBreakdown
            ? ''
            : '<th class="num" style="width: 22mm">Материалы</th><th class="num" style="width: 22mm">Работы</th>'
        }
        <th class="num" style="width: 24mm">Сумма</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="${columns}" style="text-align:center;color:#9AA096">Позиций нет</td></tr>`}
    </tbody>
  </table>

  <div class="totals">
    ${
      options.hideBreakdown
        ? ''
        : `<div><span>Материалы и оборудование</span><span>${money(totals.materials)}</span></div>
           <div><span>Работы</span><span>${money(totals.labor)}</span></div>`
    }
    <div><span>Итого</span><span>${money(totals.subtotal)}</span></div>
    ${
      totals.discount > 0
        ? `<div><span>Скидка ${esc(estimate.discountBp / 100)} %</span><span>−${money(totals.discount)}</span></div>`
        : ''
    }
    ${vat ? `<div><span>${esc(vat)}</span><span>${money(totals.vat)}</span></div>` : ''}
    <div class="grand"><span>К оплате</span><span>${money(totals.grandTotal)} ₽</span></div>
  </div>

  ${estimate.note ? `<div class="note">${esc(estimate.note)}</div>` : ''}
  ${
    options.detail === 'summary'
      ? '<div class="disclaimer">Расчёт предварительный. Точная стоимость определяется после выезда на объект.</div>'
      : ''
  }

  <div class="signatures">
    <div class="sign">
      <div class="sign-line"></div>
      <div class="sign-label">Исполнитель</div>
    </div>
    <div class="sign">
      <div class="sign-line"></div>
      <div class="sign-label">Заказчик</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

function renderPosition(
  position: DocumentPosition,
  index: number,
  totals: EstimateTotals,
  options: RenderOptions,
): string {
  if (!position.isEnabled) return '';

  const positionTotals = totals.positions.find((p) => p.positionId === position.id);
  if (!positionTotals) return '';

  const money = (value: number) => esc(formatMoney(value, { currency: false }));
  const cells = (material: number, labor: number, total: number) =>
    options.hideBreakdown
      ? `<td class="num">${money(total)}</td>`
      : `<td class="num">${money(material)}</td><td class="num">${money(labor)}</td><td class="num">${money(total)}</td>`;

  const header = `
    <tr class="pos-row">
      <td>${index + 1}</td>
      <td>${esc(position.name)}</td>
      <td>${esc(ITEM_KIND_LABELS[position.kind])}</td>
      <td class="num">${esc(formatQty(position.qty, UNIT_LABELS[position.unit]))}</td>
      ${cells(positionTotals.material, positionTotals.labor, positionTotals.total)}
    </tr>`;

  // В свёрнутом виде показываем только позиции: клиенту на месте нужна цена
  // «под ключ», а не перечень распред. коробок.
  if (options.detail === 'summary') return header;

  const lines = position.lines
    .map((line, lineIndex) => {
      if (!line.isEnabled) return '';
      const lineTotals = positionTotals.lines[lineIndex];
      if (!lineTotals) return '';

      return `
    <tr class="sub-row">
      <td></td>
      <td class="name">${esc(line.name)}</td>
      <td>${esc(ITEM_KIND_LABELS[line.kind])}</td>
      <td class="num">${esc(formatQty(line.qty, UNIT_LABELS[line.unit]))}</td>
      ${cells(lineTotals.material, lineTotals.labor, lineTotals.total)}
    </tr>`;
    })
    .join('');

  return header + lines;
}
