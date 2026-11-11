import { Module } from '@nestjs/common';
import { EmpresasController } from './empresas.controller.js';
import { EmpresasService } from './empresas.service.js';
import { PersonalizacionController } from './personalizacion.controller.js';
import { PersonalizacionService } from './personalizacion.service.js';

@Module({
  controllers: [EmpresasController, PersonalizacionController],
  providers: [EmpresasService, PersonalizacionService],
})
export class EmpresasModule {}
