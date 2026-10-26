import { Module } from '@nestjs/common';
import { DatosPersonalesController } from './datos-personales.controller.js';
import { DatosPersonalesService } from './datos-personales.service.js';

@Module({
  controllers: [DatosPersonalesController],
  providers: [DatosPersonalesService],
})
export class DatosPersonalesModule {}
