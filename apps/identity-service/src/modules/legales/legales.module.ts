import { Module } from '@nestjs/common';
import { LegalesController } from './legales.controller.js';
import { LegalesService } from './legales.service.js';

@Module({
  controllers: [LegalesController],
  providers: [LegalesService],
})
export class LegalesModule {}
