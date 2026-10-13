import { Module } from '@nestjs/common';
import { IdentityCliente } from '../../identity.cliente.js';
import { DisponibilidadService } from './disponibilidad.service.js';
import { TalleresController } from './talleres.controller.js';
import { TalleresService } from './talleres.service.js';

@Module({
  controllers: [TalleresController],
  providers: [TalleresService, DisponibilidadService, IdentityCliente],
})
export class TalleresModule {}
