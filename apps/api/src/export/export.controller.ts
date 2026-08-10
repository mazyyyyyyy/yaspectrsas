import { Controller, Get, Header, NotFoundException, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { exportEstimateSchema, type ExportEstimateInput } from '@yaspectr/core';
import { CompanyId, RequirePermissions } from '../common/decorators.js';
import { PrismaService } from '../common/prisma.service.js';
import { zodBody } from '../common/zod-validation.pipe.js';
import { DocxService } from './docx.service.js';
import { renderEstimateHtml, type DocumentEstimate } from './estimate-document.js';
import { PdfService } from './pdf.service.js';

@Controller('estimates/:id/export')
export class ExportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly docx: DocxService,
  ) {}

  @Get()
  @RequirePermissions('estimate:read')
  @Header('Cache-Control', 'no-store')
  async export(
    @CompanyId() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodBody(exportEstimateSchema)) query: ExportEstimateInput,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { estimate, company } = await this.load(companyId, id);
    const options = { detail: query.detail, hideBreakdown: query.hideBreakdown };

    const body =
      query.format === 'pdf'
        ? await this.pdf.render(renderEstimateHtml(estimate, company, options))
        : await this.docx.render(estimate, company, options);

    const contentType =
      query.format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    reply
      .header('Content-Type', contentType)
      .header('Content-Disposition', contentDisposition(estimate.number, query.format))
      .send(body);
  }

  private async load(companyId: string, id: string) {
    const result = await this.prisma.runAsTenant(companyId, async (tx) => {
      const estimate = await tx.estimate.findFirst({
        where: { id, companyId },
        include: {
          positions: {
            orderBy: { sortOrder: 'asc' },
            include: { lines: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      });
      if (!estimate) return null;

      const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
      return { estimate, company };
    });

    if (!result) throw new NotFoundException('Смета не найдена');

    const estimate: DocumentEstimate = {
      number: result.estimate.number,
      title: result.estimate.title,
      clientName: result.estimate.clientName,
      clientPhone: result.estimate.clientPhone,
      siteAddress: result.estimate.siteAddress,
      note: result.estimate.note,
      discountBp: result.estimate.discountBp,
      vatMode: result.estimate.vatMode,
      vatRateBp: result.estimate.vatRateBp,
      createdAt: result.estimate.createdAt,
      positions: result.estimate.positions,
    };

    return {
      estimate,
      company: {
        name: result.company.name,
        inn: result.company.inn,
        phone: result.company.phone,
        address: result.company.address,
      },
    };
  }
}

/**
 * Имя файла для скачивания.
 *
 * Номер документа содержит кириллицу («СМ-2026-0001»), которую нельзя класть
 * в обычный filename — по RFC 6266 там допустим только US-ASCII, и браузер
 * получит мусор. Поэтому даём ASCII-запасной вариант плюс filename* в UTF-8.
 * Управляющие символы и кавычки вырезаем: имя файла попадает в заголовок,
 * и перевод строки в нём — это подмена HTTP-заголовков.
 */
function contentDisposition(number: string, format: string): string {
  const safe = number.replace(/[^\p{L}\p{N}._-]/gu, '_');
  const ascii = safe.replace(/[^\x20-\x7E]/g, '_');

  return `attachment; filename="smeta_${ascii}.${format}"; filename*=UTF-8''${encodeURIComponent(`Смета_${safe}.${format}`)}`;
}
