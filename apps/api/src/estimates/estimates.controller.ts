import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { EstimateStatus } from '@prisma/client';
import {
  addPositionSchema,
  estimateInputSchema,
  estimateLineInputSchema,
  estimatePatchSchema,
  estimateStatusPatchSchema,
  paginationSchema,
  resyncPositionSchema,
  type AddPositionInput,
  type EstimateInput,
  type EstimateLineInput,
  type PaginationInput,
} from '@yaspectr/core';
import { CompanyId, CurrentUser, RequirePermissions } from '../common/decorators.js';
import { zodBody } from '../common/zod-validation.pipe.js';
import { EstimatesService } from './estimates.service.js';

/** Правка строки — подмножество полей строки; id и связи менять нельзя. */
const linePatchSchema = estimateLineInputSchema
  .pick({
    name: true,
    qty: true,
    unitMaterialPrice: true,
    unitLaborPrice: true,
    isEnabled: true,
    note: true,
  })
  .partial()
  .strict();

@Controller('estimates')
export class EstimatesController {
  constructor(private readonly estimates: EstimatesService) {}

  @Get()
  @RequirePermissions('estimate:read')
  list(
    @CompanyId() companyId: string,
    @Query(zodBody(paginationSchema)) query: PaginationInput,
  ) {
    return this.estimates.list(companyId, query);
  }

  @Get(':id')
  @RequirePermissions('estimate:read')
  get(@CompanyId() companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.estimates.get(companyId, id);
  }

  @Post()
  @RequirePermissions('estimate:write')
  create(
    @CompanyId() companyId: string,
    @CurrentUser('id') userId: string,
    @Body(zodBody(estimateInputSchema)) input: EstimateInput,
  ) {
    return this.estimates.create(companyId, userId, input);
  }

  @Patch(':id')
  @RequirePermissions('estimate:write')
  update(
    @CompanyId() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(estimatePatchSchema)) patch: Partial<EstimateInput>,
  ) {
    return this.estimates.updateHeader(companyId, id, patch);
  }

  /** Добавить позицию из справочника с автоматическим разворотом комплекта. */
  @Post(':id/positions')
  @RequirePermissions('estimate:write')
  addPosition(
    @CompanyId() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(addPositionSchema)) input: AddPositionInput,
  ) {
    return this.estimates.addPosition(companyId, id, input);
  }

  /** Сменить количество базовых позиций и пересчитать комплект. */
  @Patch(':id/positions/:positionId')
  @RequirePermissions('estimate:write')
  updatePosition(
    @CompanyId() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('positionId', ParseUUIDPipe) positionId: string,
    @Body(zodBody(resyncPositionSchema)) input: { qty: number },
  ) {
    return this.estimates.updatePositionQty(companyId, id, positionId, input.qty);
  }

  @Delete(':id/positions/:positionId')
  @RequirePermissions('estimate:write')
  removePosition(
    @CompanyId() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('positionId', ParseUUIDPipe) positionId: string,
  ) {
    return this.estimates.removePosition(companyId, id, positionId);
  }

  @Patch(':id/lines/:lineId')
  @RequirePermissions('estimate:write')
  updateLine(
    @CompanyId() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body(zodBody(linePatchSchema)) patch: Partial<EstimateLineInput>,
  ) {
    return this.estimates.updateLine(companyId, id, lineId, patch);
  }

  /** Обновить снимок цен по актуальному справочнику. */
  @Post(':id/reprice')
  @RequirePermissions('estimate:write')
  reprice(@CompanyId() companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.estimates.reprice(companyId, id);
  }

  @Patch(':id/status')
  @RequirePermissions('estimate:write')
  setStatus(
    @CompanyId() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(estimateStatusPatchSchema)) input: { status: EstimateStatus },
  ) {
    return this.estimates.setStatus(companyId, id, input.status);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('estimate:delete')
  remove(@CompanyId() companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.estimates.remove(companyId, id);
  }
}
