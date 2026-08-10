import { Module } from '@nestjs/common';
import { KitsController } from './kits.controller.js';
import { KitsService } from './kits.service.js';

@Module({
  controllers: [KitsController],
  providers: [KitsService],
  exports: [KitsService],
})
export class KitsModule {}
