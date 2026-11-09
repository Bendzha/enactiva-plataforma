import { Module } from '@nestjs/common';
import { IdentityCliente } from '../../identity.cliente.js';
import { AsistenciaService } from './asistencia.service.js';
import { ReferenciasService } from './referencias.service.js';
import { ValoracionController } from './valoracion.controller.js';
import { ValoracionInternoController } from './valoracion-interno.controller.js';
import { ValoracionService } from './valoracion.service.js';

@Module({
  controllers: [ValoracionController, ValoracionInternoController],
  providers: [ValoracionService, ReferenciasService, AsistenciaService, IdentityCliente],
})
export class ValoracionModule {}
