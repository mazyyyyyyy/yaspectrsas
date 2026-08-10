import { Module } from '@nestjs/common';
import { DocxService } from './docx.service.js';
import { ExportController } from './export.controller.js';
import { PdfService } from './pdf.service.js';

@Module({
  controllers: [ExportController],
  providers: [PdfService, DocxService],
  exports: [PdfService, DocxService],
})
export class ExportModule {}
