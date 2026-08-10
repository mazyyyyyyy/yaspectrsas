import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Role } from '@prisma/client';
import {
  catalogCategorySchema,
  catalogItemInputSchema,
  catalogItemPatchSchema,
  paginationSchema,
  type CatalogItemInput,
  type PaginationInput,
} from '@yaspectr/core';
import { CompanyId, CurrentUser, RequirePermissions } from '../common/decorators.js';
import { zodBody } from '../common/zod-validation.pipe.js';
import { CatalogService } from './catalog.service.js';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('items')
  @RequirePermissions('catalog:read')
  list(
    @CompanyId() companyId: string,
    @CurrentUser('role') role: Role,
    @Query(zodBody(paginationSchema)) query: PaginationInput,
  ) {
    return this.catalog.list(companyId, role, query);
  }

  @Get('items/:id')
  @RequirePermissions('catalog:read')
  get(
    @CompanyId() companyId: string,
    @CurrentUser('role') role: Role,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalog.get(companyId, role, id);
  }

  @Post('items')
  @RequirePermissions('catalog:write')
  create(
    @CompanyId() companyId: string,
    @Body(zodBody(catalogItemInputSchema)) input: CatalogItemInput,
  ) {
    return this.catalog.create(companyId, input);
  }

  @Patch('items/:id')
  @RequirePermissions('catalog:write')
  update(
    @CompanyId() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(catalogItemPatchSchema)) patch: Partial<CatalogItemInput>,
  ) {
    return this.catalog.update(companyId, id, patch);
  }

  /** DELETE переводит позицию в архив — см. комментарий в CatalogService.archive. */
  @Delete('items/:id')
  @RequirePermissions('catalog:write')
  archive(@CompanyId() companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.archive(companyId, id);
  }

  @Get('categories')
  @RequirePermissions('catalog:read')
  listCategories(@CompanyId() companyId: string) {
    return this.catalog.listCategories(companyId);
  }

  @Post('categories')
  @RequirePermissions('catalog:write')
  createCategory(
    @CompanyId() companyId: string,
    @Body(zodBody(catalogCategorySchema)) input: { name: string; sortOrder: number },
  ) {
    return this.catalog.createCategory(companyId, input);
  }
}
