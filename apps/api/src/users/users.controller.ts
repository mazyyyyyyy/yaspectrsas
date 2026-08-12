import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { createUserSchema, zEmail, zPassword, type CreateUserInput } from '@yaspectr/core';
import { z } from 'zod';
import { CompanyId, CurrentUser, RequirePermissions } from '../common/decorators.js';
import { zodBody } from '../common/zod-validation.pipe.js';
import { UsersService } from './users.service.js';

const userPatchSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    email: zEmail.optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    role: z.nativeEnum(Role).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const resetPasswordSchema = z.object({ newPassword: zPassword }).strict();

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('user:read')
  list(@CompanyId() companyId: string) {
    return this.users.list(companyId);
  }

  @Post()
  @RequirePermissions('user:write')
  create(@CompanyId() companyId: string, @Body(zodBody(createUserSchema)) input: CreateUserInput) {
    return this.users.create(companyId, input);
  }

  @Patch(':id')
  @RequirePermissions('user:write')
  update(
    @CompanyId() companyId: string,
    @CurrentUser('id') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(userPatchSchema)) patch: z.infer<typeof userPatchSchema>,
  ) {
    return this.users.update(companyId, actorId, id, patch);
  }

  @Post(':id/reset-password')
  @HttpCode(204)
  @RequirePermissions('user:write')
  resetPassword(
    @CompanyId() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(resetPasswordSchema)) input: { newPassword: string },
  ) {
    return this.users.resetPassword(companyId, id, input.newPassword);
  }
}
