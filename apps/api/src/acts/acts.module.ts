import { Module } from '@nestjs/common';
import { ActsController } from './acts.controller.js';
import { ActsService } from './acts.service.js';

@Module({
  controllers: [ActsController],
  providers: [ActsService],
  exports: [ActsService],
})
export class ActsModule {}
