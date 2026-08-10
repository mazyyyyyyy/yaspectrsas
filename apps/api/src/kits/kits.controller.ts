import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  kitTemplateInputSchema,
  kitTemplatePatchSchema,
  type KitTemplateInput,
  type KitTemplatePatch,
} from '@yaspectr/core';
import { CompanyId, RequirePermissions } from '../common/decorators.js';
import { zodBody } from '../common/zod-validation.pipe.js';
import { KitsService } from './kits.service.js';

@Controller('kits')
export class KitsController {
  constructor(private readonly kits: KitsService) {}

  @Get()
  @RequirePermissions('kit:read')
  list(@CompanyId() companyId: string) {
    return this.kits.list(companyId);
  }

  @Get(':id')
  @RequirePermissions('kit:read')
  get(@CompanyId() companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.kits.get(companyId, id);
  }

  @Post()
  @RequirePermissions('kit:write')
  create(
    @CompanyId() companyId: string,
    @Body(zodBody(kitTemplateInputSchema)) input: KitTemplateInput,
  ) {
    return this.kits.create(companyId, input);
  }

  @Patch(':id')
  @RequirePermissions('kit:write')
  update(
    @CompanyId() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(kitTemplatePatchSchema)) patch: KitTemplatePatch,
  ) {
    return this.kits.update(companyId, id, patch);
  }

  @Delete(':id')
  @RequirePermissions('kit:write')
  archive(@CompanyId() companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.kits.archive(companyId, id);
  }
}
