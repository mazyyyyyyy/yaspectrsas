import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';

/**
 * Global: AuthGuard регистрируется глобально и должен видеть SessionService
 * без импорта модуля в каждый feature-модуль.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionService],
  exports: [AuthService, PasswordService, SessionService],
})
export class AuthModule {}
