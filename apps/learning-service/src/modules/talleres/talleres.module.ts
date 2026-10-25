import { Module } from '@nestjs/common';
import { IdentityCliente } from '../../identity.cliente.js';
import { DisponibilidadService } from './disponibilidad.service.js';
import { TalleresController } from './talleres.controller.js';
import { TalleresInternoController } from './talleres-interno.controller.js';
import { TalleresService } from './talleres.service.js';

@Module({
  controllers: [TalleresController, TalleresInternoController],
  providers: [TalleresService, DisponibilidadService, IdentityCliente],
})
export class TalleresModule {}
