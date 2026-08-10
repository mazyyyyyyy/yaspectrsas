import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ActsModule } from './acts/acts.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { DocumentNumberService } from './common/document-number.service.js';
import { EstimatesModule } from './estimates/estimates.module.js';
import { ExportModule } from './export/export.module.js';
import { KitsModule } from './kits/kits.module.js';
import { UsersModule } from './users/users.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { AuthGuard } from './common/guards/auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { PrismaService } from './common/prisma.service.js';
import { loadEnv } from './config/env.js';
import { ENV } from './config/env.token.js';

@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    PrismaService,
    DocumentNumberService,
  ],
  exports: [ENV, PrismaService, DocumentNumberService],
})
class CoreModule {}

@Module({
  imports: [
    CoreModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    KitsModule,
    EstimatesModule,
    ActsModule,
    ExportModule,
  ],
  providers: [
    // Порядок важен: сначала аутентификация (кто это), затем авторизация
    // (что ему можно). RolesGuard рассчитывает на request.user от AuthGuard.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
