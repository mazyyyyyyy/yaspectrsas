import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import {
  ITEM_KIND_LABELS,
  UNIT_LABELS,
  computeEstimate,
  formatMoney,
  formatQty,
} from '@yaspectr/core';
import type {
  DocumentCompany,
  DocumentEstimate,
  RenderOptions,
} from './estimate-document.js';

const GREEN = '4E6B12';
const GREY = '71766E';
const HEADER_FILL = 'F1F6E1';

const DATE_FORMAT = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

/**
 * Выгрузка сметы в Word.
 *
 * Требование ТЗ — «чтобы поправить руками, если что-то нестандартное».
 * Поэтому здесь настоящая таблица Word с текстовыми ячейками, а не картинка
 * и не PDF в обёртке: менеджер должен уметь дописать строку и поменять цифру
 * прямо в документе.
 */
@Injectable()
export class DocxService {
  async render(
    estimate: DocumentEstimate,
    company: DocumentCompany,
    options: RenderOptions,
  ): Promise<Buffer> {
    const totals = computeEstimate(estimate);
    const money = (value: number) => formatMoney(value, { currency: false });

    const columns = options.hideBreakdown
      ? ['№', 'Наименование', 'Тип', 'Кол-во', 'Сумма']
      : ['№', 'Наименование', 'Тип', 'Кол-во', 'Материалы', 'Работы', 'Сумма'];

    const rows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: columns.map(
          (title, index) =>
            new TableCell({
              shading: { fill: HEADER_FILL },
              children: [
                new Paragraph({
                  alignment: index >= 3 ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  children: [new TextRun({ text: title, bold: true, size: 18 })],
                }),
              ],
            }),
        ),
      }),
    ];

    estimate.positions.forEach((position, index) => {
      if (!position.isEnabled) return;
      const positionTotals = totals.positions.find((p) => p.positionId === position.id);
      if (!positionTotals) return;

      const amounts = options.hideBreakdown
        ? [money(positionTotals.total)]
        : [
            money(positionTotals.material),
            money(positionTotals.labor),
            money(positionTotals.total),
          ];

      rows.push(
        this.row(
          [
            String(index + 1),
            position.name,
            ITEM_KIND_LABELS[position.kind],
            formatQty(position.qty, UNIT_LABELS[position.unit]),
            ...amounts,
          ],
          { bold: true },
        ),
      );

      if (options.detail === 'summary') return;

      position.lines.forEach((line, lineIndex) => {
        if (!line.isEnabled) return;
        const lineTotals = positionTotals.lines[lineIndex];
        if (!lineTotals) return;

        const lineAmounts = options.hideBreakdown
          ? [money(lineTotals.total)]
          : [money(lineTotals.material), money(lineTotals.labor), money(lineTotals.total)];

        rows.push(
          this.row([
            '',
            `    ${line.name}`,
            ITEM_KIND_LABELS[line.kind],
            formatQty(line.qty, UNIT_LABELS[line.unit]),
            ...lineAmounts,
          ]),
        );
      });
    });

    const totalLines: [string, string][] = [];
    if (!options.hideBreakdown) {
      totalLines.push(['Материалы и оборудование', money(totals.materials)]);
      totalLines.push(['Работы', money(totals.labor)]);
    }
    totalLines.push(['Итого', money(totals.subtotal)]);
    if (totals.discount > 0) {
      totalLines.push([`Скидка ${estimate.discountBp / 100} %`, `−${money(totals.discount)}`]);
    }
    if (estimate.vatMode !== 'NONE') {
      const label =
        estimate.vatMode === 'ADDED'
          ? `НДС ${estimate.vatRateBp / 100} % сверху`
          : `в том числе НДС ${estimate.vatRateBp / 100} %`;
      totalLines.push([label, money(totals.vat)]);
    }

    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: 'Calibri', size: 20 } },
        },
      },
      sections: [
        {
          properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
          children: [
            new Paragraph({
              children: [new TextRun({ text: company.name, bold: true, size: 26 })],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: [
                    company.inn ? `ИНН ${company.inn}` : null,
                    company.phone,
                    company.address,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                  color: GREY,
                  size: 17,
                }),
              ],
              spacing: { after: 240 },
            }),

            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [
                new TextRun({ text: `Смета ${estimate.number}`, bold: true, size: 32, color: GREEN }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `от ${DATE_FORMAT.format(estimate.createdAt)}`,
                  color: GREY,
                  size: 17,
                }),
              ],
              spacing: { after: 240 },
            }),

            ...this.facts(estimate),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows,
            }),

            new Paragraph({ text: '', spacing: { after: 240 } }),

            ...totalLines.map(
              ([label, value]) =>
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: `${label}:  ${value}`, size: 19 })],
                }),
            ),
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 120, after: 360 },
              children: [
                new TextRun({
                  text: `К оплате:  ${money(totals.grandTotal)} ₽`,
                  bold: true,
                  size: 26,
                  color: GREEN,
                }),
              ],
            }),

            ...(estimate.note
              ? [new Paragraph({ children: [new TextRun({ text: estimate.note, size: 19 })] })]
              : []),
            ...(options.detail === 'summary'
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Расчёт предварительный. Точная стоимость определяется после выезда на объект.',
                        italics: true,
                        color: GREY,
                        size: 17,
                      }),
                    ],
                  }),
                ]
              : []),

            new Paragraph({ text: '', spacing: { before: 720 } }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              },
              rows: [
                new TableRow({
                  children: ['Исполнитель', 'Заказчик'].map(
                    (label) =>
                      new TableCell({
                        children: [
                          new Paragraph({ text: '____________________________' }),
                          new Paragraph({
                            children: [new TextRun({ text: label, color: GREY, size: 17 })],
                          }),
                        ],
                      }),
                  ),
                }),
              ],
            }),
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  private facts(estimate: DocumentEstimate): Paragraph[] {
    const facts: [string, string | null][] = [
      ['Объект', estimate.siteAddress || estimate.title],
      ['Заказчик', estimate.clientName],
      ['Телефон', estimate.clientPhone],
    ];

    return facts
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .map(
        ([label, value]) =>
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: `${label}: `, bold: true, size: 19 }),
              new TextRun({ text: value, size: 19 }),
            ],
          }),
      )
      .concat(new Paragraph({ text: '', spacing: { after: 180 } }));
  }

  private row(cells: string[], options: { bold?: boolean } = {}): TableRow {
    return new TableRow({
      children: cells.map(
        (text, index) =>
          new TableCell({
            children: [
              new Paragraph({
                alignment: index >= 3 ? AlignmentType.RIGHT : AlignmentType.LEFT,
                children: [new TextRun({ text, bold: options.bold, size: 18 })],
              }),
            ],
          }),
      ),
    });
  }
}
