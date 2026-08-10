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
import type { Role } from '@prisma/client';
import {
  createActFromEstimateSchema,
  paginationSchema,
  toggleActItemSchema,
  workActInputSchema,
  type CreateActFromEstimateInput,
  type PaginationInput,
  type ToggleActItemInput,
  type WorkActInput,
} from '@yaspectr/core';
import { CompanyId, CurrentUser, RequirePermissions } from '../common/decorators.js';
import { zodBody } from '../common/zod-validation.pipe.js';
import { ActsService } from './acts.service.js';

@Controller('acts')
export class ActsController {
  constructor(private readonly acts: ActsService) {}

  @Get()
  @RequirePermissions('act:read')
  list(
    @CompanyId() companyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Query(zodBody(paginationSchema)) query: PaginationInput,
  ) {
    return this.acts.list(companyId, userId, role, query);
  }

  @Get(':id')
  @RequirePermissions('act:read')
  get(
    @CompanyId() companyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.acts.get(companyId, userId, role, id);
  }

  /** Собрать чек-лист из готовой сметы. */
  @Post('from-estimate')
  @RequirePermissions('act:write')
  createFromEstimate(
    @CompanyId() companyId: string,
    @Body(zodBody(createActFromEstimateSchema)) input: CreateActFromEstimateInput,
  ) {
    return this.acts.createFromEstimate(companyId, input);
  }

  @Post()
  @RequirePermissions('act:write')
  create(@CompanyId() companyId: string, @Body(zodBody(workActInputSchema)) input: WorkActInput) {
    return this.acts.create(companyId, input);
  }

  /** Галочки «выполнено» и «проверено». */
  @Patch(':id/items/:itemId')
  @RequirePermissions('act:write')
  toggleItem(
    @CompanyId() companyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body(zodBody(toggleActItemSchema)) patch: ToggleActItemInput,
  ) {
    return this.acts.toggleItem(companyId, userId, role, id, itemId, patch);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('estimate:delete')
  remove(@CompanyId() companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.acts.remove(companyId, id);
  }
}
