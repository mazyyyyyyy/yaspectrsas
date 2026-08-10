import { Module } from '@nestjs/common';
import { EstimatesController } from './estimates.controller.js';
import { EstimatesService } from './estimates.service.js';

@Module({
  controllers: [EstimatesController],
  providers: [EstimatesService],
  exports: [EstimatesService],
})
export class EstimatesModule {}
